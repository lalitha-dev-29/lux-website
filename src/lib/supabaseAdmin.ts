import type { GuestLecture, GuestSpeaker, GuestLectureFile } from './guestLectureTypes';
import { normalizeGuestLecture } from './guestLectureTypes';
import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import { withBase } from './url';
import type { JournalPost, JournalStatus } from './journalTypes';
import type { CaseStudy, CaseStudyStatus } from './caseStudyTypes';
import { normalizeProject, type Project, type ProjectStatus, type ProjectProgress, type ProjectDetail, type ProjectVideo, type TeamMember } from './projectTypes';
import type { ContentLink } from './contentLinks';
import { parseLinks } from './contentLinks';
import { parseGallery, parseKeyFigures, type GalleryImage, type KeyFigure } from './gallery';
import type {
  LearningOverview,
  LearningRightNowItem,
  LearningEducationItem,
  LearningCertification,
  CertFileType,
} from './learningTypes';
import type { AtlasCategory, AtlasCountry, AtlasCountryStatus, AtlasBrand, AtlasBrandStatus } from './atlasTypes';

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

function normalizeCaseStudyRow(row: CaseStudy): CaseStudy {
  const r = row as unknown as Record<string, unknown>;
  return {
    ...normalizeRow(row),
    gallery: parseGallery(r.gallery),
    key_figures: parseKeyFigures(r.key_figures),
    conclusion: typeof r.conclusion === 'string' && r.conclusion.trim() ? r.conclusion : null,
  };
}

/**
 * A save that names a column the database doesn't have yet fails with
 * PostgREST's "Could not find the 'gallery' column ... in the schema cache".
 * Turn that into an instruction the site owner can act on.
 */
function friendlyError(message: string): string {
  if (/could not find the '(gallery|key_figures|conclusion|core_question)' column/i.test(message)) {
    return 'The database is missing the new gallery fields. Run supabase/portfolio_media.sql once in the Supabase SQL Editor, then save again.';
  }
  return message;
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
  status: JournalStatus,
  /** The id the form already filed this post's images under, so the row and its images share a folder. */
  id?: string
): Promise<JournalPost> {
  const supabase = getSupabaseClient();
  const payload = {
    ...input,
    ...(id ? { id } : {}),
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
    if (error.code !== UNIQUE_VIOLATION) throw new Error(friendlyError(error.message));
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
  // Best effort: remove the post's cover and inline images from storage.
  await removeUploadFolders([['content-images', `journal/${id}`]]);
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
  coming_soon: boolean;
  seo_title: string | null;
  seo_description: string | null;
  og_image: string | null;
  links: ContentLink[];
  gallery: GalleryImage[];
  key_figures: KeyFigure[];
  conclusion: string | null;
}

export async function listAllCaseStudies(): Promise<CaseStudy[]> {
  const { data, error } = await getSupabaseClient()
    .from('case_studies')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as CaseStudy[]).map(normalizeCaseStudyRow);
}

export async function getCaseStudyById(id: string): Promise<CaseStudy | null> {
  const { data, error } = await getSupabaseClient().from('case_studies').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalizeCaseStudyRow(data as CaseStudy) : null;
}

