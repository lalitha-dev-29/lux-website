import type { JournalPost } from './journalTypes';
import { PUBLIC_JOURNAL_FIELDS } from './journalTypes';
import type { CaseStudy } from './caseStudyTypes';
import { PUBLIC_CASE_STUDY_FIELDS } from './caseStudyTypes';
import { parseLinks } from './contentLinks';
import type { LearningOverview, LearningRightNowItem, LearningEducationItem, LearningCertification } from './learningTypes';
import {
  PUBLIC_LEARNING_OVERVIEW_FIELDS,
  PUBLIC_RIGHT_NOW_FIELDS,
  PUBLIC_EDUCATION_FIELDS,
  PUBLIC_CERTIFICATION_FIELDS,
} from './learningTypes';
import type { AtlasCountry, AtlasBrand, AtlasCategory } from './atlasTypes';
import { PUBLIC_ATLAS_COUNTRY_FIELDS, PUBLIC_ATLAS_BRAND_FIELDS, PUBLIC_ATLAS_CATEGORY_FIELDS } from './atlasTypes';
import { renderMarkdown } from './markdown';

/**
 * Build-time reads against Supabase's PostgREST API, used by `getStaticPaths()`
 * in the public Journal/Case Study routes so every entry gets a real,
 * pre-rendered page (title, SEO tags, canonical URL) instead of a client-fetched
 * shell. This runs in Node during `astro build`, not in the browser — same
 * technique and same anon-key credentials as src/lib/journalClient.ts, just
 * invoked at a different time. RLS still enforces that only published rows
 * come back.
 *
 * Fails loudly (throws) if Supabase isn't configured, rather than silently
 * building a site with zero Journal/Case Study pages — a scheduled rebuild
 * with a missing secret should fail visibly in the Actions log, not ship an
 * empty site.
 */

function getConfig(): { url: string; anonKey: string } {
  const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) {
    throw new Error(
      'PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY are not set. The build cannot fetch Journal or ' +
        'Case Study content without them — see .env.example.'
    );
  }
  return { url, anonKey };
}

async function restGet(path: string): Promise<unknown[]> {
  const { url, anonKey } = getConfig();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!res.ok) {
    throw new Error(`Supabase request failed (${res.status}) for ${path}: ${await res.text()}`);
  }
  return res.json();
}

function normalizeJournalPost(row: Record<string, unknown>): JournalPost {
  return { ...row, links: parseLinks(row.links) } as JournalPost;
}

function normalizeCaseStudy(row: Record<string, unknown>): CaseStudy {
  return { ...row, links: parseLinks(row.links) } as CaseStudy;
}

export async function fetchAllPublishedJournalPosts(): Promise<JournalPost[]> {
  const rows = await restGet(
    `journal_posts?select=${PUBLIC_JOURNAL_FIELDS}&status=eq.published&order=published_at.desc`
  );
  return (rows as Record<string, unknown>[]).map(normalizeJournalPost);
}

export async function fetchPublishedJournalPostBySlug(slug: string): Promise<JournalPost | null> {
  const rows = await restGet(
    `journal_posts?select=${PUBLIC_JOURNAL_FIELDS}&status=eq.published&slug=eq.${encodeURIComponent(slug)}&limit=1`
  );
  const list = (rows as Record<string, unknown>[]).map(normalizeJournalPost);
  return list[0] ?? null;
}

export async function fetchAllPublishedCaseStudies(): Promise<CaseStudy[]> {
  const rows = await restGet(
    `case_studies?select=${PUBLIC_CASE_STUDY_FIELDS}&status=eq.published&order=order_index.asc`
  );
  return (rows as Record<string, unknown>[]).map(normalizeCaseStudy);
}

/** Fallback used only if the learning_overview singleton row is ever missing (it's seeded by supabase/learning_cms.sql). */
const FALLBACK_LEARNING_OVERVIEW: LearningOverview = {
  heading: "I'm Still Learning. And I Think That's a Good Thing.",
  description:
    "Marketing changes constantly. Consumers change. Culture changes. And luxury definitely changes. So I don't want to treat learning as something that ends with a degree or a certificate. I want it to be part of how I build my career.",
  updated_at: new Date(0).toISOString(),
};

