-- Learning section CMS for Supabase (Postgres).
--
-- Run this once in the Supabase SQL Editor, AFTER schema.sql and
-- case_study_cms.sql (this file depends on public.is_admin() and
-- public.set_updated_at(), both defined in schema.sql). Safe to re-run:
-- every statement is idempotent.
--
-- Adds four tables backing the Admin → Learning section (see README's
-- "Learning CMS" section for the full architecture):
--   1. learning_overview      — singleton row: the page's heading + intro copy.
--   2. learning_right_now     — "What I'm Currently Learning About" cards.
--   3. learning_education     — education history entries.
--   4. learning_certifications — certificates (with an uploaded file: image or PDF).
--
-- Unlike journal_posts/case_studies, none of these carry a draft/published
-- status — Learning has no editorial review step, so a saved row is simply
-- live (the same "no draft state" model a settings panel would use). Delete
-- confirmation in the Admin Panel is what stands in for "unpublish".

-- ---------------------------------------------------------------------------
-- 1. Overview — a single row (id is always `true`), holding the page's
-- heading and intro paragraph. Upsert-only from the app; never inserted a
-- second time.
-- ---------------------------------------------------------------------------
create table if not exists public.learning_overview (
  id boolean primary key default true,
  heading text not null,
  description text not null,
  updated_at timestamptz not null default now(),
  constraint learning_overview_singleton check (id)
);

drop trigger if exists learning_overview_set_updated_at on public.learning_overview;
create trigger learning_overview_set_updated_at
  before update on public.learning_overview
  for each row execute function public.set_updated_at();

alter table public.learning_overview enable row level security;

drop policy if exists "public can read learning overview" on public.learning_overview;
create policy "public can read learning overview"
  on public.learning_overview for select
  to anon, authenticated
  using (true);

drop policy if exists "admins can insert learning overview" on public.learning_overview;
create policy "admins can insert learning overview"
  on public.learning_overview for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admins can update learning overview" on public.learning_overview;
create policy "admins can update learning overview"
  on public.learning_overview for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Seed: migrated verbatim from the hardcoded heading/paragraph in
