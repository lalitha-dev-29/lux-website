# Kasturi Lalitha Manogna — Portfolio

Personal luxury-marketing portfolio site: case studies, journal, learning, and an interactive world atlas.

Built with [Astro](https://astro.build) — static output, near-zero client JS, content managed as Markdown.

## Project structure

```
src/
  components/     Reusable UI: Nav, Footer, cards, the atlas map, the connect form
    admin/        Admin-only form fragments (Journal editor fields)
  content/        Markdown content collections
    case-studies/ One .md file per case study (frontmatter: title, tags, excerpt, pdfUrl, ...)
    journal/      Original Journal posts — historical seed data, see "Journal CMS" below
    certifications/  One .md file per certification (empty until you add real ones)
  content.config.ts  Schema for the collections above
  data/atlas.ts   Country descriptions + marker coordinates for the Atlas page
  layouts/        Layout.astro (public shell), AdminLayout.astro (Admin Panel shell)
  lib/            supabaseAdmin.ts (auth + CRUD), journalClient.ts (public reads),
                  journalPublic.ts (card rendering), journalForm.ts, journalTypes.ts
  pages/          Routes — one file/folder per URL, including admin/ (see below)
  scripts/site.ts Nav scroll state, mobile menu, scroll-reveal animation
  styles/global.css  Design tokens + all public-site component styles
  styles/admin.css   Admin Panel-only layout (dashboard, table, editor, login)
supabase/schema.sql  Journal CMS database schema, RLS policies, and seed data
legacy/index.html  The original single-file HTML/CSS/JS version, kept for reference
```

## Adding content

- **Case study**: add a new `.md` file to `src/content/case-studies/`, following the frontmatter shape of an existing one. It automatically appears in the grid and gets its own page at `/case-studies/<filename>/`.
- **Journal post**: use the [Admin Panel](#journal-cms--admin-panel) — see below. The `.md` files in `src/content/journal/` are historical seed data only (see that section for why).
- **Certification**: add a `.md` file to `src/content/certifications/` once you have a real one to list.

## Journal CMS + Admin Panel

The Journal is the one part of this site that isn't static Markdown: an admin can create, edit, draft, publish, unpublish and delete posts from a browser-based Admin Panel, and visitors see the change immediately — no commit, no rebuild, no redeploy.

### Why not just Markdown + Git?

GitHub Pages serves static files only — it can't run a server, so it can't authenticate an admin or accept writes at all. Making "publish a post" require editing a `.md` file and pushing to `main` would mean giving CMS access = giving `git push` access, and would mean a 1–2 minute CI build stands between "I hit publish" and "the visitor sees it." Neither is what a CMS is for.

### Architecture

```
Admin browser ──sign in──► Supabase Auth (hosted)
Admin browser ──CRUD─────► Supabase Postgres, via its auto-generated REST API
                            (every request re-checked by Row Level Security)
Visitor browser ──read───► same REST API, anon key, RLS restricts to
                            status = 'published' only
```

**[Supabase](https://supabase.com)** (managed Postgres + Auth + an auto-generated REST API) is the entire backend. There is no custom server anywhere in this repo — the Admin Panel (`/admin/*`) is static HTML, exactly like every other page, shipped by the same GitHub Pages deploy. It's a client-rendered mini-app that talks straight to Supabase over HTTPS; Supabase's own infrastructure is what's actually running 24/7, not anything this repo deploys or operates.

- **Authentication** — [Supabase Auth](https://supabase.com/docs/guides/auth) (email + password). No password ever touches this codebase; `@supabase/supabase-js` handles the login request and holds the resulting session. That SDK is only imported by `/admin/*` pages, so it never ships to a normal visitor's bundle.
- **Authorization (RBAC)** — enforced in Postgres, not in JavaScript. `supabase/schema.sql` creates an `admin_users` table and Row Level Security policies that require `auth.uid()` to appear in it for any insert/update/delete on `journal_posts`, and restrict `select` to `status = 'published'` for everyone else. A tampered/forged client request still hits these policies — the database itself is the enforcement point. `src/lib/supabaseAdmin.ts`'s `requireAdminOrRedirect()` (used by `AdminLayout.astro` on every admin page) is a **UX convenience only** — it just redirects a non-admin browser to the login page faster than waiting for an RLS rejection.
- **Storage** — one table, `journal_posts` (see `supabase/schema.sql` for the full schema: `title`, `slug`, `excerpt`, `content`, `external_url`, `category`, `tags`, `cover_image`, `status`, `published_at`, `created_at`, `updated_at`).
- **Public Journal read** — `src/lib/journalClient.ts` makes a plain `fetch()` against Supabase's REST endpoint with the public anon key — deliberately **not** using `@supabase/supabase-js` here, so the public bundle stays close to its original near-zero-JS footprint. Used by `/journal/` (the listing), `/` (the homepage's 2-post preview), and `/journal/post/?slug=…` (an individual post's page, only reachable for posts that have on-site `content`).
- **Content is plain text, not Markdown/HTML** — the editor's "Main Content" field is escaped and split into paragraphs by `renderJournalContent()` in `src/lib/journalTypes.ts`. Nothing typed into it can ever produce an HTML tag or attribute, so there's no sanitizer to get wrong and no XSS surface, at the cost of not supporting rich formatting. Given the original Journal entries were link-preview cards with no body copy at all, this matches the actual complexity of the content rather than adding a rich-text editor no one needs yet.

### Setting up your own Supabase project

1. Create a free project at [supabase.com](https://supabase.com).
2. **Dashboard → SQL Editor → New query** — paste in the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and run it. This creates the tables, RLS policies, and seeds the 5 original Journal posts as published rows.
3. **Dashboard → Authentication → Users → Add user** — create your admin login (email + password, check "Auto Confirm User"). Copy the new user's UID.
4. Back in the SQL Editor, run: `insert into public.admin_users (user_id) values ('<uid-from-step-3>');` — this one row is what makes that account an admin. Everyone else who might ever sign up is a plain USER by default.
5. **Dashboard → Project Settings → API** — copy the **Project URL** and **anon public key**.
6. Local dev: copy `.env.example` to `.env` and fill in `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY`. Deployed site: add the same two as **repo secrets** (Settings → Secrets and variables → Actions) — the deploy workflow already reads them.
7. Visit `/admin/login/` and sign in.

### Using the Admin Panel

- `/admin/` — dashboard: post counts, recently updated.
- `/admin/journal/` — list, search, filter by status, publish/unpublish/delete.
- `/admin/journal/new/` — create a post; Save Draft or Publish.
- `/admin/journal/edit/?id=<uuid>` — edit, save, toggle publish state, or delete. (A static site can't pre-generate a page per database row with an unknown-at-build-time ID, so edit/new use a query string rather than a path segment like `/admin/journal/<id>/edit` — everything else about them behaves the same.)

A post needs either **Main Content**, an **External LinkedIn URL**, or both — this is enforced both in the editor and by a database constraint, so it can't be bypassed from a raw API call either. If only an external URL is set, the public card behaves exactly like the original design ("View on LinkedIn", opens in a new tab). If content is set (with or without a LinkedIn URL), the card instead links to an on-site article at `/journal/post/?slug=…`.

The Admin Panel intentionally looks different from the public site — same colour/type tokens (`src/styles/admin.css` reuses `global.css`'s custom properties), but no mandala motifs, no Atlas, no scroll-reveal. It's a workspace, not part of the editorial experience; see `src/layouts/AdminLayout.astro`.

### Existing Markdown content

The original 5 posts in `src/content/journal/*.md` are preserved as-is and are what `supabase/schema.sql` seeds into the database. `content.config.ts`'s `journal` collection is kept for that historical/reference purpose only — as of this feature, no page reads from it anymore (`journal.astro`, `index.astro`, and the new `/journal/post/` page all fetch from Supabase instead). This is a deliberate single-source-of-truth choice: once migrated, the database is authoritative, and the `.md` files are frozen seed data, not a live alternate feed.

### Environment variables

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `PUBLIC_SUPABASE_URL` | Public (ships to browser) | Supabase project's REST endpoint. |
| `PUBLIC_SUPABASE_ANON_KEY` | Public (ships to browser) | Supabase's anonymous API key. Safe to expose by design — it authorizes nothing on its own; Row Level Security is what actually gates every read/write. |

There is no server-only secret anywhere in this feature — the `PUBLIC_` prefix is correct here, not a mistake, because both values are meant to be public (same reasoning as the existing `PUBLIC_EMAILJS_*` keys above). The one credential that must never end up in this repo is the admin's Supabase Auth **password** — that only ever lives in Supabase's own systems and the admin's memory.

### Security review

- **Unauthenticated access to `/admin/*`**: the pages load (they're static HTML — GitHub Pages can't gate a route), but render nothing but a "Checking access…" state before client JS redirects to `/admin/login/`; every data call underneath still requires a valid admin session token, enforced by RLS.
- **Client-side role tampering**: `isCurrentUserAdmin()` and `requireAdminOrRedirect()` are UX only. Deleting them, patching them to always return `true`, or calling `supabaseAdmin.ts`'s functions directly from the console does not grant write access — Postgres re-evaluates `is_admin()` against the real, server-verified `auth.uid()` on every request.
- **Draft leakage**: the public read policy (`status = 'published'`) is enforced in Postgres itself, not filtered client-side — there's no query shape that returns a draft to an anonymous request.
- **Object access**: every `journal_posts` row is gated by the same admin-only policy; there's no per-row ownership model to bypass (single admin role, by design — see RBAC section above for how this extends to more roles later).
- **Content injection**: plain-text content is HTML-escaped before insertion into the DOM (see "Content is plain text" above) — there is no code path that interprets admin-authored text as markup.
- **Secrets**: confirmed no non-`PUBLIC_` Supabase credential exists in this repo, `.env.example`, or the deploy workflow. The Supabase **service role key** (which bypasses RLS) is never used anywhere in this codebase — intentionally, since nothing here needs it.

## The Atlas map

The `/atlas/` page is a custom-drawn interactive world map, not a mapping library — three files work together:

- **`src/data/world-map-paths.svg`** — raw country geometry. One `<path class="country" data-name="…">` per country, generated once from a standard world-map SVG. This file is imported as raw text (`?raw`) and injected straight into the page's `<svg>`.
- **`src/data/atlas.ts`** — the content layer. `countries` holds the heading/description/brand list shown in the slide-over panel for each researched country; `centroids` holds the `{x, y}` point (in the SVG's own coordinate space) where that country's pulsing marker sits. A country can appear in the map without an entry here — it just renders in the unhighlighted base grey and shows a "coming soon" panel if clicked.
- **`src/components/AtlasMap.astro`** — wires the two together: colours any country with a `countries` entry, renders the markers from `centroids`, and handles hover tooltips, click/keyboard selection, the mobile-friendly chip picker (the map's own hit areas are too small to tap reliably), and the slide-over panel.

**To add a country**, add an entry to `countries` in `atlas.ts` keyed by its exact `data-name` in the SVG, and a matching `{x, y}` in `centroids` so its marker lands in the right place — see the doc comment directly above `centroids` in that file.

One thing worth knowing if you ever touch the SVG: some countries include far-flung territories as extra sub-paths under the *same* `data-name` (e.g. France's path originally also included French Guiana, over near South America) — colouring or centring on the wrong sub-path will look like the marker landed in the wrong country entirely. If a marker or highlight ever looks misplaced, check whether the path for that country is actually more than one disconnected shape.

## Theming (light / dark mode)

All colour is expressed as CSS custom properties in `src/styles/global.css`, defined three times:

1. `:root` — the light-mode values (the default).
2. `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` — dark values, applied automatically when the OS is in dark mode and the visitor hasn't made an explicit choice.
3. `:root[data-theme="dark"]` / `:root[data-theme="light"]` — the same dark values (and light values) again, applied when the visitor *has* made an explicit choice via the nav toggle, which always wins over the OS setting in either direction.

The toggle button (`Nav.astro` / `site.ts`) writes that choice to `localStorage` under the key `lmk-theme` and sets `data-theme` on `<html>`. A small blocking inline script in `Layout.astro`'s `<head>` reads that key and applies it *before* the page paints, so there's no flash of the wrong theme on load. Toggling live gets a brief `.theme-transition` class on `<html>` so every surface cross-fades together instead of hard-cutting (skipped entirely under `prefers-reduced-motion`).

Note the tokens aren't a simple palette inversion — several (`--motif-*`, see below) are deliberately re-tuned per theme rather than reused at the same opacity, because the same alpha value reads very differently on a near-white surface than a near-black one.

## Background motifs

The fixed decorative background (`src/components/SiteMotifs.astro`, styled in the `SITE MOTIFS` section of `global.css`) is a layered system, not one flat image:

- **Atmosphere** — soft gold gradient blooms anchored top-left/bottom-right.
- **Corner medallions** — the concentric mandala/rangoli rings in the top-left and bottom-right corners, turning slowly in opposite directions. Two-tone on purpose: neutral ink rings for structure, gold spokes/dots as accent, with a soft glow layered on in dark mode.
- **Bloom** — the abstract radial burst low on the page, standing in for a literal building/temple icon.
- **Particles** — small drifting points, positioned and timed via inline CSS custom properties per instance (`--x`, `--y`, `--dur`, `--delay`) so one CSS rule covers all of them.

Every layer is `transform`/`opacity`/`filter` only (GPU-composited, never triggers layout) and sits behind the page at `z-index:-1` with `pointer-events:none`. A handful of layers carry `data-parallax` and drift gently on scroll — `site.ts` writes the current scroll position to a `--motif-scroll` custom property (throttled to one write per animation frame), and each layer reads it back through its own `--parallax-speed`.

All of this is gated behind the `.js-anim` class, which the head script only adds when JS is running *and* the visitor hasn't set `prefers-reduced-motion: reduce` — so a reduced-motion visitor never gets the scroll listener attached, and a separate `@media (prefers-reduced-motion: reduce)` block freezes the corner-spin/breathe/particle animations outright as a second line of defence.

## Versioning

The footer shows the site version (`© … · v0.0.1`), read directly from the `version` field in `package.json` (`Footer.astro`) — there's no second place that number needs to be kept in sync. Bump it in `package.json` when you want the footer to reflect a new version.

## Commands

| Command           | Action                                      |
| ------------------ | -------------------------------------------- |
| `npm install`       | Install dependencies                         |
| `npm run dev`       | Start the local dev server                   |
| `npm run build`     | Build the static site to `./dist/`           |
| `npm run preview`   | Preview the production build locally         |

## Deploying to GitHub Pages

A workflow at `.github/workflows/deploy.yml` builds and deploys on every push to `main`. In the repo's **Settings → Pages**, set the source to **GitHub Actions**.

The workflow derives the site's base path from the repo name automatically. If this repo is a `<username>.github.io` user/org site (served from the domain root), edit the workflow and drop the `BASE_PATH` override.

## Contact form email (EmailJS)

The `/connect/` form sends submissions via [EmailJS](https://www.emailjs.com) directly from the browser — no backend required. Without the env vars below set, it silently falls back to CV-gate-only behavior (unlocks the CV download, sends nothing).

To enable it:

1. Sign up at emailjs.com, add an **Email Service** (e.g. connect your Gmail), and create an **Email Template** with variables `{{name}}`, `{{mobile}}`, `{{email}}`, `{{reason}}`, `{{message}}`.
2. Copy your Service ID, Template ID, and Public Key from the dashboard.
3. For local dev: copy `.env.example` to `.env` and fill them in.
4. For the deployed site: add them as **repo secrets** (Settings → Secrets and variables → Actions) named `PUBLIC_EMAILJS_SERVICE_ID`, `PUBLIC_EMAILJS_TEMPLATE_ID`, `PUBLIC_EMAILJS_PUBLIC_KEY` — the deploy workflow already reads them.

### Form behavior

- **CV unlock is reason-dependent.** Only "Job Opportunity" and "Collaboration /
  Research" unlock the CV download after submitting — the button reads "Submit &
  Unlock CV" for those, and just "Submit" for everything else. This lives in
  `CV_UNLOCK_REASONS` in `ConnectForm.astro`; add/remove reasons there.
- **The message field is reason-dependent too.** Its label and placeholder change
  per reason (`MESSAGE_PROMPTS` in the same file) and it's hidden until a reason is
  picked. It's sent to EmailJS as `{{message}}`.
- **Mobile number** uses [intl-tel-input](https://intl-tel-input.com) for country-code
  selection, as-you-type formatting, and validation — sent to EmailJS as a full
  E.164 number (e.g. `+6591234567`), regardless of how it displays in the field.

### Abuse protection

The form blocks more than one submission per email address per 24 hours, tracked in
the visitor's `localStorage`. **This is a UX nicety, not real security** — it lives
entirely in the visitor's own browser, so a private window, a different browser, or
clearing site data resets it instantly. It stops accidental double-submits and
casual repeat use through the form; it does not stop someone determined to abuse it.

That's an inherent limit of any backend-less contact form: the EmailJS Service ID,
Template ID, and Public Key all have to ship in the site's JS to work at all, so
anyone can read them from the deployed bundle and call EmailJS's API directly,
bypassing the site (and this rate limit) entirely. The actual defenses against that
live on EmailJS's side, not in this codebase:

1. **Domain allowlist** — EmailJS dashboard → Account → Security → "Allowed domains
   for API calls". This is the strongest option (rejects any request whose origin
   doesn't match, server-side) but is gated behind a paid EmailJS plan.
2. **reCAPTCHA v2 on the template (what this site uses)** — free, and also enforced
   server-side by EmailJS, so it protects against direct API calls too, not just
   submissions through the site's UI:
   - Register a site at [google.com/recaptcha/admin/create](https://www.google.com/recaptcha/admin/create)
     (type: reCAPTCHA v2, "I'm not a robot" Checkbox) with this domain added.
   - Paste the **Secret Key** into EmailJS: Email Templates → your template →
     Settings → enable **"reCAPTCHA V2 verification"**.
   - Set the **Site Key** (safe to be public) as `PUBLIC_RECAPTCHA_SITE_KEY` — copy
     `.env.example` to `.env` for local dev, and add it as a repo secret
     (Settings → Secrets and variables → Actions) for the deployed site.
   - Left unset, the form has no captcha requirement (submissions go straight to
     EmailJS, protected only by the client-side rate limit above).
3. Keep an eye on usage at dashboard.emailjs.com/admin — the free tier caps at a
   monthly send count; EmailJS emails you as you approach it.
