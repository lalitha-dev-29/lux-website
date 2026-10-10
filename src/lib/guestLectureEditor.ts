/**
 * DOM logic for the Guest Lecture editor, shared by admin/guest-lectures/new
 * and edit. Markup lives in components/admin/GuestLectureFormFields.astro.
 *
 * Photos and handouts are kept in memory as either an already-uploaded URL or
 * a pending File; nothing is uploaded until save() so cancelling a form never
 * leaves stray objects in Storage.
 */
import { uploadGuestLectureAsset, deleteGuestLectureAssets, type GuestLectureInput } from './supabaseAdmin';
import type { GuestLecture, GuestLectureFile, GuestLectureFileType, GuestSpeaker } from './guestLectureTypes';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DOC_TYPES: Record<string, GuestLectureFileType> = {
  'application/pdf': 'pdf',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'ppt',
};
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_DOC_BYTES = 25 * 1024 * 1024;

interface PhotoItem {
  url?: string;
  file?: File;
  preview?: string;
}
interface FileItem {
  existing?: GuestLectureFile;
  file?: File;
}
interface SpeakerRow {
  el: HTMLElement;
  photos: PhotoItem[];
}

/** "Luxury Strategy, Gen Z" -> ["Luxury Strategy", "Gen Z"], de-duplicated case-insensitively. */
export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const tag = part.trim().replace(/\s+/g, ' ');
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      out.push(tag);
    }
  }
  return out;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function formatBytes(n: number): string {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function createGuestLectureEditor() {
  const speakersList = $('speakersList');
  const speakerTpl = $<HTMLTemplateElement>('speakerTemplate');
  const filesInput = $<HTMLInputElement>('fFiles');
  const filesList = $('filesList');
  const rows: SpeakerRow[] = [];
  let files: FileItem[] = [];
  const onChange: Array<() => void> = [];
  const changed = () => onChange.forEach((fn) => fn());

  // ---- tags ------------------------------------------------------------
  const tagsInput = $<HTMLInputElement>('fTags');
  const tagSuggestions = $('tagSuggestions');
  let knownTags: string[] = [];

  function renderTagSuggestions() {
    const chosen = new Set(parseTags(tagsInput.value).map((t) => t.toLowerCase()));
    tagSuggestions.replaceChildren();
    knownTags
      .filter((t) => !chosen.has(t.toLowerCase()))
      .forEach((tag) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tag-suggestion';
        btn.textContent = `+ ${tag}`;
        btn.addEventListener('click', () => {
          tagsInput.value = [...parseTags(tagsInput.value), tag].join(', ');
          tagsInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
        tagSuggestions.append(btn);
      });
    tagSuggestions.hidden = tagSuggestions.childElementCount === 0;
  }
  tagsInput.addEventListener('input', renderTagSuggestions);

  /** Tags already used on other lectures, offered as one-click chips so spelling stays consistent. */
  function setKnownTags(tags: string[]) {
    knownTags = Array.from(new Set(tags));
    renderTagSuggestions();
  }

  // ---- speakers --------------------------------------------------------
  function renumber() {
    rows.forEach((row, i) => {
      (row.el.querySelector('.speaker-heading') as HTMLElement).textContent = `Speaker ${i + 1}`;
      (row.el.querySelector('.speaker-remove') as HTMLElement).hidden = rows.length === 1;
    });
  }

  function renderPhotos(row: SpeakerRow) {
    const wrap = row.el.querySelector('.speaker-photos') as HTMLElement;
    wrap.replaceChildren();
    row.photos.forEach((photo, i) => {
      const fig = document.createElement('figure');
      fig.className = 'photo-thumb';
      const img = document.createElement('img');
      img.src = photo.url ?? photo.preview ?? '';
      img.alt = '';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'photo-remove';
      btn.setAttribute('aria-label', 'Remove this photo');
      btn.textContent = '✕';
      btn.addEventListener('click', () => {
        const [removed] = row.photos.splice(i, 1);
        if (removed?.preview) URL.revokeObjectURL(removed.preview);
        renderPhotos(row);
        changed();
      });
      fig.append(img, btn);
      wrap.append(fig);
    });
  }

  function addSpeaker(initial?: Partial<GuestSpeaker>): SpeakerRow {
    const el = (speakerTpl.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
    const row: SpeakerRow = { el, photos: (initial?.photos ?? []).map((url) => ({ url })) };
    const q = <T extends HTMLElement>(sel: string) => el.querySelector(sel) as T;
    q<HTMLInputElement>('.speaker-name').value = initial?.name ?? '';
    q<HTMLInputElement>('.speaker-role').value = initial?.role ?? '';
    q<HTMLTextAreaElement>('.speaker-description').value = initial?.description ?? '';
    q<HTMLTextAreaElement>('.speaker-quote').value = initial?.quote ?? '';

    const photoInput = q<HTMLInputElement>('.speaker-photo-input');
    const photoError = q<HTMLElement>('.speaker-photo-error');
    photoInput.addEventListener('change', () => {
      photoError.hidden = true;
      for (const file of Array.from(photoInput.files ?? [])) {
        if (!IMAGE_TYPES.includes(file.type)) {
          photoError.textContent = `"${file.name}" isn't a JPG, PNG or WebP image.`;
          photoError.hidden = false;
          continue;
        }
        if (file.size > MAX_IMAGE_BYTES) {
          photoError.textContent = `"${file.name}" is over the 10MB photo limit.`;
          photoError.hidden = false;
          continue;
        }
        row.photos.push({ file, preview: URL.createObjectURL(file) });
      }
      photoInput.value = '';
      renderPhotos(row);
      changed();
    });

    q<HTMLButtonElement>('.speaker-remove').addEventListener('click', () => {
      if (rows.length === 1) return;
      row.photos.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
      rows.splice(rows.indexOf(row), 1);
      el.remove();
      renumber();
      changed();
    });

    rows.push(row);
    speakersList.append(el);
    renderPhotos(row);
    renumber();
    return row;
  }

  $('addSpeakerBtn').addEventListener('click', () => {
    addSpeaker();
    changed();
  });

  // ---- handouts --------------------------------------------------------
  const FILE_ERROR = $('fFilesError');

  function renderFiles() {
    filesList.replaceChildren();
    files.forEach((item, i) => {
      const li = document.createElement('li');
      li.className = 'file-row';
      const name = document.createElement('span');
      const label = item.existing ? item.existing.name : (item.file as File).name;
      const kind = (item.existing ? item.existing.type : DOC_TYPES[(item.file as File).type]) === 'ppt' ? 'PPT' : 'PDF';
      name.textContent = `${label} · ${kind}${item.file ? ` · ${formatBytes(item.file.size)} · not uploaded yet` : ''}`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'link-remove';
      btn.setAttribute('aria-label', `Remove ${label}`);
      btn.textContent = '✕';
      btn.addEventListener('click', () => {
        files.splice(i, 1);
        renderFiles();
        changed();
      });
      li.append(name, btn);
      filesList.append(li);
    });
  }

  filesInput.addEventListener('change', () => {
    FILE_ERROR.hidden = true;
    for (const file of Array.from(filesInput.files ?? [])) {
      if (!DOC_TYPES[file.type]) {
        FILE_ERROR.textContent = `"${file.name}" isn't a PDF or PowerPoint (.ppt/.pptx) file.`;
        FILE_ERROR.hidden = false;
        continue;
      }
      if (file.size > MAX_DOC_BYTES) {
        FILE_ERROR.textContent = `"${file.name}" is over the 25MB file limit.`;
        FILE_ERROR.hidden = false;
        continue;
      }
      files.push({ file });
    }
    filesInput.value = '';
    renderFiles();
    changed();
  });

  // ---- values ----------------------------------------------------------
  function readSpeakers() {
    return rows.map((row) => {
      const v = (sel: string) => (row.el.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement).value.trim();
      return {
        name: v('.speaker-name'),
        role: v('.speaker-role'),
        description: v('.speaker-description'),
        quote: v('.speaker-quote'),
        photos: row.photos,
      };
    });
  }

  function setValue(lecture: GuestLecture) {
    $<HTMLInputElement>('fTopic').value = lecture.topic;
    $<HTMLInputElement>('fLectureDate').value = lecture.lecture_date;
    $<HTMLTextAreaElement>('fKeyLearnings').value = lecture.key_learnings;
    $<HTMLInputElement>('fTags').value = lecture.tags.join(', ');
    renderTagSuggestions();
    rows.splice(0).forEach((r) => r.el.remove());
    (lecture.speakers.length ? lecture.speakers : [{}]).forEach((s) => addSpeaker(s));
    files = lecture.files.map((existing) => ({ existing }));
    renderFiles();
  }

  function validate(): string | null {
    if (!$<HTMLInputElement>('fTopic').value.trim()) return 'Topic is required.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test($<HTMLInputElement>('fLectureDate').value)) return 'Lecture date is required.';
    const speakers = readSpeakers();
    for (let i = 0; i < speakers.length; i++) {
      if (!speakers[i].name) return `Speaker ${i + 1}: name is required (remove the speaker if you don't need it).`;
    }
    if (!$<HTMLTextAreaElement>('fKeyLearnings').value.trim()) return 'What I learned is required.';
    return null;
  }

  /**
   * Uploads pending photos/handouts under `lectureId/` and returns the row payload.
   * If any upload fails, objects uploaded by this call are removed again.
   */
  async function buildInput(lectureId: string): Promise<GuestLectureInput> {
    const uploaded: string[] = [];
    try {
      const speakers: GuestSpeaker[] = [];
      for (const s of readSpeakers()) {
        const photos: string[] = [];
        for (const p of s.photos) {
          if (p.url) photos.push(p.url);
          else if (p.file) {
            const url = await uploadGuestLectureAsset(lectureId, p.file);
            uploaded.push(url);
            photos.push(url);
          }
        }
        speakers.push({
          name: s.name,
          role: s.role || null,
          description: s.description || null,
          quote: s.quote || null,
          photos,
        });
      }
      const outFiles: GuestLectureFile[] = [];
      for (const f of files) {
        if (f.existing) outFiles.push(f.existing);
        else if (f.file) {
          const url = await uploadGuestLectureAsset(lectureId, f.file);
          uploaded.push(url);
          outFiles.push({ url, name: f.file.name, type: DOC_TYPES[f.file.type] });
        }
      }
      return {
        id: lectureId,
        topic: $<HTMLInputElement>('fTopic').value.trim(),
        lecture_date: $<HTMLInputElement>('fLectureDate').value,
        speakers,
        tags: parseTags($<HTMLInputElement>('fTags').value),
        key_learnings: $<HTMLTextAreaElement>('fKeyLearnings').value.trim(),
        files: outFiles,
      };
    } catch (err) {
      await deleteGuestLectureAssets(uploaded);
      throw err;
    }
  }

  return {
    setKnownTags,
    addSpeaker,
    setValue,
    validate,
    buildInput,
    onChange: (fn: () => void) => onChange.push(fn),
    /** Public URLs of every photo/handout this lecture currently references. */
    assetUrls(lecture: GuestLecture): string[] {
      return [...lecture.speakers.flatMap((s) => s.photos), ...lecture.files.map((f) => f.url)];
    },
  };
}
