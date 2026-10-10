-- Guest Lectures for the Learning section (Supabase / Postgres).
--
-- Run once in the Supabase SQL Editor, AFTER schema.sql and learning_cms.sql
-- (depends on public.is_admin() and public.set_updated_at()). Idempotent.
--
-- Backs Admin -> Learning -> Guest Lectures: what you took away from each
-- guest lecture. Like the other Learning tables there is no draft state — a
-- saved row is live on /learning/.

create table if not exists public.learning_guest_lectures (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  speaker text not null,
  organisation text,
  lecture_date date not null,
  key_learnings text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learning_guest_lectures_date_idx
  on public.learning_guest_lectures (lecture_date desc);

drop trigger if exists learning_guest_lectures_set_updated_at on public.learning_guest_lectures;
create trigger learning_guest_lectures_set_updated_at
  before update on public.learning_guest_lectures
  for each row execute function public.set_updated_at();

alter table public.learning_guest_lectures enable row level security;

drop policy if exists "public can read learning guest lectures" on public.learning_guest_lectures;
create policy "public can read learning guest lectures"
  on public.learning_guest_lectures for select
  to anon, authenticated
  using (true);

drop policy if exists "admins can insert learning guest lectures" on public.learning_guest_lectures;
create policy "admins can insert learning guest lectures"
  on public.learning_guest_lectures for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admins can update learning guest lectures" on public.learning_guest_lectures;
create policy "admins can update learning guest lectures"
  on public.learning_guest_lectures for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins can delete learning guest lectures" on public.learning_guest_lectures;
create policy "admins can delete learning guest lectures"
  on public.learning_guest_lectures for delete
  to authenticated
  using (public.is_admin());
