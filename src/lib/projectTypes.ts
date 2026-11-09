/** Shared types + helpers for the Projects CMS (supabase/projects.sql). */
import type { ContentLink } from './contentLinks';
import { parseLinks } from './contentLinks';
import { parseGallery, parseKeyFigures, type GalleryImage, type KeyFigure } from './gallery';

export type ProjectStatus = 'draft' | 'published';
export type ProjectProgress = 'completed' | 'in_progress';

export interface ProjectDetail {
  label: string;
  value: string;
}

export interface TeamMember {
  name: string;
  role: string;
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  excerpt: string;
  content: string | null;
  project_type: string | null;
  course: string | null;
  institution: string | null;
  period: string | null;
  my_role: string | null;
  progress: ProjectProgress;
  tags: string[];
  cover_image: string | null;
  video_url: string | null;
  details: ProjectDetail[];
  key_figures: KeyFigure[];
  team: TeamMember[];
  gallery: GalleryImage[];
  conclusion: string | null;
  pdf_url: string | null;
  pdf_filename: string | null;
  links: ContentLink[];
  order_index: number;
  reading_time_minutes: number | null;
  status: ProjectStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Fields the public site renders — never more than this for anon requests. */
export const PUBLIC_PROJECT_FIELDS =
  'id,slug,title,tagline,excerpt,content,project_type,course,institution,period,my_role,progress,tags,cover_image,video_url,details,key_figures,team,gallery,conclusion,pdf_url,pdf_filename,links,order_index,reading_time_minutes,published_at' as const;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

function parsePairs<T>(raw: unknown, a: string, b: string, make: (x: string, y: string) => T): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    const x = str(o[a]);
    return x ? [make(x, str(o[b]) ?? '')] : [];
  });
}

/** Defensive normalisation — jsonb columns can hold anything. */
export function normalizeProject(row: Record<string, unknown>): Project {
  return {
    ...(row as unknown as Project),
    tagline: str(row.tagline),
    project_type: str(row.project_type),
    course: str(row.course),
    institution: str(row.institution),
    period: str(row.period),
    my_role: str(row.my_role),
    progress: row.progress === 'in_progress' ? 'in_progress' : 'completed',
    tags: Array.isArray(row.tags) ? row.tags.filter((t): t is string => typeof t === 'string' && !!t.trim()) : [],
    video_url: str(row.video_url),
    details: parsePairs(row.details, 'label', 'value', (label, value) => ({ label, value })),
    key_figures: parseKeyFigures(row.key_figures),
    team: parsePairs(row.team, 'name', 'role', (name, role) => ({ name, role })),
    gallery: parseGallery(row.gallery),
    conclusion: str(row.conclusion),
    links: parseLinks(row.links),
  };
}

/** Admin textarea ("Left | Right" per line) <-> pairs. */
export function pairsFromText(text: string): [string, string][] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [left, ...rest] = l.split('|');
      return [left.trim(), rest.join('|').trim()] as [string, string];
    })
    .filter(([left]) => left);
}

export function pairsToText(pairs: [string, string][]): string {
  return pairs.map(([a, b]) => (b ? `${a} | ${b}` : a)).join('\n');
}

/**
 * Turns a YouTube or Vimeo page link into an embeddable player URL.
 * Anything else returns null (the page then shows a plain "Watch" link).
 */
export function videoEmbedUrl(url: string | null): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0] || null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const m = /^\/(?:embed|shorts|live)\/([^/?#]+)/.exec(u.pathname);
      id = m?.[1] ?? null;
    }
  }
  if (id && /^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = /(\d{6,12})/.exec(u.pathname);
    if (m) return `https://player.vimeo.com/video/${m[1]}`;
  }
  return null;
}

export { slugify } from './slugify';
