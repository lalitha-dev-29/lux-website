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
