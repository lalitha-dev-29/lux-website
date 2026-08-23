/** Shared by Journal and Case Study forms — estimates reading time from body content. */
const WORDS_PER_MINUTE = 200;

export function calculateReadingTime(markdown: string | null | undefined): number {
  if (!markdown) return 1;
  const plain = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> link text
    .replace(/[#*_>`~-]/g, ' ') // markdown punctuation
    .trim();
  const words = plain.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
