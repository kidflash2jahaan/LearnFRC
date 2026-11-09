/**
 * Teacher applications and the teacher record: the limits and the pure rules
 * (classes-design.md sections 3.1, 9.1 and 11, and the second form decided on
 * Nov 9: teacher-application-spec.md sections 2 and 3).
 *
 * No `@/` imports and no `server-only`, so /apply/teach's form shows the same
 * questions, limits and word counts the server enforces, the desk reads the
 * same labels, and `node --test` runs the checks (teacher-rules.test.ts). The
 * server side is src/lib/app/class-teachers.ts.
 */

import type { Eligibility } from "./types.ts";

export const TEACHER_APPLY_LIMITS = {
  /** teacher_applications.legal_name and class_teachers.letter_name checks. */
  legalNameMin: 2,
  legalNameMax: 80,
  /**
   * The NOT NULL `topics` column. The second form doesn't ask for topics in
   * words any more; the server fills it with the picked modules' titles,
   * cut to this.
   */
  topicsMax: 300,
  /** Picked modules (teacher_applications.topic_ids). */
  minTopicIds: 1,
  maxTopicIds: 5,
  /** The first form's long answers. Kept for any old reader. */
  longMax: 3000,
  availabilityMax: 200,
  referenceNameMax: 80,
  referenceEmailMax: 254,
  /** One season row's "official events you competed at". */
  seasonEventsMin: 5,
  seasonEventsMax: 200,
  teamNumberMax: 99999,
  otherProgramsMax: 300,
  codeQuestionsMax: 500,
  /** teacher_applications.review_note check. */
  reviewNoteMax: 1000,
  suspendReasonMax: 500,
  /** A super admin's note when changing a letter name. */
  letterNoteMin: 3,
  letterNoteMax: 1000,
} as const;

const L = TEACHER_APPLY_LIMITS;

/* ── Who can teach: at least one full FRC season ───────────────────── */

/** A full season: a build season plus at least one official event. */
export const MIN_FULL_SEASONS = 1;

export const FULL_SEASON_SENTENCE =
  "At least one full FRC season: a build season and at least one official event (a regional, a district event, a district championship or the FIRST Championship). Off-season events and scrimmages don’t count. FTC, FLL and VEX are welcome background, but they don’t count on their own.";

/** The refusal for anyone who says they haven't finished a full season yet. */
export const NOT_YET_SENTENCE =
  "Teaching opens after your first full FRC season: a build season and at least one official event. Come back after your first event.";

/** The first FRC season. */
export const FIRST_FRC_YEAR = 1992;
/** Season rows on one application. */
export const MAX_SEASONS = 5;
/** The year select lists this year down to this one, then "Earlier". */
export const EARLIEST_LISTED_YEAR = 2015;

export const FRC_ROLES = [
  { id: "mechanical", label: "Mechanical and build" },
  { id: "electrical", label: "Electrical" },
  { id: "programming", label: "Programming" },
  { id: "cad", label: "CAD and design" },
  { id: "strategy", label: "Strategy and scouting" },
  { id: "drive", label: "Drive team" },
  { id: "business", label: "Business, outreach and media" },
  { id: "other", label: "Something else" },
] as const;

export const TEACH_OFTEN = [
  { id: "monthly", label: "About once a month" },
  { id: "few_monthly", label: "Two or three times a month" },
  { id: "weekly", label: "Once a week or more" },
] as const;

export type FrcRoleId = (typeof FRC_ROLES)[number]["id"];
export type TeachOftenId = (typeof TEACH_OFTEN)[number]["id"];

export const frcRoleLabel = (id: string): string => FRC_ROLES.find((r) => r.id === id)?.label ?? id;
export const teachOftenLabel = (id: string | null | undefined): string | null =>
  TEACH_OFTEN.find((t) => t.id === id)?.label ?? null;

/* ── The written answers ───────────────────────────────────────────── */

