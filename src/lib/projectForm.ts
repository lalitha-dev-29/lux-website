/** Read/write/validate helpers for components/admin/ProjectFormFields.astro. */
import { calculateReadingTime } from './readingTime';
import { readLinks, writeLinks } from './linksForm';
import { keyFiguresFromText, keyFiguresToText, type GalleryImage } from './gallery';
import { pairsFromText, pairsToText, slugify, videosFromText, videosToText, type Project, type ProjectProgress } from './projectTypes';
import { uploadProjectVideo, type ProjectInput } from './supabaseAdmin';

const val = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value.trim();

export function writeProjectForm(p: Project): void {
  const set = (id: string, v: string | null | undefined) => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (el) el.value = v ?? '';
  };
  set('fTitle', p.title);
  set('fTagline', p.tagline);
  set('fExcerpt', p.excerpt);
  set('fProjectType', p.project_type);
  set('fProgress', p.progress);
  set('fCourse', p.course);
  set('fInstitution', p.institution);
  set('fPeriod', p.period);
  set('fMyRole', p.my_role);
  set('fTags', p.tags.join(', '));
  set('fOrderIndex', String(p.order_index));
  set('fCoverImage', p.cover_image);
  set('fVideoUrl', p.video_url);
  set('fVideos', videosToText(p.videos));
  set('fContent', p.content);
  set('fDetails', pairsToText(p.details.map((d) => [d.label, d.value])));
  set('fKeyFigures', keyFiguresToText(p.key_figures));
  set('fTeam', pairsToText(p.team.map((m) => [m.name, m.role])));
  set('fConclusion', p.conclusion);
  writeLinks('projectLinks', p.links);
}

export function validateProjectForm(): string | null {
  if (!val('fTitle')) return 'Project title is required.';
  if (!val('fExcerpt')) return 'Summary is required.';
  const video = val('fVideoUrl');
  if (video && !/^https?:\/\//i.test(video)) return 'The video link must start with https://';
  const badVideo = val('fVideos')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .find((l) => !/^https?:\/\//i.test(l.includes('|') ? l.slice(l.indexOf('|') + 1).trim() : l));
  if (badVideo) return `Each extra video needs a link starting with https:// — check "${badVideo.slice(0, 40)}". Use the format: Title | link`;
  return null;
}

export function toProjectInput(gallery: GalleryImage[], existingSlug?: string): ProjectInput {
  const content = val('fContent');
  const orNull = (s: string) => s || null;
  return {
    title: val('fTitle'),
    slug: existingSlug || slugify(val('fTitle')),
    tagline: orNull(val('fTagline')),
    excerpt: val('fExcerpt'),
    content: orNull(content),
    project_type: orNull(val('fProjectType')),
    course: orNull(val('fCourse')),
    institution: orNull(val('fInstitution')),
    period: orNull(val('fPeriod')),
    my_role: orNull(val('fMyRole')),
    progress: (val('fProgress') === 'in_progress' ? 'in_progress' : 'completed') as ProjectProgress,
    tags: val('fTags').split(',').map((t) => t.trim()).filter(Boolean),
    cover_image: orNull(val('fCoverImage')),
    video_url: orNull(val('fVideoUrl')),
    videos: videosFromText(val('fVideos')),
    details: pairsFromText(val('fDetails')).map(([label, value]) => ({ label, value })),
    key_figures: keyFiguresFromText(val('fKeyFigures')),
    team: pairsFromText(val('fTeam')).map(([name, role]) => ({ name, role })),
    gallery,
    conclusion: orNull(val('fConclusion')),
    links: readLinks('projectLinks'),
    order_index: Number(val('fOrderIndex')) || 0,
    reading_time_minutes: content ? calculateReadingTime(content) : null,
  };
}

/**
 * "Upload a video file": uploads straight away, then drops the new link into
 * the form — as the main video if that's empty, otherwise as a new line in
 * "More Videos" (with the file name as a starting title to edit).
 */
export function wireVideoUpload(prefix: string, onChange: () => void): void {
  const input = document.getElementById('fVideoFile') as HTMLInputElement | null;
  const status = document.getElementById('fVideoFileStatus');
  if (!input || !status) return;
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    status.textContent = `Uploading ${file.name}…`;
    try {
      const url = await uploadProjectVideo(prefix, file);
      const main = document.getElementById('fVideoUrl') as HTMLInputElement;
      const more = document.getElementById('fVideos') as HTMLTextAreaElement;
      if (!main.value.trim()) {
        main.value = url;
      } else {
        const title = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
        more.value = `${more.value.trim()}${more.value.trim() ? '\n' : ''}${title} | ${url}`;
      }
      status.textContent = 'Uploaded — remember to save.';
      onChange();
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : 'Upload failed.';
    } finally {
      input.value = '';
    }
  });
}
