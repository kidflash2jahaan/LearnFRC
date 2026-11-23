#!/bin/bash
# App Store screenshots, headless: iPhone 6.9" (1320 x 2868) and iPad 13" (2064 x 2752).
#
#   apple/scripts/app-store-screenshots.sh [iphone|ipad|all] [out folder]
#
# Builds the Debug app for the simulator, boots each simulator without opening Simulator.app,
# sets a clean status bar (9:41, full battery, full signal), then launches the app once per
# screen with the debug-only -LFShot* launch arguments (LearnFRC/Core/Preview/ScreenshotScript.swift)
# and saves `simctl io screenshot`. Every shot is a guest reading the live catalog: no account,
# no other people. SKIP_BUILD=1 reuses the last build. Look at every PNG before uploading.
set -euo pipefail

WHICH=${1:-all}
APPLE=$(cd "$(dirname "$0")/.." && pwd)
OUT=${2:-$APPLE/.build/screenshots}
DD=$APPLE/.build/dd
APP=$DD/Build/Products/Debug-iphonesimulator/LearnFRC.app
BUNDLE=com.learnfrc.app
# background priority, so the Mac stays usable
LOW=(taskpolicy -b nice -n 20)

LESSON=learnfrc://guides/mechanical-build/drivetrains/swerve-drive
TOOL=learnfrc://tools/frc-gear-ratio-calculator

# file name | launch arguments (no spaces inside one argument)
IPHONE_SHOTS=(
  "01-home|"
  "02-guides|-LFShotLink learnfrc://guides"
  "03-lesson|-LFShotLink $LESSON -LFShotScroll what-it-is"
  "04-quiz|-LFShotLink $LESSON -LFShotScroll lesson-quiz -LFShotQuiz 2,3"
  "05-gear-ratio|-LFShotLink $TOOL -LFShotScroll tool-field-wheel@0.6"
  "06-glossary|-LFShotLink learnfrc://glossary"
)
IPAD_SHOTS=(
  "01-home|"
  "02-guides|-LFShotLink learnfrc://guides"
  "03-lesson|-LFShotLink $LESSON"
  "04-quiz|-LFShotLink $LESSON -LFShotScroll lesson-quiz -LFShotQuiz 2,3"
  "05-gear-ratio|-LFShotLink $TOOL -LFShotScroll tool-field-wheel@0.46"
  "06-glossary|-LFShotLink learnfrc://glossary"
)

# simulator id by device name, on the oldest iOS that has it (iPadOS 27 adds the app's name
# to the status bar and ignores the date override)
udid_for() {
  xcrun simctl list devices available -j | python3 -c '
import json, re, sys
name = sys.argv[1]
version = lambda runtime: [int(n) for n in re.findall(r"\d+", runtime.split(".")[-1])]
for runtime, devices in sorted(json.load(sys.stdin)["devices"].items(), key=lambda item: version(item[0])):
    for d in devices:
        if d["name"] == name:
            print(d["udid"]); sys.exit()
sys.exit("no simulator named " + name)' "$1"
}

# 9:41 local, as the UTC timestamp simctl wants (the iPad also shows the date)
STATUS_TIME=$(date -u -r "$(date -j -f "%Y-%m-%d %H:%M:%S" "2026-09-08 09:41:00" +%s)" +%Y-%m-%dT%H:%M:%S.000Z)

# build the Debug app once
build() {
  local udid=$1
  local packages=()
  [ -d "$APPLE/.build/packages" ] && packages=(-clonedSourcePackagesDirPath "$APPLE/.build/packages" -disableAutomaticPackageResolution)
  echo "Building (log: $APPLE/.build/screenshots-build.log)"
  (cd "$APPLE" && "${LOW[@]}" xcodebuild build -project LearnFRC.xcodeproj -scheme LearnFRC -configuration Debug \
    -destination "platform=iOS Simulator,id=$udid" -derivedDataPath "$DD" ${packages[@]+"${packages[@]}"} \
    -skipMacroValidation -skipPackagePluginValidation > "$APPLE/.build/screenshots-build.log" 2>&1) \
    || { echo "Build failed, see the log"; exit 1; }
}

# one device: boot, status bar, fresh install, every shot, shut down
shoot() {
  local device=$1 name=$2 width=$3 height=$4; shift 4
  local udid; udid=$(udid_for "$name")
  local dir=$OUT/$device
  mkdir -p "$dir"
  echo "$name ($udid) -> $dir"

  local booted=no state
  state=$(xcrun simctl list devices | grep "$udid" || true)
  if [[ $state != *Booted* ]]; then
    "${LOW[@]}" xcrun simctl boot "$udid"; booted=yes
  fi
  xcrun simctl bootstatus "$udid" -b > /dev/null
  if [ "$device" = iphone ]; then
    xcrun simctl status_bar "$udid" override --time "$STATUS_TIME" --dataNetwork wifi --wifiMode active --wifiBars 3 \
      --cellularMode active --cellularBars 4 --batteryState discharging --batteryLevel 100 --operatorName ""
  else
    xcrun simctl status_bar "$udid" override --time "$STATUS_TIME" --dataNetwork wifi --wifiMode active --wifiBars 3 \
      --batteryState discharging --batteryLevel 100
  fi

  # a fresh guest, then one launch to fill the catalog cache
  xcrun simctl uninstall "$udid" "$BUNDLE" > /dev/null 2>&1 || true
  "${LOW[@]}" xcrun simctl install "$udid" "$APP"
  xcrun simctl launch "$udid" "$BUNDLE" > /dev/null
  sleep 20

  local shot file args data
  for shot in "$@"; do
    file=${shot%%|*}
    args=${shot#*|}
    xcrun simctl terminate "$udid" "$BUNDLE" > /dev/null 2>&1 || true
    # forget the last window's tabs and screens
    data=$(xcrun simctl get_app_container "$udid" "$BUNDLE" data)
    rm -rf "$data/Library/Saved Application State"
    # shellcheck disable=SC2086
    xcrun simctl launch "$udid" "$BUNDLE" $args > /dev/null
    sleep 10
    xcrun simctl io "$udid" screenshot "$dir/$file.png" > /dev/null 2>&1
    local size; size=$(sips -g pixelWidth -g pixelHeight "$dir/$file.png" | awk '/pixel/ {print $2}' | paste -sd x -)
    [ "$size" = "${width}x$height" ] && echo "  $file.png $size" || echo "  $file.png $size (expected ${width}x$height)"
  done

  xcrun simctl terminate "$udid" "$BUNDLE" > /dev/null 2>&1 || true
  xcrun simctl status_bar "$udid" clear
  [ "$booted" = yes ] && xcrun simctl shutdown "$udid"
  return 0
}

IPHONE="iPhone 17 Pro Max"
IPAD="iPad Pro 13-inch (M5)"
[ "${SKIP_BUILD:-0}" = 1 ] || build "$(udid_for "$IPHONE")"
case $WHICH in
  iphone) shoot iphone "$IPHONE" 1320 2868 "${IPHONE_SHOTS[@]}" ;;
  ipad) shoot ipad "$IPAD" 2064 2752 "${IPAD_SHOTS[@]}" ;;
  all)
    shoot iphone "$IPHONE" 1320 2868 "${IPHONE_SHOTS[@]}"
    shoot ipad "$IPAD" 2064 2752 "${IPAD_SHOTS[@]}"
    ;;
  *) echo "usage: $0 [iphone|ipad|all] [out folder]"; exit 2 ;;
esac
