import type { ContentLink } from './contentLinks';
import type { GalleryImage, KeyFigure } from './gallery';

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
  coming_soon: boolean;
  status: CaseStudyStatus;
  pdf_url: string | null;
  pdf_filename: string | null;
  pdf_page_count: number | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image: string | null;
  author: string;
  links: ContentLink[];
  /** Photo grid shown as the "Visual Archive" (supabase/portfolio_media.sql). */
  gallery: GalleryImage[];
  /** "By the Numbers" stat cards. */
  key_figures: KeyFigure[];
  /** Closing "Core Conclusion" statement. */
  conclusion: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Fields the public site is allowed to render — never expose more than this to anon requests. */
export const PUBLIC_CASE_STUDY_FIELDS =
  'id,slug,title,excerpt,content,category,tags,cover_image,order_index,reading_time_minutes,featured,coming_soon,pdf_url,pdf_filename,pdf_page_count,seo_title,seo_description,og_image,author,links,published_at' as const;

/** Added by supabase/portfolio_media.sql — fetched separately so the build still works before that migration runs. */
export const PUBLIC_CASE_STUDY_MEDIA_FIELDS = 'gallery,key_figures,conclusion' as const;

export { slugify } from './slugify';
