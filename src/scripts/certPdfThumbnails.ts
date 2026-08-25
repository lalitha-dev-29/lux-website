/**
 * Renders a real first-page thumbnail for each PDF certificate card on
 * /learning/ — a static icon+filename would satisfy "has a preview"
 * technically, but the spec explicitly wants "a proper certificate
 * thumbnail/preview rather than only showing a generic file name", so this
 * mirrors src/scripts/pdfViewer.ts's lazy pdf.js loading (only imported if
 * the page actually has a PDF certificate card) but renders once, small,
 * with no toolbar/pagination — it's a thumbnail, not a reader. The full
 * reader (src/components/PDFViewer.astro) still does the real viewing work
 * inside each card's lightbox dialog.
 *
 * Lazy per-card: only renders once a thumbnail scrolls near the viewport,
 * so a page with several PDF certificates doesn't load pdf.js and every PDF
 * up front.
 */
export function initCertPdfThumbnails(): void {
  const thumbs = document.querySelectorAll<HTMLElement>('[data-pdf-thumb-url]');
  if (thumbs.length === 0) return;

  let pdfjsPromise: ReturnType<typeof loadPdfjs> | null = null;
  function loadPdfjs() {
    return import('pdfjs-dist').then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
      return pdfjsLib;
    });
  }

  async function renderThumb(el: HTMLElement): Promise<void> {
    const url = el.dataset.pdfThumbUrl;
    if (!url) return;
    try {
      pdfjsPromise ??= loadPdfjs();
      const pdfjsLib = await pdfjsPromise;
      const pdfDoc = await pdfjsLib.getDocument({ url }).promise;
      const page = await pdfDoc.getPage(1);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(el.clientWidth / baseViewport.width, (el.clientHeight * 2) / baseViewport.height);
      const viewport = page.getViewport({ scale: Math.max(scale, 0.3) });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;

      el.replaceChildren(canvas);
      el.classList.add('cert-pdf-thumb-rendered');
    } catch {
      // Leave the static icon+label fallback already in the markup.
    }
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        void renderThumb(entry.target as HTMLElement);
      }
    },
    { rootMargin: '200px' }
  );

  thumbs.forEach((el) => observer.observe(el));
}
