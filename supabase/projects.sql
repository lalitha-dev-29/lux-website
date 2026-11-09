-- Projects CMS (university and personal projects) for Supabase.
--
-- Run once in the Supabase SQL Editor, AFTER schema.sql (needs
-- public.is_admin() and public.set_updated_at()) and case_study_cms.sql (its
-- storage buckets are reused). Idempotent — safe to re-run.
--
-- Backs Admin -> Projects and the public /projects/ pages. One row per project:
--   title, tagline        headline and the italic line under it
--   excerpt               short summary for the listing card
--   content               the full write-up (Markdown; "## Heading" = section)
--   project_type          e.g. "Brand Strategy & Ad Campaign" (shown as a pill)
--   course, institution   e.g. "Digital Platforms", "ESSEC Business School"
--   period                free text, e.g. "October 2026" or "Fall 2026"
--   my_role               what you did, e.g. "Strategy lead"
--   progress              'completed' (large card) or 'in_progress' (smaller card)
--   video_url             optional YouTube / Vimeo link, embedded on the page
--   details               jsonb [{ label, value }] — the project-facts strip
--   key_figures           jsonb [{ value, label }] — "By the Numbers" cards
--   team                  jsonb [{ name, role }] — the team section
--   gallery               jsonb [{ url, caption }] — photo grid
--   conclusion            closing "What this project taught me" statement
--   pdf_url / pdf_filename the final deck or report, shown in the PDF viewer
--   links                 jsonb [{ type, url, label }] — same shape as case studies
-- Draft/published works the same way as Case Studies.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  tagline text,
  excerpt text not null,
  content text,
  project_type text,
  course text,
  institution text,
  period text,
  my_role text,
  progress text not null default 'completed' check (progress in ('completed', 'in_progress')),
  tags text[] not null default '{}',
  cover_image text,
  video_url text,
  details jsonb not null default '[]'::jsonb,
  key_figures jsonb not null default '[]'::jsonb,
  team jsonb not null default '[]'::jsonb,
  gallery jsonb not null default '[]'::jsonb,
  conclusion text,
  pdf_url text,
  pdf_filename text,
  links jsonb not null default '[]'::jsonb,
  order_index int not null default 0,
  reading_time_minutes int,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_details_is_array check (jsonb_typeof(details) = 'array'),
  constraint projects_key_figures_is_array check (jsonb_typeof(key_figures) = 'array'),
  constraint projects_team_is_array check (jsonb_typeof(team) = 'array'),
  constraint projects_gallery_is_array check (jsonb_typeof(gallery) = 'array'),
  constraint projects_links_is_array check (jsonb_typeof(links) = 'array')
);

create index if not exists projects_status_idx on public.projects (status, order_index);

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;

drop policy if exists "public can read published projects" on public.projects;
create policy "public can read published projects"
  on public.projects for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "admins can read all projects" on public.projects;
create policy "admins can read all projects"
  on public.projects for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admins can insert projects" on public.projects;
create policy "admins can insert projects"
  on public.projects for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admins can update projects" on public.projects;
create policy "admins can update projects"
  on public.projects for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins can delete projects" on public.projects;
create policy "admins can delete projects"
  on public.projects for delete
  to authenticated
  using (public.is_admin());

-- Rebuild the public site automatically when a project changes — only if the
-- auto-rebuild trigger function (supabase/auto_rebuild_webhook.sql) is installed.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'notify_content_updated') then
    execute 'drop trigger if exists projects_notify_update on public.projects';
    execute 'create trigger projects_notify_update
      after insert or update or delete on public.projects
      for each row execute function public.notify_content_updated()';
  end if;
end $$;

-- Images go in the existing public "content-images" bucket and decks in
-- "case-study-pdfs" (both created by case_study_cms.sql, admin-only write),
-- under a projects/<id>/ folder — so no new storage policy is needed.

notify pgrst, 'reload schema';
