"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { applyToTeach, type TeachFormState } from "@/app/actions/class-teachers";
import { TEACHER_CODE } from "@/lib/classes/notice";
import {
  EARLIEST_LISTED_YEAR,
  FIRST_FRC_YEAR,
  FRC_ROLES,
  MAX_SEASONS,
  TEACHER_APPLY_LIMITS,
  TEACH_ANSWERS,
  TEACH_OFTEN,
  wordCount,
  type CatalogGroup,
  type PreviousTeachAnswers,
  type TeachAnswerKey,
} from "@/lib/classes/teacher-rules";

/**
 * The teacher application (the second form, decided Nov 9:
 * teacher-application-spec.md section 3). It asks first whether they've
 * finished a full FRC season; "Not yet" stops it before any writing. Then
 * five sections: FRC experience, what they'd teach, one lesson taught on
 * paper, two situations, and the practical bits and the code.
 *
 * Every question, limit and word floor comes from teacher-rules.ts, the same
 * table submitTeacherApplication checks against, and the server sends every
 * problem at once: they show in a summary at the top (focused, with links to
 * each field) and under each field.
 *
 * EVERY FIELD IS CONTROLLED: React resets a `<form action={fn}>` on every
 * dispatch, whichever way the action answers, so an uncontrolled field would
 * be emptied by a refusal. One reducer holds the whole form, season rows
 * included.
 *
 * THE DRAFT stays on this device (localStorage, per account), saved 800 ms
 * after a change. Never the name, the reference or the two ticked boxes:
 * family computers are shared, and the boxes are ticked fresh each time. It's
 * read after mount, never during render, so the server's HTML and the first
 * client render match. Storage can be blocked; the form works the same.
 */

const L = TEACHER_APPLY_LIMITS;
const SAVE_MS = 800;
const CLEAR_ARMED_MS = 5000;

type SeasonRow = { key: number; year: string; earlier: string; team: string; events: string };

type Fields = {
  fullSeason: "" | "yes" | "no";
  seasons: SeasonRow[];
  frcRoles: string[];
  experience: string;
  otherPrograms: string;
  topicIds: string[];
  sampleLessonId: string;
  teachingSample: string;
  samplePlan: string;
  scenarioSafety: string;
  scenarioTeaching: string;
  motivation: string;
  teachOften: string;
  availability: string;
  referenceName: string;
  referenceEmail: string;
  legalName: string;
  codeQuestions: string;
  code: boolean;
  ownWords: boolean;
};

type TextField = Exclude<keyof Fields, "fullSeason" | "seasons" | "frcRoles" | "topicIds" | "code" | "ownWords">;

/** What never goes into the draft. */
const NOT_SAVED = ["legalName", "referenceName", "referenceEmail", "code", "ownWords"] as const;

type Form = {
  fields: Fields;
  nextKey: number;
  /** User edits since load; 0 means nothing to save. */
  rev: number;
  /** A draft is on this device (restored, or saved since). */
  saved: boolean;
};

type Action =
  | { type: "text"; name: TextField; value: string }
  | { type: "fullSeason"; value: "yes" | "no" }
  | { type: "box"; name: "code" | "ownWords"; value: boolean }
  | { type: "toggle"; name: "frcRoles" | "topicIds"; id: string; on: boolean }
  | { type: "season"; index: number; part: "year" | "earlier" | "team" | "events"; value: string }
  | { type: "addSeason" }
  | { type: "removeSeason"; index: number }
  | { type: "replace"; fields: Fields; nextKey: number; saved: boolean }
  | { type: "saved" };

/** The module each lesson belongs to, and every module id, from the catalog. */
function catalogIndex(groups: CatalogGroup[]) {
  const lessonModule = new Map<string, string>();
  const modules = new Map<string, { title: string; lessons: { id: string; title: string }[] }>();
  for (const g of groups)
    for (const m of g.modules) {
      modules.set(m.id, { title: m.title, lessons: m.lessons });
      for (const l of m.lessons) lessonModule.set(l.id, m.id);
    }
  return { lessonModule, modules };
}

function reducer(index: ReturnType<typeof catalogIndex>) {
  return (state: Form, a: Action): Form => {
    const f = state.fields;
    const next = (fields: Fields, extra: Partial<Form> = {}): Form => ({
      ...state,
      ...extra,
      fields,
      rev: state.rev + 1,
    });
    switch (a.type) {
      case "text":
        return next({ ...f, [a.name]: a.value });
      case "fullSeason":
        return next({ ...f, fullSeason: a.value });
      case "box":
        return next({ ...f, [a.name]: a.value });
      case "toggle": {
        const list = f[a.name];
        if (a.on && a.name === "topicIds" && !list.includes(a.id) && list.length >= L.maxTopicIds) return state;
        const updated = a.on ? (list.includes(a.id) ? list : [...list, a.id]) : list.filter((x) => x !== a.id);
        // Unpicking the sample lesson's module clears the lesson.
        const keepLesson =
          a.name !== "topicIds" || !f.sampleLessonId || updated.includes(index.lessonModule.get(f.sampleLessonId) ?? "");
        return next({ ...f, [a.name]: updated, sampleLessonId: keepLesson ? f.sampleLessonId : "" });
      }
      case "season":
        return next({
          ...f,
          seasons: f.seasons.map((s, i) => (i === a.index ? { ...s, [a.part]: a.value } : s)),
        });
      case "addSeason":
        if (f.seasons.length >= MAX_SEASONS) return state;
        return next(
          { ...f, seasons: [...f.seasons, { key: state.nextKey, year: "", earlier: "", team: "", events: "" }] },
          { nextKey: state.nextKey + 1 }
        );
      case "removeSeason":
        if (f.seasons.length <= 1) return state;
        return next({ ...f, seasons: f.seasons.filter((_, i) => i !== a.index) });
      case "replace":
        // A restore or a clear: not an edit, so it doesn't trigger a save.
        return { fields: a.fields, nextKey: a.nextKey, rev: 0, saved: a.saved };
      case "saved":
        return state.saved ? state : { ...state, saved: true };
    }
  };
}

