/*
 * /sitemap.xml — every public page, so search engines can find new case
 * studies, projects, lectures and journal posts. Built with the rest of the
 * site, so it updates on every content rebuild.
 */
import type { APIRoute } from 'astro';
import { withBase } from '../lib/url';
import {
  fetchAllGuestLectures,
  fetchAllPublishedCaseStudies,
  fetchAllPublishedJournalPosts,
  fetchAllPublishedProjects,
} from '../lib/buildTimeData';
import { lectureSlugs } from '../lib/guestLectureTypes';

const STATIC_PAGES = ['/', '/case-studies/', '/projects/', '/journal/', '/learning/', '/guest-lectures/', '/atlas/', '/connect/'];

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async ({ site }) => {
  const [caseStudies, projects, posts, lectures] = await Promise.all([
    fetchAllPublishedCaseStudies(),
    fetchAllPublishedProjects(),
    fetchAllPublishedJournalPosts(),
    fetchAllGuestLectures(),
  ]);
  const slugs = lectureSlugs(lectures);

  const entries: { path: string; lastmod?: string }[] = [
    ...STATIC_PAGES.map((path) => ({ path })),
    ...caseStudies.map((c) => ({ path: `/case-studies/${c.slug}/`, lastmod: c.updated_at })),
    ...projects.map((p) => ({ path: `/projects/${p.slug}/`, lastmod: p.updated_at })),
    ...posts.map((p) => ({ path: `/journal/${p.slug}/`, lastmod: p.updated_at })),
    ...lectures.map((l) => ({ path: `/guest-lectures/${slugs.get(l.id)}/`, lastmod: l.updated_at })),
  ];

  const urls = entries
    .map(({ path, lastmod }) => {
      const loc = new URL(withBase(path), site).toString();
      const date = lastmod ? new Date(lastmod) : null;
      const mod = date && !Number.isNaN(date.getTime()) ? `<lastmod>${date.toISOString().slice(0, 10)}</lastmod>` : '';
      return `  <url><loc>${escapeXml(loc)}</loc>${mod}</url>`;
    })
    .join('\n');

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
