import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import { withBase } from './url';
import type { JournalPost, JournalStatus } from './journalTypes';
import type { CaseStudy, CaseStudyStatus } from './caseStudyTypes';
import type { ContentLink } from './contentLinks';
import { parseLinks } from './contentLinks';

/**
 * Admin-only Supabase client. This module (and the @supabase/supabase-js
 * dependency it pulls in) is only ever imported by pages under /admin/, so it
 * never reaches the public site's bundle.
 *
 * Every read/write here still goes through Postgres Row Level Security
 * (supabase/schema.sql, supabase/case_study_cms.sql) — the `is_admin()`
 * checks in this file are a client UX convenience (redirect non-admins away,
 * show the right buttons) and are NOT the security boundary. A tampered
 * client that skips these checks still gets a 401/403 from Supabase on the
 * actual insert/update/delete/storage operation.
 */

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY (see .env.example).'
    );
  }
  client = createClient(url, anonKey);
  return client;
}

export async function signInAdmin(email: string, password: string): Promise<Session> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(error?.message || 'Sign in failed.');
  }
  const admin = await isCurrentUserAdmin();
  if (!admin) {
    await supabase.auth.signOut();
    throw new Error('This account does not have admin access.');
  }
  return data.session;
}

export async function signOutAdmin(): Promise<void> {
  await getSupabaseClient().auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session;
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;
  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  return !error && !!data;
}

/**
 * Client-side route guard for every /admin/* page (except /admin/login).
 * Redirects non-authenticated or non-admin visitors to the login page.
 * Real authorization is enforced by RLS regardless of whether this runs.
 */
export async function requireAdminOrRedirect(): Promise<Session | null> {
  const session = await getSession();
  if (!session || !(await isCurrentUserAdmin())) {
    window.location.href = withBase('/admin/login/');
    return null;
  }
  return session;
}

/** Postgres unique-violation. Slugs are derived from the title, so two entries named
 *  alike collide — suffix the slug rather than making the admin rename it. */
const UNIQUE_VIOLATION = '23505';

function normalizeRow<T extends { links?: unknown }>(row: T): T {
  return { ...row, links: parseLinks(row.links) };
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

export interface JournalPostInput {
  title: string;
  slug: string;
  excerpt: string;
  content: string | null;
  external_url: string | null;
  category: string | null;
  tags: string[];
  cover_image: string | null;
  author: string;
  featured: boolean;
  reading_time_minutes: number | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image: string | null;
  links: ContentLink[];
}

export async function listAllJournalPosts(): Promise<JournalPost[]> {
  const { data, error } = await getSupabaseClient()
    .from('journal_posts')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as JournalPost[]).map(normalizeRow);
}

export async function getJournalPostById(id: string): Promise<JournalPost | null> {
  const { data, error } = await getSupabaseClient().from('journal_posts').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalizeRow(data as JournalPost) : null;
}

export async function createJournalPost(
  input: JournalPostInput,
  status: JournalStatus
): Promise<JournalPost> {
  const supabase = getSupabaseClient();
  const payload = {
    ...input,
    status,
    published_at: status === 'published' ? new Date().toISOString() : null,
  };

  for (let attempt = 0; attempt < 20; attempt++) {
    const slug = attempt === 0 ? input.slug : `${input.slug}-${attempt + 1}`;
    const { data, error } = await supabase
      .from('journal_posts')
      .insert({ ...payload, slug })
      .select()
      .single();

    if (!error) return normalizeRow(data as JournalPost);
    if (error.code !== UNIQUE_VIOLATION) throw new Error(error.message);
  }

  throw new Error('Could not generate a unique URL slug for this title. Try a different title.');
}

export async function updateJournalPost(
  id: string,
  input: JournalPostInput
): Promise<JournalPost> {
  const { data, error } = await getSupabaseClient()
    .from('journal_posts')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return normalizeRow(data as JournalPost);
}