/**
 * The six written answers. One table the form, the server and the desk all
 * read: `label` is the desk's short name (the desk, its flags and the
 * emails), `question` and `hint` are what the form prints, and `situation`
 * is the scenario printed above the box. Anything the applicant reads (the
 * form's summary, the duplicate refusal) names an answer by its `question`,
 * since that's what's on the form. The copied-prompt check compares an
 * answer with its own question, hint and situation.
 *
 * The floors add up to 440 words. Writing a bit over them takes a serious
 * applicant about 25 minutes (spec section 3.9).
 */
export const TEACH_ANSWERS = {
  experience: {
    label: "What you personally worked on",
    question: "What you personally worked on",
    hint: "Name at least one specific thing you built, wired, programmed, designed or ran, and one time something went wrong and how it got fixed. Say “I” for your part and “we” for the team’s. If you’ve helped newer members learn something, say what.",
    situation: null,
    minWords: 80,
    aimWords: 250,
    maxChars: 3000,
    rows: 7,
  },
  teachingSample: {
    label: "Explain one idea to a rookie",
    question: "Explain one idea from it to a rookie",
    hint: "Write it the way you’d say it out loud to someone who joined your team last week and has never touched a robot. Start from something they already know, use an example, and end with one question you’d ask to check they got it (not “does that make sense?”). This is the answer we read most closely.",
    situation: null,
    minWords: 150,
    aimWords: 350,
    maxChars: 4000,
    rows: 9,
  },
  samplePlan: {
    label: "Your class plan",
    question: "Plan a 30 to 45 minute class on it",
    hint: "What should students be able to do by the end? How do you open? What do you show: your screen, a diagram, code? What do students do, given their cameras stay off and they talk in chat or by unmuting? How do you check they got it? What would you cut if you ran short?",
    situation: null,
    minWords: 100,
    aimWords: 300,
    maxChars: 3000,
    rows: 8,
  },
  scenarioSafety: {
    label: "The student who asks for your Discord",
    question: "A student asks to keep talking somewhere else",
    hint: null,
    situation:
      "Halfway through your class, a student says in chat that they’re stuck on their team’s code and asks if they can add you on Discord after class. Another student starts saying which school they go to. What do you do and say?",
    minWords: 40,
    aimWords: 150,
    maxChars: 1500,
    rows: 5,
  },
  scenarioTeaching: {
    label: "The question you can’t answer",
    question: "A question you can’t answer",
    hint: null,
    situation:
      "A student asks something about the lesson that you don’t know the answer to. While you’re thinking, another student says they’re totally lost. What do you do?",
    minWords: 40,
    aimWords: 150,
    maxChars: 1500,
    rows: 5,
  },
  motivation: {
    label: "Why you want to teach",
    question: "Why do you want to teach on LearnFRC?",
    hint: "Volunteer hours are a fine reason. Tell us what else you want out of it.",
    situation: null,
    minWords: 30,
    aimWords: 120,
    maxChars: 1000,
    rows: 4,
  },
} as const;

export type TeachAnswerKey = keyof typeof TEACH_ANSWERS;

/** The long answers in form order. */
export const TEACH_ANSWER_KEYS: TeachAnswerKey[] = [
  "experience",
  "teachingSample",
  "samplePlan",
  "scenarioSafety",
  "scenarioTeaching",
  "motivation",
];

/* ── Words ─────────────────────────────────────────────────────────── */

