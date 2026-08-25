-- Atlas CMS schema for Supabase (Postgres).
--
-- Run this once in the Supabase SQL Editor, AFTER schema.sql and
-- case_study_cms.sql (this file depends on public.is_admin(),
-- public.set_updated_at(), and the public `content-images` Storage bucket,
-- all defined there). Safe to re-run: every statement is idempotent.
--
-- Adds three tables backing the Admin → Atlas section, replacing the
-- hard-coded src/data/atlas.ts:
--   1. atlas_categories — a flat, unstatused lookup list (Leather Goods,
--      Jewellery, ...) used to group brands. No draft/published concept —
--      "keep it simple" per the feature spec.
--   2. atlas_countries  — one row per country shown (or not yet shown) on
--      the public map. Three-state status (draft/published/unpublished),
--      unlike journal_posts/case_studies' two-state model — this is
--      intentional: "unpublished" lets a country be taken off the public
--      map without deleting its content, which two states can't express.
--   3. atlas_brands      — one row per luxury house, one-to-many under a
--      country (not many-to-many). Two-state status (draft/published);
--      only visible publicly if both the brand AND its parent country are
--      published (see the cross-table RLS policy below).
--
-- No new Storage bucket: country/brand images reuse the existing public
-- `content-images` bucket (provisioned by case_study_cms.sql) under a new
-- `atlas/...` path prefix.

-- ---------------------------------------------------------------------------
-- 1. Categories.
-- ---------------------------------------------------------------------------
create table if not exists public.atlas_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists atlas_categories_order_idx on public.atlas_categories (display_order);

drop trigger if exists atlas_categories_set_updated_at on public.atlas_categories;
create trigger atlas_categories_set_updated_at
  before update on public.atlas_categories
  for each row execute function public.set_updated_at();

alter table public.atlas_categories enable row level security;

drop policy if exists "public can read atlas categories" on public.atlas_categories;
create policy "public can read atlas categories"
  on public.atlas_categories for select
  to anon, authenticated
  using (true);

drop policy if exists "admins can insert atlas categories" on public.atlas_categories;
create policy "admins can insert atlas categories"
  on public.atlas_categories for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admins can update atlas categories" on public.atlas_categories;
create policy "admins can update atlas categories"
  on public.atlas_categories for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins can delete atlas categories" on public.atlas_categories;
create policy "admins can delete atlas categories"
  on public.atlas_categories for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2. Countries.
-- ---------------------------------------------------------------------------
create table if not exists public.atlas_countries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- The exact SVG `data-name` string (src/data/world-map-paths.svg) this
  -- country corresponds to — what the public map matches against. Nullable
  -- at the DB level (a duplicated draft can exist before one is chosen);
  -- required by the app's form validation before a country can be published.
  map_id text unique,
  country_code text,
  short_description text,
  heading text not null,
  research_content text,
  featured_image_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'unpublished')),
  is_featured boolean not null default false,
  display_order int not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atlas_countries_published_needs_map_id
    check (status <> 'published' or map_id is not null)
);

create index if not exists atlas_countries_status_idx on public.atlas_countries (status, display_order);

drop trigger if exists atlas_countries_set_updated_at on public.atlas_countries;
create trigger atlas_countries_set_updated_at
  before update on public.atlas_countries
  for each row execute function public.set_updated_at();

alter table public.atlas_countries enable row level security;

drop policy if exists "public can read published atlas countries" on public.atlas_countries;
create policy "public can read published atlas countries"
  on public.atlas_countries for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "admins can read all atlas countries" on public.atlas_countries;
create policy "admins can read all atlas countries"
  on public.atlas_countries for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admins can insert atlas countries" on public.atlas_countries;
create policy "admins can insert atlas countries"
  on public.atlas_countries for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admins can update atlas countries" on public.atlas_countries;
create policy "admins can update atlas countries"
  on public.atlas_countries for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins can delete atlas countries" on public.atlas_countries;
