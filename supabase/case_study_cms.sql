-- Case Study CMS schema + Journal CMS extensions for Supabase (Postgres).
--
-- Run this once in the Supabase SQL Editor, AFTER schema.sql (this file
-- depends on public.is_admin() and public.set_updated_at(), both defined
-- there). Safe to re-run: every statement is idempotent.
--
-- This extends the original Journal-only CMS (schema.sql) with:
--   1. New columns on journal_posts (author, featured, reading time, SEO,
--      a flexible multi-platform links list).
--   2. A new case_studies table, structured the same way as journal_posts,
--      so Case Studies get the same admin-managed CRUD/RLS/draft-publish
--      workflow that Journal already has.
--   3. Two public Storage buckets (content-images, case-study-pdfs) so the
--      admin panel can upload real files instead of pasting URLs.

-- ---------------------------------------------------------------------------
-- 1. Extend journal_posts.
-- ---------------------------------------------------------------------------
alter table public.journal_posts
  add column if not exists author text not null default 'Kasturi Lalitha Manogna',
  add column if not exists featured boolean not null default false,
  add column if not exists reading_time_minutes int,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists og_image text,
  add column if not exists links jsonb not null default '[]'::jsonb;

-- external_url is kept (not dropped): the has-body check constraint below
-- still references it, and old rows keep working unchanged. New saves from
-- the expanded admin editor route external links through `links` instead;
-- external_url is only left populated for rows nobody has edited yet.

-- One-time backfill: posts saved before this feature only have external_url
-- set (their LinkedIn link) — migrate it into the new `links` list so their
-- public page still shows a working link. Guarded so it only touches rows
-- that haven't been edited through the new editor yet (those already have a
-- real `links` value and must not be overwritten).
update public.journal_posts
set links = jsonb_build_array(jsonb_build_object('platform', 'linkedin', 'url', external_url))
where links = '[]'::jsonb and external_url is not null;

-- ---------------------------------------------------------------------------
-- 2. Case studies.
-- ---------------------------------------------------------------------------
create table if not exists public.case_studies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null,
  content text,
  category text not null,
  tags text[] not null default '{}',
  cover_image text,
  order_index int not null default 0,
  reading_time_minutes int,
  featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  pdf_url text,
  pdf_filename text,
  pdf_page_count int,
  seo_title text,
  seo_description text,
  og_image text,
  author text not null default 'Kasturi Lalitha Manogna',
  links jsonb not null default '[]'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists case_studies_status_idx on public.case_studies (status, order_index);

drop trigger if exists case_studies_set_updated_at on public.case_studies;
create trigger case_studies_set_updated_at
  before update on public.case_studies
  for each row execute function public.set_updated_at();

alter table public.case_studies enable row level security;

drop policy if exists "public can read published case studies" on public.case_studies;
create policy "public can read published case studies"
  on public.case_studies for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "admins can read all case studies" on public.case_studies;
create policy "admins can read all case studies"
  on public.case_studies for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admins can insert case studies" on public.case_studies;
create policy "admins can insert case studies"
  on public.case_studies for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admins can update case studies" on public.case_studies;
create policy "admins can update case studies"
  on public.case_studies for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins can delete case studies" on public.case_studies;
