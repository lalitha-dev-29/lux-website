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
  end if;
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
