import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/* Add a new case study by adding a Markdown file to src/content/case-studies/.
   Set pdfUrl to attach a real PDF, e.g. "/assets/case-studies/hermes.pdf" */
const caseStudies = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/case-studies' }),
  schema: z.object({
    order: z.number(),
    img: z.string(),
    cat: z.string(),
    time: z.string(),
    title: z.string(),
    excerpt: z.string(),
    tags: z.array(z.string()),
    pdfUrl: z.string().optional(),
  }),
});

/* Add a new post by adding a Markdown file to src/content/journal/. Point `url` to
   the real LinkedIn post permalink once it's live. */
const journal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/journal' }),
  schema: z.object({
    order: z.number(),
    title: z.string(),
    excerpt: z.string(),
    url: z.url(),
  }),
});

/* Add a certificate by adding a Markdown file to src/content/certifications/.
   Only real, earned certifications should go here. */
const certifications = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/certifications' }),
  schema: z.object({
    order: z.number(),
    img: z.string(),
    issuer: z.string(),
    date: z.string(),
    title: z.string(),
    credentialId: z.string(),
    url: z.url(),
  }),
});

export const collections = { caseStudies, journal, certifications };
