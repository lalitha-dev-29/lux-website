import { uploadContentImage } from './supabaseAdmin';

/**
 * Formats browsers can actually decode in an <img> tag. Deliberately excludes
 * HEIC/HEIF (what iPhones save photos as by default) — no browser except a
 * narrow slice of Safari can render it inline, so accepting it would silently
 * upload a file nothing can ever display, with no visible error.
 */
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

function isSupportedImage(file: File): boolean {
  if (ALLOWED_IMAGE_TYPES.includes(file.type)) return true;
  // Some browsers/OSes report an empty or generic type for certain files (e.g.
  // .svg from some pickers) — fall back to the extension in that case only.
  if (!file.type) return /\.(jpe?g|png|webp|gif|svg)$/i.test(file.name);
  return false;
}

/** Wires a single image field: file input -> upload -> hidden URL input + preview + remove. Shared by cover-image and OG-image fields on both admin forms. */
export function wireSingleImageField(
  prefix: string,
  refs: {
    fileInput: HTMLInputElement;
    hiddenInput: HTMLInputElement;
    preview: HTMLImageElement;
    removeBtn: HTMLButtonElement;
    status: HTMLElement;
  }
): void {
  refs.fileInput.addEventListener('change', async () => {
    const file = refs.fileInput.files?.[0];
    if (!file) return;
    if (!isSupportedImage(file)) {
      refs.status.textContent =
        file.type === 'image/heic' || file.type === 'image/heif' || /\.heic$|\.heif$/i.test(file.name)
          ? 'HEIC/HEIF photos (the iPhone default) can\'t be displayed by browsers — please convert to JPG or PNG first.'
          : 'Unsupported image format — please use JPG, PNG, WebP, GIF or SVG.';
      refs.fileInput.value = '';
      return;
    }
    refs.status.textContent = 'Uploading…';
    try {
      const url = await uploadContentImage(prefix, file);
      refs.hiddenInput.value = url;
      refs.hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
      refs.preview.src = url;
      refs.preview.hidden = false;
      refs.removeBtn.hidden = false;
      refs.status.textContent = '';
    } catch (err) {
      refs.status.textContent = err instanceof Error ? err.message : 'Upload failed.';
    } finally {
      refs.fileInput.value = '';
    }
  });
  refs.removeBtn.addEventListener('click', () => {
    refs.hiddenInput.value = '';
    refs.hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
    refs.preview.src = '';
    refs.preview.hidden = true;
    refs.removeBtn.hidden = true;
  });
}

/** Populates an already-wired single image field with an existing URL (edit pages). */
export function showExistingImage(url: string | null, preview: HTMLImageElement, removeBtn: HTMLButtonElement): void {
  if (!url) return;
  preview.src = url;
  preview.hidden = false;
  removeBtn.hidden = false;
}

/** Wires an "Insert Image" control next to a Markdown textarea: uploads a file and inserts `![](url)` at the cursor. */
export function wireInlineImageInsert(
  prefix: string,
  textarea: HTMLTextAreaElement,
  fileInput: HTMLInputElement,
  status: HTMLElement,
  triggerBtn?: HTMLButtonElement
): void {
  triggerBtn?.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!isSupportedImage(file)) {
      status.textContent =
        file.type === 'image/heic' || file.type === 'image/heif' || /\.heic$|\.heif$/i.test(file.name)
          ? 'HEIC/HEIF photos (the iPhone default) can\'t be displayed by browsers — please convert to JPG or PNG first.'
          : 'Unsupported image format — please use JPG, PNG, WebP, GIF or SVG.';
      fileInput.value = '';
      return;
    }
    status.textContent = 'Uploading…';
    try {
      const url = await uploadContentImage(prefix, file);
      const snippet = `![Describe this image](${url})`;
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      textarea.value = textarea.value.slice(0, start) + snippet + textarea.value.slice(end);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.focus();
      const cursor = start + snippet.length;
      textarea.setSelectionRange(cursor, cursor);
      status.textContent = 'Image inserted — edit the alt text in the brackets.';
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : 'Upload failed.';
    } finally {
      fileInput.value = '';
    }
  });
}

/**
 * Wires the image controls shared by JournalFormFields.astro and
 * CaseStudyFormFields.astro (cover image, OG image, inline content-image
 * insert) — the element IDs are identical in both forms, so one call handles
 * either page. `prefix` is the Storage path prefix (e.g. `journal/<id>` or
 * `case-studies/<id>`); pass a client-generated id for a not-yet-saved entry.
 */
export function wireContentFormImages(prefix: string): void {
  const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

  wireSingleImageField(prefix, {
    fileInput: byId('fCoverImageFile'),
    hiddenInput: byId('fCoverImage'),
    preview: byId('fCoverImagePreview'),
    removeBtn: byId('fCoverImageRemove'),
    status: byId('fCoverImageStatus'),
  });
  wireSingleImageField(prefix, {
    fileInput: byId('fOgImageFile'),
    hiddenInput: byId('fOgImage'),
    preview: byId('fOgImagePreview'),
    removeBtn: byId('fOgImageRemove'),
    status: byId('fOgImageStatus'),
  });
  wireInlineImageInsert(
    prefix,
    byId('fContent'),
    byId('fContentImageFile'),
    byId('contentImageStatus'),
    byId('insertImageBtn')
  );
}

/** Shows any existing cover/OG image previews on an edit page after the record loads. */
export function showExistingContentImages(coverUrl: string | null, ogUrl: string | null): void {
  const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  showExistingImage(coverUrl, byId('fCoverImagePreview'), byId('fCoverImageRemove'));
  showExistingImage(ogUrl, byId('fOgImagePreview'), byId('fOgImageRemove'));
}
