-- Teacher applications, second form (decided Nov 9): the answers the longer
-- form asks for. Additive and re-runnable: every column is new and nullable;
-- nothing is renamed, dropped, retyped or relaxed. Rows from the first form
-- keep nulls here (form_version null). topics, experience and sample_plan
-- stay NOT NULL and keep their meaning; the server keeps filling them.
--
-- RLS: teacher_applications already has RLS on and every privilege revoked
-- from anon and authenticated (20261109120000_live_classes.sql). New columns
-- inherit that, so only the service role reads or writes them. No policy or
-- grant changes. The 180-day sweep and account deletion remove whole rows,
-- so they cover the new columns too.

alter table public.teacher_applications
  add column if not exists form_version smallint
    check (form_version is null or form_version between 1 and 100),
  -- [{ "year": 2026, "team": 1234, "events": "..." }], newest first, built
  -- by the server from checked values.
  add column if not exists frc_seasons jsonb
    check (frc_seasons is null or (jsonb_typeof(frc_seasons) = 'array'
      and jsonb_array_length(frc_seasons) between 1 and 5)),
  add column if not exists frc_roles text[],
  add column if not exists other_programs text
    check (other_programs is null or char_length(other_programs) <= 300),
  add column if not exists sample_lesson_id uuid
    references public.lessons(id) on delete set null,
  add column if not exists teaching_sample text
    check (teaching_sample is null or char_length(teaching_sample) <= 4000),
  add column if not exists scenario_safety text
    check (scenario_safety is null or char_length(scenario_safety) <= 1500),
  add column if not exists scenario_teaching text
    check (scenario_teaching is null or char_length(scenario_teaching) <= 1500),
  add column if not exists motivation text
    check (motivation is null or char_length(motivation) <= 1000),
  add column if not exists teach_often text
    check (teach_often is null or teach_often in ('monthly', 'few_monthly', 'weekly')),
  add column if not exists code_questions text
    check (code_questions is null or char_length(code_questions) <= 500),
  add column if not exists own_words boolean;
