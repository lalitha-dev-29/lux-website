-- Adds an admin-controlled "Coming Soon" flag to Case Studies.
--
-- Run this once in the Supabase SQL Editor, AFTER schema.sql and
-- case_study_cms.sql. Safe to re-run (idempotent).
--
-- Previously the "Coming Soon" badge was hardcoded onto every Case Study
-- card in the UI (src/components/CaseStudyCard.astro) with no way to turn
-- it off. This replaces that with a per-row admin checkbox — defaults to
-- false (not shown) for every existing row, same as new ones.

alter table public.case_studies
  add column if not exists coming_soon boolean not null default false;