export async function createCaseStudy(
  input: CaseStudyInput,
  status: CaseStudyStatus,
  /** The id the form already filed this entry's uploads under, so the row and its images share a folder. */
  id?: string
): Promise<CaseStudy> {
  const supabase = getSupabaseClient();
  const payload = {
    ...input,
    ...(id ? { id } : {}),
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

    if (!error) return normalizeCaseStudyRow(data as CaseStudy);
    if (error.code !== UNIQUE_VIOLATION) throw new Error(friendlyError(error.message));
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
  if (error) throw new Error(friendlyError(error.message));
  return normalizeCaseStudyRow(data as CaseStudy);
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
  return normalizeCaseStudyRow(data as CaseStudy);
}

export async function deleteCaseStudy(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('case_studies').delete().eq('id', id);
  if (error) throw new Error(error.message);
  // Best effort: remove the case study's images and PDF from storage.
  await removeUploadFolders([
    ['content-images', `case-studies/${id}`],
    ['content-images', `case-studies/${id}/gallery`],
    ['case-study-pdfs', `case-studies/${id}`],
  ]);
}

/**
 * Deletes every file directly inside each [bucket, folder]. Used after a row
 * is deleted so its uploads don't linger; failures are ignored because the
 * row itself is already gone and leftover files are harmless.
 */
async function removeUploadFolders(folders: [string, string][]): Promise<void> {
  const supabase = getSupabaseClient();
  await Promise.all(
    folders.map(async ([bucket, folder]) => {
      try {
        const { data } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });
        const files = (data ?? []).filter((f) => f.id).map((f) => `${folder}/${f.name}`);
        if (files.length) await supabase.storage.from(bucket).remove(files);
      } catch {
        /* leave the files */
      }
    })
  );
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
  return normalizeCaseStudyRow(data as CaseStudy);
}

// ---------------------------------------------------------------------------
// Storage — content images (Journal inline/cover, Case Study cover/OG) and
// Case Study PDFs. Both buckets are public-read/admin-write (see
// supabase/case_study_cms.sql); uploads use a timestamp prefix so re-uploading
// the same filename can't silently overwrite an unrelated entry's file.
// ---------------------------------------------------------------------------

/** Supabase's per-file upload cap on this project's plan. */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Uploads a file to a storage bucket, turning size and network failures into plain-English errors. */
async function uploadToBucket(bucket: string, path: string, file: File): Promise<void> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `"${file.name}" is ${mb(file.size)} — the upload limit is 50 MB. Compress it first (for a PDF, export with smaller images or use a PDF compressor) and try again.`
    );
  }
  const { error } = await getSupabaseClient().storage.from(bucket).upload(path, file, { upsert: false });
  if (!error) return;
  if (/maximum allowed size|payload too large|413/i.test(error.message)) {
    throw new Error(`"${file.name}" is too large to upload (${mb(file.size)}). Compress it and try again.`);
  }
  throw new Error(error.message);
}

function uniqueObjectName(file: File): string {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  return `${Date.now()}-${safeName}`;
}

/** Uploads an image (Journal inline/cover art, Case Study cover/OG image) and returns its public URL. */
export async function uploadContentImage(prefix: string, file: File): Promise<string> {
  const supabase = getSupabaseClient();
  const path = `${prefix}/${uniqueObjectName(file)}`;
  await uploadToBucket('content-images', path, file);
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
  await uploadToBucket('case-study-pdfs', path, file);
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

// ---------------------------------------------------------------------------
// Learning — Overview (singleton), Right Now, Education, Certifications.
// None of these carry a draft/published status: a saved row is simply live,
// the same "no review step" model a settings panel would use. Delete
// confirmation in the UI is what stands in for "unpublish".
// ---------------------------------------------------------------------------

export async function getLearningOverview(): Promise<LearningOverview | null> {
  const { data, error } = await getSupabaseClient()
    .from('learning_overview')
    .select('*')
    .eq('id', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as LearningOverview | null;
}

export async function saveLearningOverview(input: { heading: string; description: string }): Promise<LearningOverview> {
  const { data, error } = await getSupabaseClient()
    .from('learning_overview')
    .upsert({ id: true, ...input })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as LearningOverview;
}

export interface RightNowInput {
  title: string;
  body: string;
  order_index: number;
}

export async function listAllRightNow(): Promise<LearningRightNowItem[]> {
  const { data, error } = await getSupabaseClient()
    .from('learning_right_now')
    .select('*')
    .order('order_index', { ascending: true });
  if (error) throw new Error(error.message);
  return data as LearningRightNowItem[];
}

export async function getRightNowById(id: string): Promise<LearningRightNowItem | null> {
  const { data, error } = await getSupabaseClient().from('learning_right_now').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as LearningRightNowItem | null;
}

export async function createRightNow(input: RightNowInput): Promise<LearningRightNowItem> {
  const { data, error } = await getSupabaseClient().from('learning_right_now').insert(input).select().single();
  if (error) throw new Error(error.message);
  return data as LearningRightNowItem;
}

export async function updateRightNow(id: string, input: RightNowInput): Promise<LearningRightNowItem> {
  const { data, error } = await getSupabaseClient()
    .from('learning_right_now')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as LearningRightNowItem;
}

export async function deleteRightNow(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('learning_right_now').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function reorderRightNow(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, i) => getSupabaseClient().from('learning_right_now').update({ order_index: i + 1 }).eq('id', id))
  );
}