export async function fetchLearningOverview(): Promise<LearningOverview> {
  const rows = await restGet(`learning_overview?select=${PUBLIC_LEARNING_OVERVIEW_FIELDS}&id=eq.true&limit=1`);
  return (rows[0] as LearningOverview | undefined) ?? FALLBACK_LEARNING_OVERVIEW;
}

export async function fetchAllRightNow(): Promise<LearningRightNowItem[]> {
  const rows = await restGet(`learning_right_now?select=${PUBLIC_RIGHT_NOW_FIELDS}&order=order_index.asc`);
  return rows as LearningRightNowItem[];
}

export async function fetchAllEducation(): Promise<LearningEducationItem[]> {
  const rows = await restGet(`learning_education?select=${PUBLIC_EDUCATION_FIELDS}&order=order_index.asc`);
  return rows as LearningEducationItem[];
}

export async function fetchAllCertifications(): Promise<LearningCertification[]> {
  const rows = await restGet(`learning_certifications?select=${PUBLIC_CERTIFICATION_FIELDS}&order=order_index.asc`);
  return rows as LearningCertification[];
}

// ---------------------------------------------------------------------------
// Atlas — the public /atlas/ page's build-time data source, replacing the
// old static import of src/data/atlas.ts. RLS already restricts brand rows
// to ones whose parent country is also published (supabase/atlas_cms.sql),
// but the assembly below still keys brands by country_id defensively rather
// than trusting that alone.
// ---------------------------------------------------------------------------

export async function fetchAllPublishedAtlasCountries(): Promise<AtlasCountry[]> {
  const rows = await restGet(
    `atlas_countries?select=${PUBLIC_ATLAS_COUNTRY_FIELDS}&status=eq.published&order=display_order.asc`
  );
  return rows as AtlasCountry[];
}

export async function fetchAllPublishedAtlasBrands(): Promise<AtlasBrand[]> {
  const rows = await restGet(
    `atlas_brands?select=${PUBLIC_ATLAS_BRAND_FIELDS}&status=eq.published&order=display_order.asc`
  );
  return rows as AtlasBrand[];
}

export async function fetchAllAtlasCategories(): Promise<AtlasCategory[]> {
  const rows = await restGet(`atlas_categories?select=${PUBLIC_ATLAS_CATEGORY_FIELDS}&order=display_order.asc`);
  return rows as AtlasCategory[];
}

export interface AtlasMapPanelData {
  heading: string;
  description: string;
  brands: { name: string; cat: string; website: string | null; founder: string | null; foundedYear: number | null }[];
}

/**
 * Assembles the exact shape AtlasMap.astro has always consumed — a
 * Record<mapId, {heading, description, brands}> — from the three Atlas
 * tables, keyed by each published country's `map_id` (the string that must
 * match a `data-name` in src/data/world-map-paths.svg) rather than its
 * editorial `name`. `research_content` Markdown is rendered to HTML once
 * here at build time via the shared renderMarkdown() (src/lib/markdown.ts),
 * the same helper Journal/Case Study body content uses.
 */
export async function buildAtlasMapData(): Promise<Record<string, AtlasMapPanelData>> {
  const [countries, brands, categories] = await Promise.all([
    fetchAllPublishedAtlasCountries(),
    fetchAllPublishedAtlasBrands(),
    fetchAllAtlasCategories(),
  ]);

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  const result: Record<string, AtlasMapPanelData> = {};
  for (const country of countries) {
    if (!country.map_id) continue; // shouldn't happen for published rows (DB check constraint), guarded defensively
    const countryBrands = brands
      .filter((b) => b.country_id === country.id)
      .map((b) => ({
        name: b.name,
        cat: (b.category_id && categoryNameById.get(b.category_id)) || 'Uncategorized',
        website: b.website_url,
        founder: b.founder,
        foundedYear: b.founded_year,
      }));

    result[country.map_id] = {
      heading: country.heading,
      description: renderMarkdown(country.research_content),
      brands: countryBrands,
    };
  }
  return result;
}
