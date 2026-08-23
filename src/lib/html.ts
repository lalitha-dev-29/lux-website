/**
 * Shared HTML-safety helpers for the places that build markup as strings
 * (the Journal cards and the admin tables, which render data that doesn't
 * exist at build time and so can't be Astro components).
 *
 * This lives in one module on purpose: there used to be four near-identical
 * copies of `escapeHtml`, two of which omitted the quote escape while being
 * interpolated into attributes — so an ordinary title like
 * `Why "Quiet Luxury" Works` broke out of its own attribute.
 */

/** Escapes text for insertion into element content OR a double-quoted attribute. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escapes a URL for an `href`, refusing schemes that execute code.
 * `javascript:`/`data:`/`vbscript:` hrefs are rejected outright (returns '#')
 * rather than escaped, since escaping alone wouldn't stop them from running.
 *
 * URLs here are admin-authored, so this is defence in depth rather than a
 * fix for untrusted input — but the authorization model is meant to grow
 * more roles (see the README's RBAC section), and a future non-admin editor
 * must not be able to plant a script URL in a link.
 */
export function safeUrl(value: string): string {
  const trimmed = value.trim();
  // Relative and root-relative paths carry no scheme and are always fine.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return escapeHtml(trimmed);
  if (/^(https?|mailto):/i.test(trimmed)) return escapeHtml(trimmed);
  return '#';
}

/**
 * Same scheme validation as safeUrl(), but WITHOUT HTML-entity escaping —
 * for use inside .astro template attribute expressions (`href={...}`),
 * where Astro already HTML-escapes the value itself. Wrapping an
 * already-escaped string in another layer of Astro escaping would corrupt
 * it (e.g. a literal "&" surviving as the text "&amp;" on the page).
 */
export function safeUrlScheme(value: string): string {
  const trimmed = value.trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  if (/^(https?|mailto):/i.test(trimmed)) return trimmed;
  return '#';
}
