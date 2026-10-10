/** Shared types + formatting helpers for the standalone Guest Lectures CMS. */
import { monthName } from './learningTypes';
import { slugify } from './slugify';

export interface GuestSpeaker {
  name: string;
  /** Job title / organisation, e.g. "CMO, Maison Example". */
  role: string | null;
  /** Free-text biography / everything worth remembering about the speaker. */
  description: string | null;
  /** A remembered quotation from this speaker. */
  quote: string | null;
  /** Public URLs of uploaded photos (any number). */
  photos: string[];
}

export type GuestLectureFileType = 'pdf' | 'ppt';

export interface GuestLectureFile {
  url: string;
  name: string;
  type: GuestLectureFileType;
}

export interface GuestLecture {
  id: string;
  topic: string;
  /** ISO calendar date, YYYY-MM-DD. */
  lecture_date: string;
  speakers: GuestSpeaker[];
  /** Admin-chosen subject tags, e.g. "Luxury Strategy". */
  tags: string[];
  key_learnings: string;
  files: GuestLectureFile[];
  created_at: string;
  updated_at: string;
}

export const PUBLIC_GUEST_LECTURE_FIELDS = 'id,topic,lecture_date,speakers,tags,key_learnings,files' as const;

/** "12 March 2026" from YYYY-MM-DD, parsed as a calendar date (no timezone shift). */
export function formatLectureDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return `${d} ${monthName(m)} ${y}`;
}

/** Defensive normalisation — jsonb columns can hold anything an admin (or a bad write) put there. */
export function normalizeGuestLecture(row: Record<string, unknown>): GuestLecture {
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
  const speakers = (Array.isArray(row.speakers) ? row.speakers : []).map((s) => {
    const o = (s ?? {}) as Record<string, unknown>;
    return {
      name: str(o.name) ?? '',
      role: str(o.role),
      description: str(o.description),
      quote: str(o.quote),
      photos: Array.isArray(o.photos) ? o.photos.filter((p): p is string => typeof p === 'string') : [],
    } satisfies GuestSpeaker;
  });
  const files = (Array.isArray(row.files) ? row.files : []).flatMap((f) => {
    const o = (f ?? {}) as Record<string, unknown>;
    const url = str(o.url);
    if (!url) return [];
    return [{ url, name: str(o.name) ?? 'Download', type: o.type === 'ppt' ? 'ppt' : 'pdf' } as GuestLectureFile];
  });
  const tags = (Array.isArray(row.tags) ? row.tags : [])
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim())
    .filter(Boolean);
  return { ...(row as unknown as GuestLecture), speakers, tags, files };
}

/**
 * Stable URL slug per lecture, derived from the topic. Lectures have no slug
 * column, so a duplicate topic gets the first 8 chars of its id appended.
 */
export function lectureSlugs(lectures: GuestLecture[]): Map<string, string> {
  const seen = new Map<string, number>();
  const base = lectures.map((l) => slugify(l.topic));
  base.forEach((b) => seen.set(b, (seen.get(b) ?? 0) + 1));
  return new Map(lectures.map((l, i) => [l.id, (seen.get(base[i]) ?? 0) > 1 ? `${base[i]}-${l.id.slice(0, 8)}` : base[i]]));
}

/** "Rishabh & Ashwin", "A, B & C" — for card eyebrows and detail metadata. */
export function speakerNames(lecture: GuestLecture): string {
  const names = lecture.speakers.map((s) => s.name).filter(Boolean);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/** First speaker photo across all speakers — used as the card cover. */
export function lectureCoverImage(lecture: GuestLecture): string | null {
  for (const s of lecture.speakers) if (s.photos[0]) return s.photos[0];
  return null;
}

/** Card excerpt: the takeaways flattened to one line and trimmed. */
export function lectureExcerpt(lecture: GuestLecture, max = 170): string {
  const flat = lecture.key_learnings.split('\n').map((l) => l.trim()).filter(Boolean).join(' · ');
  return flat.length > max ? `${flat.slice(0, max).replace(/\s+\S*$/, '')}…` : flat;
}
