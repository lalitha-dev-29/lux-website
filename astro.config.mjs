// @ts-check
import { defineConfig } from 'astro/config';

/*
 * GitHub Pages serves project sites from https://<user>.github.io/<repo>/,
 * so every internal link needs that repo name as a base path. Set BASE_PATH
 * in the deploy workflow (see .github/workflows/deploy.yml) or export it
 * locally before building, e.g. BASE_PATH=/lux-website npm run build.
 * Leave it unset for a <user>.github.io root site or local dev.
 */
const base = process.env.BASE_PATH || '/';
const site = process.env.SITE_URL || 'https://example.github.io';

// https://astro.build/config
export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
});