create policy "admins can delete atlas countries"
  on public.atlas_countries for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. Brands. One-to-many under a country (on delete cascade — the Admin UI
-- always confirms the brand count before a country delete goes through).
-- ---------------------------------------------------------------------------
create table if not exists public.atlas_brands (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.atlas_countries(id) on delete cascade,
  category_id uuid references public.atlas_categories(id) on delete set null,
  name text not null,
  founded_year int,
  founder text,
  description text,
  positioning text,
  website_url text,
  instagram_url text,
  logo_url text,
  image_url text,
  research_notes text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists atlas_brands_country_idx on public.atlas_brands (country_id, display_order);
create index if not exists atlas_brands_category_idx on public.atlas_brands (category_id);

drop trigger if exists atlas_brands_set_updated_at on public.atlas_brands;
create trigger atlas_brands_set_updated_at
  before update on public.atlas_brands
  for each row execute function public.set_updated_at();

alter table public.atlas_brands enable row level security;

-- Public: a brand is visible only if it AND its parent country are both
-- published — the one policy in this schema that has to look at another
-- table (worth an explicit anon-role test after running this file).
drop policy if exists "public can read published atlas brands" on public.atlas_brands;
create policy "public can read published atlas brands"
  on public.atlas_brands for select
  to anon, authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.atlas_countries c
      where c.id = country_id and c.status = 'published'
    )
  );

drop policy if exists "admins can read all atlas brands" on public.atlas_brands;
create policy "admins can read all atlas brands"
  on public.atlas_brands for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admins can insert atlas brands" on public.atlas_brands;
create policy "admins can insert atlas brands"
  on public.atlas_brands for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admins can update atlas brands" on public.atlas_brands;
create policy "admins can update atlas brands"
  on public.atlas_brands for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins can delete atlas brands" on public.atlas_brands;
create policy "admins can delete atlas brands"
  on public.atlas_brands for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. Seed: migrated verbatim from src/data/atlas.ts, so the public Atlas
-- looks identical the moment the admin-driven page goes live. Guarded so it
-- only runs once, even if this file is re-run.
-- ---------------------------------------------------------------------------
insert into public.atlas_categories (name, display_order)
select * from (values
  ('Leather Goods', 1),
  ('Fashion & Beauty', 2),
  ('Fashion', 3),
  ('Jewellery', 4)
) as seed(name, display_order)
where not exists (select 1 from public.atlas_categories);

insert into public.atlas_countries
  (name, map_id, country_code, heading, research_content, status, display_order, published_at)
select * from (values
  ('France', 'France', 'FR',
   'The home of many of the maisons that shaped modern luxury.',
   'What interests me most about French luxury is the way heritage has been turned into something that can keep evolving.',
   'published', 1, now()),
  ('Italy', 'Italy', 'IT',
   'Craft, design and a very different approach to luxury.',
   'Italian maisons show how craftsmanship and creativity can become powerful brand assets.',
   'published', 2, now()),
  ('India', 'India', 'IN',
   'A culture with so much already built into its idea of luxury.',
   'India has craftsmanship, textiles, jewellery, ceremony, storytelling and incredibly diverse cultural traditions. I think there is a lot to explore here, especially as Indian luxury becomes increasingly relevant to the global conversation.',
   'published', 3, now()),
  ('Japan', 'Japan', 'JP',
   'Precision, restraint and craftsmanship.',
   'Japanese luxury offers a completely different way of thinking about quality and desirability.',
   'published', 4, now()),
  ('United Kingdom', 'United Kingdom', 'GB',
   'Heritage that keeps finding new ways to express itself.',
   'British luxury has a fascinating relationship with history, tradition and contemporary culture.',
   'published', 5, now())
) as seed(name, map_id, country_code, heading, research_content, status, display_order, published_at)
where not exists (select 1 from public.atlas_countries);

insert into public.atlas_brands (country_id, category_id, name, status, display_order)
select c.id, cat.id, b.name, 'published', b.display_order
from (values
  ('France', 'Louis Vuitton', 'Leather Goods', 1),
  ('France', 'Dior', 'Fashion & Beauty', 2),
  ('France', 'CHANEL', 'Fashion', 3),
  ('France', 'Hermès', 'Leather Goods', 4),
  ('France', 'Cartier', 'Jewellery', 5),
  ('Italy', 'Prada', 'Fashion', 1),
  ('Italy', 'Bottega Veneta', 'Leather Goods', 2),
  ('Italy', 'Gucci', 'Fashion', 3),
  ('Italy', 'Bulgari', 'Jewellery', 4)
) as b(country_name, name, category_name, display_order)
join public.atlas_countries c on c.name = b.country_name
join public.atlas_categories cat on cat.name = b.category_name
where not exists (select 1 from public.atlas_brands);

-- ---------------------------------------------------------------------------
-- 5. Storage path convention: atlas country/brand images upload into the
-- existing `content-images` bucket (see supabase/case_study_cms.sql) under
-- prefixes `atlas/country/<id>/...` and `atlas/brand/<id>/...` via the
-- existing uploadContentImage() helper — no new bucket or policy needed.
-- ---------------------------------------------------------------------------