/** A season as the row's two year controls hold it. */
function yearParts(year: number): { year: string; earlier: string } {
  return year >= EARLIEST_LISTED_YEAR ? { year: String(year), earlier: "" } : { year: "earlier", earlier: String(year) };
}

/** What the form opens with: the last application's answers in `again` mode, else the profile's team in row 1. */
function prefill(
  props: { teamNumber: number | null; previous: PreviousTeachAnswers | null },
  index: ReturnType<typeof catalogIndex>
): Form {
  const p = props.previous;
  const seasons: SeasonRow[] = p?.seasons.length
    ? p.seasons.slice(0, MAX_SEASONS).map((s, i) => ({ key: i, ...yearParts(s.year), team: String(s.team), events: s.events }))
    : [{ key: 0, year: "", earlier: "", team: props.teamNumber ? String(props.teamNumber) : "", events: "" }];
  const topicIds = (p?.topicIds ?? []).filter((id) => index.modules.has(id)).slice(0, L.maxTopicIds);
  const lessonModule = p?.sampleLessonId ? index.lessonModule.get(p.sampleLessonId) : undefined;
  return {
    nextKey: seasons.length,
    rev: 0,
    saved: false,
    fields: {
      fullSeason: "",
      seasons,
      frcRoles: (p?.roles ?? []).filter((id) => FRC_ROLES.some((r) => r.id === id)),
      experience: p?.experience ?? "",
      otherPrograms: p?.otherPrograms ?? "",
      topicIds,
      sampleLessonId: p?.sampleLessonId && lessonModule && topicIds.includes(lessonModule) ? p.sampleLessonId : "",
      teachingSample: p?.teachingSample ?? "",
      samplePlan: p?.samplePlan ?? "",
      scenarioSafety: p?.scenarioSafety ?? "",
      scenarioTeaching: p?.scenarioTeaching ?? "",
      motivation: p?.motivation ?? "",
      teachOften: TEACH_OFTEN.some((t) => t.id === p?.teachOften) ? (p?.teachOften as string) : "",
      availability: p?.availability ?? "",
      referenceName: "",
      referenceEmail: "",
      legalName: "",
      codeQuestions: p?.codeQuestions ?? "",
      code: false,
      ownWords: false,
    },
  };
}

/** The saved draft over the prefill. Anything malformed is ignored, field by field. */
function withDraft(base: Form, raw: unknown, index: ReturnType<typeof catalogIndex>): Form | null {
  if (!raw || typeof raw !== "object") return null;
  const d = (raw as { fields?: unknown }).fields;
  if (!d || typeof d !== "object") return null;
  const r = d as Record<string, unknown>;
  const s = (k: string, max = 5000) => (typeof r[k] === "string" ? (r[k] as string).slice(0, max) : undefined);
  const ids = (k: string) => (Array.isArray(r[k]) ? (r[k] as unknown[]).filter((x): x is string => typeof x === "string") : undefined);
  const f: Fields = { ...base.fields };
  const fullSeason = s("fullSeason");
  if (fullSeason === "yes" || fullSeason === "no" || fullSeason === "") f.fullSeason = fullSeason;
  if (Array.isArray(r.seasons) && r.seasons.length) {
    f.seasons = (r.seasons as unknown[]).slice(0, MAX_SEASONS).map((row, i) => {
      const o = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
      const t = (k: string) => (typeof o[k] === "string" ? (o[k] as string).slice(0, 300) : "");
      return { key: i, year: t("year"), earlier: t("earlier"), team: t("team"), events: t("events") };
    });
  }
  const roles = ids("frcRoles");
  if (roles) f.frcRoles = roles.filter((id) => FRC_ROLES.some((x) => x.id === id));
  const topics = ids("topicIds");
  if (topics) f.topicIds = topics.filter((id) => index.modules.has(id)).slice(0, L.maxTopicIds);
  const lesson = s("sampleLessonId");
  if (lesson !== undefined)
    f.sampleLessonId = f.topicIds.includes(index.lessonModule.get(lesson) ?? "") ? lesson : "";
  for (const k of [
    "experience",
    "otherPrograms",
    "teachingSample",
    "samplePlan",
    "scenarioSafety",
    "scenarioTeaching",
    "motivation",
    "availability",
    "codeQuestions",
  ] as const) {
    const v = s(k);
    if (v !== undefined) f[k] = v;
  }
  const often = s("teachOften");
  if (often !== undefined && (often === "" || TEACH_OFTEN.some((t) => t.id === often))) f.teachOften = often;
  return { fields: f, nextKey: f.seasons.length, rev: 0, saved: true };
}

function draftOf(f: Fields) {
  const out: Record<string, unknown> = {
    ...f,
    seasons: f.seasons.map((s) => ({ year: s.year, earlier: s.earlier, team: s.team, events: s.events })),
  };
  for (const k of NOT_SAVED) delete out[k];
  return out;
}

/** Every localStorage call, wrapped: blocked storage just means no draft. */
const store = {
  get(key: string): unknown {
    try {
      const v = window.localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown): boolean {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* storage blocked: nothing was saved */
    }
  },
};

/* ── Where each problem points ─────────────────────────────────────── */

const fieldId = (field: string) => `teach-${field}`;

