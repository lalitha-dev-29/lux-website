import type { ContentLink } from './contentLinks';

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
  author: string;
  featured: boolean;
  reading_time_minutes: number | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image: string | null;
  links: ContentLink[];
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Fields the public site is allowed to render — never expose more than this to anon requests. */
export const PUBLIC_JOURNAL_FIELDS =
  'id,title,slug,excerpt,content,external_url,category,tags,cover_image,author,featured,reading_time_minutes,seo_title,seo_description,og_image,links,published_at' as const;

export { slugify } from './slugify';
