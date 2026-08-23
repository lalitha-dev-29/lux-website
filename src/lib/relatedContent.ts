import type { JournalPost } from './journalTypes';
import type { CaseStudy } from './caseStudyTypes';
import { withBase } from './url';

export interface RelatedItem {
  href: string;
  eyebrow: string | null;
  title: string;
  excerpt: string;
  image: string | null;
  meta: string | null;
  tags: string[];
  kind: 'journal' | 'case-study';
}

function toItem(kind: 'journal' | 'case-study', entry: JournalPost | CaseStudy): RelatedItem {
  const path = kind === 'journal' ? `/journal/${entry.slug}/` : `/case-studies/${entry.slug}/`;
  return {
    href: withBase(path),
    eyebrow: 'category' in entry ? entry.category : null,
    title: entry.title,
    excerpt: entry.excerpt,
    image: entry.cover_image,
    meta: entry.reading_time_minutes ? `${entry.reading_time_minutes} min read` : null,
    tags: entry.tags,
    kind,
  };
}

function overlapScore(tagsA: string[], categoryA: string | null, tagsB: string[], categoryB: string | null): number {
  const setA = new Set(tagsA.map((t) => t.toLowerCase()));
  let score = 0;
  for (const tag of tagsB) if (setA.has(tag.toLowerCase())) score++;
  if (categoryA && categoryB && categoryA.toLowerCase() === categoryB.toLowerCase()) score += 2;
  return score;
}

/**
 * Tag/category-overlap based discovery — no manually curated relationships.
 * Only returns items with a real relevance signal (score > 0); a sparse or
 * empty related section is preferable to padding it with unrelated content.
 */
export function getRelatedItems(opts: {
  currentSlug: string;
  currentKind: 'journal' | 'case-study';
  currentTags: string[];
  currentCategory: string | null;
  journalPosts: JournalPost[];
  caseStudies: CaseStudy[];
  limit?: number;
}): RelatedItem[] {
  const { currentSlug, currentKind, currentTags, currentCategory, journalPosts, caseStudies, limit = 3 } = opts;

  const scored: { item: RelatedItem; score: number }[] = [];
  for (const post of journalPosts) {
    if (currentKind === 'journal' && post.slug === currentSlug) continue;
    scored.push({ item: toItem('journal', post), score: overlapScore(currentTags, currentCategory, post.tags, post.category) });
  }
  for (const cs of caseStudies) {
    if (currentKind === 'case-study' && cs.slug === currentSlug) continue;
    scored.push({ item: toItem('case-study', cs), score: overlapScore(currentTags, currentCategory, cs.tags, cs.category) });
  }

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.item);
}
