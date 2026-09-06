import type { MetadataRoute } from "next";

/**
 * Installed, the site is still the binder. `background_color` is the newsprint
 * ground and `theme_color` matches the `themeColor` viewport export in the root
 * layout, so the splash screen, the Android status bar and the page edge are
 * all the same paper. They used to be `#060912`, a near-black left over from a
 * design two rebuilds ago, which meant launching the app flashed black before a
 * light page faded in.
 *
 * The installed app's name now matches the root layout's `metadata.title`
 * default character for character, which it did not before: the two disagreed
 * on both the wording and the dash, so a home-screen icon and a browser tab
 * showed the site under two different names.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LearnFRC, every job on an FRC team, written down",
    short_name: "LearnFRC",
    description:
      "The complete, structured guide to mastering every department of the FIRST Robotics Competition.",
    start_url: "/",
    display: "standalone",
    background_color: "#E6E8E3",
    theme_color: "#E6E8E3",
    categories: ["education", "productivity"],
  };
}
