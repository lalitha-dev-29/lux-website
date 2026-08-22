import { slugify } from './journalTypes';
import type { JournalPostInput } from './supabaseAdmin';

export interface JournalFormValues {
  title: string;
  excerpt: string;
  content: string;
  external_url: string;
  category: string;
  tags: string;
  cover_image: string;
}

export function readJournalForm(): JournalFormValues {
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement).value;
  return {
    title: val('fTitle').trim(),
    excerpt: val('fExcerpt').trim(),
    content: val('fContent').trim(),
    external_url: val('fExternalUrl').trim(),
    category: val('fCategory').trim(),
    tags: val('fTags').trim(),
    cover_image: val('fCoverImage').trim(),
  };
}

export function writeJournalForm(values: Partial<JournalFormValues>): void {
  const set = (id: string, v: string | undefined) => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    if (el && v !== undefined) el.value = v;
  };
  set('fTitle', values.title);
  set('fExcerpt', values.excerpt);
  set('fContent', values.content);
  set('fExternalUrl', values.external_url);
  set('fCategory', values.category);
  set('fTags', values.tags);
  set('fCoverImage', values.cover_image);
}

/** Returns an error message if invalid, or null if the form is valid. Mirrors the DB's `journal_posts_has_body` check. */
export function validateJournalForm(values: JournalFormValues): string | null {
  if (!values.title) return 'Title is required.';
  if (!values.excerpt) return 'Excerpt is required.';
  if (!values.content && !values.external_url) {
    return 'Provide Main Content, an External LinkedIn URL, or both.';
  }
  if (values.external_url) {
    try {
      new URL(values.external_url);
    } catch {
      return 'External LinkedIn URL is not a valid URL.';
    }
  }
  if (values.cover_image) {
    try {
      new URL(values.cover_image, window.location.origin);
    } catch {
      return 'Cover Image is not a valid URL.';
    }
  }
  return null;
}

export function toJournalPostInput(values: JournalFormValues, existingSlug?: string): JournalPostInput {
  return {
    title: values.title,
    slug: existingSlug || slugify(values.title),
    excerpt: values.excerpt,
    content: values.content || null,
    external_url: values.external_url || null,
    category: values.category || null,
    tags: values.tags
      ? values.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
    cover_image: values.cover_image || null,
  };
}