export interface EducationInput {
  institution: string;
  programme: string;
  description: string;
  location: string | null;
  start_month: number | null;
  start_year: number | null;
  end_month: number | null;
  end_year: number | null;
  is_current: boolean;
  order_index: number;
}

export async function listAllEducation(): Promise<LearningEducationItem[]> {
  const { data, error } = await getSupabaseClient()
    .from('learning_education')
    .select('*')
    .order('order_index', { ascending: true });
  if (error) throw new Error(error.message);
  return data as LearningEducationItem[];
}

export async function getEducationById(id: string): Promise<LearningEducationItem | null> {
  const { data, error } = await getSupabaseClient().from('learning_education').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as LearningEducationItem | null;
}

export async function createEducation(input: EducationInput): Promise<LearningEducationItem> {
  const { data, error } = await getSupabaseClient().from('learning_education').insert(input).select().single();
  if (error) throw new Error(error.message);
  return data as LearningEducationItem;
}

export async function updateEducation(id: string, input: EducationInput): Promise<LearningEducationItem> {
  const { data, error } = await getSupabaseClient()
    .from('learning_education')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as LearningEducationItem;
}

export async function deleteEducation(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('learning_education').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function reorderEducation(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, i) => getSupabaseClient().from('learning_education').update({ order_index: i + 1 }).eq('id', id))
  );
}

export interface CertificationInput {
  name: string;
  issuer_portal: string | null;
  issuing_institution: string;
  cert_month: number;
  cert_year: number;
  file_url: string;
  file_type: CertFileType;
  file_name: string | null;
  description: string | null;
  certificate_link: string;
  order_index: number;
}

export async function listAllCertifications(): Promise<LearningCertification[]> {
  const { data, error } = await getSupabaseClient()
    .from('learning_certifications')
    .select('*')
    .order('order_index', { ascending: true });
  if (error) throw new Error(error.message);
  return data as LearningCertification[];
}

export async function getCertificationById(id: string): Promise<LearningCertification | null> {
  const { data, error } = await getSupabaseClient()
    .from('learning_certifications')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as LearningCertification | null;
}

export async function createCertification(input: CertificationInput): Promise<LearningCertification> {
  const { data, error } = await getSupabaseClient().from('learning_certifications').insert(input).select().single();
  if (error) throw new Error(error.message);
  return data as LearningCertification;
}

/** Metadata-only update — never touches file_url/file_type/file_name (see updateCertificationFile below), so editing details never risks the attached file. */
export async function updateCertification(
  id: string,
  input: Omit<CertificationInput, 'file_url' | 'file_type' | 'file_name'>
): Promise<LearningCertification> {
  const { data, error } = await getSupabaseClient()
    .from('learning_certifications')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as LearningCertification;
}

/** Updates only the file fields — kept separate so replacing a certificate file never requires re-submitting the rest of the form. */
export async function updateCertificationFile(
  id: string,
  fields: { file_url: string; file_type: CertFileType; file_name: string | null }
): Promise<LearningCertification> {
  const { data, error } = await getSupabaseClient()
    .from('learning_certifications')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as LearningCertification;
}

