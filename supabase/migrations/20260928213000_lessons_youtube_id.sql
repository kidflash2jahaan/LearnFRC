-- The lesson's video on the LearnFRC YouTube channel. Filled in as each lesson
-- video is uploaded; the lesson page shows the video when this is set.
alter table public.lessons add column if not exists youtube_id text;
