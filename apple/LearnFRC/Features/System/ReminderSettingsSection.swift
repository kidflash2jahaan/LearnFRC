import SwiftUI

/// The on-device reminder settings, as a `Form` section: a switch, the time, the days and one
/// honest line about what happens next. Drop it into Settings:
///
///     Form {
///         ...
///         ReminderSettingsSection()
///     }
///
/// Turning it on asks for notification permission the first time. If notifications are off
/// for LearnFRC, the section says so and links to the system setting.
struct ReminderSettingsSection: View {
    @Bindable private var scheduler: ReminderScheduler
    @Environment(\.openURL) private var openURL
    @Environment(\.scenePhase) private var scenePhase

    init(scheduler: ReminderScheduler = .shared) {
        self.scheduler = scheduler
    }

    private var isOn: Binding<Bool> {
        Binding(
            get: { scheduler.isEnabled },
            set: { on in Task { await scheduler.setEnabled(on) } }
        )
    }

    var body: some View {
        Section {
            Toggle(isOn: isOn) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Study reminders")
                    Text("A note about your next lesson, once a day at most.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .disabled(scheduler.isWorking)
            .accessibilityHint("Sends a notification from this device at the time you pick.")

            if scheduler.isEnabled {
                DatePicker("Time", selection: $scheduler.time, displayedComponents: .hourAndMinute)

                LabeledContent("Days") {
                    daysMenu
                }

                if let status = scheduler.statusLine, scheduler.permission != .denied {
                    Label(status, systemImage: scheduler.hasNothingToRemind ? "checkmark.circle" : "bell")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .accessibilityLabel(status)
                }
            }

            if scheduler.permission == .denied {
                deniedRow
            }
        } header: {
            Text("Reminders on this device")
        } footer: {
            Text(ReminderScheduler.footnote)
        }
        .task {
            await scheduler.refreshPermission()
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task { await scheduler.refreshPermission() }
        }
    }

    private var daysMenu: some View {
        Menu {
            Section {
                presetButton("Every day", days: ReminderScheduler.everyDay)
                presetButton("Weekdays", days: ReminderScheduler.weekdaysOnly)
                presetButton("Weekends", days: ReminderScheduler.weekendsOnly)
            }
            Section("Pick days") {
                ForEach(scheduler.orderedWeekdays, id: \.self) { day in
                    Toggle(Self.dayName(day), isOn: Binding(
                        get: { scheduler.weekdays.contains(day) },
                        set: { _ in scheduler.toggleWeekday(day) }
                    ))
                    // The last day can't be unticked; switch reminders off instead.
                    .disabled(scheduler.weekdays == [day])
                }
            }
            #if os(iOS)
            // Ticking several days shouldn't close the menu each time (Mac menus can't stay open).
            .menuActionDismissBehavior(.disabled)
            #endif
        } label: {
            Text(scheduler.daysSummary)
                .multilineTextAlignment(.trailing)
        }
        .accessibilityLabel("Days")
        .accessibilityValue(scheduler.daysSummary)
    }

    private func presetButton(_ title: String, days: Set<Int>) -> some View {
        Button {
            scheduler.setWeekdays(days)
        } label: {
            if scheduler.weekdays == days {
                Label(title, systemImage: "checkmark")
            } else {
                Text(title)
            }
        }
    }

    private var deniedRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Notifications are off for LearnFRC, so reminders can't arrive. You can turn them on in Settings.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            if let url = ReminderScheduler.systemSettingsURL {
                Button("Open Notification Settings") { openURL(url) }
                    .font(.footnote.weight(.semibold))
            }
        }
        .padding(.vertical, 2)
    }

    static func dayName(_ weekday: Int) -> String {
        let symbols = Calendar.current.weekdaySymbols
        return (1...7).contains(weekday) ? symbols[weekday - 1] : ""
    }
}

// MARK: - Previews

#if DEBUG
extension ReminderScheduler {
    /// A scheduler that never touches the real notification center or the app's defaults.
    static func preview(
        enabled: Bool,
        permission: ReminderPermission = .allowed,
        hour: Int = 19,
        minute: Int = 0,
        weekdays: Set<Int> = ReminderScheduler.everyDay,
        model: AppModel = .preview
    ) -> ReminderScheduler {
        let defaults = UserDefaults(suiteName: "preview.reminders.\(enabled).\(permission.rawValue).\(weekdays.sorted())") ?? .standard
        defaults.set(enabled, forKey: "reminders.enabled")
        defaults.set(hour, forKey: "reminders.hour")
        defaults.set(minute, forKey: "reminders.minute")
        defaults.set(weekdays.sorted(), forKey: "reminders.weekdays")
        let scheduler = ReminderScheduler(client: .preview(permission), defaults: defaults)
        scheduler.attach(model)
        return scheduler
    }
}

private struct ReminderSettingsPreview: View {
    let on: ReminderScheduler
    let off: ReminderScheduler
    let teamDays: ReminderScheduler
    let denied: ReminderScheduler

    init() {
        on = .preview(enabled: true)
        off = .preview(enabled: false)
        teamDays = .preview(enabled: true, hour: 18, minute: 30, weekdays: [3, 5, 7])
        denied = .preview(enabled: false, permission: .denied)
    }

    var body: some View {
        NavigationStack {
            Form {
                ReminderSettingsSection(scheduler: on)
                ReminderSettingsSection(scheduler: teamDays)
                ReminderSettingsSection(scheduler: off)
                ReminderSettingsSection(scheduler: denied)
            }
            .formStyle(.grouped)
            .navigationTitle("Settings")
            .task {
                await on.reschedule()
                await teamDays.reschedule()
            }
        }
        .tint(LF.Palette.blue)
    }
}

#Preview("Reminders, iPhone light", traits: .fixedLayout(width: 393, height: 1400)) {
    ReminderSettingsPreview()
}

#Preview("Reminders, iPhone dark", traits: .fixedLayout(width: 393, height: 1400)) {
    ReminderSettingsPreview()
        .environment(\.colorScheme, .dark)
}

#Preview("Reminders, iPad light", traits: .fixedLayout(width: 820, height: 1180)) {
    ReminderSettingsPreview()
}

#Preview("Reminders, iPad dark", traits: .fixedLayout(width: 820, height: 1180)) {
    ReminderSettingsPreview()
        .environment(\.colorScheme, .dark)
}
#endif
