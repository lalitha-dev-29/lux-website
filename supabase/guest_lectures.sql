-- Guest Lectures CMS for Supabase (Postgres + Storage).
--
-- Run once in the Supabase SQL Editor, AFTER schema.sql (needs
-- public.is_admin() and public.set_updated_at()). Idempotent — safe to re-run.
--
-- Backs the standalone Admin -> Guest Lectures tab and the public
-- /guest-lectures/ page. One row per lecture:
--   topic         the lecture's topic/title
--   lecture_date  when it happened (entries are shown newest first)
--   speakers      jsonb array — one object per speaker:
--                   { name, role, description, quote, photos: [url, ...] }
--   tags          text[] — your own subject tags, shown on cards and the page
--   key_learnings your own takeaways and insights
--   files         jsonb array of optional handouts/slides:
--                   { url, name, type: 'pdf' | 'ppt' }
-- No draft state — a saved row is live (same model as the Learning tables).

-- An earlier iteration of this feature created learning_guest_lectures; it
-- was never used in production and is superseded by guest_lectures below.
drop table if exists public.learning_guest_lectures;

create table if not exists public.guest_lectures (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  lecture_date date not null,
  speakers jsonb not null default '[]'::jsonb,
  key_learnings text not null,
  files jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_lectures_speakers_is_array check (jsonb_typeof(speakers) = 'array'),
  constraint guest_lectures_files_is_array check (jsonb_typeof(files) = 'array')
);

-- Custom subject tags (added after the first release; safe to re-run).
alter table public.guest_lectures
  add column if not exists tags text[] not null default '{}'::text[];

create index if not exists guest_lectures_date_idx on public.guest_lectures (lecture_date desc);

drop trigger if exists guest_lectures_set_updated_at on public.guest_lectures;
create trigger guest_lectures_set_updated_at
  before update on public.guest_lectures
  for each row execute function public.set_updated_at();

alter table public.guest_lectures enable row level security;

drop policy if exists "public can read guest lectures" on public.guest_lectures;
create policy "public can read guest lectures"
  on public.guest_lectures for select
  to anon, authenticated
  using (true);

drop policy if exists "admins can insert guest lectures" on public.guest_lectures;
create policy "admins can insert guest lectures"
  on public.guest_lectures for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admins can update guest lectures" on public.guest_lectures;
create policy "admins can update guest lectures"
  on public.guest_lectures for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins can delete guest lectures" on public.guest_lectures;
create policy "admins can delete guest lectures"
  on public.guest_lectures for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage — speaker photos and optional slide decks / handouts.
-- Public read, admin-only write, 25MB cap, restricted at the bucket level to
-- images + PDF/PPT/PPTX (the app also checks client-side for a friendlier error).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'guest-lectures', 'guest-lectures', true, 26214400,
  array[
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public can read guest-lectures" on storage.objects;
create policy "public can read guest-lectures" on storage.objects
  for select to anon, authenticated using (bucket_id = 'guest-lectures');

drop policy if exists "admins can insert guest-lectures" on storage.objects;
create policy "admins can insert guest-lectures" on storage.objects
  for insert to authenticated with check (bucket_id = 'guest-lectures' and public.is_admin());

drop policy if exists "admins can update guest-lectures" on storage.objects;
create policy "admins can update guest-lectures" on storage.objects
  for update to authenticated using (bucket_id = 'guest-lectures' and public.is_admin());

drop policy if exists "admins can delete guest-lectures" on storage.objects;
create policy "admins can delete guest-lectures" on storage.objects
  for delete to authenticated using (bucket_id = 'guest-lectures' and public.is_admin());