const WORD = /[\p{L}\p{N}]+(?:['’.\-][\p{L}\p{N}]+)*/gu;

/** Words, the way the form's counter and the server count them: "don't", "1.5" and "CAN-bus" are one each. */
export function wordCount(s: string): number {
  return (s.match(WORD) ?? []).length;
}

function words(s: string): string[] {
  return (s.toLowerCase().match(WORD) ?? []).map((w) => w.replace(/’/g, "'"));
}

const SHINGLE = 5;

/** Every run of five words, lowercased. */
function shingles(s: string): Set<string> {
  const w = words(s);
  const out = new Set<string>();
  for (let i = 0; i + SHINGLE <= w.length; i++) out.add(w.slice(i, i + SHINGLE).join(" "));
  return out;
}

/** Shared shingles over the smaller set: 1 when one answer sits whole inside the other. */
function containment(a: Set<string>, b: Set<string>): number {
  const small = a.size <= b.size ? a : b;
  const big = small === a ? b : a;
  if (small.size === 0) return 0;
  let shared = 0;
  for (const s of small) if (big.has(s)) shared += 1;
  return shared / small.size;
}

/** How much of `answer` is runs of five words from `prompt`. */
function copiedShare(answer: Set<string>, prompt: Set<string>): number {
  if (answer.size === 0) return 0;
  let shared = 0;
  for (const s of answer) if (prompt.has(s)) shared += 1;
  return shared / answer.size;
}

function promptText(key: TeachAnswerKey): string {
  const a = TEACH_ANSWERS[key];
  return [a.question, a.hint, a.situation].filter(Boolean).join(" ");
}

/** Padding: lots of words but few different ones, or one word five times running. */
function padded(text: string): boolean {
  const w = words(text);
  if (w.length >= 60 && new Set(w).size / w.length < 0.3) return true;
  let run = 1;
  for (let i = 1; i < w.length; i++) {
    run = w[i] === w[i - 1] ? run + 1 : 1;
    if (run >= 5) return true;
  }
  return false;
}

export const EFFORT_SENTENCES = {
  /** Takes the other answer's `question`, as the form prints it. */
  repeats: (otherQuestion: string) =>
    `This repeats your answer to “${otherQuestion}”${/[?!.]$/.test(otherQuestion) ? "" : "."} Write this one fresh.`,
  copiedPrompt: "This mostly repeats the question. Answer it in your own words.",
  padding: "This repeats the same few words. Write it out in sentences.",
} as const;

/**
 * The three hard refusals that keep a low-effort application out, run on
 * answers that already cleared their floors (spec section 3.9). No AI
 * detection: these only catch the same text twice, the question pasted
 * back, and padding.
 */
export function effortProblems(answers: Partial<Record<TeachAnswerKey, string>>): FieldProblem[] {
  const out: FieldProblem[] = [];
  const keys = TEACH_ANSWER_KEYS.filter((k) => typeof answers[k] === "string" && answers[k]!.trim());
  const sets = new Map(keys.map((k) => [k, shingles(answers[k]!)]));
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const mine = sets.get(key)!;
    const earlier = keys.slice(0, i).find((other) => containment(mine, sets.get(other)!) >= 0.5);
    if (earlier) {
      out.push({ field: key, error: EFFORT_SENTENCES.repeats(TEACH_ANSWERS[earlier].question) });
      continue;
    }
    if (copiedShare(mine, shingles(promptText(key))) >= 0.6) {
      out.push({ field: key, error: EFFORT_SENTENCES.copiedPrompt });
      continue;
    }
    if (padded(answers[key]!)) out.push({ field: key, error: EFFORT_SENTENCES.padding });
  }
  return out;
}

/* ── Names ─────────────────────────────────────────────────────────── */

/** Trims and collapses inner whitespace, so "  Maya   Chen " is "Maya Chen". */
export function normalizeName(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * The name that goes on hours letters, as the school knows the person.
 * Letters, spaces, hyphens, apostrophes and periods: no digits, no @, no
 * links, since it's printed under "This letter confirms that".
 */
export function letterNameProblem(raw: string): string | null {
  const name = normalizeName(raw);
  const sentence = `Write the name your school knows you by, ${L.legalNameMin} to ${L.legalNameMax} characters.`;
  if (name.length < L.legalNameMin || name.length > L.legalNameMax) return sentence;
  if (!/\p{L}/u.test(name)) return sentence;
  if (/[0-9@<>{}[\]\\/|_=+*#$%^&~`]/.test(name) || /https?:|www\./i.test(name))
    return "Use only letters, spaces, hyphens, apostrophes and periods in your name.";
  return null;
}

/* ── The application ───────────────────────────────────────────────── */

/** The refusal when the teacher code box isn't ticked (TEACHER_SENTENCES.code points here). */
export const TEACHER_CODE_SENTENCE = "Read the teacher code and tick the box to agree to it.";

export type TeacherSeason = { year: number; team: number; events: string };

/** What a valid application holds, trimmed and ready to insert. */
export type TeacherApplicationInput = {
  legalName: string;
  /** Newest first. */
  seasons: TeacherSeason[];
  /** FRC_ROLES ids, in FRC_ROLES order. */
  roles: FrcRoleId[];
  experience: string;
  otherPrograms: string | null;
  topicIds: string[];
  sampleLessonId: string;
  teachingSample: string;
  samplePlan: string;
  scenarioSafety: string;
  scenarioTeaching: string;
  motivation: string;
  teachOften: TeachOftenId;
  availability: string | null;
  referenceName: string | null;
  referenceEmail: string | null;
  codeQuestions: string | null;
};

/** What the form or a request sent. Anything that isn't a string counts as empty. */
export type TeacherApplicationRaw = {
  fullSeason?: unknown;
  seasonYear?: unknown;
  seasonTeam?: unknown;
  seasonEvents?: unknown;
  frcRoles?: unknown;
  experience?: unknown;
  otherPrograms?: unknown;
  topicIds?: unknown;
  sampleLessonId?: unknown;
  teachingSample?: unknown;
  samplePlan?: unknown;
  scenarioSafety?: unknown;
  scenarioTeaching?: unknown;
  motivation?: unknown;
  teachOften?: unknown;
  availability?: unknown;
  referenceName?: unknown;
  referenceEmail?: unknown;
  legalName?: unknown;
  codeQuestions?: unknown;
  code?: unknown;
  ownWords?: unknown;
};

export type FieldProblem = { field: string; error: string };

/** A check's answer. On a refusal, `field` and `error` are `problems[0]`. */
export type FieldCheck<T> =
  | { ok: true; value: T }
  | { ok: false; field: string; error: string; problems: FieldProblem[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * A plain address, for the reference. No `?`, `&`, `,`, `%` or other URL
 * characters: the desk puts it in a mailto link, where those would add a
 * hidden recipient or header.
 */
const EMAIL = /^[a-z0-9._+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

/**
 * A field as a trimmed string, with line breaks as plain \n. A form posted as
 * multipart turns every line break into \r\n, which would count twice
 * against a character cap the textarea counted once.
 */
function str(v: unknown): string {
  return typeof v === "string"
    ? v.replace(/\r\n?/g, "\n").trim()
    : typeof v === "number" && Number.isFinite(v)
      ? String(v)
      : "";
}

/** A form's repeated field (getAll) or a single value, as trimmed strings. */
function list(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(str);
  return v == null ? [] : [str(v)];
}

const tooLong = (max: number) => `Keep this under ${max} characters.`;
const writeMore = (min: number, n: number) => `Write at least ${min} words. You’re at ${n}.`;

/** Builds the season rows from the zipped columns. Fully empty rows are skipped. */
function checkSeasons(raw: TeacherApplicationRaw, now: Date, problems: FieldProblem[]): TeacherSeason[] {
  const years = list(raw.seasonYear);
  const teams = list(raw.seasonTeam);
  const events = list(raw.seasonEvents);
  const n = Math.max(years.length, teams.length, events.length);
  const thisYear = now.getUTCFullYear();
  const rows: { index: number; year: string; team: string; events: string }[] = [];
  for (let i = 0; i < n; i++) {
    const row = { index: i + 1, year: years[i] ?? "", team: teams[i] ?? "", events: events[i] ?? "" };
    if (row.year || row.team || row.events) rows.push(row);
  }
  if (rows.length === 0) {
    problems.push({ field: "seasons", error: "Add at least one FRC season." });
    return [];
  }
  if (rows.length > MAX_SEASONS) {
    problems.push({ field: "seasons", error: `List up to ${MAX_SEASONS} seasons.` });
    return [];
  }
  const seen = new Set<number>();
  const out: TeacherSeason[] = [];
  for (const r of rows) {
    const before = problems.length;
    const year = /^\d{4}$/.test(r.year) ? Number(r.year) : NaN;
    if (!Number.isInteger(year) || year < FIRST_FRC_YEAR || year > thisYear) {
      problems.push({ field: `season-${r.index}-year`, error: `Season ${r.index}: pick the year.` });
    } else if (seen.has(year)) {
      problems.push({ field: `season-${r.index}-year`, error: `Season ${r.index}: you already listed ${year}.` });
    } else {
      seen.add(year);
    }
    const team = /^\d{1,5}$/.test(r.team) ? Number(r.team) : NaN;
    if (!Number.isInteger(team) || team < 1 || team > L.teamNumberMax)
      problems.push({ field: `season-${r.index}-team`, error: `Season ${r.index}: add your team number for that year.` });
    const ev = r.events.replace(/\s+/g, " ");
    if (ev.length < L.seasonEventsMin)
      problems.push({ field: `season-${r.index}-events`, error: `Season ${r.index}: name the official events you went to.` });
    else if (ev.length > L.seasonEventsMax)
      problems.push({
        field: `season-${r.index}-events`,
        error: `Season ${r.index}: keep the events under ${L.seasonEventsMax} characters.`,
      });
    if (problems.length === before) out.push({ year, team, events: ev });
  }
  return out.sort((a, b) => b.year - a.year);
}

/**
 * Checks a whole application and returns every problem at once, in form
 * order, so one refusal lists everything (the form's summary prints them).
 *
 * Someone who hasn't finished a full FRC season gets only that refusal:
 * nothing else on the form applies to them yet.
 */
export function checkTeacherApplication(
  raw: TeacherApplicationRaw,
  opts: { codeVersion: string; now?: Date }
): FieldCheck<TeacherApplicationInput> {
  const now = opts.now ?? new Date();
  if (str(raw.fullSeason) !== "yes") {
    const problem = { field: "fullSeason", error: NOT_YET_SENTENCE };
    return { ok: false, ...problem, problems: [problem] };
  }
  const problems: FieldProblem[] = [];

  // Section 1: FRC experience.
  const seasons = checkSeasons(raw, now, problems);

  const roleIds = [...new Set(list(raw.frcRoles).filter(Boolean))];
  if (roleIds.length === 0) problems.push({ field: "frcRoles", error: "Tick at least one thing you worked on." });
  else if (roleIds.some((id) => !FRC_ROLES.some((r) => r.id === id)))
    problems.push({ field: "frcRoles", error: "Pick from the list." });
  const roles = FRC_ROLES.map((r) => r.id).filter((id) => roleIds.includes(id));

  const answers: Partial<Record<TeachAnswerKey, string>> = {};
  const longAnswer = (key: TeachAnswerKey) => {
    const a = TEACH_ANSWERS[key];
    const text = str(raw[key]);
    const n = wordCount(text);
    if (text.length > a.maxChars) problems.push({ field: key, error: tooLong(a.maxChars) });
    else if (n < a.minWords) problems.push({ field: key, error: writeMore(a.minWords, n) });
    else answers[key] = text;
    return text;
  };

  const experience = longAnswer("experience");
  const otherPrograms = str(raw.otherPrograms);
  if (otherPrograms.length > L.otherProgramsMax)
    problems.push({ field: "otherPrograms", error: tooLong(L.otherProgramsMax) });

  // Section 2: what you'd teach.
  const topicIds = [...new Set(list(raw.topicIds).filter(Boolean))];
  if (topicIds.length < L.minTopicIds)
    problems.push({ field: "topicIds", error: "Pick at least one module you could teach." });
  else if (topicIds.length > L.maxTopicIds)
    problems.push({ field: "topicIds", error: `Pick up to ${L.maxTopicIds} modules.` });
  else if (topicIds.some((id) => !UUID.test(id)))
    problems.push({ field: "topicIds", error: "One of the picked modules isn’t on LearnFRC." });

  // Section 3: one lesson.
  const sampleLessonId = str(raw.sampleLessonId);
  if (!UUID.test(sampleLessonId)) problems.push({ field: "sampleLessonId", error: "Pick the lesson you’d teach." });
  const teachingSample = longAnswer("teachingSample");
  const samplePlan = longAnswer("samplePlan");

  // Section 4: two situations.
  const scenarioSafety = longAnswer("scenarioSafety");
  const scenarioTeaching = longAnswer("scenarioTeaching");

  // Section 5: why, when, and sign it.
  const motivation = longAnswer("motivation");

  const teachOften = str(raw.teachOften);
  if (!TEACH_OFTEN.some((t) => t.id === teachOften))
    problems.push({ field: "teachOften", error: "Pick about how often you could teach." });

  const availability = str(raw.availability);
  if (availability.length > L.availabilityMax) problems.push({ field: "availability", error: "Keep availability to a line." });

  const referenceName = normalizeName(str(raw.referenceName));
  const referenceEmail = str(raw.referenceEmail).toLowerCase();
  if (referenceName.length > L.referenceNameMax)
    problems.push({ field: "referenceName", error: `Keep the name under ${L.referenceNameMax} characters.` });
  else if (!referenceName && referenceEmail) problems.push({ field: "referenceName", error: "Add their name too." });
  if (referenceEmail && (referenceEmail.length > L.referenceEmailMax || !EMAIL.test(referenceEmail)))
    problems.push({ field: "referenceEmail", error: "That email address doesn't look right." });
  else if (referenceName && !referenceEmail) problems.push({ field: "referenceEmail", error: "Add their email too." });

  const legalName = normalizeName(str(raw.legalName));
  const nameProblem = letterNameProblem(legalName);
  if (nameProblem) problems.push({ field: "legalName", error: nameProblem });

  const codeQuestions = str(raw.codeQuestions);
  if (codeQuestions.length > L.codeQuestionsMax)
    problems.push({ field: "codeQuestions", error: tooLong(L.codeQuestionsMax) });

  if (str(raw.code) !== opts.codeVersion) problems.push({ field: "code", error: TEACHER_CODE_SENTENCE });
  if (str(raw.ownWords) !== "yes")
    problems.push({ field: "ownWords", error: "Tick the box to say you wrote these answers yourself." });

  // The effort checks, on the answers that cleared their floors, slotted
  // back into form order.
  const effort = effortProblems(answers);
  if (effort.length) {
    const order = (field: string) => {
      const i = FIELD_ORDER.indexOf(field.startsWith("season-") ? "seasons" : field);
      return i === -1 ? FIELD_ORDER.length : i;
    };
    problems.push(...effort);
    problems.sort((a, b) => order(a.field) - order(b.field));
  }

  if (problems.length) return { ok: false, field: problems[0].field, error: problems[0].error, problems };
  return {
    ok: true,
    value: {
      legalName,
      seasons,
      roles,
      experience,
      otherPrograms: otherPrograms || null,
      topicIds,
      sampleLessonId: sampleLessonId.toLowerCase(),
      teachingSample,
      samplePlan,
      scenarioSafety,
      scenarioTeaching,
      motivation,
      teachOften: teachOften as TeachOftenId,
      availability: availability || null,
      referenceName: referenceName || null,
      referenceEmail: referenceEmail || null,
      codeQuestions: codeQuestions || null,
    },
  };
}

/** Every field the form has, in the order it shows them (season rows sort as "seasons"). */
export const FIELD_ORDER = [
  "fullSeason",
  "seasons",
  "frcRoles",
  "experience",
  "otherPrograms",
  "topicIds",
  "sampleLessonId",
  "teachingSample",
  "samplePlan",
  "scenarioSafety",
  "scenarioTeaching",
  "motivation",
  "teachOften",
  "availability",
  "referenceName",
  "referenceEmail",
  "legalName",
  "codeQuestions",
  "code",
  "ownWords",
];

/* ── What the reviewer gets flagged (never blocks) ─────────────────── */

/**
 * Soft flags for the desk (spec section 5): things worth a second look, none
 * of which refuse anything.
 */
export function applicationFlags(
  app: { seasons: TeacherSeason[]; answers: Partial<Record<TeachAnswerKey, string | null>> },
  opts: { profileTeam: number | null; now?: Date }
): string[] {
  const now = opts.now ?? new Date();
  const flags: string[] = [];
  if (opts.profileTeam && app.seasons.length && !app.seasons.some((s) => s.team === opts.profileTeam))
    flags.push(`Their profile says team ${opts.profileTeam}, which isn’t in their seasons.`);
  const thisYear = now.getUTCFullYear();
  if (now.getUTCMonth() <= 2 && app.seasons.some((s) => s.year === thisYear))
    flags.push(`A season is ${thisYear}. Check its events have happened.`);

  const present = TEACH_ANSWER_KEYS.filter((k) => app.answers[k]);
  for (const k of present) {
    const n = wordCount(app.answers[k]!);
    const min = TEACH_ANSWERS[k].minWords;
    if (n < min * 1.15) flags.push(`${TEACH_ANSWERS[k].label} is right at the minimum (${n} words).`);
  }
  const sets = new Map(present.map((k) => [k, shingles(app.answers[k]!)]));
  for (let i = 0; i < present.length; i++) {
    for (let j = i + 1; j < present.length; j++) {
      const c = containment(sets.get(present[i])!, sets.get(present[j])!);
      if (c >= 0.2 && c < 0.5)
        flags.push(`${TEACH_ANSWERS[present[i]].label} and ${TEACH_ANSWERS[present[j]].label} share a lot of wording.`);
    }
  }
  for (const k of present) {
    if (/(\p{L})\1{5,}/u.test(app.answers[k]!))
      flags.push(`There’s a long run of one letter in ${TEACH_ANSWERS[k].label}.`);
  }
  return flags;
}

/** The Blue Alliance's and FRC Events' pages for one team's season. */
export function seasonLinks(s: { year: number; team: number }): { tbaUrl: string; frcEventsUrl: string } {
  return {
    tbaUrl: `https://www.thebluealliance.com/team/${s.team}/${s.year}`,
    frcEventsUrl: `https://frc-events.firstinspires.org/${s.year}/team/${s.team}`,
  };
}

/* ── The catalog the form picks from ───────────────────────────────── */

/**
 * Departments, their modules and each module's lessons, in catalog order
 * (scheduleTopicOptions in src/lib/app/classes-teaching.ts). Here so the
 * client form imports the type from a pure module.
 */
export type CatalogGroup = {
  department: string;
  modules: { id: string; title: string; lessons: { id: string; title: string }[] }[];
};

/**
 * The answers from someone's last turned-down or withdrawn application, to
 * fill the form when they apply again (web only, never in an API). Never
 * the name, the reference or the ticked boxes.
 */
export type PreviousTeachAnswers = {
  seasons: TeacherSeason[];
  roles: string[];
  experience: string;
  otherPrograms: string;
  topicIds: string[];
  sampleLessonId: string | null;
  teachingSample: string;
  samplePlan: string;
  scenarioSafety: string;
  scenarioTeaching: string;
  motivation: string;
  teachOften: string | null;
  availability: string;
  codeQuestions: string;
};

/**
 * Owner and staff accounts never get an hours letter (section 9.1): an owner
 * email, any site_admins row, the safety lead, or an id in
 * CLASSES_NO_LETTER_USER_IDS. Accepting such an account as a teacher sets
 * class_teachers.letters_blocked.
 */
export function lettersBlockedFor(facts: {
  ownerEmail: boolean;
  siteAdmin: boolean;
  safetyLead: boolean;
  noLetterId: boolean;
}): boolean {
  return facts.ownerEmail || facts.siteAdmin || facts.safetyLead || facts.noLetterId;
}

/* ── Where someone stands on /apply/teach ──────────────────────────── */

/**
 * The state /apply/teach renders and the app's GET /api/app/apply reports as
 * the teacher role's `status`. Add values, never rename them: installed app
 * copies read this string.
 */
export type TeachApplyMode =
  | "hidden"
  | "signed-out"
  | "no-handle"
  | "device-blocked"
  | "needs-age"
  | "adult"
  | "parent-declined"
  | "suspended"
  | "code-outdated"
  | "teacher"
  | "pending"
  | "again"
  | "new";

export type TeacherApplicationStatus = "pending" | "accepted" | "rejected" | "withdrawn";

/**
 * The mode, from the facts. Eligibility first (section 4): someone hidden,
 * signed out, without a handle or an age answer, on a blocked device or 18+
 * can't apply or teach. Then an existing teacher row (suspended, an old code
 * version, or teaching). Then a parent who said no. Then the application.
 *
 * Applying is open in needs_parent, waiting_parent and ready: the parent OK
 * can come after the application, but scheduling waits for it. The full-season
 * rule isn't a mode: the form asks it first and the server refuses without it.
 */
export function teachApplyMode(input: {
  eligibility: Eligibility;
  teacher: { suspended: boolean; codeCurrent: boolean } | null;
  latest: TeacherApplicationStatus | null;
}): TeachApplyMode {
  switch (input.eligibility) {
    case "hidden":
      return "hidden";
    case "signed_out":
      return "signed-out";
    case "needs_handle":
      return "no-handle";
    case "device_blocked":
      return "device-blocked";
    case "needs_age":
      return "needs-age";
    case "adult":
      return "adult";
  }
  if (input.teacher) {
    if (input.teacher.suspended) return "suspended";
    if (!input.teacher.codeCurrent) return "code-outdated";
    return "teacher";
  }
  if (input.eligibility === "parent_declined") return "parent-declined";
  if (input.latest === "pending") return "pending";
  if (input.latest === "rejected" || input.latest === "withdrawn") return "again";
  return "new";
}

/** The modes that show the application form. */
export function canApplyIn(mode: TeachApplyMode): boolean {
  return mode === "new" || mode === "again";
}

/** The parent step, as the desk and the apply page word it. */
export type ParentStep = "agreed" | "waiting" | "not_asked" | "declined";

export function parentStepFor(eligibility: Eligibility): ParentStep | null {
  switch (eligibility) {
    case "ready":
      return "agreed";
    case "waiting_parent":
      return "waiting";
    case "needs_parent":
      return "not_asked";
    case "parent_declined":
      return "declined";
    default:
      return null;
  }
}

/** The latest parent OK row's status, as a step (for the desk, which reads rows). */
export function parentStepFromRows(
  rows: { status: string; expires_at: string }[],
  now: Date = new Date()
): ParentStep {
  if (rows.some((r) => r.status === "agreed")) return "agreed";
  const latest = rows[0];
  if (!latest) return "not_asked";
  if (latest.status === "sent" && Date.parse(latest.expires_at) > now.getTime()) return "waiting";
  if (latest.status === "declined" || latest.status === "revoked") return "declined";
  return "not_asked";
}

export const PARENT_STEP_WORDS: Record<ParentStep, string> = {
  agreed: "parent OK given",
  waiting: "parent OK requested, not answered",
  not_asked: "parent OK not asked yet",
  declined: "parent said no",
};
