import { Marked, type RendererObject } from 'marked';
import { escapeHtml, safeUrl } from './html';

/**
 * A dedicated Marked instance (not the global singleton) so this module's
 * renderer overrides can't leak into or be affected by anything else that
 * might use `marked` elsewhere. Raw HTML in the source is left un-rendered
 * by default (`marked`'s standard behavior with GFM) — admin-authored
 * content is lower-risk than public input, but links/images still route
 * through `safeUrl()` as defence in depth (see src/lib/html.ts), consistent
 * with how the rest of the codebase treats admin-authored URLs.
 */
const renderer: RendererObject = {
  link({ href, tokens }) {
    const text = this.parser.parseInline(tokens);
    return `<a href="${safeUrl(href)}" target="_blank" rel="noopener">${text}</a>`;
  },
  image({ href, title, text }) {
    const alt = escapeHtml(text || '');
    const caption = title ? `<figcaption>${escapeHtml(title)}</figcaption>` : '';
    return `<figure><img src="${safeUrl(href)}" alt="${alt}" loading="lazy" />${caption}</figure>`;
  },
};

const md = new Marked({ gfm: true, breaks: false });
md.use({ renderer });

/**
 * Renders admin-authored Markdown (Journal/Case Study body content) to HTML
 * at build time. Image syntax `![alt](url "caption")` becomes a <figure>
 * with an optional caption, giving editors inline images + captions + alt
 * text without a rich-text editor dependency.
 */
export function renderMarkdown(source: string | null | undefined): string {
  if (!source) return '';
  return md.parse(source, { async: false }) as string;
}
