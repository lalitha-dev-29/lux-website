/** Shared types + formatting helpers for the standalone Guest Lectures CMS. */
import { monthName } from './learningTypes';
import { slugify } from './slugify';
import { escapeHtml } from './html';
import { parseGallery, type GalleryImage } from './gallery';

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
  /** Photos from the session (supabase/portfolio_media.sql). */
  gallery: GalleryImage[];
  /** The one question the session set out to answer. */
  core_question: string | null;
  created_at: string;
  updated_at: string;
}

export const PUBLIC_GUEST_LECTURE_FIELDS = 'id,topic,lecture_date,speakers,tags,key_learnings,files' as const;

/** Added by supabase/portfolio_media.sql — requested only when present, so older databases keep building. */
export const PUBLIC_GUEST_LECTURE_MEDIA_FIELDS = 'gallery,core_question' as const;

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
  return {
    ...(row as unknown as GuestLecture),
    speakers,
    tags,
    files,
    gallery: parseGallery(row.gallery),
    core_question: str(row.core_question),
  };
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

export interface LearningPoint {
  /** "Claude Code - Turning designs into functional websites" — null for an untitled bullet. */
  title: string | null;
  body: string;
}

export interface StructuredLearnings {
  /** Opening paragraph(s) before the first takeaway. */
  intro: string[];
  points: LearningPoint[];
  /** Closing paragraph(s) after the last takeaway, e.g. "Overall, ...". */
  outro: string[];
}

/**
 * Splits the free-text "What I learned" field into an intro, a list of
 * takeaways and a conclusion, so the detail page can lay them out as numbered
 * cards. A line reading "Title: explanation" becomes a titled takeaway; a
 * short line ending in ":" (e.g. "Key learnings from the session:") is
 * treated as a heading and dropped. Text before the first takeaway is the
 * intro; text after the last one is the conclusion. Leading bullet markers
 * ("-", "•", "*", "1.") are ignored.
 */
export function structureLearnings(text: string): StructuredLearnings {
  const lines = text
    .split('\n')
    .map((l) =>
      l
        .trim()
        .replace(/^(?:[-•*–]|\d+[.)])\s+/, '')
        // "Title:** text" / "**Title**: text" — a bold marker hugging the colon.
        .replace(/\*\*\s*:\s*\*\*|:\s*\*\*|\*\*\s*:/g, ':')
        .trim()
    )
    .filter(Boolean);

  const intro: string[] = [];
  const points: LearningPoint[] = [];
  const outro: string[] = [];

  for (const line of lines) {
    if (line.endsWith(':') && line.length <= 90) continue;
    const titled = /^(.{3,110}?):\s+(.+)$/.exec(line);
    // Ignore a colon that belongs to a URL or a time ("https://", "10:30").
    const isTitled = titled && !/https?$/i.test(titled[1]) && !/\d$/.test(titled[1]);
    if (isTitled) {
      // Anything collected as "outro" since the last point was really part of
      // the list (an untitled bullet between titled ones).
      for (const loose of outro.splice(0)) points.push({ title: null, body: loose });
      points.push({ title: titled![1].replace(/\*+/g, '').trim(), body: titled![2] });
    } else if (points.length === 0) {
      intro.push(line);
    } else {
      outro.push(line);
    }
  }
  return { intro, points, outro };
}

/**
 * Admin text → safe inline HTML: escapes everything, then turns `code` into
 * <code> and **bold** into <strong>; any unmatched "**" left over from a
 * half-typed bold is removed rather than shown.
 */
export function inlineFormat(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*\*/g, '');
}
