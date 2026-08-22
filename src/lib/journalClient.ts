import type { JournalPost } from './journalTypes';
import { PUBLIC_JOURNAL_FIELDS } from './journalTypes';

/**
 * Minimal, dependency-free reads against Supabase's auto-generated REST API
 * (PostgREST), used by the public Journal pages. Deliberately NOT using
 * @supabase/supabase-js here — that SDK is only needed for authenticated
 * writes (the admin panel), and keeping it out of this bundle keeps the
 * public site close to its original near-zero-JS footprint.
 *
 * Safety comes from Row Level Security (supabase/schema.sql), not from
 * keeping the URL/key secret — both are meant to be public. This mirrors how
 * the existing EmailJS integration already ships public keys to the browser.
 */

interface SupabaseRestConfig {
  url: string;
  anonKey: string;
}

function getConfig(): SupabaseRestConfig | null {
  const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

async function restGet(path: string): Promise<unknown[] | null> {
  const config = getConfig();
  if (!config) return null;
  const res = await fetch(`${config.url}/rest/v1/${path}`, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
    },
  });
  if (!res.ok) return null;
  return res.json();
}

/** Published posts only — RLS also enforces this server-side, so this filter is defense in depth, not the actual boundary. */
export async function fetchPublishedJournalPosts(): Promise<JournalPost[] | null> {
  const rows = await restGet(
    `journal_posts?select=${PUBLIC_JOURNAL_FIELDS}&status=eq.published&order=published_at.desc`
  );
  return rows as JournalPost[] | null;
}

export async function fetchPublishedJournalPostBySlug(slug: string): Promise<JournalPost | null> {
  const rows = await restGet(
    `journal_posts?select=${PUBLIC_JOURNAL_FIELDS}&status=eq.published&slug=eq.${encodeURIComponent(slug)}&limit=1`
  );
  const list = rows as JournalPost[] | null;
  return list && list.length > 0 ? list[0] : null;
}