export async function deleteCertification(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('learning_certifications').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function reorderCertifications(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, i) => getSupabaseClient().from('learning_certifications').update({ order_index: i + 1 }).eq('id', id))
  );
}

const ALLOWED_CERT_TYPES: Record<string, CertFileType> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
};

const MAX_CERT_FILE_BYTES = 10 * 1024 * 1024;

export interface UploadedCertFile {
  url: string;
  filename: string;
  fileType: CertFileType;
}

/** Uploads a certificate file (image or PDF) for a given certification row and returns its public URL + detected type. */
export async function uploadCertificateFile(certificationId: string, file: File): Promise<UploadedCertFile> {
  const fileType = ALLOWED_CERT_TYPES[file.type];
  if (!fileType) {
    throw new Error('Unsupported certificate format — please upload a PDF, JPG, PNG or WebP file.');
  }
  if (file.size > MAX_CERT_FILE_BYTES) {
    throw new Error('Certificate file is too large — the limit is 10MB.');
  }
  const supabase = getSupabaseClient();
  const path = `${certificationId}/${uniqueObjectName(file)}`;
  await uploadToBucket('learning-certificates', path, file);
  const { data } = supabase.storage.from('learning-certificates').getPublicUrl(path);
  return { url: data.publicUrl, filename: file.name, fileType };
}

/** Best-effort delete of the previous certificate file when replacing/removing — failure here isn't fatal to the row update. */
export async function deleteCertificateFileObject(fileUrl: string): Promise<void> {
  const marker = '/object/public/learning-certificates/';
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) return;
  const path = fileUrl.slice(idx + marker.length);
  await getSupabaseClient().storage.from('learning-certificates').remove([path]);
}

// ---------------------------------------------------------------------------
// Projects (supabase/projects.sql). Images live in the content-images bucket
// and decks in case-study-pdfs, both under projects/<id>/.
// ---------------------------------------------------------------------------

export interface ProjectInput {
  title: string;
  slug: string;
  tagline: string | null;
  excerpt: string;
  content: string | null;
  project_type: string | null;
  course: string | null;
  institution: string | null;
  period: string | null;
  my_role: string | null;
  progress: ProjectProgress;
  tags: string[];
  cover_image: string | null;
  video_url: string | null;
  videos: ProjectVideo[];
  details: ProjectDetail[];
  key_figures: KeyFigure[];
  team: TeamMember[];
  gallery: GalleryImage[];
  conclusion: string | null;
  links: ContentLink[];
  order_index: number;
  reading_time_minutes: number | null;
}

function projectError(message: string): string {
  if (/relation "public\.projects" does not exist|could not find the table 'public\.projects'/i.test(message)) {
    return 'The Projects table does not exist yet. Run supabase/projects.sql once in the Supabase SQL Editor, then try again.';
  }
  return message;
}

export async function listAllProjects(): Promise<Project[]> {
  const { data, error } = await getSupabaseClient()
    .from('projects')
    .select('*')
    .order('order_index', { ascending: true })
    .order('updated_at', { ascending: false });
  if (error) throw new Error(projectError(error.message));
  return (data as Record<string, unknown>[]).map(normalizeProject);
}

export async function getProjectById(id: string): Promise<Project | null> {
  const { data, error } = await getSupabaseClient().from('projects').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(projectError(error.message));
  return data ? normalizeProject(data as Record<string, unknown>) : null;
}

export async function createProject(input: ProjectInput, status: ProjectStatus, id?: string): Promise<Project> {
  const supabase = getSupabaseClient();
  const payload = {
    ...input,
    ...(id ? { id } : {}),
    status,
    published_at: status === 'published' ? new Date().toISOString() : null,
  };
  for (let attempt = 0; attempt < 20; attempt++) {
    const slug = attempt === 0 ? input.slug : `${input.slug}-${attempt + 1}`;
    const { data, error } = await supabase.from('projects').insert({ ...payload, slug }).select().single();
    if (!error) return normalizeProject(data as Record<string, unknown>);
    if (error.code !== UNIQUE_VIOLATION || !/slug/i.test(error.message)) throw new Error(projectError(error.message));
  }
  throw new Error('Could not generate a unique URL for this title. Try a different title.');
}