export async function setJournalPostStatus(id: string, status: JournalStatus): Promise<JournalPost> {
  const { data, error } = await getSupabaseClient()
    .from('journal_posts')
    .update({
      status,
      published_at: status === 'published' ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return normalizeRow(data as JournalPost);
}

export async function deleteJournalPost(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('journal_posts').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Case Studies
// ---------------------------------------------------------------------------

export interface CaseStudyInput {
  title: string;
  slug: string;
  excerpt: string;
  content: string | null;
  category: string;
  tags: string[];
  cover_image: string | null;
  order_index: number;
  reading_time_minutes: number | null;
  author: string;
  featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
  og_image: string | null;
  links: ContentLink[];
}

export async function listAllCaseStudies(): Promise<CaseStudy[]> {
  const { data, error } = await getSupabaseClient()
    .from('case_studies')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as CaseStudy[]).map(normalizeRow);
}

export async function getCaseStudyById(id: string): Promise<CaseStudy | null> {
  const { data, error } = await getSupabaseClient().from('case_studies').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalizeRow(data as CaseStudy) : null;
}

export async function createCaseStudy(
  input: CaseStudyInput,
  status: CaseStudyStatus
): Promise<CaseStudy> {
  const supabase = getSupabaseClient();
  const payload = {
    ...input,
    status,
    published_at: status === 'published' ? new Date().toISOString() : null,
  };

  for (let attempt = 0; attempt < 20; attempt++) {
    const slug = attempt === 0 ? input.slug : `${input.slug}-${attempt + 1}`;
    const { data, error } = await supabase
      .from('case_studies')
      .insert({ ...payload, slug })
      .select()
      .single();

    if (!error) return normalizeRow(data as CaseStudy);
    if (error.code !== UNIQUE_VIOLATION) throw new Error(error.message);
  }

  throw new Error('Could not generate a unique URL slug for this title. Try a different title.');
}

export async function updateCaseStudy(id: string, input: CaseStudyInput): Promise<CaseStudy> {
  const { data, error } = await getSupabaseClient()
    .from('case_studies')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return normalizeRow(data as CaseStudy);
}

export async function setCaseStudyStatus(id: string, status: CaseStudyStatus): Promise<CaseStudy> {
  const { data, error } = await getSupabaseClient()
    .from('case_studies')
    .update({
      status,
      published_at: status === 'published' ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return normalizeRow(data as CaseStudy);
}

export async function deleteCaseStudy(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('case_studies').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Updates only the PDF fields — kept separate from the main form save so attaching/replacing/removing a PDF doesn't require the rest of the form to be filled in or re-submitted. */
export async function updateCaseStudyPdf(
  id: string,
  fields: { pdf_url: string | null; pdf_filename: string | null }
): Promise<CaseStudy> {
  const { data, error } = await getSupabaseClient()
    .from('case_studies')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return normalizeRow(data as CaseStudy);
}

// ---------------------------------------------------------------------------
// Storage — content images (Journal inline/cover, Case Study cover/OG) and
// Case Study PDFs. Both buckets are public-read/admin-write (see
// supabase/case_study_cms.sql); uploads use a timestamp prefix so re-uploading
// the same filename can't silently overwrite an unrelated entry's file.
// ---------------------------------------------------------------------------

function uniqueObjectName(file: File): string {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  return `${Date.now()}-${safeName}`;
}

/** Uploads an image (Journal inline/cover art, Case Study cover/OG image) and returns its public URL. */
export async function uploadContentImage(prefix: string, file: File): Promise<string> {
  const supabase = getSupabaseClient();
  const path = `${prefix}/${uniqueObjectName(file)}`;
  const { error } = await supabase.storage.from('content-images').upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('content-images').getPublicUrl(path);
  return data.publicUrl;
}

export interface UploadedPdf {
  url: string;
  filename: string;
}

export async function uploadCaseStudyPdf(caseStudyId: string, file: File): Promise<UploadedPdf> {
  if (file.type !== 'application/pdf') {
    throw new Error('Please choose a PDF file.');
  }
  const supabase = getSupabaseClient();
  const path = `case-studies/${caseStudyId}/${uniqueObjectName(file)}`;
  const { error } = await supabase.storage.from('case-study-pdfs').upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('case-study-pdfs').getPublicUrl(path);
  return { url: data.publicUrl, filename: file.name };
}

/** Best-effort delete of the previous PDF object when replacing/removing — failure here isn't fatal to the row update. */
export async function deleteCaseStudyPdfObject(pdfUrl: string): Promise<void> {
  const marker = '/object/public/case-study-pdfs/';
  const idx = pdfUrl.indexOf(marker);
  if (idx === -1) return;
  const path = pdfUrl.slice(idx + marker.length);
  await getSupabaseClient().storage.from('case-study-pdfs').remove([path]);
}