create policy "admins can delete case studies"
  on public.case_studies for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. Storage buckets — public read (published content only, enforced by the
-- app layer since bucket contents mirror published rows), admin-only write.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('content-images', 'content-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('case-study-pdfs', 'case-study-pdfs', true)
on conflict (id) do nothing;

drop policy if exists "public can read content-images" on storage.objects;
create policy "public can read content-images" on storage.objects
  for select to anon, authenticated using (bucket_id = 'content-images');

drop policy if exists "admins can insert content-images" on storage.objects;
create policy "admins can insert content-images" on storage.objects
  for insert to authenticated with check (bucket_id = 'content-images' and public.is_admin());

drop policy if exists "admins can update content-images" on storage.objects;
create policy "admins can update content-images" on storage.objects
  for update to authenticated using (bucket_id = 'content-images' and public.is_admin());

drop policy if exists "admins can delete content-images" on storage.objects;
create policy "admins can delete content-images" on storage.objects
  for delete to authenticated using (bucket_id = 'content-images' and public.is_admin());

drop policy if exists "public can read case-study-pdfs" on storage.objects;
create policy "public can read case-study-pdfs" on storage.objects
  for select to anon, authenticated using (bucket_id = 'case-study-pdfs');

drop policy if exists "admins can insert case-study-pdfs" on storage.objects;
create policy "admins can insert case-study-pdfs" on storage.objects
  for insert to authenticated with check (bucket_id = 'case-study-pdfs' and public.is_admin());

drop policy if exists "admins can update case-study-pdfs" on storage.objects;
create policy "admins can update case-study-pdfs" on storage.objects
  for update to authenticated using (bucket_id = 'case-study-pdfs' and public.is_admin());

drop policy if exists "admins can delete case-study-pdfs" on storage.objects;
create policy "admins can delete case-study-pdfs" on storage.objects
  for delete to authenticated using (bucket_id = 'case-study-pdfs' and public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. Seed: migrated verbatim from src/content/case-studies/*.md. Safe to
-- re-run — `on conflict` skips rows that already exist. Slugs match the
-- original filenames exactly so /case-studies/<slug>/ URLs don't change.
-- ---------------------------------------------------------------------------
insert into public.case_studies
  (slug, title, excerpt, content, category, tags, cover_image, order_index, reading_time_minutes, status, published_at)
values
  ('louis-vuitton',
   'Looking Beyond the Monogram',
   'Louis Vuitton is one of those brands where the logo is almost impossible to separate from the brand itself. But what happens when a brand becomes so recognisable that it needs to keep finding new ways to create desire? This project looks at how Louis Vuitton uses heritage, fashion, culture, collaborations and storytelling to keep the brand relevant while protecting its core identity.',
   'Louis Vuitton is one of those brands where the logo is almost impossible to separate from the brand itself. But what happens when a brand becomes so recognisable that it needs to keep finding new ways to create desire? This project looks at how Louis Vuitton uses heritage, fashion, culture, collaborations and storytelling to keep the brand relevant while protecting its core identity.',
   'LOUIS VUITTON', array['Brand Strategy','Heritage','Culture','Consumer Behaviour'],
   'https://images.unsplash.com/photo-1600180758890-6b94519a8ba6?auto=format&fit=crop&w=800&q=80',
   1, 12, 'published', now()),
  ('hermes',
   'Why Are People Willing to Wait?',
   'Hermès is interesting to me because the brand doesn''t seem to chase consumers in the way most brands do. The waiting, the scarcity, the craftsmanship and the stories around the products all become part of the experience. This project looks at how Hermès turns limited accessibility into desirability.',
   'Hermès is interesting to me because the brand doesn''t seem to chase consumers in the way most brands do. The waiting, the scarcity, the craftsmanship and the stories around the products all become part of the experience. This project looks at how Hermès turns limited accessibility into desirability.',
   'HERMÈS', array['Luxury Strategy','Scarcity','Consumer Psychology'],
   'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
   2, 10, 'published', now()),
  ('chanel',
   'How Do You Reinvent a Brand Without Losing It?',
   'This is one of the questions behind my CHANEL brand audit. I looked at how CHANEL communicates its identity across different touchpoints and how a heritage maison can continue to evolve while remaining recognisable. I''m particularly interested in what this means when the consumer itself is changing.',
   'This is one of the questions behind my CHANEL brand audit. I looked at how CHANEL communicates its identity across different touchpoints and how a heritage maison can continue to evolve while remaining recognisable. I''m particularly interested in what this means when the consumer itself is changing.',
   'CHANEL', array['Brand Strategy','Heritage','Gen Z','Brand Consistency'],
   'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=800&q=80',
   3, 11, 'published', now()),
  ('cartier',
   'When Jewellery Becomes Personal',
   'Luxury jewellery is not always about showing that you own something expensive. Sometimes it becomes connected to a memory, a milestone, a relationship or simply the way someone sees themselves. This project looks at Cartier through that lens and explores how jewellery can move from being a status symbol to becoming part of someone''s identity.',
   'Luxury jewellery is not always about showing that you own something expensive. Sometimes it becomes connected to a memory, a milestone, a relationship or simply the way someone sees themselves. This project looks at Cartier through that lens and explores how jewellery can move from being a status symbol to becoming part of someone''s identity.',
   'CARTIER', array['Consumer Behaviour','Identity','Jewellery','Storytelling'],
   'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=800&q=80',
   4, 9, 'published', now()),
  ('dior',
   'How Do You Stay Relevant Across Generations?',
   'Dior has built a very strong heritage, but every generation experiences the brand differently. This project looks at how Dior continues to create desire across fashion, beauty and culture while speaking to changing consumers.',
   'Dior has built a very strong heritage, but every generation experiences the brand differently. This project looks at how Dior continues to create desire across fashion, beauty and culture while speaking to changing consumers.',
   'DIOR', array['Brand Strategy','Consumer Behaviour','Culture'],
   'https://images.unsplash.com/photo-1495385794356-15371f348c31?auto=format&fit=crop&w=800&q=80',
   5, 10, 'published', now())
on conflict (slug) do nothing;