const SUMMARY_LABELS: Record<string, string> = {
  fullSeason: "Full FRC season",
  seasons: "Your FRC seasons",
  frcRoles: "What you worked on",
  otherPrograms: "Other robotics programs",
  topicIds: "Modules you could teach",
  sampleLessonId: "The lesson you’d teach",
  teachOften: "How often you could teach",
  availability: "When you’re usually free",
  referenceName: "Mentor or coach",
  referenceEmail: "Their email",
  legalName: "Name as your school knows it",
  codeQuestions: "Questions about the code",
  code: "The teacher code",
  ownWords: "Your own words",
  ...Object.fromEntries(Object.entries(TEACH_ANSWERS).map(([k, a]) => [k, a.label])),
};

/** "Season 2: pick the year." already says where it is. */
const summaryLine = (p: { field: string; error: string }) =>
  p.field.startsWith("season-") || !SUMMARY_LABELS[p.field] ? p.error : `${SUMMARY_LABELS[p.field]}: ${p.error}`;

/** Focuses a field from the summary: the control itself, or a group's first box. */
function jumpTo(e: React.MouseEvent, id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  const target = el.matches("input, select, textarea, button")
    ? el
    : (el.querySelector<HTMLElement>(
        "input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])"
      ) ?? el);
  el.scrollIntoView({ block: "center" });
  target.focus({ preventScroll: true });
}

/* ── Pieces ────────────────────────────────────────────────────────── */

function FieldError({ id, text }: { id: string; text: string | null }) {
  return text ? (
    <p id={`${id}-error`} className="nb-error">
      {text}
    </p>
  ) : null;
}

const describedBy = (...ids: (string | false | null | undefined)[]) => ids.filter(Boolean).join(" ") || undefined;

function SectionLegend({ n, title }: { n: number; title: string }) {
  return (
    <legend className="mb-1 w-full border-t-2 border-ink pt-5">
      <h3>
        <span className="nb-slug mr-2 align-middle font-bold text-ink">{n}.</span>
        {title}
      </h3>
    </legend>
  );
}

function LongAnswer({
  name,
  value,
  onChange,
  onBlur,
  left,
  serverError,
}: {
  name: TeachAnswerKey;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  left: boolean;
  serverError: string | null;
}) {
  const a = TEACH_ANSWERS[name];
  const id = fieldId(name);
  const n = wordCount(value);
  const under = n < a.minWords;
  const error = serverError ?? (left && under ? `Write at least ${a.minWords} words. You’re at ${n}.` : null);
  return (
    <div className="nb-field">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label htmlFor={id} className="nb-label">
          {a.question}
        </label>
        <span id={`${id}-count`} className="nb-slug tabular-nums">
          {under ? `${n} / ${a.minWords} words` : `${n} words, aim for ${a.minWords} to ${a.aimWords}`}
        </span>
      </div>
      {a.situation ? (
        <p id={`${id}-situation`} className="max-w-[64ch] text-[0.97rem] leading-relaxed">
          {a.situation}
        </p>
      ) : null}
      <textarea
        id={id}
        name={name}
        rows={a.rows}
        maxLength={a.maxChars}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-describedby={describedBy(
          a.situation && `${id}-situation`,
          a.hint && `${id}-hint`,
          `${id}-count`,
          error && `${id}-error`
        )}
        aria-invalid={error ? true : undefined}
        className="nb-input"
      />
      {a.hint ? (
        <p id={`${id}-hint`} className="nb-hint max-w-[70ch]">
          {a.hint}
        </p>
      ) : null}
      <FieldError id={id} text={error} />
    </div>
  );
}

function ShortField({
  name,
  label,
  hint,
  placeholder,
  maxLength,
  value,
  onChange,
  error,
  type = "text",
  autoComplete,
  hintId,
}: {
  name: TextField;
  label: string;
  hint?: string;
  placeholder?: string;
  maxLength: number;
  value: string;
  onChange: (v: string) => void;
  error: string | null;
  type?: "text" | "email";
  autoComplete?: string;
  /** A hint shared with another field, printed elsewhere. */
  hintId?: string;
}) {
  const id = fieldId(name);
  return (
    <div className="nb-field content-start">
      <label htmlFor={id} className="nb-label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-describedby={describedBy(hint && `${id}-hint`, hintId, error && `${id}-error`)}
        aria-invalid={error ? true : undefined}
        className="nb-input"
      />
      {hint ? (
        <p id={`${id}-hint`} className="nb-hint">
          {hint}
        </p>
      ) : null}
      <FieldError id={id} text={error} />
    </div>
  );
}

/* ── The form ──────────────────────────────────────────────────────── */