export async function updateProject(id: string, input: ProjectInput): Promise<Project> {
  const { data, error } = await getSupabaseClient().from('projects').update(input).eq('id', id).select().single();
  if (error) throw new Error(projectError(error.message));
  return normalizeProject(data as Record<string, unknown>);
}

export async function setProjectStatus(id: string, status: ProjectStatus): Promise<Project> {
  const { data, error } = await getSupabaseClient()
    .from('projects')
    .update({ status, published_at: status === 'published' ? new Date().toISOString() : null })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(projectError(error.message));
  return normalizeProject(data as Record<string, unknown>);
}

export async function updateProjectPdf(
  id: string,
  pdf: { pdf_url: string | null; pdf_filename: string | null }
): Promise<Project> {
  const { data, error } = await getSupabaseClient().from('projects').update(pdf).eq('id', id).select().single();
  if (error) throw new Error(projectError(error.message));
  return normalizeProject(data as Record<string, unknown>);
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw new Error(projectError(error.message));
  // Best effort: remove the project's uploads (cover, inline and gallery
  // images, PDF deck) so deleted projects don't leave files behind in storage.
  await removeUploadFolders([
    ['content-images', `projects/${id}`],
    ['content-images', `projects/${id}/gallery`],
    ['content-images', `projects/${id}/videos`],
    ['case-study-pdfs', `projects/${id}`],
  ]);
}

/** Uploads a video file (mp4/webm/mov) for a project and returns its public URL. */
export async function uploadProjectVideo(prefix: string, file: File): Promise<string> {
  if (!/^video\/(mp4|webm|quicktime)$/.test(file.type) && !/\.(mp4|webm|mov|m4v)$/i.test(file.name)) {
    throw new Error('Please choose an MP4, WebM or MOV video file.');
  }
  const path = `${prefix}/videos/${uniqueObjectName(file)}`;
  await uploadToBucket('content-images', path, file);
  return getSupabaseClient().storage.from('content-images').getPublicUrl(path).data.publicUrl;
}

export async function uploadProjectPdf(projectId: string, file: File): Promise<UploadedPdf> {
  if (file.type !== 'application/pdf') throw new Error('Please choose a PDF file.');
  const supabase = getSupabaseClient();
  const path = `projects/${projectId}/${uniqueObjectName(file)}`;
  await uploadToBucket('case-study-pdfs', path, file);
  const { data } = supabase.storage.from('case-study-pdfs').getPublicUrl(path);
  return { url: data.publicUrl, filename: file.name };
}

// ---------------------------------------------------------------------------
// Guest Lectures — standalone CMS (supabase/guest_lectures.sql). Speaker
// photos and optional PDF/PPT handouts live in the public `guest-lectures`
// Storage bucket under `<lectureId>/…`; rows reference them by public URL.
// ---------------------------------------------------------------------------

export interface GuestLectureInput {
  /** Supplied on create so uploads can be filed under the row's id before it exists. */
  id?: string;
  topic: string;
  lecture_date: string;
  speakers: GuestSpeaker[];
  tags: string[];
  key_learnings: string;
  files: GuestLectureFile[];
  gallery: GalleryImage[];
  core_question: string | null;
}

