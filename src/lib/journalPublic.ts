import type { JournalPost } from './journalTypes';
import { withBase } from './url';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const arrowSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
  <path d="M7 17V10M7 7.5V7M11 17v-4.5c0-1.4 1-2.5 2.4-2.5S16 11.1 16 12.5V17" />
  <path d="M4 4h16v16H4z" opacity="0" />
  <path d="M17 7l3-3M20 4v3h-3" />
</svg>`;

/** A post with an external LinkedIn URL links out to it (unchanged behavior); a content-only post links to its on-site page instead. */
function resolveLink(post: JournalPost): { href: string; label: string; meta: string; external: boolean } {
  if (post.external_url) {
    return { href: post.external_url, label: 'View on LinkedIn', meta: 'LinkedIn Post', external: true };
  }
  return {
    href: withBase(`/journal/post/?slug=${encodeURIComponent(post.slug)}`),
    label: 'Read the Full Post',
    meta: 'Journal Entry',
    external: false,
  };
}

/** Mirrors the markup of the removed JournalListItem.astro component. */
export function renderJournalListItem(post: JournalPost): string {
  const link = resolveLink(post);
  const attrs = link.external ? 'target="_blank" rel="noopener"' : '';
  return `
    <article class="li-post">
      <div>
        <div class="card-meta">${escapeHtml(link.meta)}</div>
        <h3>${escapeHtml(post.title)}</h3>
        <p class="excerpt">${escapeHtml(post.excerpt)}</p>
      </div>
      <a class="li-link" href="${escapeHtml(link.href)}" ${attrs}>
        ${escapeHtml(link.label)}
        ${arrowSvg}
      </a>
    </article>`;
}

/** Mirrors the markup of the removed JournalPreviewCard.astro component. */
export function renderJournalPreviewCard(post: JournalPost): string {
  const link = resolveLink(post);
  const attrs = link.external ? 'target="_blank" rel="noopener"' : '';
  return `
    <a href="${escapeHtml(link.href)}" ${attrs} class="card">
      <div class="card-body">
        <div class="card-meta">${escapeHtml(link.meta)}</div>
        <h3>${escapeHtml(post.title)}</h3>
        <p class="excerpt">${escapeHtml(post.excerpt)}</p>
      </div>
    </a>`;
}
