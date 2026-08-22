-- Journal CMS schema for Supabase (Postgres).
--
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New
-- query) after creating a project. Safe to re-run: every statement is
-- idempotent (`if not exists` / `or replace` / `drop ... if exists`).
--
-- After running this, create the admin's login: Dashboard → Authentication →
-- Users → Add user (email + password, "Auto Confirm User" checked). Then
-- copy that user's UID and run:
--   insert into public.admin_users (user_id) values ('<uid-here>');
-- That single row is what makes that account an ADMIN — everyone else is a
-- USER by default, including any future Supabase Auth sign-ups.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Role table. Extensible: a future role just needs a new table (or a `role`
-- column here) plus matching policies — the app code never hardcodes "who is
-- an admin", it always asks the database.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Admins can see the admin list (needed so the panel can tell the logged-in
-- user they're authorized); nobody can write to it from the client — role
-- grants are a dashboard/SQL action only, never an API call.
drop policy if exists "admins can read admin_users" on public.admin_users;
create policy "admins can read admin_users"
  on public.admin_users for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Journal posts.
-- ---------------------------------------------------------------------------
create table if not exists public.journal_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null,
  content text,
  external_url text,
  category text,
  tags text[] not null default '{}',
  cover_image text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_posts_has_body check (content is not null or external_url is not null)
);

create index if not exists journal_posts_status_idx on public.journal_posts (status, published_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists journal_posts_set_updated_at on public.journal_posts;
create trigger journal_posts_set_updated_at
  before update on public.journal_posts
  for each row execute function public.set_updated_at();

alter table public.journal_posts enable row level security;

-- Public: only published posts, and only the columns the public site needs
-- (RLS filters rows, not columns — column exposure is controlled by what the
-- public site's SELECT list asks for, which is documented in
-- src/lib/journalClient.ts).
drop policy if exists "public can read published posts" on public.journal_posts;
create policy "public can read published posts"
  on public.journal_posts for select
  to anon, authenticated
  using (status = 'published');

-- Admin: full read (including drafts).
drop policy if exists "admins can read all posts" on public.journal_posts;
create policy "admins can read all posts"
  on public.journal_posts for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admins can insert posts" on public.journal_posts;
create policy "admins can insert posts"
  on public.journal_posts for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admins can update posts" on public.journal_posts;
create policy "admins can update posts"
  on public.journal_posts for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins can delete posts" on public.journal_posts;
create policy "admins can delete posts"
  on public.journal_posts for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Seed: migrated from the original src/content/journal/*.md files. Safe to
-- re-run — `on conflict` skips rows that already exist.
-- ---------------------------------------------------------------------------
insert into public.journal_posts (title, slug, excerpt, external_url, status, published_at)
values
  ('Why Luxury Doesn''t Need Discounts', 'why-luxury-doesnt-need-discounts',
   'What happens when a brand starts teaching its customers to wait for a sale? I wanted to understand why luxury brands treat price so differently from traditional consumer brands.',
   'https://www.linkedin.com/in/lalitha-manogna-kasturi/', 'published', now()),
  ('The Psychology of Luxury Unboxing', 'psychology-of-luxury-unboxing',
   'Why does opening a luxury product feel like an experience in itself? I looked at how packaging, anticipation and small details can change how we perceive a product.',
   'https://www.linkedin.com/in/lalitha-manogna-kasturi/', 'published', now()),
  ('Why Luxury Doesn''t Want Every Customer', 'why-luxury-doesnt-want-every-customer',
   'Luxury has always played with accessibility. But where does exclusivity end and desirability begin?',
   'https://www.linkedin.com/in/lalitha-manogna-kasturi/', 'published', now()),
  ('What Sabyasachi Knows That Milan Forgot', 'what-sabyasachi-knows-that-milan-forgot',
   'Can cultural specificity actually make a brand more globally desirable? This was my attempt to look at Indian luxury from a different perspective.',
   'https://www.linkedin.com/in/lalitha-manogna-kasturi/', 'published', now()),
  ('Reading Cartier''s Windows', 'reading-cartiers-windows',
   'A store window can tell you a lot about a brand before you even walk inside. I wanted to understand what luxury brands are really communicating through visual merchandising.',
   'https://www.linkedin.com/in/lalitha-manogna-kasturi/', 'published', now())
on conflict (slug) do nothing;
