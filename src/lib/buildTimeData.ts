import type { JournalPost } from './journalTypes';
import { PUBLIC_JOURNAL_FIELDS } from './journalTypes';
import type { CaseStudy } from './caseStudyTypes';
import { PUBLIC_CASE_STUDY_FIELDS } from './caseStudyTypes';
import { parseLinks } from './contentLinks';

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
