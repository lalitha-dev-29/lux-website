/**
 * DOM logic for components/admin/GalleryEditor.astro. Items are kept in
 * memory as either an already-uploaded URL or a pending File; nothing is
 * uploaded until resolve() runs at save time, so abandoning a form never
 * leaves stray files in Storage.
 */
import type { GalleryImage } from './gallery';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES = 10 * 1024 * 1024;

interface Item {
  url?: string;
  file?: File;
  preview?: string;
  caption: string;
}

export interface GalleryEditor {
  set(images: GalleryImage[]): void;
  /** Uploads pending photos with `upload` and returns the final list, in order. */
  resolve(upload: (file: File) => Promise<string>): Promise<GalleryImage[]>;
  /** URLs uploaded by the last resolve() — for cleanup if the save then fails. */
  lastUploaded(): string[];
  onChange(fn: () => void): void;
}

export function initGalleryEditor(rootId: string): GalleryEditor {
  const root = document.getElementById(rootId) as HTMLElement;
  const list = root.querySelector('[data-gallery-list]') as HTMLUListElement;
  const input = root.querySelector('[data-gallery-input]') as HTMLInputElement;
  const error = root.querySelector('[data-gallery-error]') as HTMLElement;
  let items: Item[] = [];
  let uploadedLast: string[] = [];
  const listeners: Array<() => void> = [];
  const changed = () => listeners.forEach((fn) => fn());

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length) return;
    const [item] = items.splice(from, 1);
    items.splice(to, 0, item);
    render();
    changed();
  }

  function render() {
    list.replaceChildren();
    items.forEach((item, i) => {
      const li = document.createElement('li');
      li.className = 'gallery-editor-item';

      const img = document.createElement('img');
      img.src = item.url ?? item.preview ?? '';
      img.alt = '';

      const body = document.createElement('div');
      body.className = 'gallery-editor-body';
      const num = document.createElement('span');
      num.className = 'gallery-editor-num';
      num.textContent = `Photo ${i + 1}${item.file ? ' · not uploaded yet' : ''}`;
      const caption = document.createElement('input');
      caption.type = 'text';
      caption.maxLength = 220;
      caption.placeholder = 'Caption (optional), e.g. "The window display at Marina Bay Sands"';
      caption.value = item.caption;
      caption.setAttribute('aria-label', `Caption for photo ${i + 1}`);
      caption.addEventListener('input', () => {
        item.caption = caption.value;
        changed();
      });
      body.append(num, caption);

      const actions = document.createElement('div');
      actions.className = 'gallery-editor-actions';
      const mk = (text: string, label: string, fn: () => void, disabled = false) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'gallery-editor-btn';
        b.textContent = text;
        b.setAttribute('aria-label', label);
        b.disabled = disabled;
        b.addEventListener('click', fn);
        return b;
      };
      actions.append(
        mk('↑', `Move photo ${i + 1} earlier`, () => move(i, i - 1), i === 0),
        mk('↓', `Move photo ${i + 1} later`, () => move(i, i + 1), i === items.length - 1),
        mk('✕', `Remove photo ${i + 1}`, () => {
          const [removed] = items.splice(i, 1);
          if (removed?.preview) URL.revokeObjectURL(removed.preview);
          render();
          changed();
        })
      );

      li.append(img, body, actions);
      list.append(li);
    });
  }

  input.addEventListener('change', () => {
    error.hidden = true;
    for (const file of Array.from(input.files ?? [])) {
      if (!IMAGE_TYPES.includes(file.type)) {
        error.textContent = `"${file.name}" isn't a JPG, PNG, WebP or GIF image.`;
        error.hidden = false;
        continue;
      }
      if (file.size > MAX_BYTES) {
        error.textContent = `"${file.name}" is over the 10MB photo limit.`;
        error.hidden = false;
        continue;
      }
      items.push({ file, preview: URL.createObjectURL(file), caption: '' });
    }
    input.value = '';
    render();
    changed();
  });

  return {
    set(images) {
      items = images.map((g) => ({ url: g.url, caption: g.caption ?? '' }));
      render();
    },
    async resolve(upload) {
      uploadedLast = [];
      const out: GalleryImage[] = [];
      for (const item of items) {
        let url = item.url;
        if (!url && item.file) {
          url = await upload(item.file);
          uploadedLast.push(url);
          // Remember the upload so a retry after a failed save doesn't upload twice.
          item.url = url;
          item.file = undefined;
        }
        if (url) out.push({ url, caption: item.caption.trim() || null });
      }
      render();
      return out;
    },
    lastUploaded: () => uploadedLast,
    onChange: (fn) => listeners.push(fn),
  };
}
