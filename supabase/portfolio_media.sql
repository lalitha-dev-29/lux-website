-- Photo galleries, key figures, conclusions and session questions for
-- Case Studies and Guest Lectures.
--
-- Run this once in the Supabase SQL Editor, AFTER case_study_cms.sql and
-- guest_lectures.sql. Safe to re-run (idempotent). Existing rows keep working:
-- every new column defaults to empty.
--
-- case_studies
--   gallery      jsonb array of { url, caption } — the "Visual Archive" photo grid
--   key_figures  jsonb array of { value, label } — the "By the Numbers" stat cards
--   conclusion   text — the closing "Core Conclusion" statement
-- guest_lectures
--   gallery        jsonb array of { url, caption } — photos from the session
--   core_question  text — the one question the session set out to answer
--
-- Gallery images upload into the existing public buckets (content-images for
-- case studies, guest-lectures for lectures), so no new storage policy is needed.

alter table public.case_studies
  add column if not exists gallery jsonb not null default '[]'::jsonb,
  add column if not exists key_figures jsonb not null default '[]'::jsonb,
  add column if not exists conclusion text;

alter table public.guest_lectures
  add column if not exists gallery jsonb not null default '[]'::jsonb,
  add column if not exists core_question text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'case_studies_gallery_is_array') then
    alter table public.case_studies
      add constraint case_studies_gallery_is_array check (jsonb_typeof(gallery) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'case_studies_key_figures_is_array') then
    alter table public.case_studies
      add constraint case_studies_key_figures_is_array check (jsonb_typeof(key_figures) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'guest_lectures_gallery_is_array') then
    alter table public.guest_lectures
      add constraint guest_lectures_gallery_is_array check (jsonb_typeof(gallery) = 'array');
  end if;
end $$;

-- Ask PostgREST to pick up the new columns immediately.
notify pgrst, 'reload schema';
