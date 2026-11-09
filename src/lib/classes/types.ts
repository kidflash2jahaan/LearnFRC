/**
 * Live classes: the shared types. Row types mirror
 * supabase/migrations/20261109120000_live_classes.sql column for column
 * (timestamps arrive from PostgREST as ISO strings). No imports and no
 * runtime code besides SYSTEM_ACTOR, so anything can import it, client
 * components and tests included.
 */

/* ── Enums (the migration's check constraints) ─────────────────────── */

export type ClassRole = "teacher" | "student" | "staff";
export type RtkApp = "dev" | "prod";

export type ClassStatus =
  | "scheduled"
  | "live"
  | "ended"
  | "in_review"
  | "approved"
  | "rejected"
  | "canceled";

export type ClassEndReason =
  | "teacher"
  | "admin"
  | "time"
  | "empty"
  | "teacher_gone"
  | "reports"
  | "paused"
  | "sweep";

export type EnrollmentStatus = "enrolled" | "canceled" | "removed";
export type TeacherApplicationStatus = "pending" | "accepted" | "rejected" | "withdrawn";
export type ParentConsentStatus = "sent" | "agreed" | "declined" | "expired" | "revoked";
export type ConsentKind = "recording_notice" | "teacher_code";
export type TranscriptStatus = "waiting" | "stored" | "missing" | "failed";
export type ReviewStatus = "pending" | "ready" | "refused" | "failed" | "no_transcript";
export type ReviewVerdict = "looks_fine" | "needs_review" | "urgent";
export type LessonMatch = "matches" | "partly" | "off_topic" | "unclear";
export type MediaKind = "camera" | "screenshare";
export type LetterStatus = "requested" | "issued" | "declined" | "revoked";
export type HoldReason =
  | "urgent_flag"
  | "refusal"
  | "class_report"
  | "auto_end"
  | "ban"
  | "self_delete_open_case"
  | "reject_safety"
  | "manual";
export type HoldRecordingStatus = "none" | "copying" | "stored" | "failed" | "gone";

/** Why an account is being deleted (deleteAccountData's opts.reason). */
export type AccountDeletionReason = "self" | "ban" | "under_13";

/* ── Eligibility (section 4) ───────────────────────────────────────── */

export type Eligibility =
  | "hidden"
  | "signed_out"
  | "needs_handle"
  | "device_blocked"
  | "needs_age"
  | "adult"
  | "needs_parent"
  | "waiting_parent"
  | "parent_declined"
  | "ready";

export type AgeBand = "under13" | "13-15" | "16-17" | "18+";

/* ── Chat (sections 3.6 and 6.5) ───────────────────────────────────── */

export type ChatStatus = "shown" | "blocked";

/** Why the chat filter stopped a message (class_chat_messages.blocked_kinds). */
export type ChatBlockedKind =
  | "link"
  | "handle"
  | "email"
  | "phone"
  | "contact_app"
  | "contact_phrase"
  | "profanity";

/** One message as the chat panel shows it (shown rows only). */
export type ChatMessage = {
  id: number;
  classId: string;
  senderId: string | null;
  senderUsername: string;
  senderRole: ClassRole;
  body: string;
  sentAt: string;
};

/* ── Who is acting ─────────────────────────────────────────────────── */

/** The sweep, an auto-end or another server-side trigger, not a person. */
export type SystemActor = { system: true; reason?: string };
export const SYSTEM_ACTOR: SystemActor = { system: true };

/* ── Rows ──────────────────────────────────────────────────────────── */

export type TeacherApplicationRow = {
  id: string;
  user_id: string;
  team_number: number | null;
  team_role: string | null;
  legal_name: string;
  topics: string;
  topic_ids: string[];
  experience: string;
  sample_plan: string;
  availability: string | null;
  reference_name: string | null;
  reference_email: string | null;
  code_version: string;
  status: TeacherApplicationStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
};

export type ClassTeacherRow = {
  user_id: string;
  application_id: string | null;
  granted_by: string | null;
  granted_at: string;
  letter_name: string;
  letter_name_changed_by: string | null;
  letter_name_changed_at: string | null;
  letter_name_change_note: string | null;
  letters_blocked: boolean;
  code_version: string | null;
  code_agreed_at: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
  note: string | null;
};

