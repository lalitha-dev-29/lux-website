import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

/**
 * Wires the PDF viewer rendered by src/components/PDFViewer.astro. Kept as a
 * plain module (not bundled with every page) — pdfjs-dist itself is only
 * ever imported inside `load()`, which fires automatically the first time
 * the viewer is actually visible (see the IntersectionObserver below), not
 * on page load — so a Case Study page whose PDF section is never scrolled
 * to, or a Certificate lightbox that's never opened, still ships zero
 * pdf.js bytes.
 */
export function initPdfViewer(root: HTMLElement): void {
  if (!root.dataset.pdfUrl) return;
  const pdfUrl: string = root.dataset.pdfUrl;
  const title = root.dataset.pdfTitle || 'PDF';

  const byId = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;

  const toolbar = byId<HTMLElement>('pdfToolbar');
  const canvasWrap = byId<HTMLElement>('pdfCanvasWrap');
  const canvas = byId<HTMLCanvasElement>('pdfCanvas');
  const scrollPages = byId<HTMLElement>('pdfScrollPages');
  const status = byId<HTMLElement>('pdfStatus');
  const frame = byId<HTMLElement>('pdfViewerFrame');
  const mobileFallback = byId<HTMLElement>('pdfMobileFallback');
  const openNewTabBtn = byId<HTMLButtonElement>('pdfOpenNewTabBtn');
  const mobileOpenBtn = byId<HTMLButtonElement>('pdfMobileOpenBtn');

  const viewPageBtn = byId<HTMLButtonElement>('pdfViewPageBtn');
  const viewScrollBtn = byId<HTMLButtonElement>('pdfViewScrollBtn');
  const pageNavGroup = byId<HTMLElement>('pdfPageNavGroup');
  const prevBtn = byId<HTMLButtonElement>('pdfPrevBtn');
  const nextBtn = byId<HTMLButtonElement>('pdfNextBtn');
  const pageInput = byId<HTMLInputElement>('pdfPageInput');
  const pageCountEl = byId<HTMLElement>('pdfPageCount');
  const zoomOutBtn = byId<HTMLButtonElement>('pdfZoomOutBtn');
  const zoomInBtn = byId<HTMLButtonElement>('pdfZoomInBtn');
  const zoomInput = byId<HTMLInputElement>('pdfZoomInput');
  const fitWidthBtn = byId<HTMLButtonElement>('pdfFitWidthBtn');
  const fitPageBtn = byId<HTMLButtonElement>('pdfFitPageBtn');
  const fullscreenBtn = byId<HTMLButtonElement>('pdfFullscreenBtn');
  const exitFullscreenBtn = byId<HTMLButtonElement>('pdfExitFullscreenBtn');

  let pdfDoc: PDFDocumentProxy | null = null;
  let currentPage = 1;
  let scale = 1;
  // 'custom' (not 'width') so the initial render is a literal 100% — a
  // deliberate, user-set zoom, not an auto-fit guess. Fit Width/Fit Page
  // are still one click away for anyone who wants that instead.
  let fitMode: 'width' | 'page' | 'custom' = 'custom';
  let rendering = false;
  let viewMode: 'page' | 'scroll' = 'scroll';
  let scrollPageObserver: IntersectionObserver | null = null;

  function reducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function showError(message: string): void {
    status.textContent = message;
    mobileFallback.hidden = false;
    toolbar.hidden = true;
    canvasWrap.hidden = true;
  }

  // --- Page mode -----------------------------------------------------------

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
      zoomInput.value = String(Math.round(scale * 100));
    } catch {
      showError('Could not render this page.');
    } finally {
      rendering = false;
    }
  }

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
      zoomInput.value = String(Math.round(scale * 100));
    } finally {
      rendering = false;
    }
  }

  // --- Continuous-scroll mode -----------------------------------------------

  function observeScrollPages(canvases: HTMLCanvasElement[]): void {
    scrollPageObserver?.disconnect();
    scrollPageObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length === 0) return;
        const most = visible.reduce((a, b) => (b.intersectionRatio > a.intersectionRatio ? b : a));
        const num = Number((most.target as HTMLElement).dataset.pageNum);
        if (num) {
          currentPage = num;
          pageInput.value = String(num);
        }
      },
      { root: canvasWrap, threshold: [0.25, 0.5, 0.75] }
    );
    canvases.forEach((c) => scrollPageObserver!.observe(c));
  }

  /** Renders every page as its own canvas, stacked in #pdfScrollPages. Reuses `scale`/`fitMode` the same way renderPage() does, so switching modes never resets zoom. */
  async function renderContinuous(): Promise<void> {
    if (!pdfDoc || rendering) return;
    rendering = true;
    try {
      const firstPage = await pdfDoc.getPage(1);
      const baseViewport = firstPage.getViewport({ scale: 1 });
      if (fitMode !== 'custom') {
        scale = Math.max((canvasWrap.clientWidth - 32) / baseViewport.width, 0.25);
      }
      // Captured once and reused for every page in this pass — rendering
      // 30+ pages takes real time, and reading the shared `scale` fresh per
      // page would let a zoom click that lands mid-render mix two scales
      // into a single, inconsistent pass. The `rendering` guard above stops
      // a second pass from starting concurrently; this stops the one
      // in-flight pass from drifting.
      const renderScale = scale;

      scrollPages.replaceChildren();
      const canvases: HTMLCanvasElement[] = [];
      for (let num = 1; num <= pdfDoc.numPages; num++) {
        const page: PDFPageProxy = num === 1 ? firstPage : await pdfDoc.getPage(num);
        const viewport = page.getViewport({ scale: renderScale });
        const pageCanvas = document.createElement('canvas');
        pageCanvas.dataset.pageNum = String(num);
        pageCanvas.setAttribute('role', 'img');
        pageCanvas.setAttribute('aria-label', `${title} — page ${num} of ${pdfDoc.numPages}`);
        pageCanvas.width = viewport.width;
        pageCanvas.height = viewport.height;
        scrollPages.appendChild(pageCanvas);
        canvases.push(pageCanvas);
        const ctx = pageCanvas.getContext('2d');
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport, canvas: pageCanvas }).promise;
      }
      zoomInput.value = String(Math.round(renderScale * 100));
      observeScrollPages(canvases);
    } catch {
      showError('Could not render this PDF.');
    } finally {
      rendering = false;
    }
  }

  function scrollToPage(num: number, instant = false): void {
    const target = scrollPages.querySelector<HTMLElement>(`canvas[data-page-num="${num}"]`);
    target?.scrollIntoView({ block: 'start', behavior: instant || reducedMotion() ? 'auto' : 'smooth' });
    currentPage = num;
    pageInput.value = String(num);
  }

  // --- Shared re-render helpers (fit-width/fit-page/resize/fullscreen and
  // zoom both need to redraw in whichever mode is currently active) --------

  async function refreshView(): Promise<void> {
    if (viewMode === 'page') {
      await renderPage(currentPage);
    } else {
      const page = currentPage;
      await renderContinuous();
      scrollToPage(page, true);
    }
  }

  async function applyZoom(): Promise<void> {
    if (viewMode === 'page') {
      await renderFixedScale();
    } else {
      const page = currentPage;
      await renderContinuous();
      scrollToPage(page, true);
    }
  }

  async function setViewMode(mode: 'page' | 'scroll'): Promise<void> {
    viewMode = mode;
    viewPageBtn.setAttribute('aria-pressed', String(mode === 'page'));
    viewScrollBtn.setAttribute('aria-pressed', String(mode === 'scroll'));
    // "Fit Page" (fit a single page to the viewport height) has no
    // equivalent once pages are stacked in a continuous scroll, and the
    // page-jump control doesn't add much once you can just scroll — both
    // hide themselves in Scroll mode rather than sit there unused.
    fitPageBtn.hidden = mode === 'scroll';
    pageNavGroup.hidden = mode === 'scroll';
    if (!pdfDoc) return; // Not loaded yet — load() renders into whichever mode is active once it finishes.

    if (mode === 'page') {
      scrollPageObserver?.disconnect();
      canvas.hidden = false;
      scrollPages.hidden = true;
      await renderPage(currentPage);
    } else {
      canvas.hidden = true;
      scrollPages.hidden = false;
      if (fitMode === 'page') fitMode = 'width';
      const page = currentPage;
      await renderContinuous();
      scrollToPage(page, true);
    }
  }

  viewPageBtn.addEventListener('click', () => void setViewMode('page'));
  viewScrollBtn.addEventListener('click', () => void setViewMode('scroll'));

  // --- Load ------------------------------------------------------------------

  let loadStarted = false;
  async function load(): Promise<void> {
    if (loadStarted) return;
    loadStarted = true;
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
      await (viewMode === 'page' ? renderPage(1) : renderContinuous());
    } catch {
      showError('This PDF couldn’t be displayed here.');
    }
  }

  // Loads automatically the moment the viewer is actually on screen — a
  // closed <dialog> (a Certificate's lightbox) has no box at all until
  // showModal() runs, so this naturally waits for that; the Case Study
  // page's always-present viewer loads as soon as it scrolls near view.
  // rootMargin starts the fetch a little before it's literally visible so
  // it already looks "just there" by the time a visitor reaches it.
  const visibilityObserver = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      visibilityObserver.disconnect();
      void load();
    },
    { rootMargin: '400px' }
  );
  visibilityObserver.observe(root);

  // --- Navigation / zoom -----------------------------------------------------

  prevBtn.addEventListener('click', () => {
    if (!pdfDoc || currentPage <= 1) return;
    const target = currentPage - 1;
    if (viewMode === 'page') void renderPage(target);
    else scrollToPage(target);
  });
  nextBtn.addEventListener('click', () => {
    if (!pdfDoc || currentPage >= pdfDoc.numPages) return;
    const target = currentPage + 1;
    if (viewMode === 'page') void renderPage(target);
    else scrollToPage(target);
  });
  pageInput.addEventListener('change', () => {
    if (!pdfDoc) return;
    const n = Math.min(Math.max(1, Number(pageInput.value) || 1), pdfDoc.numPages);
    if (viewMode === 'page') void renderPage(n);
    else scrollToPage(n);
  });

  zoomInBtn.addEventListener('click', () => {
    fitMode = 'custom';
    scale = Math.min(scale * 1.2, 4);
    void applyZoom();
  });
  zoomOutBtn.addEventListener('click', () => {
    fitMode = 'custom';
    scale = Math.max(scale / 1.2, 0.25);
    void applyZoom();
  });
  zoomInput.addEventListener('change', () => {
    // `|| 100` would also catch a legitimate, deliberately-typed 0 (falsy)
    // and silently replace it with 100 instead of clamping it to the 25
    // floor — check for a real number first, and only fall back on NaN
    // (an empty or non-numeric field).
    const raw = Number(zoomInput.value);
    const pct = Math.min(Math.max(Number.isFinite(raw) ? raw : 100, 25), 400);
    zoomInput.value = String(pct);
    fitMode = 'custom';
    scale = pct / 100;
    void applyZoom();
  });
  zoomInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') zoomInput.blur();
  });
  fitWidthBtn.addEventListener('click', () => {
    fitMode = 'width';
    void refreshView();
  });
  fitPageBtn.addEventListener('click', () => {
    fitMode = 'page';
    void refreshView();
  });

  // --- Open in a new tab, without ever triggering a download ----------------

  /**
   * Opens the PDF in a new tab via a fetched blob: URL rather than linking
   * straight to the Storage URL. A raw cross-origin PDF link can get
   * intercepted by a browser's "always download PDFs" setting before the
   * browser's own inline viewer ever gets a chance to run — a blob: URL
   * carries no HTTP headers or origin of its own for that setting to key
   * off, so it opens in the browser's native PDF viewer instead.
   *
   * The blank tab is opened synchronously, before the `await`, and
   * navigated once the blob is ready — opening it only after the fetch
   * resolves would no longer count as a direct result of the click, and
   * most browsers would block it as a popup.
   */
  async function openInNewTab(button: HTMLButtonElement): Promise<void> {
    const newTab = window.open('', '_blank', 'noopener');
    if (!newTab) {
      window.open(pdfUrl, '_blank', 'noopener');
      return;
    }
    button.disabled = true;
    try {
      const res = await fetch(pdfUrl);
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      newTab.location.href = blobUrl;
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch {
      newTab.location.href = pdfUrl;
    } finally {
      button.disabled = false;
    }
  }

  openNewTabBtn.addEventListener('click', () => void openInNewTab(openNewTabBtn));
  mobileOpenBtn.addEventListener('click', () => void openInNewTab(mobileOpenBtn));

  // --- Fullscreen ---------------------------------------------------------
  // The real Fullscreen API can reject even when document.fullscreenEnabled
  // reports true — e.g. the page is embedded in an iframe/preview frame
  // whose Permissions Policy doesn't delegate `fullscreen` to it, which
  // rejects with "Permissions check failed" and previously left the button
  // looking dead: clicked, nothing happened, no error surfaced anywhere.
  // "pseudoFullscreen" is a CSS-only fallback (reusing the exact same
  // .pdf-fullscreen treatment) for exactly that case — the button always
  // does *something* visible, whether or not the browser grants the real
  // OS-level fullscreen.
  let pseudoFullscreen = false;
  let pseudoFullscreenPlaceholder: Comment | null = null;
  let fullscreenDialog: HTMLDialogElement | null = null;

  /**
   * Runs before EITHER fullscreen path (native or pseudo). A Certificate's
   * PDF lives inside an open <dialog>, which renders in the browser's own
   * "top layer" — same mechanism the Fullscreen API itself uses — so a
   * still-open dialog was floating on top of (or fighting with) the
   * fullscreen frame instead of getting out of the way. Closing it and
   * moving the frame out to <body> sidesteps that entirely, and fixes the
   * unrelated `will-change:transform` containing-block issue (see below)
   * for the native path too, not just the CSS fallback.
   */
  function detachFrameForFullscreen(): void {
    const dialog = frame.closest('dialog') as HTMLDialogElement | null;
    if (dialog?.open) {
      fullscreenDialog = dialog;
      dialog.close();
    }
    pseudoFullscreenPlaceholder = document.createComment('pdf-fullscreen-placeholder');
    frame.before(pseudoFullscreenPlaceholder);
    document.body.appendChild(frame);
  }

  function reattachFrame(): void {
    pseudoFullscreenPlaceholder?.replaceWith(frame);
    pseudoFullscreenPlaceholder = null;
    if (fullscreenDialog) {
      fullscreenDialog.showModal();
      fullscreenDialog = null;
    }
  }

  function enterPseudoFullscreen(): void {
    pseudoFullscreen = true;
    frame.classList.add('pdf-fullscreen');
    document.body.classList.add('pdf-pseudo-fullscreen-open');
    exitFullscreenBtn.hidden = false;
    exitFullscreenBtn.focus();
    if (fitMode !== 'custom') void refreshView();
  }

  function exitPseudoFullscreen(): void {
    pseudoFullscreen = false;
    frame.classList.remove('pdf-fullscreen');
    document.body.classList.remove('pdf-pseudo-fullscreen-open');
    reattachFrame();
    exitFullscreenBtn.hidden = true;
    fullscreenBtn.focus();
    if (fitMode !== 'custom') void refreshView();
  }

  fullscreenBtn.addEventListener('click', () => {
    detachFrameForFullscreen();
    if (!document.fullscreenEnabled || !frame.requestFullscreen) {
      enterPseudoFullscreen();
      return;
    }
    frame.requestFullscreen().catch(() => enterPseudoFullscreen());
  });
  exitFullscreenBtn.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (pseudoFullscreen) exitPseudoFullscreen();
  });
  document.addEventListener('fullscreenchange', () => {
    const isFullscreen = document.fullscreenElement === frame;
    frame.classList.toggle('pdf-fullscreen', isFullscreen);
    exitFullscreenBtn.hidden = !isFullscreen;
    if (isFullscreen) {
      exitFullscreenBtn.focus();
      if (fitMode !== 'custom') void refreshView();
    } else if (!pseudoFullscreen) {
      // Native fullscreen just ended (Esc, browser chrome, etc.) — put the
      // frame back where it came from, reopening its dialog if it had one.
      reattachFrame();
      fullscreenBtn.focus();
      if (fitMode !== 'custom') void refreshView();
    }
  });
  frame.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') nextBtn.click();
    if (e.key === 'ArrowLeft') prevBtn.click();
    // The real Fullscreen API exits on Escape by itself; pseudo-fullscreen
    // needs its own handler for the same affordance.
    if (e.key === 'Escape' && pseudoFullscreen) exitPseudoFullscreen();
  });

  window.addEventListener('resize', () => {
    if (pdfDoc && fitMode !== 'custom') void refreshView();
  });
}
