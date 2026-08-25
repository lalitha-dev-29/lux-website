-- Automatic rebuild trigger (SQL-based alternative to the Database Webhooks
-- UI, for when that screen can't be found in the dashboard — this achieves
-- the exact same thing: an HTTP call to GitHub on every journal_posts /
-- case_studies insert/update/delete, picked up by the repository_dispatch
-- trigger in .github/workflows/scheduled-rebuild.yml).
--
-- BEFORE RUNNING: replace 'PASTE-YOUR-GITHUB-TOKEN-HERE' below with the
-- fine-grained GitHub token described in the README's "Automatic rebuild on
-- save" section (Contents: Read and write, Actions: Read and write, scoped
-- to only this repo). Run this once in the SQL Editor. Safe to re-run.

create extension if not exists pg_net with schema extensions;

-- Stores the token in Supabase's encrypted secret store (Vault) rather than
-- in plain text in a table or in this function's source — only this
-- security-definer function can read it back.
select vault.create_secret('PASTE-YOUR-GITHUB-TOKEN-HERE', 'github_dispatch_token')
where not exists (select 1 from vault.decrypted_secrets where name = 'github_dispatch_token');

create or replace function public.notify_content_updated()
returns trigger
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  token text;
begin
  -- This whole body is wrapped so a notification failure (expired/missing
  -- GitHub token, a pg_net hiccup, GitHub API being briefly unavailable)
  -- can NEVER fail or roll back the actual insert/update/delete that fired
  -- this trigger — this function runs AFTER the real write, in the same
  -- transaction, so an uncaught exception here would otherwise discard the
  -- admin's save along with it. Anything missed here is still picked up by
  -- the 15-minute cron safety net in
  -- .github/workflows/scheduled-rebuild.yml, and a persistent failure
  -- (e.g. an expired token) still surfaces via the RAISE WARNING below in
  -- Supabase's Postgres logs (Dashboard -> Logs -> Postgres Logs).
  begin
    select decrypted_secret into token
    from vault.decrypted_secrets
    where name = 'github_dispatch_token';

    if token is not null then
      perform net.http_post(
        url := 'https://api.github.com/repos/lalitha-dev-29/lux-website/dispatches',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || token,
          'Accept', 'application/vnd.github+json',
          'Content-Type', 'application/json',
          'User-Agent', 'supabase-content-webhook'
        ),
        body := jsonb_build_object('event_type', 'content-updated')
      );
    else
      raise warning 'notify_content_updated: github_dispatch_token secret not found in Vault — rebuild will only happen via the cron safety net.';
    end if;
  exception when others then
    raise warning 'notify_content_updated failed (save was NOT affected): %', sqlerrm;
  end;
  return null;
end;
$$;

drop trigger if exists journal_posts_notify_update on public.journal_posts;
create trigger journal_posts_notify_update
  after insert or update or delete on public.journal_posts
  for each row execute function public.notify_content_updated();

drop trigger if exists case_studies_notify_update on public.case_studies;
create trigger case_studies_notify_update
  after insert or update or delete on public.case_studies
  for each row execute function public.notify_content_updated();

-- Learning CMS (supabase/learning_cms.sql) — same rebuild-on-save wiring,
-- covering all four Learning tables so an Admin → Learning edit goes live
-- the same way a Journal/Case Study edit does.
drop trigger if exists learning_overview_notify_update on public.learning_overview;
create trigger learning_overview_notify_update
  after insert or update on public.learning_overview
  for each row execute function public.notify_content_updated();

drop trigger if exists learning_right_now_notify_update on public.learning_right_now;
create trigger learning_right_now_notify_update
  after insert or update or delete on public.learning_right_now
  for each row execute function public.notify_content_updated();

drop trigger if exists learning_education_notify_update on public.learning_education;
create trigger learning_education_notify_update
  after insert or update or delete on public.learning_education
  for each row execute function public.notify_content_updated();

drop trigger if exists learning_certifications_notify_update on public.learning_certifications;
create trigger learning_certifications_notify_update
  after insert or update or delete on public.learning_certifications
  for each row execute function public.notify_content_updated();

-- Atlas CMS (supabase/atlas_cms.sql) — same rebuild-on-save wiring, covering
-- all three Atlas tables so publishing/editing a country or brand goes live
-- the same way a Journal/Case Study/Learning edit does.
drop trigger if exists atlas_countries_notify_update on public.atlas_countries;
create trigger atlas_countries_notify_update
  after insert or update or delete on public.atlas_countries
  for each row execute function public.notify_content_updated();

drop trigger if exists atlas_brands_notify_update on public.atlas_brands;
create trigger atlas_brands_notify_update
  after insert or update or delete on public.atlas_brands
  for each row execute function public.notify_content_updated();

drop trigger if exists atlas_categories_notify_update on public.atlas_categories;
create trigger atlas_categories_notify_update
  after insert or update or delete on public.atlas_categories
  for each row execute function public.notify_content_updated();
