# Kasturi Lalitha Manogna — Portfolio

Personal luxury-marketing portfolio site: case studies, journal, learning, and an interactive world atlas.

Built with [Astro](https://astro.build) — static output, near-zero client JS, content managed as Markdown.

## Project structure

```
src/
  components/     Reusable UI: Nav, Footer, cards, the atlas map, the connect form
  content/        Markdown content collections
    case-studies/ One .md file per case study (frontmatter: title, tags, excerpt, pdfUrl, ...)
    journal/      One .md file per LinkedIn post preview
    certifications/  One .md file per certification (empty until you add real ones)
  content.config.ts  Schema for the collections above
  data/atlas.ts   Country descriptions + marker coordinates for the Atlas page
  layouts/        Shared page shell (Layout.astro)
  pages/          Routes — one file/folder per URL
  scripts/site.ts Nav scroll state, mobile menu, scroll-reveal animation
  styles/global.css  Design tokens + all component styles
legacy/index.html  The original single-file HTML/CSS/JS version, kept for reference
```

## Adding content

- **Case study**: add a new `.md` file to `src/content/case-studies/`, following the frontmatter shape of an existing one. It automatically appears in the grid and gets its own page at `/case-studies/<filename>/`.
- **Journal post**: add a `.md` file to `src/content/journal/` with `title`, `excerpt`, and the LinkedIn post `url`.
- **Certification**: add a `.md` file to `src/content/certifications/` once you have a real one to list.

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
