/**
 * The 60-second tour on the LearnFRC YouTube channel. Kept out of the client
 * component so server components can read the plain strings: an export from a
 * "use client" module reaches a server component as a client reference, not as
 * its value.
 */
export const TOUR_VIDEO_ID = "-QlRttoFw3g";
export const TOUR_VIDEO_URL = `https://www.youtube.com/watch?v=${TOUR_VIDEO_ID}`;
