import type { PDFDocumentProxy } from 'pdfjs-dist';

/**
 * Wires the PDF viewer rendered by src/components/PDFViewer.astro. Kept as a
 * plain module (not bundled with every page) — pdfjs-dist itself is only
 * ever imported inside `load()`, after the visitor clicks "Load PDF
 * Preview", so pages without a PDF (or visitors who never click) ship zero
 * pdf.js bytes.
 */
export function initPdfViewer(root: HTMLElement): void {
  if (!root.dataset.pdfUrl) return;
  const pdfUrl: string = root.dataset.pdfUrl;
  const title = root.dataset.pdfTitle || 'PDF';

  const byId = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;

  const loadBtn = byId<HTMLButtonElement>('pdfLoadBtn');
  const toolbar = byId<HTMLElement>('pdfToolbar');
  const canvasWrap = byId<HTMLElement>('pdfCanvasWrap');
  const canvas = byId<HTMLCanvasElement>('pdfCanvas');
  const status = byId<HTMLElement>('pdfStatus');
  const frame = byId<HTMLElement>('pdfViewerFrame');
  const mobileFallback = byId<HTMLElement>('pdfMobileFallback');

  const prevBtn = byId<HTMLButtonElement>('pdfPrevBtn');
  const nextBtn = byId<HTMLButtonElement>('pdfNextBtn');
  const pageInput = byId<HTMLInputElement>('pdfPageInput');
  const pageCountEl = byId<HTMLElement>('pdfPageCount');
  const zoomOutBtn = byId<HTMLButtonElement>('pdfZoomOutBtn');
  const zoomInBtn = byId<HTMLButtonElement>('pdfZoomInBtn');
  const zoomLabel = byId<HTMLElement>('pdfZoomLabel');
  const fitWidthBtn = byId<HTMLButtonElement>('pdfFitWidthBtn');
  const fitPageBtn = byId<HTMLButtonElement>('pdfFitPageBtn');
  const fullscreenBtn = byId<HTMLButtonElement>('pdfFullscreenBtn');
  const exitFullscreenBtn = byId<HTMLButtonElement>('pdfExitFullscreenBtn');

  let pdfDoc: PDFDocumentProxy | null = null;
  let currentPage = 1;
  let scale = 1;
  let fitMode: 'width' | 'page' | 'custom' = 'width';
  let rendering = false;

  function showError(message: string): void {
    status.textContent = message;
    mobileFallback.hidden = false;
    toolbar.hidden = true;
    canvasWrap.hidden = true;
  }

  async function renderPage(num: number): Promise<void> {
    if (!pdfDoc || rendering) return;
    rendering = true;
    try {
      const page = await pdfDoc.getPage(num);
      const baseViewport = page.getViewport({ scale: 1 });

      if (fitMode === 'width') {
        scale = Math.max((canvasWrap.clientWidth - 32) / baseViewport.width, 0.25);
      } else if (fitMode === 'page') {
        const availHeight = window.innerHeight * (frame.classList.contains('pdf-fullscreen') ? 0.85 : 0.7);
        scale = Math.max(
          Math.min((canvasWrap.clientWidth - 32) / baseViewport.width, availHeight / baseViewport.height),
          0.25
        );
      }

      const viewport = page.getViewport({ scale });
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas rendering is not supported.');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.setAttribute('aria-label', `${title} — page ${num} of ${pdfDoc.numPages}`);
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;

      currentPage = num;
      pageInput.value = String(num);
      zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    } catch {
      showError('Could not render this page.');
    } finally {
      rendering = false;
    }
  }

  async function load(): Promise<void> {
    loadBtn.hidden = true;
    canvasWrap.hidden = false;
    status.textContent = 'Loading PDF…';
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).href;

      pdfDoc = await pdfjsLib.getDocument({ url: pdfUrl }).promise;
      pageCountEl.textContent = String(pdfDoc.numPages);
      pageInput.max = String(pdfDoc.numPages);
      toolbar.hidden = false;
      status.textContent = '';
      await renderPage(1);
    } catch {
      showError('This PDF couldn’t be displayed here.');
    }
  }

  loadBtn.addEventListener('click', () => void load());

  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) void renderPage(currentPage - 1);
  });
  nextBtn.addEventListener('click', () => {
    if (pdfDoc && currentPage < pdfDoc.numPages) void renderPage(currentPage + 1);
  });
  pageInput.addEventListener('change', () => {
    if (!pdfDoc) return;
    const n = Math.min(Math.max(1, Number(pageInput.value) || 1), pdfDoc.numPages);
    void renderPage(n);
  });

  zoomInBtn.addEventListener('click', () => {
    fitMode = 'custom';
    scale = Math.min(scale * 1.2, 4);
    void renderFixedScale();
  });
  zoomOutBtn.addEventListener('click', () => {
    fitMode = 'custom';
    scale = Math.max(scale / 1.2, 0.25);
    void renderFixedScale();
  });
  fitWidthBtn.addEventListener('click', () => {
    fitMode = 'width';
    void renderPage(currentPage);
  });
  fitPageBtn.addEventListener('click', () => {
    fitMode = 'page';
    void renderPage(currentPage);
  });

  async function renderFixedScale(): Promise<void> {
    if (!pdfDoc || rendering) return;
    rendering = true;
    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    } finally {
      rendering = false;
    }
  }

  // --- Fullscreen ---------------------------------------------------------
  if (!document.fullscreenEnabled) {
    fullscreenBtn.hidden = true;
  }
  fullscreenBtn.addEventListener('click', () => {
    frame.requestFullscreen?.().catch(() => {
      /* unsupported in this browser (e.g. iOS Safari) — the visible
         Open-in-New-Tab / Download actions above remain the fallback */
    });
  });
  exitFullscreenBtn.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
  });
  document.addEventListener('fullscreenchange', () => {
    const isFullscreen = document.fullscreenElement === frame;
    frame.classList.toggle('pdf-fullscreen', isFullscreen);
    exitFullscreenBtn.hidden = !isFullscreen;
    if (isFullscreen) {
      exitFullscreenBtn.focus();
      if (fitMode !== 'custom') void renderPage(currentPage);
    } else {
      fullscreenBtn.focus();
    }
  });
  frame.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') nextBtn.click();
    if (e.key === 'ArrowLeft') prevBtn.click();
  });

  window.addEventListener('resize', () => {
    if (pdfDoc && fitMode !== 'custom') void renderPage(currentPage);
  });
}
