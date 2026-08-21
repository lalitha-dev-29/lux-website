/* ============ THEME TOGGLE ============
   The blocking inline script in <head> already applied any stored choice
   before paint (avoiding a flash) — this just wires up the button and
   keeps everything in sync from here on: persisting new choices, updating
   the toggle's label/pressed state, and reacting live if the OS theme
   changes while no explicit choice has been made yet. */
const THEME_KEY = 'lmk-theme';
const themeToggle = document.getElementById('themeToggle') as HTMLButtonElement | null;
const darkSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

function effectiveTheme(): 'light' | 'dark' {
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return darkSchemeQuery.matches ? 'dark' : 'light';
}

function updateThemeToggleLabel() {
  if (!themeToggle) return;
  const isDark = effectiveTheme() === 'dark';
  themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  themeToggle.setAttribute('aria-pressed', String(isDark));
}

function updateMetaThemeColor() {
  const isDark = effectiveTheme() === 'dark';
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute('content', isDark ? '#17140D' : '#F7F4EC'));
}

if (themeToggle) {
  updateThemeToggleLabel();

  themeToggle.addEventListener('click', () => {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    const html = document.documentElement;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!prefersReducedMotion) html.classList.add('theme-transition');
    html.setAttribute('data-theme', next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* localStorage unavailable — theme still applies, just won't persist */
    }

    updateThemeToggleLabel();
    updateMetaThemeColor();

    if (!prefersReducedMotion) {
      window.setTimeout(() => html.classList.remove('theme-transition'), 260);
    }
  });

  // No explicit choice yet: if the OS theme changes (e.g. sunset auto-switch),
  // follow it live — but never override a choice the visitor already made.
  darkSchemeQuery.addEventListener('change', () => {
    if (!document.documentElement.getAttribute('data-theme')) {
      updateThemeToggleLabel();
      updateMetaThemeColor();
    }
  });
}

/* ============ NAV SCROLL STATE ============ */
const siteNav = document.getElementById('siteNav');
if (siteNav) {
  const setScrolled = () => siteNav.classList.toggle('scrolled', window.scrollY > 16);
  setScrolled();
  window.addEventListener('scroll', setScrolled, { passive: true });
}

/* ============ MOBILE NAV DRAWER ============
   Below 880px the nav is an off-canvas drawer. While it's open we lock body
   scroll, trap Tab inside it, close on Escape, and return focus to the
   toggle — so keyboard and screen-reader users aren't stranded behind it. */
const navToggle = document.getElementById('navToggle') as HTMLButtonElement | null;
const primaryLinks = document.getElementById('primaryLinks');

if (navToggle && primaryLinks) {
  const isDrawer = () => window.matchMedia('(max-width: 879.98px)').matches;

  function setNavOpen(open: boolean) {
    primaryLinks!.classList.toggle('open', open);
    navToggle!.setAttribute('aria-expanded', String(open));
    navToggle!.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('nav-open', open);
    if (open) {
      // Flush styles so `.open`'s `visibility:visible` is applied before we move
      // focus — focus() is a no-op inside a `visibility:hidden` subtree.
      void primaryLinks!.offsetHeight;
      primaryLinks!.querySelector('a')?.focus();
    }
  }

  navToggle.addEventListener('click', () => {
    setNavOpen(navToggle.getAttribute('aria-expanded') !== 'true');
  });

  // Any link tap closes the drawer (same-page anchors would otherwise leave it open).
  primaryLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      if (isDrawer()) setNavOpen(false);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (!isDrawer() || navToggle.getAttribute('aria-expanded') !== 'true') return;

    if (e.key === 'Escape') {
      setNavOpen(false);
      navToggle.focus();
      return;
    }

    if (e.key === 'Tab') {
      const focusables = [navToggle, ...Array.from(primaryLinks.querySelectorAll('a'))];
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        (last as HTMLElement).focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        (first as HTMLElement).focus();
      }
    }
  });

  // Leaving the drawer breakpoint should never strand the page in a locked state.
  window.matchMedia('(max-width: 879.98px)').addEventListener('change', (e) => {
    if (!e.matches) setNavOpen(false);
  });
}

/* ============ BACKGROUND PARALLAX ============
   The motif layers in SiteMotifs.astro that carry `data-parallax` read a
   `--motif-scroll` custom property (see global.css) as an independent
   `translate`, each at its own speed via its own --parallax-speed. So the
   only job here is keeping that one property in sync with scroll position,
   throttled to one write per animation frame. Gated behind `.js-anim` (JS
   running + not prefers-reduced-motion, set synchronously in <head>) so a
   reduced-motion visitor never gets the scroll listener attached at all —
   the CSS rule that reads --motif-scroll is scoped under .js-anim too, so
   even a stray write here would be a no-op for them regardless. */
if (document.documentElement.classList.contains('js-anim')) {
  const root = document.documentElement;
  let ticking = false;

  function updateMotifScroll() {
    root.style.setProperty('--motif-scroll', `${window.scrollY}px`);
    ticking = false;
  }

  updateMotifScroll();
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateMotifScroll);
    },
    { passive: true }
  );
}

/* ============ SCROLL REVEAL ============
   Only runs when the inline head script opted in via `.js-anim`. Content is
   visible by default, so every failure path here degrades to "just shown". */
function revealAll() {
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
}

function initReveal() {
  if (!document.documentElement.classList.contains('js-anim')) return;

  try {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -48px 0px' }
    );

    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

    // Safety net: anything still hidden after 2s that's near the viewport gets shown.
    window.setTimeout(() => {
      document.querySelectorAll('.reveal:not(.in)').forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight * 1.5) el.classList.add('in');
      });
    }, 2000);
  } catch {
    revealAll();
  }
}

initReveal();
