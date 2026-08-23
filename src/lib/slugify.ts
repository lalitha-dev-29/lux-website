/** Shared by Journal and Case Study admin forms — both derive a URL slug from a title. */
export function slugify(title: string): string {
  const slug = title
    .normalize('NFD')
    // Fold accents onto their base letter ("Café" -> "cafe") instead of
    // dropping them, which would otherwise yield "caf-society".
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
    .replace(/-+$/, '');
  // A title with no Latin characters at all (e.g. CJK, emoji, punctuation)
  // reduces to an empty string, which would produce an unreachable route.
  // The calling create*() function de-duplicates the fallback into post-2,
  // post-3, ... as needed.
  return slug || 'post';
}
