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
  // Only ever used as a `download` filename on the new tab's fallback link,
  // so a decode failure on an odd URL is a cosmetic problem, not a fatal one.
  const fileName = (() => {
    const last = pdfUrl.split(/[?#]/)[0].split('/').pop() || 'document.pdf';
    try {
      return decodeURIComponent(last);
    } catch {
      return last;
    }
  })();

  // Scoped to this viewer's own root: a Learning page renders one viewer per
  // Certification PDF, so `data-pdf` names are shared across instances by
  // design and must never be looked up against the whole document.
  const el = <T extends HTMLElement>(name: string) => root.querySelector<T>(`[data-pdf="${name}"]`)!;

  const toolbar = el<HTMLElement>('toolbar');
  const canvasWrap = el<HTMLElement>('canvasWrap');
  const canvas = el<HTMLCanvasElement>('canvas');
  const scrollPages = el<HTMLElement>('scrollPages');
  const status = el<HTMLElement>('status');
  const frame = el<HTMLElement>('frame');
  const mobileFallback = el<HTMLElement>('mobileFallback');
  const openNewTabBtn = el<HTMLButtonElement>('openNewTabBtn');
  const mobileOpenBtn = el<HTMLButtonElement>('mobileOpenBtn');

  const viewPageBtn = el<HTMLButtonElement>('viewPageBtn');
  const viewScrollBtn = el<HTMLButtonElement>('viewScrollBtn');
  const pageNavGroup = el<HTMLElement>('pageNavGroup');
  const prevBtn = el<HTMLButtonElement>('prevBtn');
  const nextBtn = el<HTMLButtonElement>('nextBtn');
  const pageInput = el<HTMLInputElement>('pageInput');
  const pageCountEl = el<HTMLElement>('pageCount');
  const zoomOutBtn = el<HTMLButtonElement>('zoomOutBtn');
  const zoomInBtn = el<HTMLButtonElement>('zoomInBtn');
  const zoomInput = el<HTMLInputElement>('zoomInput');
  const fitWidthBtn = el<HTMLButtonElement>('fitWidthBtn');
  const fitPageBtn = el<HTMLButtonElement>('fitPageBtn');
  const fullscreenBtn = el<HTMLButtonElement>('fullscreenBtn');
  const exitFullscreenBtn = el<HTMLButtonElement>('exitFullscreenBtn');

  let pdfDoc: PDFDocumentProxy | null = null;
  let currentPage = 1;
  let scale = 1;
  // 'custom' (not 'width') so the initial render is a literal 100% — a
  // deliberate, user-set zoom, not an auto-fit guess. Fit Width/Fit Page
  // are still one click away for anyone who wants that instead.
  let fitMode: 'width' | 'page' | 'custom' = 'custom';
  let rendering = false;
  /** A redraw asked for while one was already running — see redraw(). */
  let redrawQueued = false;
  let viewMode: 'page' | 'scroll' = 'scroll';
  let scrollPageObserver: IntersectionObserver | null = null;

  function reducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** The PDF title is admin-authored free text, and it gets written into the
   *  new tab's document as markup — escape it rather than trust it. */
  function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
  }

  function showError(message: string): void {
    status.textContent = message;
    mobileFallback.hidden = false;
    toolbar.hidden = true;
    canvasWrap.hidden = true;
  }

  // --- Page mode -----------------------------------------------------------

  /** Draws `currentPage` onto the single page-mode canvas. Only ever called through redraw(). */
  async function renderPage(num: number): Promise<void> {
    if (!pdfDoc) return;
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

      // Deliberately does NOT write `currentPage` back. redraw() always
      // renders whatever `currentPage` says, and goToPage() sets it (and
      // the page field) up front — so assigning it here, after an await,
      // could only ever overwrite a newer target chosen while this pass was
      // still drawing. That is exactly what used to make two quick clicks
      // on › land on page 2 instead of page 3: the second click set 3, the
      // first click's render finished and put it back to 2, and the queued
      // redraw then faithfully re-rendered 2. The page field is only
      // re-synced when nothing newer has arrived.
      if (currentPage === num) pageInput.value = String(num);
      zoomInput.value = String(Math.round(scale * 100));
    } catch {
      showError('Could not render this page.');
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
    if (!pdfDoc) return;
    try {
      const firstPage = await pdfDoc.getPage(1);
      const baseViewport = firstPage.getViewport({ scale: 1 });
      if (fitMode !== 'custom') {
        scale = Math.max((canvasWrap.clientWidth - 32) / baseViewport.width, 0.25);
      }
      // Captured once and reused for every page in this pass — rendering
      // 30+ pages takes real time, and reading the shared `scale` fresh per
      // page would let a zoom click that lands mid-render mix two scales
      // into a single, inconsistent pass. redraw()'s lock stops a second
      // pass starting concurrently; this stops the in-flight one drifting,
      // and the queued redraw afterwards picks up the newer scale.
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
    }
  }

  function scrollToPage(num: number, instant = false): void {
    const target = scrollPages.querySelector<HTMLElement>(`canvas[data-page-num="${num}"]`);
    target?.scrollIntoView({ block: 'start', behavior: instant || reducedMotion() ? 'auto' : 'smooth' });
    currentPage = num;
    pageInput.value = String(num);
  }

  // --- The single redraw path ----------------------------------------------

  /**
   * Redraws whichever mode is active from the current `scale`/`fitMode`/
   * `currentPage`. Every control goes through here: page nav, zoom, fit,
   * mode switch, resize, fullscreen.
   *
   * The rule that matters is what happens to a click that lands while a
   * pass is still running — and in a 30-page PDF in Scroll mode, that pass
   * takes seconds, so this is the common case, not the edge case. Each
   * render function used to hold the lock itself and simply `return` when
   * it was taken, which dropped the request on the floor *after* the
   * handler had already moved `scale`. The zoom field would sit at 120%
   * while the real scale was 144%, and the next click would jump straight
   * to 173% — a step and a half — with a whole click having visibly done
   * nothing in between. Requests are coalesced into one trailing redraw
   * instead: the in-flight pass finishes, then a single fresh pass runs
   * off the latest state, however many clicks arrived in the meantime.
   */
  async function redraw(): Promise<void> {
    if (rendering) {
      redrawQueued = true;
      return;
    }
    rendering = true;
    try {
      do {
        redrawQueued = false;
        if (viewMode === 'page') {
          await renderPage(currentPage);
        } else {
          const page = currentPage;
          await renderContinuous();
          scrollToPage(page, true);
        }
      } while (redrawQueued);
    } finally {
      rendering = false;
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
    } else {
      canvas.hidden = true;
      scrollPages.hidden = false;
      if (fitMode === 'page') fitMode = 'width';
    }
    await redraw();
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
      currentPage = 1;
      await redraw();
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

  function goToPage(num: number): void {
    if (!pdfDoc) return;
    const target = Math.min(Math.max(1, num), pdfDoc.numPages);
    // Scroll mode already has every page drawn — it only needs to move.
    if (viewMode !== 'page') {
      scrollToPage(target);
      return;
    }
    currentPage = target;
    pageInput.value = String(target);
    void redraw();
  }

  prevBtn.addEventListener('click', () => goToPage(currentPage - 1));
  nextBtn.addEventListener('click', () => goToPage(currentPage + 1));
  pageInput.addEventListener('change', () => goToPage(Number(pageInput.value) || 1));

  zoomInBtn.addEventListener('click', () => {
    fitMode = 'custom';
    scale = Math.min(scale * 1.2, 4);
    void redraw();
  });
  zoomOutBtn.addEventListener('click', () => {
    fitMode = 'custom';
    scale = Math.max(scale / 1.2, 0.25);
    void redraw();
  });
  zoomInput.addEventListener('change', () => {
    // Two cases that must not be conflated, and neither `|| 100` nor a bare
    // Number.isFinite() check separates them. A <input type="number"> hands
    // back "" for anything it can't parse, and `Number("")` is 0 — not NaN
    // — so an emptied field used to land on the 25 floor rather than the
    // 100 it was supposed to. The empty string is tested for on its own;
    // everything left is a real number, including a deliberately typed 0,
    // which does belong at the floor.
    const raw = zoomInput.value.trim();
    const parsed = raw === '' ? Number.NaN : Number(raw);
    const pct = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 100, 25), 400);
    zoomInput.value = String(pct);
    fitMode = 'custom';
    scale = pct / 100;
    void redraw();
  });
  zoomInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') zoomInput.blur();
  });
  fitWidthBtn.addEventListener('click', () => {
    fitMode = 'width';
    void redraw();
  });
  fitPageBtn.addEventListener('click', () => {
    fitMode = 'page';
    void redraw();
  });

  // --- Open in a new tab, without ever triggering a download ----------------

  /**
   * Opens the PDF in a new tab without ever triggering a download.
   *
   * Two things have to be right for that:
   *
   * 1. The blank tab is opened synchronously, *before* the `await` —
   *    opening it after the fetch resolves no longer counts as a direct
   *    result of the click and gets blocked as a popup. Note the missing
   *    `noopener`: `window.open()` returns **null** whenever `noopener` is
   *    passed, which is exactly what used to happen here — the handle was
   *    always null, so this fell through to a plain link to the Storage URL
   *    every single time, which is the download the user saw. `opener` is
   *    nulled manually right after instead, which gives the same isolation
   *    while keeping the handle we need to navigate the tab.
   *
   * 2. The tab is navigated to a small blob: HTML page that *embeds* the
   *    PDF, rather than to the PDF itself. Chrome's "Download PDFs instead
   *    of automatically opening them" setting — the other half of this bug,
   *    and the reason a plain link downloaded even though Storage serves
   *    the file as a perfectly ordinary `application/pdf` — only applies to
   *    a *top-level* navigation to a PDF. An <embed>ed one still renders
   *    inline, in the browser's own PDF viewer, toolbar and all.
   */
  async function openInNewTab(button: HTMLButtonElement): Promise<void> {
    const newTab = window.open('', '_blank');
    if (!newTab) return; // Popup blocked — nothing we can do without downloading instead.
    try {
      newTab.opener = null;
    } catch {
      /* Cross-origin-ish edge cases: isolation is nice-to-have, not worth failing over. */
    }
    button.disabled = true;
    try {
      if (newTab.document.body) newTab.document.body.textContent = 'Opening…';

      const res = await fetch(pdfUrl);
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
      // Force the type: a blob typed application/octet-stream (or with no
      // type at all) is a guaranteed download, whatever it's embedded in.
      const blobUrl = URL.createObjectURL(new Blob([await res.blob()], { type: 'application/pdf' }));
      // The tab lands on a tiny blob: HTML page that *embeds* the PDF
      // rather than navigating straight to it — see (2) above. The
      // fallback layer sits underneath at full size: a browser with no
      // inline PDF viewer at all (most mobile browsers) paints nothing for
      // the <embed> and the message shows through, instead of the blank
      // grey tab that an <embed> alone would leave behind.
      const pageUrl = URL.createObjectURL(
        new Blob(
          [
            '<!doctype html><meta charset="utf-8">',
            '<meta name="viewport" content="width=device-width,initial-scale=1">',
            `<title>${escapeHtml(title)}</title>`,
            '<style>html,body{margin:0;height:100%;background:#525659;color:#f4f2ec;',
            'font:16px/1.7 system-ui,-apple-system,sans-serif}',
            '.fallback{position:absolute;inset:0;display:flex;flex-direction:column;',
            'gap:4px;align-items:center;justify-content:center;text-align:center;padding:24px}',
            '.fallback a{color:inherit}',
            'embed{position:absolute;inset:0;width:100%;height:100%;border:0}</style>',
            `<div class="fallback"><p>${escapeHtml(title)}</p>`,
            `<p><a href="${blobUrl}" download="${escapeHtml(fileName)}">Download the PDF</a>`,
            ' — this browser has no built-in PDF viewer.</p></div>',
            `<embed src="${blobUrl}" type="application/pdf">`,
          ],
          { type: 'text/html' }
        )
      );
      // Deliberately never revoked: both URLs stay alive exactly as long as
      // this page does (the browser reclaims them with the document), so a
      // visitor can leave that tab open — and reload it — for as long as
      // they like. Revoking on a timer, or on the new tab's own `pagehide`,
      // would kill the URLs the moment this navigation replaces about:blank
      // and leave them staring at a blank frame.
      newTab.location.href = pageUrl;
    } catch {
      // Last resort. May download rather than preview, depending on the
      // visitor's browser settings — still better than a dead blank tab.
      newTab.location.href = pdfUrl;
    } finally {
      button.disabled = false;
    }
  }

  openNewTabBtn.addEventListener('click', () => void openInNewTab(openNewTabBtn));
  mobileOpenBtn.addEventListener('click', () => void openInNewTab(mobileOpenBtn));

  // --- Fullscreen ---------------------------------------------------------
  // The real Fullscreen API can fail even when document.fullscreenEnabled
  // reports true — an embedded or managed browser context whose Permissions
  // Policy doesn't delegate `fullscreen` refuses the request, sometimes by
  // rejecting ("Permissions check failed") and sometimes by swallowing it
  // whole (no fullscreenchange, no fullscreenerror, a promise that never
  // settles). "pseudoFullscreen" is a CSS-only stand-in, reusing the exact
  // same .pdf-fullscreen treatment, so the button always does something
  // visible whichever way the browser says no.
  //
  // A native request that is going to succeed does so within a frame or
  // two; anything still pending past this is one of the swallowed ones.
  const NATIVE_FULLSCREEN_TIMEOUT_MS = 400;
  let pseudoFullscreen = false;
  let pseudoFullscreenPlaceholder: Comment | null = null;
  let fullscreenDialog: HTMLDialogElement | null = null;

  /**
   * Pseudo-fullscreen only — the native path leaves the frame exactly where
   * it is (see the click handler for why moving it breaks that path).
   *
   * The CSS fallback is `position:fixed`, and `.pdf-viewer` carries
   * `.reveal`'s `will-change:transform`, which makes it the containing
   * block for fixed descendants — so the "fullscreen" frame would size
   * itself to the viewer, not the viewport. Moving it out to <body>
   * escapes that. A Certificate's viewer additionally sits inside an open
   * <dialog>, which lives in the browser's top layer and would float over
   * the frame, so that gets closed for the duration and reopened on exit.
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
    detachFrameForFullscreen();
    frame.classList.add('pdf-fullscreen');
    document.body.classList.add('pdf-pseudo-fullscreen-open');
    exitFullscreenBtn.hidden = false;
    exitFullscreenBtn.focus();
    if (fitMode !== 'custom') void redraw();
  }

  function exitPseudoFullscreen(): void {
    pseudoFullscreen = false;
    frame.classList.remove('pdf-fullscreen');
    document.body.classList.remove('pdf-pseudo-fullscreen-open');
    reattachFrame();
    exitFullscreenBtn.hidden = true;
    fullscreenBtn.focus();
    if (fitMode !== 'custom') void redraw();
  }

  fullscreenBtn.addEventListener('click', () => {
    if (pseudoFullscreen || document.fullscreenElement === frame) return;
    if (!document.fullscreenEnabled || !frame.requestFullscreen) {
      enterPseudoFullscreen();
      return;
    }

    // Two separate things used to sink this button, and both are handled
    // here rather than by `.catch()` alone:
    //
    // 1. The native request has to be made with the frame STILL IN PLACE.
    //    Moving it to <body> first (which this did unconditionally, before
    //    even trying) makes the request get dropped on the floor, and the
    //    click's only visible effect was the frame ending up orphaned at
    //    the end of <body> with the page layout collapsed around the hole
    //    it left. Only the CSS fallback needs that move, so only it moves.
    //
    // 2. Some embedded/managed browser contexts neither resolve nor reject
    //    the promise and never fire `fullscreenerror` — the request simply
    //    vanishes. `.catch()` can't rescue a promise that never settles, so
    //    the button sat there looking dead. A short timer decides instead:
    //    if we aren't actually in fullscreen shortly after asking, the CSS
    //    fallback takes over. (Should a swallowed request somehow land
    //    later anyway, `fullscreenchange` below stands the stand-in down.)
    let settled = false;
    const fallbackTimer = window.setTimeout(() => {
      if (!settled && !document.fullscreenElement) enterPseudoFullscreen();
    }, NATIVE_FULLSCREEN_TIMEOUT_MS);
    frame.requestFullscreen().then(
      () => {
        settled = true;
        window.clearTimeout(fallbackTimer);
      },
      () => {
        settled = true;
        window.clearTimeout(fallbackTimer);
        enterPseudoFullscreen();
      }
    );
  });
  exitFullscreenBtn.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (pseudoFullscreen) exitPseudoFullscreen();
  });
  document.addEventListener('fullscreenchange', () => {
    const isFullscreen = document.fullscreenElement === frame;
    if (isFullscreen && pseudoFullscreen) {
      // A request we'd given up on landed after the fallback timer fired.
      // Real fullscreen wins; the CSS stand-in stands down. The frame stays
      // where the stand-in moved it — exiting puts it back either way.
      pseudoFullscreen = false;
      document.body.classList.remove('pdf-pseudo-fullscreen-open');
    }
    frame.classList.toggle('pdf-fullscreen', isFullscreen);
    exitFullscreenBtn.hidden = !isFullscreen;
    if (isFullscreen) {
      exitFullscreenBtn.focus();
      if (fitMode !== 'custom') void redraw();
    } else if (!pseudoFullscreen) {
      // Native fullscreen just ended (Esc, browser chrome, etc.). The
      // native path never moves the frame, so this is a no-op unless the
      // late-landing case above inherited a move from the CSS stand-in.
      reattachFrame();
      fullscreenBtn.focus();
      if (fitMode !== 'custom') void redraw();
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
    if (pdfDoc && fitMode !== 'custom') void redraw();
  });
}
