/** Shared by Journal and Case Studies: a flexible, typed external-link list (replaces the old LinkedIn-only `external_url` field). */

export type LinkPlatform =
  | 'linkedin'
  | 'medium'
  | 'substack'
  | 'github'
  | 'website'
  | 'research_paper'
  | 'other';

export interface ContentLink {
  platform: LinkPlatform;
  url: string;
  /** Only used when platform is 'other' — a short custom label. */
  label?: string;
}

export const LINK_PLATFORM_LABELS: Record<LinkPlatform, string> = {
  linkedin: 'LinkedIn',
  medium: 'Medium',
  substack: 'Substack',
  github: 'GitHub',
  website: 'Website',
  research_paper: 'Research Paper',
  other: 'Other',
};

export function linkLabel(link: ContentLink): string {
  if (link.platform === 'other' && link.label) return link.label;
  return LINK_PLATFORM_LABELS[link.platform];
}

/**
 * Journal posts saved before this feature only have the old `external_url`
 * column (a single LinkedIn link), not `links`. Falls back to it so those
 * posts keep their working "View on LinkedIn" link until they're next
 * edited and saved through the new editor (which always writes `links`).
 */
export function effectiveLinks(links: ContentLink[], legacyExternalUrl: string | null): ContentLink[] {
  if (links.length > 0) return links;
  if (legacyExternalUrl) return [{ platform: 'linkedin', url: legacyExternalUrl }];
  return [];
}

/** Parses a jsonb `links` column value defensively — malformed/legacy data degrades to an empty list rather than crashing a page. */
export function parseLinks(value: unknown): ContentLink[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ContentLink =>
      !!item &&
      typeof item === 'object' &&
      typeof (item as ContentLink).url === 'string' &&
      typeof (item as ContentLink).platform === 'string'
  );
}
