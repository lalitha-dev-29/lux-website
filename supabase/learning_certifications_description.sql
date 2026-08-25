-- Replaces learning_certifications.credential_id with a free-text
-- description field. Run this once in the Supabase SQL Editor, after
-- learning_cms.sql. Safe to re-run.
--
-- description is nullable at the DB level (existing rows have none), but
-- the admin form requires it for new saves — same convention as other
-- optional-at-the-database, required-by-the-form fields in this project.

alter table public.learning_certifications drop column if exists credential_id;
alter table public.learning_certifications add column if not exists description text;