export function TeachForm({
  username,
  teamNumber,
  teamRole,
  again,
  groups,
  codeVersion,
  draftKey,
  previous,
  thisYear,
}: {
  username: string;
  teamNumber: number | null;
  teamRole: string | null;
  again: boolean;
  groups: CatalogGroup[];
  codeVersion: string;
  /** `lf-teach-draft:v2:<user id>`, so two accounts on one computer don't share a draft. */
  draftKey: string;
  /** In `again` mode, the last application's answers (never the name or reference). */
  previous: PreviousTeachAnswers | null;
  /** The server's year, so the year list renders the same on both sides. */
  thisYear: number;
}) {
  const index = React.useMemo(() => catalogIndex(groups), [groups]);
  const reduce = React.useMemo(() => reducer(index), [index]);
  const initial = React.useCallback(() => prefill({ teamNumber, previous }, index), [teamNumber, previous, index]);
  const [form, dispatch] = React.useReducer(reduce, undefined, initial);
  const f = form.fields;

  const [state, formAction, isPending] = useActionState<TeachFormState, FormData>(applyToTeach, undefined);
  const [clearArmed, setClearArmed] = React.useState(false);
  const [left, setLeft] = React.useState<string[]>([]);
  // Fields typed in since the last answer from the server: their server
  // error is cleared. Keyed on that answer, so a new one starts fresh.
  const [edited, setEdited] = React.useState<{ for: TeachFormState; fields: string[] }>({ for: undefined, fields: [] });
  const sentRef = React.useRef<HTMLDivElement>(null);
  const summaryRef = React.useRef<HTMLDivElement>(null);

  const problems = React.useMemo(() => state?.problems ?? [], [state]);
  const editedFields = edited.for === state ? edited.fields : [];
  const serverError = (field: string) =>
    editedFields.includes(field) ? null : (problems.find((p) => p.field === field)?.error ?? null);
  const touch = (...fields: string[]) =>
    setEdited((e) => {
      const base = e.for === state ? e.fields : [];
      return { for: state, fields: [...new Set([...base, ...fields])] };
    });
  const leave = (field: string) => setLeft((l) => (l.includes(field) ? l : [...l, field]));
  const text = (name: TextField) => (v: string) => {
    dispatch({ type: "text", name, value: v });
    touch(name);
  };

  // The draft, read once after mount (once per account), never again on a re-render.
  const restoredFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (restoredFor.current === draftKey) return;
    restoredFor.current = draftKey;
    const restored = withDraft(initial(), store.get(draftKey), index);
    if (restored) {
      dispatch({ type: "replace", fields: restored.fields, nextKey: restored.nextKey, saved: true });
    }
  }, [draftKey, index, initial]);

  // Saved 800 ms after an edit, while the form is open.
  React.useEffect(() => {
    if (form.rev === 0 || f.fullSeason !== "yes" || state?.success) return;
    const t = window.setTimeout(() => {
      if (store.set(draftKey, { savedAt: new Date().toISOString(), fields: draftOf(f) })) dispatch({ type: "saved" });
    }, SAVE_MS);
    return () => window.clearTimeout(t);
  }, [form.rev, f, draftKey, state?.success]);

  React.useEffect(() => {
    if (!clearArmed) return;
    const t = window.setTimeout(() => setClearArmed(false), CLEAR_ARMED_MS);
    return () => window.clearTimeout(t);
  }, [clearArmed]);

  React.useEffect(() => {
    if (state?.success) {
      store.remove(draftKey);
      sentRef.current?.focus();
    } else if (state?.error) {
      summaryRef.current?.focus();
    }
  }, [state, draftKey]);

  if (state?.success) {
    return (
      <div ref={sentRef} tabIndex={-1} role="status" className="nb-box nb-tilt-4 p-[clamp(1.1rem,2.4vw,1.6rem)]">
        <span className="nb-tape -top-3 left-[26%] rotate-[-3.4deg]" aria-hidden="true" />
        <p className="nb-slug">sent / waiting on a decision</p>
        <p className="mt-2 font-semibold">Thank you. It&rsquo;s in.</p>
        <p className="mt-2 max-w-[54ch] text-[0.95rem] leading-relaxed text-graphite">
          A person reads every application, and you&rsquo;ll get an email either way. Until then this page
          says where it stands, and you can withdraw it from here.
        </p>
      </div>
    );
  }

  const record = [teamNumber ? `team ${teamNumber}` : "team not set", teamRole || null].filter(Boolean).join(" / ");
  const years = Array.from({ length: thisYear - EARLIEST_LISTED_YEAR + 1 }, (_, i) => String(thisYear - i));
  const pickedModules = f.topicIds
    .map((id) => ({ id, ...index.modules.get(id) }))
    .filter((m): m is { id: string; title: string; lessons: { id: string; title: string }[] } => !!m.title);
  const full = f.topicIds.length >= L.maxTopicIds;
  const generalError = state?.error && problems.length === 0 ? state.error : null;

  const clearDraft = () => {
    if (!clearArmed) {
      setClearArmed(true);
      return;
    }
    store.remove(draftKey);
    const fresh = initial();
    dispatch({ type: "replace", fields: fresh.fields, nextKey: fresh.nextKey, saved: false });
    setClearArmed(false);
    setLeft([]);
  };

  return (
    <>
      <div className="nb-note max-w-[70ch]">
        <p className="nb-slug">before you start</p>
        <p className="mt-2 text-[0.97rem] leading-relaxed">
          This takes about 25 minutes. Most of it is writing, and that&rsquo;s on purpose: it&rsquo;s how we see
          how you&rsquo;d teach. Your answers save on this device as you go, so you can stop and come back.
        </p>
        <p className="mt-3 text-[0.97rem] font-semibold">Have these ready:</p>
        <div className="nb-prose mt-1.5">
          <ul>
            <li>The FRC seasons you&rsquo;ve done, your team number each year, and the official events you went to.</li>
            <li>One LearnFRC lesson you know well enough to teach.</li>
            <li>If you like, the name and email of a mentor or coach on your team.</li>
          </ul>
        </div>
      </div>

      <div className="nb-hair mt-6 pt-4">
        <p className="nb-slug">what the reviewer sees</p>
        <p className="mt-1.5 text-[1.02rem] font-bold">
          @{username}
          <span className="nb-slug ml-2 font-normal">{record}</span>
        </p>
        <p className="mt-2 max-w-[56ch] text-[0.93rem] leading-relaxed text-graphite">
          That line, your answers below and your age group. Your seasons, your name and your reference are seen
          only by LearnFRC&rsquo;s reviewers, never by students.
        </p>
      </div>

      <form action={formAction} className="mt-6" noValidate>
        {state?.error ? (
          <div ref={summaryRef} tabIndex={-1} role="alert" className="nb-note mb-6 max-w-[70ch]">
            {generalError ? (
              <p className="font-semibold">{generalError}</p>
            ) : (
              <>
                <p className="font-semibold">
                  Fix {problems.length} {problems.length === 1 ? "thing" : "things"} before sending
                </p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {problems.map((p) => (
                    <li key={`${p.field}:${p.error}`}>
                      <a
                        href={`#${fieldId(p.field)}`}
                        onClick={(e) => jumpTo(e, fieldId(p.field))}
                        className="nb-link text-[0.95rem]"
                      >
                        {summaryLine(p)}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : null}

        <fieldset disabled={isPending} className="m-0 flex min-w-0 flex-col gap-6 border-0 p-0">
          <fieldset
            id={fieldId("fullSeason")}
            tabIndex={-1}
            className="nb-field m-0 min-w-0 border-0 p-0"
            aria-describedby={describedBy(`${fieldId("fullSeason")}-hint`, serverError("fullSeason") && `${fieldId("fullSeason")}-error`)}
          >
            <legend className="nb-label mb-1.5 text-[0.85rem] font-bold">Have you finished at least one full FRC season?</legend>
            <p id={`${fieldId("fullSeason")}-hint`} className="nb-hint max-w-[70ch]">
              A full season is a build season plus at least one official event: a regional, a district event, a
              district championship or the FIRST Championship. Off-season events and scrimmages don&rsquo;t count.
              FTC and FLL are great background, but teaching needs at least one FRC season.
            </p>
            <div className="mt-1 flex flex-wrap gap-x-6">
              {(
                [
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "Not yet" },
                ] as const
              ).map((o) => (
                <label key={o.value} className="flex min-h-[2.75rem] cursor-pointer items-center gap-3 text-[0.97rem] font-semibold">
                  <input
                    type="radio"
                    name="fullSeason"
                    value={o.value}
                    className="size-4 shrink-0"
                    checked={f.fullSeason === o.value}
                    onChange={() => {
                      dispatch({ type: "fullSeason", value: o.value });
                      touch("fullSeason");
                    }}
                  />
                  {o.label}
                </label>
              ))}
            </div>
            <FieldError id={fieldId("fullSeason")} text={serverError("fullSeason")} />
          </fieldset>

          {f.fullSeason === "no" ? (
            <div className="nb-box nb-tilt-2 p-[clamp(1.1rem,2.6vw,1.8rem)]">
              <span className="nb-tape -top-3 left-[18%] rotate-[-3deg]" aria-hidden="true" />
              <p className="nb-slug">not yet</p>
              <p className="mt-3 max-w-[58ch] text-[0.99rem] leading-relaxed">
                Teaching opens after your first full FRC season. Come back after your first official event, and
                we&rsquo;d love to hear from you then. Every lesson on LearnFRC is still yours in the meantime.
              </p>
              <Link href="/guides" className="nb-btn mt-6">
                Browse the guides
              </Link>
            </div>
          ) : null}

          {f.fullSeason === "yes" ? (
            <>
              {/* ── 1. FRC experience ── */}
              <fieldset className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
                <SectionLegend n={1} title="Your FRC experience" />
                <p className="nb-hint max-w-[70ch]">
                  Only LearnFRC&rsquo;s reviewers see this section. We check your seasons against official event
                  results. None of it shows next to your classes, and your team doesn&rsquo;t have to be on your
                  profile.
                </p>

                <fieldset id={fieldId("seasons")} tabIndex={-1} className="nb-field m-0 min-w-0 border-0 p-0">
                  <legend className="nb-label mb-1.5">Your FRC seasons</legend>
                  <p id="teach-events-hint" className="nb-hint">
                    For each season: the year, your team number that year, and the official events you competed
                    at. Name them the way The Blue Alliance does. Leave out off-season events.
                  </p>
                  <FieldError id={fieldId("seasons")} text={serverError("seasons")} />
                  <ol className="mt-1 flex list-none flex-col gap-4 p-0">
                    {f.seasons.map((s, i) => {
                      const n = i + 1;
                      const yid = fieldId(`season-${n}-year`);
                      const tid = fieldId(`season-${n}-team`);
                      const eid = fieldId(`season-${n}-events`);
                      const yErr = serverError(`season-${n}-year`);
                      const tErr = serverError(`season-${n}-team`);
                      const eErr = serverError(`season-${n}-events`);
                      const set = (part: "year" | "earlier" | "team" | "events", field: string) => (value: string) => {
                        dispatch({ type: "season", index: i, part, value });
                        touch(field);
                      };
                      return (
                        <li key={s.key} className="nb-hair pt-3 first:border-t-0 first:pt-0">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="nb-slug font-bold text-ink">season {n}</p>
                            {i > 0 ? (
                              <button
                                type="button"
                                className="nb-btn-ghost nb-btn-sm"
                                onClick={() => {
                                  dispatch({ type: "removeSeason", index: i });
                                  touch(
                                    ...f.seasons.flatMap((_, j) =>
                                      ["year", "team", "events"].map((p) => `season-${j + 1}-${p}`)
                                    )
                                  );
                                }}
                              >
                                Remove<span className="sr-only"> season {n}</span>
                              </button>
                            ) : null}
                          </div>
                          <input type="hidden" name="seasonYear" value={s.year === "earlier" ? s.earlier : s.year} />
                          <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,8.5rem)_minmax(0,8.5rem)_minmax(0,1fr)]">
                            <div className="nb-field content-start">
                              <label htmlFor={yid} className="nb-label">
                                Year<span className="sr-only">, season {n}</span>
                              </label>
                              <select
                                id={yid}
                                value={s.year}
                                onChange={(e) => set("year", `season-${n}-year`)(e.target.value)}
                                aria-invalid={yErr ? true : undefined}
                                aria-describedby={describedBy(yErr && `${yid}-error`)}
                                className="nb-input nb-select"
                              >
                                <option value="">Pick</option>
                                {years.map((y) => (
                                  <option key={y} value={y}>
                                    {y}
                                  </option>
                                ))}
                                <option value="earlier">Earlier</option>
                              </select>
                              {s.year === "earlier" ? (
                                <>
                                  <label htmlFor={`${yid}-earlier`} className="sr-only">
                                    Which year, season {n}
                                  </label>
                                  <input
                                    id={`${yid}-earlier`}
                                    type="number"
                                    inputMode="numeric"
                                    min={FIRST_FRC_YEAR}
                                    max={EARLIEST_LISTED_YEAR - 1}
                                    placeholder="year"
                                    value={s.earlier}
                                    onChange={(e) => set("earlier", `season-${n}-year`)(e.target.value)}
                                    aria-invalid={yErr ? true : undefined}
                                    className="nb-input"
                                  />
                                </>
                              ) : null}
                              <FieldError id={yid} text={yErr} />
                            </div>
                            <div className="nb-field content-start">
                              <label htmlFor={tid} className="nb-label">
                                Team number<span className="sr-only">, season {n}</span>
                              </label>
                              <input
                                id={tid}
                                name="seasonTeam"
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={L.teamNumberMax}
                                value={s.team}
                                onChange={(e) => set("team", `season-${n}-team`)(e.target.value)}
                                aria-invalid={tErr ? true : undefined}
                                aria-describedby={describedBy(tErr && `${tid}-error`)}
                                className="nb-input"
                              />
                              <FieldError id={tid} text={tErr} />
                            </div>
                            <div className="nb-field content-start">
                              <label htmlFor={eid} className="nb-label">
                                Official events you competed at<span className="sr-only">, season {n}</span>
                              </label>
                              <input
                                id={eid}
                                name="seasonEvents"
                                type="text"
                                maxLength={L.seasonEventsMax}
                                placeholder="the regionals or district events, by name"
                                value={s.events}
                                onChange={(e) => set("events", `season-${n}-events`)(e.target.value)}
                                aria-invalid={eErr ? true : undefined}
                                aria-describedby={describedBy("teach-events-hint", eErr && `${eid}-error`)}
                                className="nb-input"
                              />
                              <FieldError id={eid} text={eErr} />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  {f.seasons.length < MAX_SEASONS ? (
                    <div>
                      <button
                        type="button"
                        className="nb-btn-ghost nb-btn-sm mt-1"
                        onClick={() => dispatch({ type: "addSeason" })}
                      >
                        Add another season
                      </button>
                    </div>
                  ) : null}
                </fieldset>

                <fieldset
                  id={fieldId("frcRoles")}
                  tabIndex={-1}
                  className="nb-field m-0 min-w-0 border-0 p-0"
                  aria-describedby={describedBy(`${fieldId("frcRoles")}-hint`, serverError("frcRoles") && `${fieldId("frcRoles")}-error`)}
                >
                  <legend className="nb-label mb-1.5">What you worked on</legend>
                  <p id={`${fieldId("frcRoles")}-hint`} className="nb-hint">
                    Tick everything you did a real share of.
                  </p>
                  <ul className="mt-1 grid list-none gap-x-6 p-0 sm:grid-cols-2">
                    {FRC_ROLES.map((r) => (
                      <li key={r.id} className="min-w-0">
                        <label className="flex min-h-[2.5rem] cursor-pointer items-center gap-3 text-[0.95rem] leading-snug">
                          <input
                            type="checkbox"
                            name="frcRoles"
                            value={r.id}
                            className="size-4 shrink-0"
                            checked={f.frcRoles.includes(r.id)}
                            onChange={(e) => {
                              dispatch({ type: "toggle", name: "frcRoles", id: r.id, on: e.target.checked });
                              touch("frcRoles");
                            }}
                          />
                          <span className="min-w-0">{r.label}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <FieldError id={fieldId("frcRoles")} text={serverError("frcRoles")} />
                </fieldset>

                <LongAnswer
                  name="experience"
                  value={f.experience}
                  onChange={text("experience")}
                  onBlur={() => leave("experience")}
                  left={left.includes("experience")}
                  serverError={serverError("experience")}
                />

                <ShortField
                  name="otherPrograms"
                  label="Other robotics programs, optional"
                  hint="FLL, FTC, VEX or anything else. It’s useful background, though it doesn’t count toward the FRC season."
                  maxLength={L.otherProgramsMax}
                  value={f.otherPrograms}
                  onChange={text("otherPrograms")}
                  error={serverError("otherPrograms")}
                />
              </fieldset>

              {/* ── 2. What you'd teach ── */}
              <fieldset className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
                <SectionLegend n={2} title="What you’d teach" />
                <fieldset
                  id={fieldId("topicIds")}
                  tabIndex={-1}
                  className="nb-field m-0 min-w-0 border-0 p-0"
                  aria-describedby={describedBy(
                    `${fieldId("topicIds")}-hint`,
                    `${fieldId("topicIds")}-count`,
                    serverError("topicIds") && `${fieldId("topicIds")}-error`
                  )}
                >
                  <legend className="nb-label mb-1.5">Pick 1 to {L.maxTopicIds} LearnFRC modules you could teach</legend>
                  <p id={`${fieldId("topicIds")}-hint`} className="nb-hint">
                    Pick what you know well enough to answer questions on, not everything you&rsquo;ve read.
                  </p>
                  <p id={`${fieldId("topicIds")}-count`} className="nb-slug">
                    {f.topicIds.length} of {L.maxTopicIds} picked{full ? ", untick one to pick another" : ""}
                  </p>
                  <div className="mt-1">
                    {groups.map((g) => {
                      const inGroup = g.modules.filter((m) => f.topicIds.includes(m.id)).length;
                      return (
                        <details key={g.department} className="border-t border-dashed border-rule py-1.5">
                          <summary className="cursor-pointer py-1 text-[0.95rem] font-semibold">
                            {g.department}
                            {inGroup ? <span className="nb-slug ml-2">{inGroup} picked</span> : null}
                          </summary>
                          <ul className="mt-1 grid list-none gap-x-6 p-0 sm:grid-cols-2">
                            {g.modules.map((m) => {
                              const on = f.topicIds.includes(m.id);
                              return (
                                <li key={m.id} className="min-w-0">
                                  <label className="flex min-h-[2.5rem] cursor-pointer items-center gap-3 text-[0.93rem] leading-snug">
                                    <input
                                      type="checkbox"
                                      name="topicIds"
                                      value={m.id}
                                      className="size-4 shrink-0"
                                      checked={on}
                                      disabled={!on && full}
                                      onChange={(e) => {
                                        dispatch({ type: "toggle", name: "topicIds", id: m.id, on: e.target.checked });
                                        touch("topicIds", "sampleLessonId");
                                      }}
                                    />
                                    <span className="min-w-0">{m.title}</span>
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        </details>
                      );
                    })}
                  </div>
                  <FieldError id={fieldId("topicIds")} text={serverError("topicIds")} />
                </fieldset>
              </fieldset>

              {/* ── 3. Teach one lesson ── */}
              <fieldset className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
                <SectionLegend n={3} title="Teach one lesson" />
                <div className="nb-field">
                  <label htmlFor={fieldId("sampleLessonId")} className="nb-label">
                    The lesson you&rsquo;d teach
                  </label>
                  <select
                    id={fieldId("sampleLessonId")}
                    name="sampleLessonId"
                    value={f.sampleLessonId}
                    disabled={pickedModules.length === 0}
                    onChange={(e) => {
                      dispatch({ type: "text", name: "sampleLessonId", value: e.target.value });
                      touch("sampleLessonId");
                    }}
                    aria-invalid={serverError("sampleLessonId") ? true : undefined}
                    aria-describedby={describedBy(
                      `${fieldId("sampleLessonId")}-hint`,
                      serverError("sampleLessonId") && `${fieldId("sampleLessonId")}-error`
                    )}
                    className="nb-input nb-select"
                  >
                    <option value="">{pickedModules.length ? "Pick a lesson" : "Pick a module above first"}</option>
                    {pickedModules.map((m) => (
                      <optgroup key={m.id} label={m.title}>
                        {m.lessons.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.title}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <p id={`${fieldId("sampleLessonId")}-hint`} className="nb-hint">
                    One lesson from a module you picked. The next two answers are about this lesson.
                  </p>
                  <FieldError id={fieldId("sampleLessonId")} text={serverError("sampleLessonId")} />
                </div>

                <LongAnswer
                  name="teachingSample"
                  value={f.teachingSample}
                  onChange={text("teachingSample")}
                  onBlur={() => leave("teachingSample")}
                  left={left.includes("teachingSample")}
                  serverError={serverError("teachingSample")}
                />
                <LongAnswer
                  name="samplePlan"
                  value={f.samplePlan}
                  onChange={text("samplePlan")}
                  onBlur={() => leave("samplePlan")}
                  left={left.includes("samplePlan")}
                  serverError={serverError("samplePlan")}
                />
              </fieldset>

              {/* ── 4. Two situations ── */}
              <fieldset className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
                <SectionLegend n={4} title="Two situations" />
                <div className="nb-note max-w-[70ch]">
                  <p className="nb-slug">the teacher code</p>
                  <div className="nb-prose mt-2.5">
                    <ul>
                      {TEACHER_CODE.map((rule) => (
                        <li key={rule}>{rule}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="max-w-[64ch] text-[0.97rem] leading-relaxed">
                  There&rsquo;s no single right answer. Tell us what you&rsquo;d actually do and say.
                </p>
                <LongAnswer
                  name="scenarioSafety"
                  value={f.scenarioSafety}
                  onChange={text("scenarioSafety")}
                  onBlur={() => leave("scenarioSafety")}
                  left={left.includes("scenarioSafety")}
                  serverError={serverError("scenarioSafety")}
                />
                <LongAnswer
                  name="scenarioTeaching"
                  value={f.scenarioTeaching}
                  onChange={text("scenarioTeaching")}
                  onBlur={() => leave("scenarioTeaching")}
                  left={left.includes("scenarioTeaching")}
                  serverError={serverError("scenarioTeaching")}
                />
              </fieldset>

              {/* ── 5. Why, when, and sign it ── */}
              <fieldset className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
                <SectionLegend n={5} title="Why, when, and sign it" />
                <LongAnswer
                  name="motivation"
                  value={f.motivation}
                  onChange={text("motivation")}
                  onBlur={() => leave("motivation")}
                  left={left.includes("motivation")}
                  serverError={serverError("motivation")}
                />

                <fieldset
                  id={fieldId("teachOften")}
                  tabIndex={-1}
                  className="nb-field m-0 min-w-0 border-0 p-0"
                  aria-describedby={describedBy(
                    `${fieldId("teachOften")}-hint`,
                    serverError("teachOften") && `${fieldId("teachOften")}-error`
                  )}
                >
                  <legend className="nb-label mb-1.5">About how often could you teach?</legend>
                  <p id={`${fieldId("teachOften")}-hint`} className="nb-hint">
                    You pick your own class times. This just helps us plan.
                  </p>
                  <div className="mt-1 flex flex-col">
                    {TEACH_OFTEN.map((t) => (
                      <label key={t.id} className="flex min-h-[2.5rem] cursor-pointer items-center gap-3 text-[0.95rem]">
                        <input
                          type="radio"
                          name="teachOften"
                          value={t.id}
                          className="size-4 shrink-0"
                          checked={f.teachOften === t.id}
                          onChange={() => {
                            dispatch({ type: "text", name: "teachOften", value: t.id });
                            touch("teachOften");
                          }}
                        />
                        {t.label}
                      </label>
                    ))}
                  </div>
                  <FieldError id={fieldId("teachOften")} text={serverError("teachOften")} />
                </fieldset>

                <ShortField
                  name="availability"
                  label="When you’re usually free, optional"
                  placeholder="weekday evenings, Pacific time"
                  maxLength={L.availabilityMax}
                  value={f.availability}
                  onChange={text("availability")}
                  error={serverError("availability")}
                />

                <div className="flex flex-col gap-2">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <ShortField
                      name="referenceName"
                      label="A mentor or coach on your team, optional"
                      maxLength={L.referenceNameMax}
                      value={f.referenceName}
                      onChange={text("referenceName")}
                      error={serverError("referenceName")}
                      hintId="teach-reference-hint"
                    />
                    <ShortField
                      name="referenceEmail"
                      type="email"
                      label="Their email, optional"
                      maxLength={L.referenceEmailMax}
                      value={f.referenceEmail}
                      onChange={text("referenceEmail")}
                      error={serverError("referenceEmail")}
                      hintId="teach-reference-hint"
                    />
                  </div>
                  <p id="teach-reference-hint" className="nb-hint max-w-[70ch]">
                    An adult on your FRC team, not a parent. It helps if your seasons are hard to check. We&rsquo;d
                    only email them if we can&rsquo;t confirm your seasons from event results, and only to ask
                    whether you were on the team. Students never see this.
                  </p>
                </div>

                <ShortField
                  name="legalName"
                  label="Name as your school knows it"
                  hint="This goes on your hours letters, and you can’t change it yourself later. Students never see it. They see your username."
                  maxLength={L.legalNameMax}
                  value={f.legalName}
                  onChange={text("legalName")}
                  error={serverError("legalName")}
                  autoComplete="name"
                />

                <div className="nb-field">
                  <label htmlFor={fieldId("codeQuestions")} className="nb-label">
                    Anything in the teacher code you&rsquo;d find hard to follow, or a question about it? Optional
                  </label>
                  <textarea
                    id={fieldId("codeQuestions")}
                    name="codeQuestions"
                    rows={3}
                    maxLength={L.codeQuestionsMax}
                    value={f.codeQuestions}
                    onChange={(e) => text("codeQuestions")(e.target.value)}
                    aria-invalid={serverError("codeQuestions") ? true : undefined}
                    aria-describedby={describedBy(
                      `${fieldId("codeQuestions")}-hint`,
                      serverError("codeQuestions") && `${fieldId("codeQuestions")}-error`
                    )}
                    className="nb-input min-h-[5.5rem]"
                  />
                  <p id={`${fieldId("codeQuestions")}-hint`} className="nb-hint">
                    Asking won&rsquo;t count against you.
                  </p>
                  <FieldError id={fieldId("codeQuestions")} text={serverError("codeQuestions")} />
                </div>

                <div className="nb-field">
                  <label className="flex min-h-[2.75rem] cursor-pointer items-center gap-3 text-[0.97rem] font-semibold">
                    <input
                      id={fieldId("code")}
                      type="checkbox"
                      name="code"
                      value={codeVersion}
                      className="size-4 shrink-0"
                      checked={f.code}
                      onChange={(e) => {
                        dispatch({ type: "box", name: "code", value: e.target.checked });
                        touch("code");
                      }}
                      aria-invalid={serverError("code") ? true : undefined}
                      aria-describedby={describedBy(serverError("code") && `${fieldId("code")}-error`)}
                    />
                    I agree to the teacher code.
                  </label>
                  <FieldError id={fieldId("code")} text={serverError("code")} />
                </div>

                <div className="nb-field">
                  <label className="flex min-h-[2.75rem] cursor-pointer items-center gap-3 text-[0.97rem] font-semibold">
                    <input
                      id={fieldId("ownWords")}
                      type="checkbox"
                      name="ownWords"
                      value="yes"
                      className="size-4 shrink-0"
                      checked={f.ownWords}
                      onChange={(e) => {
                        dispatch({ type: "box", name: "ownWords", value: e.target.checked });
                        touch("ownWords");
                      }}
                      aria-invalid={serverError("ownWords") ? true : undefined}
                      aria-describedby={describedBy(
                        `${fieldId("ownWords")}-hint`,
                        serverError("ownWords") && `${fieldId("ownWords")}-error`
                      )}
                    />
                    I wrote these answers myself.
                  </label>
                  <p id={`${fieldId("ownWords")}-hint`} className="nb-hint max-w-[70ch]">
                    Checking facts in lessons or the docs is fine. We don&rsquo;t run AI detectors. We read for how
                    you explain things.
                  </p>
                  <FieldError id={fieldId("ownWords")} text={serverError("ownWords")} />
                </div>
              </fieldset>

              <div className="flex flex-col gap-3 border-t-2 border-ink pt-5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <button type="submit" className="nb-btn" disabled={isPending} aria-busy={isPending}>
                    {isPending ? "Sending" : again ? "Send it again" : "Send the application"}
                  </button>
                  <span className="nb-hint">You&rsquo;ll get an email when it&rsquo;s decided.</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {form.saved ? <span className="nb-slug">Saved on this device.</span> : null}
                  <button type="button" className="nb-btn-ghost nb-btn-sm" onClick={clearDraft}>
                    {clearArmed ? "Press again to clear" : "Clear draft"}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </fieldset>
      </form>
    </>
  );
}
