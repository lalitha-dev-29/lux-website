-- "About the company" profile for Guest Lectures.
--
-- Run this once in the Supabase SQL Editor, AFTER guest_lectures.sql and
-- portfolio_media.sql. Safe to re-run (idempotent). Existing lectures keep
-- working: the column is optional and defaults to empty.
--
-- guest_lectures
--   company  jsonb — { name, website, overview, figures: [{ value, label }],
--            milestones: [{ year, text }] }, shown as the "Behind the Brand"
--            section on the lecture page.

alter table public.guest_lectures
  add column if not exists company jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'guest_lectures_company_is_object') then
    alter table public.guest_lectures
      add constraint guest_lectures_company_is_object check (company is null or jsonb_typeof(company) = 'object');
  end if;
end $$;

-- Ask PostgREST to pick up the new column immediately.
notify pgrst, 'reload schema';
