# Kasturi Lalitha Manogna — Portfolio

Personal luxury-marketing portfolio site: case studies, journal, learning, and an interactive world atlas.

Built with [Astro](https://astro.build) — static output, near-zero client JS, content managed as Markdown.

## Project structure

```
src/
  components/     Reusable UI: Nav, Footer, cards, the atlas map, the connect form
    ContentCard.astro       Generic listing card (Journal + Case Studies wrap this)
    ContentMetadata.astro   Category / author / date / reading-time line
    ExternalLinks.astro     Renders a ContentLink[] as labeled buttons
    RelatedContent.astro    Tag/category-overlap "You Might Also Like" section
    PDFViewer.astro         Case Study PDF reader (pairs with scripts/pdfViewer.ts)
    admin/        Admin-only form fragments (Journal + Case Study editor fields,
                  the shared LinksEditor, and the Toast notification)
  content/        Markdown content collections — FROZEN ARCHIVE, see "Adding content" below
    case-studies/ Original case study files, migrated into Supabase — kept for reference
    journal/      Original Journal posts, migrated into Supabase — kept for reference
    certifications/  One .md file per certification (empty until you add real ones;
                  this collection is still live/read directly, unlike the other two)
  content.config.ts  Schema for the collections above
  data/atlas.ts   Country descriptions + marker coordinates for the Atlas page
  layouts/        Layout.astro (public shell — title/description/OG/canonical props),
                  AdminLayout.astro (Admin Panel shell)
  lib/            supabaseAdmin.ts (auth + Journal/Case Study CRUD + Storage uploads),
                  buildTimeData.ts (build-time Supabase reads for getStaticPaths),
                  journalForm.ts / caseStudyForm.ts (admin form read/write/validate),
                  journalTypes.ts / caseStudyTypes.ts / contentLinks.ts (shared types),
                  markdown.ts (Markdown → HTML), readingTime.ts, relatedContent.ts,
                  imageUpload.ts / linksForm.ts / toast.ts (admin form widgets)
  pages/          Routes — one file/folder per URL, including admin/ (see below)
  scripts/        site.ts (nav/scroll/reveal), pdfViewer.ts (pdf.js wiring, lazy-loaded)
  styles/global.css  Design tokens + all public-site component styles
  styles/admin.css   Admin Panel-only layout (dashboard, table, editor, login)
supabase/schema.sql            Original Journal CMS schema, RLS policies, seed data
supabase/case_study_cms.sql    Case Study table + Journal extensions + Storage buckets
                                (run this AFTER schema.sql — see "Setting up" below)
.github/workflows/deploy.yml            Deploys on every push to main
.github/workflows/scheduled-rebuild.yml Rebuilds every 4h so Admin-panel edits go live
                                          without a manual push (see "Scheduled rebuild")
legacy/index.html  The original single-file HTML/CSS/JS version, kept for reference
```

## Adding content

Journal posts and Case Studies are both managed entirely through the [Admin Panel](#journal--case-study-cms--admin-panel) — there is no Markdown file to hand-edit for either anymore, and adding one never requires a code change or a new page component (see that section for the architecture). Only Certifications remain plain Markdown:

- **Journal post**: `/admin/journal/new/`. Full article (title, excerpt, Markdown body with inline images, author, category, tags, cover image, external links, SEO fields, featured/draft/published), rendered at `/journal/<slug>/`.
- **Case study**: `/admin/case-studies/new/`. Same shape as a Journal post, plus PDF upload/replace/remove, rendered at `/case-studies/<slug>/`.
- **Certification**: add a `.md` file to `src/content/certifications/` once you have a real one to list.

## Journal + Case Study CMS + Admin Panel

Journal posts and Case Studies are both database-backed: an admin creates, edits, drafts, publishes, unpublishes and deletes either from a browser-based Admin Panel with two clearly separated sections (`/admin/journal/` and `/admin/case-studies/`), sharing one design language, one auth/RBAC model, and one Supabase project.

### Why not just Markdown + Git?

GitHub Pages serves static files only — it can't run a server, so it can't authenticate an admin or accept writes at all. Making "publish a post" require editing a `.md` file and pushing to `main` would mean giving CMS access = giving `git push` access, and would mean a 1–2 minute CI build stands between "I hit publish" and "the visitor sees it." Neither is what a CMS is for.

### Architecture

```
Admin browser ──sign in──► Supabase Auth (hosted)
Admin browser ──CRUD─────► Supabase Postgres + Storage, via the auto-generated REST API
                            (every request re-checked by Row Level Security)
astro build   ──read─────► same REST API, anon key, at BUILD TIME — generates one
                            real page per published Journal post / Case Study
                            (src/lib/buildTimeData.ts, called from getStaticPaths())
GitHub Actions ──cron────► reruns astro build + deploy every 4h, so an Admin-panel
                            edit goes live without a manual push (scheduled-rebuild.yml)
```

**[Supabase](https://supabase.com)** (managed Postgres + Auth + Storage + an auto-generated REST API) is the entire backend. There is no custom server anywhere in this repo — the Admin Panel (`/admin/*`) is static HTML, exactly like every other page, shipped by the same GitHub Pages deploy. It's a client-rendered mini-app that talks straight to Supabase over HTTPS; Supabase's own infrastructure is what's actually running 24/7, not anything this repo deploys or operates.

Journal and Case Study **pages are generated at build time**, not fetched client-side — `getStaticPaths()` in `src/pages/journal/[slug].astro` and `src/pages/case-studies/[slug].astro` reads published rows from Supabase during `astro build` (same REST API, same anon key, just invoked in Node instead of the browser — see `src/lib/buildTimeData.ts`). This gives every entry a real, pre-rendered, individually shareable page with proper `<title>`/description/canonical/Open-Graph tags, the same as if it were a hand-written Markdown page. The tradeoff of static generation is that a new/edited entry isn't live until the next build — `scheduled-rebuild.yml` closes that gap by rebuilding automatically every 4 hours (`workflow_dispatch` is also enabled, so you can trigger one immediately from the Actions tab instead of waiting).

- **Authentication** — [Supabase Auth](https://supabase.com/docs/guides/auth) (email + password). No password ever touches this codebase; `@supabase/supabase-js` handles the login request and holds the resulting session. That SDK is only imported by `/admin/*` pages, so it never ships to a normal visitor's bundle.
- **Authorization (RBAC)** — enforced in Postgres, not in JavaScript. `supabase/schema.sql` and `supabase/case_study_cms.sql` create an `admin_users` table and Row Level Security policies that require `auth.uid()` to appear in it for any insert/update/delete on `journal_posts` or `case_studies` (and any Storage upload/delete), and restrict `select` to `status = 'published'` for everyone else. A tampered/forged client request still hits these policies — the database itself is the enforcement point. `src/lib/supabaseAdmin.ts`'s `requireAdminOrRedirect()` (used by `AdminLayout.astro` on every admin page) is a **UX convenience only** — it just redirects a non-admin browser to the login page faster than waiting for an RLS rejection.
- **Storage (data)** — two tables: `journal_posts` and `case_studies` (see `supabase/schema.sql` and `supabase/case_study_cms.sql`). Both carry the full editorial field set: title, slug, excerpt, Markdown `content`, author, category, tags, cover_image, featured, status, seo_title/seo_description/og_image, and a `links` jsonb array of `{platform, url, label?}` for the generic external-link list (LinkedIn/Medium/Substack/GitHub/website/research paper/other — only shown when present). `case_studies` additionally carries `order_index`, `pdf_url`, `pdf_filename`, `pdf_page_count`.
- **Storage (files)** — two public Storage buckets, admin-write/public-read: `content-images` (Journal inline/cover images, Case Study cover/OG images, prefixed `journal/<id>/…` or `case-studies/<id>/…`) and `case-study-pdfs`. Uploaded from the Admin Panel via `src/lib/supabaseAdmin.ts`'s `uploadContentImage()` / `uploadCaseStudyPdf()`.
- **Markdown authoring** — the editor's Article Content field is Markdown (`src/lib/markdown.ts`, using [`marked`](https://marked.js.org)), rendered to HTML at build time only (zero client-side Markdown parsing on the public site). An "Insert Image" button uploads a file and inserts `![alt](url "caption")` at the cursor — that's the whole inline-image/caption/alt-text story, no rich-text editor dependency. Link and image URLs are still passed through `safeUrl()`/`safeUrlScheme()` (`src/lib/html.ts`) as defence in depth against a `javascript:`-scheme URL, even though only admins can author this content.
- **Reading time** is computed automatically from word count (`src/lib/readingTime.ts`, ~200wpm) at save time — not admin-entered.
- **Related content** (`src/lib/relatedContent.ts`) is computed from tag/category overlap between whatever's currently published — no manually curated relationships to keep in sync as content grows.

### Setting up your own Supabase project

1. Create a free project at [supabase.com](https://supabase.com).
2. **Dashboard → SQL Editor → New query** — paste in the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and run it, **then** do the same with [`supabase/case_study_cms.sql`](supabase/case_study_cms.sql) (order matters — the second file depends on functions the first one creates). Together these create every table, RLS policy, and Storage bucket, and seed the 5 original Journal posts and 5 original Case Studies as published rows.
3. **Dashboard → Authentication → Users → Add user** — create your admin login (email + password, check "Auto Confirm User"). Copy the new user's UID.
4. Back in the SQL Editor, run: `insert into public.admin_users (user_id) values ('<uid-from-step-3>');` — this one row is what makes that account an admin. Everyone else who might ever sign up is a plain USER by default.
5. **Dashboard → Project Settings → API** — copy the **Project URL** and **anon public key**.
6. Local dev: copy `.env.example` to `.env` and fill in `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY`. Deployed site: add the same two as **repo secrets** (Settings → Secrets and variables → Actions) — both `deploy.yml` and `scheduled-rebuild.yml` already read them.
7. Visit `/admin/login/` and sign in.

### Using the Admin Panel

- `/admin/` — dashboard: Journal + Case Study counts, recently updated across both.
- `/admin/journal/` and `/admin/case-studies/` — list, search, filter by status, publish/unpublish/delete, with featured/PDF-attached indicators.
- `.../new/` — create; Save Draft or Publish.
- `.../edit/?id=<uuid>` — edit, save, toggle publish state, or delete. (A static site can't pre-generate a page per database row with an unknown-at-build-time ID, so edit/new use a query string rather than a path segment like `/admin/journal/<id>/edit` — everything else about them behaves the same.)

Title, Excerpt and Article Content are required on both forms (Case Studies also require a Category). Everything else — cover image, author, tags, featured, external links, SEO fields, OG image — is optional. A Case Study's PDF is managed separately, in its own section on the edit page, since a PDF needs a saved case study to attach to; upload, replace and remove all update the same `pdf_url`/`pdf_filename` fields and clean up the previous Storage object on replace/remove.

The Admin Panel intentionally looks different from the public site — same colour/type tokens (`src/styles/admin.css` reuses `global.css`'s custom properties), but no mandala motifs, no Atlas, no scroll-reveal. It's a workspace, not part of the editorial experience; see `src/layouts/AdminLayout.astro`.

### Existing Markdown content

The original 5 Journal posts (`src/content/journal/*.md`) and 5 Case Studies (`src/content/case-studies/*.md`) are preserved as-is — untouched, still in the repo — and are exactly what `supabase/schema.sql` and `supabase/case_study_cms.sql` seed into the database, field-for-field. `content.config.ts`'s `journal` and `caseStudies` collections are kept for that historical/reference purpose only — no page reads from either collection anymore; every public and admin page fetches from Supabase instead. This is a deliberate single-source-of-truth choice: once migrated, the database is authoritative, and the `.md` files are frozen seed data, not a live alternate feed.

### PDF viewer

A Case Study's PDF renders inline via [pdf.js](https://mozilla.github.io/pdf.js/) (`src/components/PDFViewer.astro` + `src/scripts/pdfViewer.ts`) — page navigation, zoom, fit-width/fit-page, fullscreen (native Fullscreen API with a visible exit button, since not every mobile browser supports it), download, and open-in-new-tab. Nothing pdf.js-related loads until a visitor clicks "Load PDF Preview" on a case study that actually has one — the library and the PDF binary are both loaded lazily, so pages without a PDF (which is most of the site) ship none of that code. If inline rendering fails for any reason, the viewer falls back to a visible "open in a new tab" link rather than a broken embed; a Case Study with no PDF renders the same empty-state message as before this feature.

### Environment variables

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `PUBLIC_SUPABASE_URL` | Public (ships to browser) | Supabase project's REST endpoint. |
| `PUBLIC_SUPABASE_ANON_KEY` | Public (ships to browser) | Supabase's anonymous API key. Safe to expose by design — it authorizes nothing on its own; Row Level Security is what actually gates every read/write. |

There is no server-only secret anywhere in this feature — the `PUBLIC_` prefix is correct here, not a mistake, because both values are meant to be public (same reasoning as the existing `PUBLIC_EMAILJS_*` keys above). The one credential that must never end up in this repo is the admin's Supabase Auth **password** — that only ever lives in Supabase's own systems and the admin's memory. No new environment variables were introduced for Case Studies or the expanded Journal fields — these same two values now also drive the build-time Journal/Case Study fetch (`src/lib/buildTimeData.ts`), not just the browser.

### Security review

- **Unauthenticated access to `/admin/*`**: the pages load (they're static HTML — GitHub Pages can't gate a route), but render nothing but a "Checking access…" state before client JS redirects to `/admin/login/`; every data call underneath still requires a valid admin session token, enforced by RLS.
- **Client-side role tampering**: `isCurrentUserAdmin()` and `requireAdminOrRedirect()` are UX only. Deleting them, patching them to always return `true`, or calling `supabaseAdmin.ts`'s functions directly from the console does not grant write access — Postgres re-evaluates `is_admin()` against the real, server-verified `auth.uid()` on every request.
- **Draft leakage**: the public read policy (`status = 'published'`) is enforced in Postgres itself, not filtered client-side — there's no query shape that returns a draft to an anonymous request. The build-time fetch (`src/lib/buildTimeData.ts`) uses the same anon key and the same `status=eq.published` filter, so a draft never gets a page generated for it either.
- **Object access**: every `journal_posts`/`case_studies` row and every Storage object is gated by the same admin-only policy; there's no per-row ownership model to bypass (single admin role, by design — see RBAC section above for how this extends to more roles later).
- **Content injection**: the Article Content field is Markdown, rendered to HTML at build time via `src/lib/markdown.ts` — raw HTML in the source is left un-rendered (standard `marked` behavior), and every link/image URL it produces still passes through `safeUrl()`/`safeUrlScheme()` (`src/lib/html.ts`), which refuse `javascript:`/`data:` schemes. Everywhere else that builds markup as a string (admin tables, list rows) still uses the original `escapeHtml`/`safeUrl` pair. This is defence in depth, not a fix for untrusted input — only admins can author this content — but the same guardrails apply if a second role is ever added.
- **File uploads**: `case-study-pdfs` accepts uploads client-side gated only by a `file.type === 'application/pdf'` check (`uploadCaseStudyPdf()` in `src/lib/supabaseAdmin.ts`) — real enforcement is Storage RLS requiring `is_admin()` on every insert, so this check is a UX nicety (a fast, friendly error) rather than the security boundary, same pattern as the RBAC UX checks above.
- **Recommended hardening — turn off public sign-up.** Supabase projects allow email sign-up by default. RBAC still holds if a stranger signs up (they land in the `authenticated` role, and every admin policy requires `is_admin()`, so they get exactly the same access as an anonymous visitor — no drafts, no writes). But there is no reason for anyone but the site owner to have an account here, and leaving it open lets strangers consume the project's auth and email quota. Turn it off at **Dashboard → Authentication → Sign In / Providers → Email → disable "Allow new users to sign up"**.
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

### Scheduled rebuild

`.github/workflows/scheduled-rebuild.yml` reruns the same build + deploy on three triggers (see the comment at the top of that file): an automatic `repository_dispatch` fired by Supabase the instant content changes (set up below), a `schedule` safety-net cron every 4 hours in case a dispatch is ever missed, and a manual `workflow_dispatch` you can fire from the Actions tab. It exists because Journal and Case Study pages are generated at build time from Supabase (see the CMS section above) — editing content in the Admin Panel doesn't push a commit, so without this, a new or edited entry wouldn't go live until someone happened to push code. It shares `deploy.yml`'s `concurrency: group: pages`, so a push-triggered deploy and a rebuild can never race and clobber each other's Pages deployment. It needs the same `PUBLIC_SUPABASE_URL`/`PUBLIC_SUPABASE_ANON_KEY` repo secrets as `deploy.yml` — without them the build fails immediately with a clear error (see `src/lib/buildTimeData.ts`) rather than silently shipping a site with no Journal or Case Study pages.

#### Automatic rebuild on save

This is what makes an Admin Panel edit go live in ~30–60 seconds with zero manual steps, instead of waiting for the 4-hour safety-net cron. It's a one-time setup with two parts:

**1. Create a GitHub token** — Settings → [Developer settings → Personal access tokens → Fine-grained tokens](https://github.com/settings/personal-access-tokens/new):
   - Repository access: **Only select repositories** → this repo.
   - Permissions → Repository permissions → **Contents: Read and write**, **Actions: Read and write**. Nothing else.
   - Generate it and copy the token — GitHub only shows it once.

**2. Add a Supabase Database Webhook for each table** — Supabase Dashboard → Database → Webhooks → Create a new webhook. Create this twice, once with **Table: `journal_posts`** and once with **Table: `case_studies`** (a webhook watches one table):
   - Events: check Insert, Update, and Delete.
   - Type: HTTP Request → Method **POST**.
   - URL: `https://api.github.com/repos/<owner>/<repo>/dispatches` (use this repo's actual owner/name).
   - HTTP Headers:
     - `Authorization: Bearer <the token from step 1>`
     - `Accept: application/vnd.github+json`
     - `Content-Type: application/json`
   - HTTP Body / Payload: `{"event_type": "content-updated"}`

That's it — any insert, update, or delete on either table now pings GitHub's `dispatches` API, which `repository_dispatch: types: [content-updated]` in `scheduled-rebuild.yml` picks up and turns into a rebuild + deploy. The token only has write access to this one repo's contents and Actions runs, nothing account-wide; if you ever need to revoke it, delete it from GitHub's token settings and the webhooks will just start failing loudly (visible in Supabase's webhook logs) rather than silently doing nothing.

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