-- src/pages/learning.astro.
insert into public.learning_overview (id, heading, description)
values (
  true,
  'I''m Still Learning. And I Think That''s a Good Thing.',
  'Marketing changes constantly. Consumers change. Culture changes. And luxury definitely changes. So I don''t want to treat learning as something that ends with a degree or a certificate. I want it to be part of how I build my career.'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Right Now — "What I'm Currently Learning About" topic cards.
-- ---------------------------------------------------------------------------
create table if not exists public.learning_right_now (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learning_right_now_order_idx on public.learning_right_now (order_index);

drop trigger if exists learning_right_now_set_updated_at on public.learning_right_now;
create trigger learning_right_now_set_updated_at
  before update on public.learning_right_now
  for each row execute function public.set_updated_at();

alter table public.learning_right_now enable row level security;

drop policy if exists "public can read learning right now" on public.learning_right_now;
create policy "public can read learning right now"
  on public.learning_right_now for select
  to anon, authenticated
  using (true);

drop policy if exists "admins can insert learning right now" on public.learning_right_now;
create policy "admins can insert learning right now"
  on public.learning_right_now for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admins can update learning right now" on public.learning_right_now;
create policy "admins can update learning right now"
  on public.learning_right_now for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins can delete learning right now" on public.learning_right_now;
create policy "admins can delete learning right now"
  on public.learning_right_now for delete
  to authenticated
  using (public.is_admin());

-- Seed: migrated verbatim from the `learningNow` array in src/pages/learning.astro.
insert into public.learning_right_now (title, body, order_index)
select * from (values
  ('Luxury Strategy', 'I''m learning what makes luxury different from traditional marketing and why the usual rules don''t always apply.', 1),
  ('Brand Management', 'I''m interested in how global brands are managed over the long term, from positioning and communication to consumer experience.', 2),
  ('Consumer Psychology', 'I''m exploring the reasons behind aspiration, desire, identity and the emotional value people attach to brands.', 3),
  ('Culture', 'I''m increasingly interested in how culture influences what consumers consider desirable and how brands can respond without losing their identity.', 4)
) as seed(title, body, order_index)
where not exists (select 1 from public.learning_right_now);

-- ---------------------------------------------------------------------------
-- 3. Education — education history entries. `location`/`start_*`/`end_*`/
-- `is_current` are all nullable/optional so an entry can be as loose as the
-- original hardcoded data ("India", no dates) or as structured as a full
-- month+year range — src/lib/learningTypes.ts's formatEducationPeriod()
-- decides what to actually print from whatever subset is filled in.
-- ---------------------------------------------------------------------------
create table if not exists public.learning_education (
  id uuid primary key default gen_random_uuid(),
  institution text not null,
  programme text not null,
  description text not null,
  location text,
  start_month int check (start_month between 1 and 12),
  start_year int,
  end_month int check (end_month between 1 and 12),
  end_year int,
  is_current boolean not null default false,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learning_education_order_idx on public.learning_education (order_index);

drop trigger if exists learning_education_set_updated_at on public.learning_education;
create trigger learning_education_set_updated_at
  before update on public.learning_education
  for each row execute function public.set_updated_at();

alter table public.learning_education enable row level security;

drop policy if exists "public can read learning education" on public.learning_education;
create policy "public can read learning education"
  on public.learning_education for select
  to anon, authenticated
  using (true);

drop policy if exists "admins can insert learning education" on public.learning_education;
create policy "admins can insert learning education"
  on public.learning_education for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admins can update learning education" on public.learning_education;
create policy "admins can update learning education"
  on public.learning_education for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins can delete learning education" on public.learning_education;
create policy "admins can delete learning education"
  on public.learning_education for delete
  to authenticated
  using (public.is_admin());

-- Seed: migrated verbatim from the `education` array in src/pages/learning.astro.
insert into public.learning_education
  (institution, programme, description, location, end_year, is_current, order_index)
select * from (values
  ('ESSEC Business School', 'MSc Marketing Management & Digital',
   'My current academic journey, where I''m developing a stronger understanding of marketing, digital strategy and consumer behaviour.',
   'Singapore', 2026, true, 1),
  ('NMIMS', 'BBA Marketing',
   'Where I built my foundation in marketing and started understanding how brands, consumers and businesses connect.',
   'India', null, false, 2)
) as seed(institution, programme, description, location, end_year, is_current, order_index)
where not exists (select 1 from public.learning_education);

-- ---------------------------------------------------------------------------
-- 4. Certifications — replaces the src/content/certifications/*.md collection
-- (which was never populated with a real certificate). Each row owns one
-- uploaded file (image or PDF) in the learning-certificates Storage bucket.
-- ---------------------------------------------------------------------------
create table if not exists public.learning_certifications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  issuer_portal text,
  issuing_institution text not null,
  cert_month int not null check (cert_month between 1 and 12),
  cert_year int not null,
  file_url text not null,
  file_type text not null check (file_type in ('image', 'pdf')),
  file_name text,
  credential_id text not null check (credential_id ~ '^[A-Za-z0-9._ -]+$'),
  certificate_link text not null check (certificate_link ~* '^https?://'),
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learning_certifications_order_idx on public.learning_certifications (order_index);

drop trigger if exists learning_certifications_set_updated_at on public.learning_certifications;
create trigger learning_certifications_set_updated_at
  before update on public.learning_certifications
  for each row execute function public.set_updated_at();

alter table public.learning_certifications enable row level security;

drop policy if exists "public can read learning certifications" on public.learning_certifications;
create policy "public can read learning certifications"
  on public.learning_certifications for select
  to anon, authenticated
  using (true);

drop policy if exists "admins can insert learning certifications" on public.learning_certifications;
create policy "admins can insert learning certifications"
  on public.learning_certifications for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admins can update learning certifications" on public.learning_certifications;
create policy "admins can update learning certifications"
  on public.learning_certifications for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins can delete learning certifications" on public.learning_certifications;
create policy "admins can delete learning certifications"
  on public.learning_certifications for delete
  to authenticated
  using (public.is_admin());

-- No seed rows — there were no real certificates in src/content/certifications/
-- to migrate (the collection was empty; the public page already renders an
-- empty state for zero certifications).

-- ---------------------------------------------------------------------------
-- 5. Storage bucket for certificate files — public read, admin write.
-- Limited (at the bucket level, in addition to the app's own client-side
-- check) to the exact formats the Admin → Certifications spec allows:
-- PDF, JPG/JPEG, PNG, WebP. 10MB cap.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'learning-certificates', 'learning-certificates', true, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public can read learning-certificates" on storage.objects;
create policy "public can read learning-certificates" on storage.objects
  for select to anon, authenticated using (bucket_id = 'learning-certificates');

drop policy if exists "admins can insert learning-certificates" on storage.objects;
create policy "admins can insert learning-certificates" on storage.objects
  for insert to authenticated with check (bucket_id = 'learning-certificates' and public.is_admin());

drop policy if exists "admins can update learning-certificates" on storage.objects;
create policy "admins can update learning-certificates" on storage.objects
  for update to authenticated using (bucket_id = 'learning-certificates' and public.is_admin());

drop policy if exists "admins can delete learning-certificates" on storage.objects;
create policy "admins can delete learning-certificates" on storage.objects
  for delete to authenticated using (bucket_id = 'learning-certificates' and public.is_admin());