export type ClassAgeCheckRow = {
  user_id: string;
  birth_year: number;
  birth_month: number;
  checked_at: string;
};

export type ClassParentConsentRow = {
  id: string;
  student_id: string | null;
  student_handle: string;
  student_birth_year: number;
  parent_email: string;
  parent_name: string | null;
  token_hash: string;
  notice_version: string;
  status: ParentConsentStatus;
  sent_at: string;
  expires_at: string;
  requested_ip_hash: string | null;
  decided_at: string | null;
  decided_ip_hash: string | null;
  decided_user_agent: string | null;
  same_network: boolean;
  revoked_at: string | null;
  revoked_by: string | null;
  account_deleted_at: string | null;
};

export type ClassRow = {
  id: string;
  teacher_id: string | null;
  title: string;
  description: string | null;
  lesson_id: string | null;
  module_id: string | null;
  starts_at: string;
  duration_minutes: number;
  hard_end_at: string;
  capacity: number;
  status: ClassStatus;
  rtk_meeting_id: string | null;
  rtk_app: RtkApp;
  live_started_at: string | null;
  ended_at: string | null;
  end_reason: ClassEndReason | null;
  canceled_at: string | null;
  canceled_by: string | null;
  cancel_reason: string | null;
  credited_minutes: number | null;
  credited_minutes_computed: number | null;
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
  keep_evidence: boolean;
  created_at: string;
  updated_at: string;
};

export type ClassEnrollmentRow = {
  class_id: string;
  user_id: string;
  status: EnrollmentStatus;
  enrolled_at: string;
  updated_at: string;
  removed_by: string | null;
  removed_reason: string | null;
};

export type ClassParticipantRow = {
  class_id: string;
  user_id: string;
  role: ClassRole;
  rtk_participant_id: string | null;
  preset_name: string;
  first_joined_at: string;
  last_token_at: string | null;
  revoked_at: string | null;
};

export type ClassSessionRow = {
  id: string;
  class_id: string;
  started_at: string | null;
  ended_at: string | null;
  end_reason: string | null;
  recording_url: string | null;
  recording_expires_at: string | null;
  transcript_status: TranscriptStatus;
  transcript_fetched_at: string | null;
};

export type ClassAttendanceRow = {
  id: string;
  class_id: string;
  session_id: string;
  user_id: string | null;
  role: ClassRole;
  account_age_days: number | null;
  peer_id: string;
  joined_at: string;
  left_at: string | null;
  source: "webhook" | "reconcile";
};

export type ClassMediaEventRow = {
  id: number;
  class_id: string;
  subject_user_id: string | null;
  kind: MediaKind;
  is_on: boolean;
  at: string;
  reported_by: string | null;
  received_at: string;
};

export type ClassConsentRow = {
  id: string;
  user_id: string | null;
  user_handle: string;
  user_birth_year: number | null;
  class_id: string | null;
  kind: ConsentKind;
  version: string;
  accepted_at: string;
  ip_hash: string | null;
  user_agent: string | null;
  account_deleted_at: string | null;
};

export type ClassChatMessageRow = {
  id: number;
  class_id: string;
  sender_id: string | null;
  sender_username: string;
  sender_role: ClassRole;
  body: string;
  status: ChatStatus;
  blocked_kinds: ChatBlockedKind[];
  sent_at: string;
};

/** One transcript line (class_transcripts.lines). label is "@username". */
export type TranscriptLine = {
  t0: number;
  t1: number;
  userId: string | null;
  label: string;
  role: ClassRole | null;
  text: string;
};

export type ClassTranscriptRow = {
  session_id: string;
  class_id: string;
  lines: TranscriptLine[];
  word_count: number;
  fetched_at: string;
  purge_after: string;
};

