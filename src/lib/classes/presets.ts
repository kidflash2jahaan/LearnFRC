/**
 * The three RealtimeKit presets (section 6.3), defined once and pushed by
 * scripts/classes/setup-realtimekit.mjs. Field names and enums are from
 * Cloudflare's Create Preset reference (POST /presets). Every permission is
 * set explicitly, so a Cloudflare default can never open something up.
 *
 * - Students can't produce video at all (NOT_ALLOWED, not CAN_REQUEST, which
 *   would let a teacher pressure a student to turn a camera on). They can
 *   unmute to ask questions.
 * - RealtimeKit's own chat is off for everyone, public and private: a message
 *   sent through it reaches the room before any server can check it. Everyone
 *   chats in LearnFRC's filtered panel instead (src/lib/classes/chat-filter.ts).
 * - Polls, plugins, breakout rooms (connected meetings), recording controls,
 *   livestreaming and display-name edits are off for everyone. The recording
 *   runs from the meeting config (record_on_start), not from a person.
 * - Nobody can kick from the client: removals go through the server
 *   (removeFromClass), so they stick.
 * - Staff are never hidden: everyone can see when Jahaan or Dhiren drops in.
 *
 * The UI Kit's chat button is hidden by the room page (the Foundation's
 * spike, 6.10 check 3, records which setting does it).
 *
 * Pure data, no imports, so the setup script (plain Node) imports it too.
 */

export type MediaPermission = "ALLOWED" | "NOT_ALLOWED" | "CAN_REQUEST";

export type RtkPreset = {
  name: string;
  config: {
    view_type: "GROUP_CALL" | "WEBINAR" | "AUDIO_ROOM" | "LIVESTREAM";
    max_video_streams: { desktop: number; mobile: number };
    max_screenshare_count: number;
    media: {
      video: { quality: "hd" | "vga" | "qvga" | "fhd" | "uhd"; frame_rate: number };
      screenshare: { quality: "hd" | "vga" | "qvga" | "fhd" | "uhd"; frame_rate: number };
      audio?: { enable_high_bitrate?: boolean; enable_stereo?: boolean };
    };
  };
  permissions: {
    accept_waiting_requests: boolean;
    can_accept_production_requests: boolean;
    can_change_participant_permissions: boolean;
    can_edit_display_name: boolean;
    can_livestream: boolean;
    can_record: boolean;
    can_spotlight: boolean;
    chat: {
      private: { can_send: boolean; can_receive: boolean; text: boolean; files: boolean };
      public: { can_send: boolean; text: boolean; files: boolean };
    };
    connected_meetings: {
      can_alter_connected_meetings: boolean;
      can_switch_connected_meetings: boolean;
      can_switch_to_parent_meeting: boolean;
    };
    disable_participant_audio: boolean;
    disable_participant_screensharing: boolean;
    disable_participant_video: boolean;
    hidden_participant: boolean;
    kick_participant: boolean;
    media: {
      audio: { can_produce: MediaPermission };
      video: { can_produce: MediaPermission };
      screenshare: { can_produce: MediaPermission };
    };
    pin_participant: boolean;
    plugins: { can_start: boolean; can_close: boolean; can_edit_config: boolean; config: Record<string, never> };
    polls: { can_create: boolean; can_view: boolean; can_vote: boolean };
    recorder_type: "RECORDER" | "LIVESTREAMER" | "NONE";
    show_participant_list: boolean;
    waiting_room_type: "SKIP" | "ON_PRIVILEGED_USER_ENTRY" | "SKIP_ON_ACCEPT";
    is_recorder: boolean;
    stage_enabled: boolean;
    stage_access: MediaPermission;
    accept_stage_requests: boolean;
    /**
     * Real-time transcription. Off: the review uses post-meeting
     * transcription (transcribe_on_end). The spike (6.10 check 9) confirms
     * post-meeting transcription works with this off; if it needs true, turn
     * it on for all three and accept the real-time cost (section 12).
     */
    transcription_enabled: boolean;
  };
};

const NO_CHAT = {
  private: { can_send: false, can_receive: false, text: false, files: false },
  public: { can_send: false, text: false, files: false },
};

