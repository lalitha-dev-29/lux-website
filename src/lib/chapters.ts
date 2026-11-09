/** Shared by the Case Study and Project pages: anchors every rendered "## Heading". */
import { renderMarkdown } from './markdown';
import { slugify } from './slugify';

export interface Chapter {
  id: string;
  title: string;
}

/** Renders Markdown and gives each <h2> an id, returning the chapters for a contents list. */
export function renderWithChapters(markdown: string | null | undefined): { html: string; chapters: Chapter[] } {
  const chapters: Chapter[] = [];
  const used = new Set<string>();
  const html = renderMarkdown(markdown).replace(/<h2>([\s\S]*?)<\/h2>/g, (_m, inner: string) => {
    const text = inner
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .trim();
    let id = `chapter-${slugify(text) || chapters.length + 1}`;
    while (used.has(id)) id += '-x';
    used.add(id);
    chapters.push({ id, title: text });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { html, chapters };
}
