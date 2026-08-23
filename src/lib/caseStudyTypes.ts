import type { ContentLink } from './contentLinks';

export type CaseStudyStatus = 'draft' | 'published';

export interface CaseStudy {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string | null;
  category: string;
  tags: string[];
  cover_image: string | null;
  order_index: number;
  reading_time_minutes: number | null;
  featured: boolean;
  status: CaseStudyStatus;
  pdf_url: string | null;
  pdf_filename: string | null;
  pdf_page_count: number | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image: string | null;
  author: string;
  links: ContentLink[];
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Fields the public site is allowed to render — never expose more than this to anon requests. */
export const PUBLIC_CASE_STUDY_FIELDS =
  'id,slug,title,excerpt,content,category,tags,cover_image,order_index,reading_time_minutes,featured,pdf_url,pdf_filename,pdf_page_count,seo_title,seo_description,og_image,author,links,published_at' as const;

export { slugify } from './slugify';