const NO_CONNECTED_MEETINGS = {
  can_alter_connected_meetings: false,
  can_switch_connected_meetings: false,
  can_switch_to_parent_meeting: false,
};

const NO_PLUGINS = { can_start: false, can_close: false, can_edit_config: false, config: {} };
const NO_POLLS = { can_create: false, can_view: false, can_vote: false };

const CONFIG: RtkPreset["config"] = {
  view_type: "GROUP_CALL",
  max_video_streams: { desktop: 9, mobile: 4 },
  max_screenshare_count: 1,
  media: {
    video: { quality: "vga", frame_rate: 24 },
    screenshare: { quality: "hd", frame_rate: 5 },
  },
};

/** Shared by all three; each preset overrides what differs. */
const LOCKED = {
  can_accept_production_requests: false,
  can_change_participant_permissions: false,
  can_edit_display_name: false,
  can_livestream: false,
  can_record: false,
  can_spotlight: false,
  chat: NO_CHAT,
  connected_meetings: NO_CONNECTED_MEETINGS,
  hidden_participant: false,
  kick_participant: false,
  pin_participant: true,
  plugins: NO_PLUGINS,
  polls: NO_POLLS,
  recorder_type: "NONE",
  is_recorder: false,
  stage_enabled: false,
  stage_access: "ALLOWED",
  accept_stage_requests: false,
  transcription_enabled: false,
} as const;

export const TEACHER_PRESET: RtkPreset = {
  name: "lfrc-teacher",
  config: CONFIG,
  permissions: {
    ...LOCKED,
    accept_waiting_requests: true,
    disable_participant_audio: true,
    disable_participant_video: true,
    disable_participant_screensharing: true,
    media: {
      audio: { can_produce: "ALLOWED" },
      video: { can_produce: "ALLOWED" },
      screenshare: { can_produce: "ALLOWED" },
    },
    show_participant_list: true,
    waiting_room_type: "SKIP",
  },
};

export const STUDENT_PRESET: RtkPreset = {
  name: "lfrc-student",
  config: CONFIG,
  permissions: {
    ...LOCKED,
    accept_waiting_requests: false,
    disable_participant_audio: false,
    disable_participant_video: false,
    disable_participant_screensharing: false,
    media: {
      audio: { can_produce: "ALLOWED" },
      video: { can_produce: "NOT_ALLOWED" },
      screenshare: { can_produce: "NOT_ALLOWED" },
    },
    show_participant_list: false,
    // Students wait until the teacher admits them.
    waiting_room_type: "SKIP_ON_ACCEPT",
  },
};

export const STAFF_PRESET: RtkPreset = {
  name: "lfrc-staff",
  config: CONFIG,
  permissions: {
    ...LOCKED,
    accept_waiting_requests: true,
    disable_participant_audio: true,
    disable_participant_video: true,
    disable_participant_screensharing: true,
    media: {
      audio: { can_produce: "ALLOWED" },
      video: { can_produce: "ALLOWED" },
      screenshare: { can_produce: "NOT_ALLOWED" },
    },
    show_participant_list: true,
    waiting_room_type: "SKIP",
  },
};

export const PRESETS: readonly RtkPreset[] = [TEACHER_PRESET, STUDENT_PRESET, STAFF_PRESET];

export function presetForRole(role: "teacher" | "student" | "staff"): RtkPreset {
  return role === "teacher" ? TEACHER_PRESET : role === "student" ? STUDENT_PRESET : STAFF_PRESET;
}

/**
 * The name everyone sees on a tile, always the full username (section 6.3):
 * `@maya`, `@maya (teacher)`, `@jahaan (LearnFRC staff)`.
 */
export function displayNameFor(username: string, role: "teacher" | "student" | "staff"): string {
  const handle = `@${username}`;
  if (role === "teacher") return `${handle} (teacher)`;
  if (role === "staff") return `${handle} (LearnFRC staff)`;
  return handle;
}

/** The webhook events the app subscribes to (section 15.4 step 7). */
export const WEBHOOK_EVENTS = [
  "meeting.started",
  "meeting.ended",
  "meeting.participantJoined",
  "meeting.participantLeft",
  "meeting.transcript",
  "recording.statusUpdate",
] as const;