export type ClassReviewRow = {
  class_id: string;
  status: ReviewStatus;
  model: string | null;
  prompt_version: string | null;
  verdict: ReviewVerdict | null;
  lesson_match: LessonMatch | null;
  summary_md: string | null;
  flags: unknown[];
  code_flags: unknown[];
  one_on_one_minutes: number;
  camera_minutes: number;
  screenshare_minutes: number;
  chat_blocked_count: number;
  refusal_category: string | null;
  restricted: boolean;
  input_tokens: number | null;
  output_tokens: number | null;
  attempts: number;
  error: string | null;
  emailed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ClassEventRow = {
  id: string;
  class_id: string | null;
  actor_id: string | null;
  kind: string;
  detail: Record<string, unknown>;
  created_at: string;
};

export type ClassWebhookEventRow = {
  id: string;
  body_sha256: string;
  webhook_id: string | null;
  event: string;
  meeting_id: string | null;
  received_at: string;
  payload: unknown;
};

export type ClassRtkCleanupRow = {
  rtk_app: RtkApp;
  meeting_id: string;
  participant_id: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
};

export type ClassSettingsRow = {
  id: true;
  classes_visible: boolean;
  joins_paused: boolean;
  paused_reason: string | null;
  safety_lead_user_id: string | null;
  monthly_minute_cap: number;
  max_live_classes: number;
  min_student_account_days: number;
  /** { dev?: string; prod?: string } */
  rtk_webhook_ids: Partial<Record<RtkApp, string>>;
  rtk_organization_id: string | null;
  last_daily_sweep_at: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type HoursLetterClass = {
  classId: string;
  date: string;
  title: string;
  topic: string | null;
  minutes: number;
};

export type HoursLetterRow = {
  id: string;
  code: string | null;
  teacher_id: string;
  letter_name: string;
  period_start: string;
  period_end: string;
  total_minutes: number;
  class_count: number;
  classes: HoursLetterClass[];
  coordinator_name: string;
  coordinator_email: string;
  status: LetterStatus;
  requested_at: string;
  approved_by: string | null;
  issued_at: string | null;
  decline_reason: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
};

export type ClassSafetyHoldRow = {
  id: string;
  class_id: string | null;
  subject_user_id: string | null;
  subject_handle: string | null;
  subject_email: string | null;
  reason: HoldReason;
  transcript: TranscriptLine[] | null;
  chat: ClassChatMessageRow[] | null;
  peer_reports: unknown;
  recording_key: string | null;
  recording_status: HoldRecordingStatus;
  created_by: string | null;
  created_at: string;
  expires_at: string;
  ncmec_report_id: string | null;
  notes: string | null;
  released_at: string | null;
  released_by: string | null;
};

/* ── What the shared functions hand back ───────────────────────────── */

/** A class's topic, as listings link it. */
export type ClassTopic = {
  kind: "lesson" | "module";
  id: string;
  title: string;
  /** Absolute URL on the site. */
  url: string;
};

/**
 * One class in a listing: /classes, the homepage and the app's
 * GET /api/app/classes (apple/docs/API.md). `teacher` is null for signed-out
 * viewers, and the homepage never shows it. Add fields, never rename them.
 */
export type ClassListing = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  /** The scheduled end (starts_at + duration). */
  endsAt: string;
  durationMinutes: number;
  status: "scheduled" | "live";
  teacher: { username: string } | null;
  teacherLabel: string;
  topic: ClassTopic | null;
  seats: { capacity: number; taken: number; left: number };
  url: string;
  /** Signed-in viewers only: whether they're enrolled. Null signed out. */
  enrolled: boolean | null;
};

/** One class's page (/classes/[id]). */
export type ClassDetail = ClassListing & {
  hardEndAt: string;
  rtkApp: RtkApp;
  /** The real status, including ended and later ones. */
  classStatus: ClassStatus;
  /** The viewer's place in it, if any. */
  viewerRole: ClassRole | null;
  enrollment: EnrollmentStatus | null;
  /** The viewer has had a participant in this class (can read its chat). */
  wasParticipant: boolean;
  /** The viewer blocked the teacher, or the teacher blocked the viewer. */
  blockedEitherWay: boolean;
  /** Within the 30-day report window and the viewer was in it. */
  canReportFromClass: boolean;
};

/** One person in a class, for the report panel and the class controls. */
export type ClassRosterEntry = {
  userId: string;
  /** Current profiles.username, or null for a deleted account. */
  username: string | null;
  role: ClassRole;
  revoked: boolean;
};
