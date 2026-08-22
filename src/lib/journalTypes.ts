export type JournalStatus = 'draft' | 'published';

export interface JournalPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string | null;
  external_url: string | null;
  category: string | null;
  tags: string[];
  cover_image: string | null;
  status: JournalStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Fields the public site is allowed to render — never expose more than this to anon requests. */
export const PUBLIC_JOURNAL_FIELDS =
  'id,title,slug,excerpt,content,external_url,category,tags,cover_image,published_at' as const;

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

/** Escapes HTML, then turns blank-line-separated paragraphs into <p> tags. No markdown parsing — the
 *  editor is plain text by design (see README "Journal CMS" section), so this is inherently safe to
 *  render: nothing written into `content` can ever produce a tag or attribute. */
export function renderJournalContent(text: string): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  return text
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${esc(para).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}
