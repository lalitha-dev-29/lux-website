/** Small display helpers shared by the Case Study listing and detail pages. */
import type { CaseStudy } from './caseStudyTypes';

/** "August 2026" from published_at, or null when unpublished/undated. */
export function caseStudyMonth(c: Pick<CaseStudy, 'published_at'>): string | null {
  if (!c.published_at) return null;
  const d = new Date(c.published_at);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Footer details for a card: reading time, PDF length, link count. */
export function caseStudyDetails(c: CaseStudy): string[] {
  const parts: string[] = [];
  if (c.reading_time_minutes) parts.push(`${c.reading_time_minutes} min read`);
  if (c.pdf_url) parts.push(c.pdf_page_count ? `${c.pdf_page_count}-page deck` : 'Full deck');
  if (c.gallery.length > 0) parts.push(`${c.gallery.length} ${c.gallery.length === 1 ? 'photo' : 'photos'}`);
  if (c.links.length > 0) parts.push(`${c.links.length} ${c.links.length === 1 ? 'resource' : 'resources'}`);
  return parts;
}
