# Lalitha Manogna Kasturi — Portfolio

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

1. Sign up at emailjs.com, add an **Email Service** (e.g. connect your Gmail), and create an **Email Template** with variables `{{name}}`, `{{mobile}}`, `{{email}}`, `{{reason}}`.
2. Copy your Service ID, Template ID, and Public Key from the dashboard.
3. For local dev: copy `.env.example` to `.env` and fill them in.
4. For the deployed site: add them as **repo secrets** (Settings → Secrets and variables → Actions) named `PUBLIC_EMAILJS_SERVICE_ID`, `PUBLIC_EMAILJS_TEMPLATE_ID`, `PUBLIC_EMAILJS_PUBLIC_KEY` — the deploy workflow already reads them.

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

1. **Domain allowlist (do this)** — EmailJS dashboard → Account → Security → "Allowed
   domains for API calls". Add `lalitha-dev-29.github.io`. EmailJS then rejects any
   request whose origin doesn't match, server-side — this is what actually stops a
   script hitting the API directly and draining the free-tier quota.
2. **CAPTCHA on the template (optional, extra bot protection)** — in the template
   editor, under Settings, enable reCAPTCHA/hCaptcha.
3. Keep an eye on usage at dashboard.emailjs.com/admin — the free tier caps at a
   monthly send count; EmailJS emails you as you approach it.
