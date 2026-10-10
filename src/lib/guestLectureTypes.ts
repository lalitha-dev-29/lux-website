/** Shared types + formatting helpers for the standalone Guest Lectures CMS. */
import { monthName } from './learningTypes';

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
  key_learnings: string;
  files: GuestLectureFile[];
  created_at: string;
  updated_at: string;
}

export const PUBLIC_GUEST_LECTURE_FIELDS = 'id,topic,lecture_date,speakers,key_learnings,files' as const;

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
  return { ...(row as unknown as GuestLecture), speakers, files };
}