export async function listAllGuestLectures(): Promise<GuestLecture[]> {
  const { data, error } = await getSupabaseClient()
    .from('guest_lectures')
    .select('*')
    .order('lecture_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Record<string, unknown>[]).map(normalizeGuestLecture);
}

export async function getGuestLectureById(id: string): Promise<GuestLecture | null> {
  const { data, error } = await getSupabaseClient().from('guest_lectures').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalizeGuestLecture(data as Record<string, unknown>) : null;
}

export async function createGuestLecture(input: GuestLectureInput): Promise<GuestLecture> {
  const { data, error } = await getSupabaseClient().from('guest_lectures').insert(input).select().single();
  if (error) throw new Error(friendlyError(error.message));
  return normalizeGuestLecture(data as Record<string, unknown>);
}

export async function updateGuestLecture(id: string, input: GuestLectureInput): Promise<GuestLecture> {
  const { id: _ignored, ...fields } = input;
  const { data, error } = await getSupabaseClient()
    .from('guest_lectures')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(friendlyError(error.message));
  return normalizeGuestLecture(data as Record<string, unknown>);
}

export async function deleteGuestLecture(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('guest_lectures').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Uploads one speaker photo or handout for a lecture and returns its public URL. */
export async function uploadGuestLectureAsset(lectureId: string, file: File): Promise<string> {
  const supabase = getSupabaseClient();
  const path = `${lectureId}/${uniqueObjectName(file)}`;
  await uploadToBucket('guest-lectures', path, file);
  return supabase.storage.from('guest-lectures').getPublicUrl(path).data.publicUrl;
}

/** Best-effort removal of storage objects by public URL — never fatal to the row operation that triggered it. */
export async function deleteGuestLectureAssets(urls: string[]): Promise<void> {
  const marker = '/object/public/guest-lectures/';
  const paths = urls
    .map((u) => {
      const idx = u.indexOf(marker);
      return idx === -1 ? null : decodeURIComponent(u.slice(idx + marker.length));
    })
    .filter((p): p is string => !!p);
  if (paths.length === 0) return;
  try {
    await getSupabaseClient().storage.from('guest-lectures').remove(paths);
  } catch {
    // Orphaned objects are harmless; don't fail the save/delete over them.
  }
}

// ---------------------------------------------------------------------------
// Atlas — Categories, Countries, Brands. Country images (featured_image_url)
// and Brand images (logo_url/image_url) reuse the same content-images
// Storage bucket/uploadContentImage() helper as Journal/Case Study, under an
// `atlas/country/<id>` or `atlas/brand/<id>` path prefix.
// ---------------------------------------------------------------------------

export interface AtlasCategoryInput {
  name: string;
  display_order: number;
}

export async function listAllAtlasCategories(): Promise<AtlasCategory[]> {
  const { data, error } = await getSupabaseClient()
    .from('atlas_categories')
    .select('*')
    .order('display_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data as AtlasCategory[];
}

export async function getAtlasCategoryById(id: string): Promise<AtlasCategory | null> {
  const { data, error } = await getSupabaseClient().from('atlas_categories').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as AtlasCategory | null;
}

export async function createAtlasCategory(input: AtlasCategoryInput): Promise<AtlasCategory> {
  const { data, error } = await getSupabaseClient().from('atlas_categories').insert(input).select().single();
  if (error) throw new Error(error.message);
  return data as AtlasCategory;
}

export async function updateAtlasCategory(id: string, input: AtlasCategoryInput): Promise<AtlasCategory> {
  const { data, error } = await getSupabaseClient()
    .from('atlas_categories')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AtlasCategory;
}

export async function deleteAtlasCategory(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('atlas_categories').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function reorderAtlasCategories(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, i) => getSupabaseClient().from('atlas_categories').update({ display_order: i + 1 }).eq('id', id))
  );
}

export interface AtlasCountryInput {
  name: string;
  map_id: string | null;
  country_code: string | null;
  short_description: string | null;
  heading: string;
  research_content: string | null;
  featured_image_url: string | null;
  display_order: number;
  is_featured: boolean;
}

export async function listAllAtlasCountries(): Promise<AtlasCountry[]> {
  const { data, error } = await getSupabaseClient()
    .from('atlas_countries')
    .select('*')
    .order('display_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data as AtlasCountry[];
}

export async function getAtlasCountryById(id: string): Promise<AtlasCountry | null> {
  const { data, error } = await getSupabaseClient().from('atlas_countries').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as AtlasCountry | null;
}

export async function createAtlasCountry(input: AtlasCountryInput, status: AtlasCountryStatus): Promise<AtlasCountry> {
  const { data, error } = await getSupabaseClient()
    .from('atlas_countries')
    .insert({ ...input, status, published_at: status === 'published' ? new Date().toISOString() : null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AtlasCountry;
}

export async function updateAtlasCountry(id: string, input: AtlasCountryInput): Promise<AtlasCountry> {
  const { data, error } = await getSupabaseClient()
    .from('atlas_countries')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AtlasCountry;
}

export async function setAtlasCountryStatus(id: string, status: AtlasCountryStatus): Promise<AtlasCountry> {
  const { data, error } = await getSupabaseClient()
    .from('atlas_countries')
    .update({
      status,
      published_at: status === 'published' ? new Date().toISOString() : undefined,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AtlasCountry;
}

export async function deleteAtlasCountry(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('atlas_countries').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function reorderAtlasCountries(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, i) => getSupabaseClient().from('atlas_countries').update({ display_order: i + 1 }).eq('id', id))
  );
}

/** Clones a country's scalar fields as a new Draft (name suffixed " (Copy)", map_id cleared since it must stay
 *  unique per country). Does NOT duplicate the source country's brands, to avoid silently doubling brand data. */
export async function duplicateAtlasCountry(id: string): Promise<AtlasCountry> {
  const source = await getAtlasCountryById(id);
  if (!source) throw new Error('Country not found.');
  const all = await listAllAtlasCountries();
  const maxOrder = all.reduce((max, c) => Math.max(max, c.display_order), 0);
  return createAtlasCountry(
    {
      name: `${source.name} (Copy)`,
      map_id: null,
      country_code: source.country_code,
      short_description: source.short_description,
      heading: source.heading,
      research_content: source.research_content,
      featured_image_url: source.featured_image_url,
      display_order: maxOrder + 1,
      is_featured: false,
    },
    'draft'
  );
}

export interface AtlasBrandInput {
  country_id: string;
  category_id: string | null;
  name: string;
  founded_year: number | null;
  founder: string | null;
  positioning: string | null;
  website_url: string | null;
  research_notes: string | null;
  display_order: number;
}

export async function listAllAtlasBrands(): Promise<AtlasBrand[]> {
  const { data, error } = await getSupabaseClient()
    .from('atlas_brands')
    .select('*')
    .order('display_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data as AtlasBrand[];
}

export async function listAtlasBrandsByCountry(countryId: string): Promise<AtlasBrand[]> {
  const { data, error } = await getSupabaseClient()
    .from('atlas_brands')
    .select('*')
    .eq('country_id', countryId)
    .order('display_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data as AtlasBrand[];
}

export async function getAtlasBrandById(id: string): Promise<AtlasBrand | null> {
  const { data, error } = await getSupabaseClient().from('atlas_brands').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as AtlasBrand | null;
}

export async function createAtlasBrand(input: AtlasBrandInput, status: AtlasBrandStatus = 'draft'): Promise<AtlasBrand> {
  const { data, error } = await getSupabaseClient()
    .from('atlas_brands')
    .insert({ ...input, status })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AtlasBrand;
}

export async function updateAtlasBrand(id: string, input: AtlasBrandInput): Promise<AtlasBrand> {
  const { data, error } = await getSupabaseClient()
    .from('atlas_brands')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AtlasBrand;
}

export async function setAtlasBrandStatus(id: string, status: AtlasBrandStatus): Promise<AtlasBrand> {
  const { data, error } = await getSupabaseClient().from('atlas_brands').update({ status }).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data as AtlasBrand;
}

export async function deleteAtlasBrand(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('atlas_brands').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function reorderAtlasBrandsWithinCountry(countryId: string, orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, i) => getSupabaseClient().from('atlas_brands').update({ display_order: i + 1 }).eq('id', id).eq('country_id', countryId))
  );
}
