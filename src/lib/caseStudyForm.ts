import { slugify } from './caseStudyTypes';
import { calculateReadingTime } from './readingTime';
import { readLinks, writeLinks } from './linksForm';
import type { ContentLink } from './contentLinks';
import type { CaseStudyInput } from './supabaseAdmin';

export interface CaseStudyFormValues {
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string;
  cover_image: string;
  order_index: string;
  author: string;
  featured: boolean;
  seo_title: string;
  seo_description: string;
  og_image: string;
  links: ContentLink[];
}

export function readCaseStudyForm(): CaseStudyFormValues {
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement).value;
  const checked = (id: string) => (document.getElementById(id) as HTMLInputElement).checked;
  return {
    title: val('fTitle').trim(),
    excerpt: val('fExcerpt').trim(),
    content: val('fContent').trim(),
    category: val('fCategory').trim(),
    tags: val('fTags').trim(),
    cover_image: val('fCoverImage').trim(),
    order_index: val('fOrderIndex').trim(),
    author: val('fAuthor').trim(),
    featured: checked('fFeatured'),
    seo_title: val('fSeoTitle').trim(),
    seo_description: val('fSeoDescription').trim(),
    og_image: val('fOgImage').trim(),
    links: readLinks('caseStudyLinks'),
  };
}

export function writeCaseStudyForm(values: {
  title: string;
  excerpt: string;
  content: string | null;
  category: string;
  tags: string[];
  cover_image: string | null;
  order_index: number;
  author: string;
  featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
  og_image: string | null;
  links: ContentLink[];
}): void {
  const set = (id: string, v: string | undefined | null) => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    if (el && v !== undefined && v !== null) el.value = v;
  };
  set('fTitle', values.title);
  set('fExcerpt', values.excerpt);
  set('fContent', values.content ?? '');
  set('fCategory', values.category);
  set('fTags', values.tags.join(', '));
  set('fCoverImage', values.cover_image ?? '');
  set('fOrderIndex', String(values.order_index));
  set('fAuthor', values.author);
  set('fSeoTitle', values.seo_title ?? '');
  set('fSeoDescription', values.seo_description ?? '');
  set('fOgImage', values.og_image ?? '');
  const featuredEl = document.getElementById('fFeatured') as HTMLInputElement | null;
  if (featuredEl) featuredEl.checked = values.featured;
  writeLinks('caseStudyLinks', values.links);
}

export function validateCaseStudyForm(values: CaseStudyFormValues): string | null {
  if (!values.title) return 'Title is required.';
  if (!values.excerpt) return 'Excerpt is required.';
  if (!values.content) return 'Content is required.';
  if (!values.category) return 'Category is required.';
  return null;
}

export function toCaseStudyInput(values: CaseStudyFormValues, existingSlug?: string): CaseStudyInput {
  return {
    title: values.title,
    slug: existingSlug || slugify(values.title),
    excerpt: values.excerpt,
    content: values.content,
    category: values.category,
    tags: values.tags
      ? values.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [],
    cover_image: values.cover_image || null,
    order_index: Number(values.order_index) || 0,
    author: values.author || 'Kasturi Lalitha Manogna',
    featured: values.featured,
    reading_time_minutes: calculateReadingTime(values.content),
    seo_title: values.seo_title || null,
    seo_description: values.seo_description || null,
    og_image: values.og_image || null,
    links: values.links,
  };
}
