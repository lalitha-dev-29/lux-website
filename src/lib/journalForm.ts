import { slugify } from './journalTypes';
import type { JournalPostInput } from './supabaseAdmin';

export interface JournalFormValues {
  title: string;
  excerpt: string;
  external_url: string;
}

export function readJournalForm(): JournalFormValues {
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement).value;
  return {
    title: val('fTitle').trim(),
    excerpt: val('fExcerpt').trim(),
    external_url: val('fExternalUrl').trim(),
  };
}

export function writeJournalForm(values: Partial<JournalFormValues>): void {
  const set = (id: string, v: string | undefined) => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    if (el && v !== undefined) el.value = v;
  };
  set('fTitle', values.title);
  set('fExcerpt', values.excerpt);
  set('fExternalUrl', values.external_url);
}

/** Returns an error message if invalid, or null if the form is valid. The URL is required
 *  because it's the card's only destination, and because the DB's `journal_posts_has_body`
 *  check needs either it or `content` — and `content` is no longer authored here. */
export function validateJournalForm(values: JournalFormValues): string | null {
  if (!values.title) return 'Title is required.';
  if (!values.excerpt) return 'Excerpt is required.';
  if (!values.external_url) return 'LinkedIn Post URL is required.';
  try {
    new URL(values.external_url);
  } catch {
    return 'LinkedIn Post URL is not a valid URL.';
  }
  return null;
}

export function toJournalPostInput(values: JournalFormValues, existingSlug?: string): JournalPostInput {
  return {
    title: values.title,
    slug: existingSlug || slugify(values.title),
    excerpt: values.excerpt,
    external_url: values.external_url,
    // Written explicitly rather than omitted so editing an older post clears any
    // leftover values from when these fields were still part of the editor.
    content: null,
    category: null,
    tags: [],
    cover_image: null,
  };
}
