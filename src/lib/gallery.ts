/**
 * Shared shapes + defensive parsers for the media added by
 * supabase/portfolio_media.sql: photo galleries (Case Studies and Guest
 * Lectures) and key-figure stat cards (Case Studies). jsonb columns can hold
 * anything an admin — or an older row — put there, so everything is
 * normalised before it reaches a template.
 */

export interface GalleryImage {
  url: string;
  caption: string | null;
}

export interface KeyFigure {
  /** The headline number or fact, e.g. "$12B" or "7 touchpoints". */
  value: string;
  /** What it means, e.g. "Brand value, 2026". */
  label: string;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function parseGallery(raw: unknown): GalleryImage[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    const url = typeof item === 'string' ? str(item) : str(o.url);
    return url ? [{ url, caption: typeof item === 'string' ? null : str(o.caption) }] : [];
  });
}

export function parseKeyFigures(raw: unknown): KeyFigure[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    const value = str(o.value);
    return value ? [{ value, label: str(o.label) ?? '' }] : [];
  });
}

/** Admin textarea ("$12B | Brand value" per line) <-> KeyFigure[]. */
export function keyFiguresFromText(text: string): KeyFigure[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, ...rest] = line.split('|');
      return { value: value.trim(), label: rest.join('|').trim() };
    })
    .filter((f) => f.value);
}

export function keyFiguresToText(figures: KeyFigure[]): string {
  return figures.map((f) => (f.label ? `${f.value} | ${f.label}` : f.value)).join('\n');
}
