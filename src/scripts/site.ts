/* ============ NAV SCROLL STATE ============ */
const siteNav = document.getElementById('siteNav');
if (siteNav) {
  window.addEventListener('scroll', () => {
    siteNav.classList.toggle('scrolled', window.scrollY > 20);
  });
  siteNav.classList.toggle('scrolled', window.scrollY > 20);
}

/* ============ MOBILE NAV ============ */
const navToggle = document.getElementById('navToggle');
const primaryLinks = document.getElementById('primaryLinks');
if (navToggle && primaryLinks) {
  navToggle.addEventListener('click', () => {
    const open = primaryLinks.classList.toggle('open');
    navToggle.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
  });
  primaryLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      primaryLinks.classList.remove('open');
      navToggle.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ============ SCROLL REVEAL ============ */
function showAllReveals() {
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
}

function observeReveals() {
  /* If IntersectionObserver is unavailable (older browsers) or anything goes wrong,
     reveal everything immediately. Content must never stay stuck at opacity:0. */
  if (typeof IntersectionObserver === 'undefined') {
    showAllReveals();
    return;
  }
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
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
    );
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    /* Safety net: if anything is still hidden after 2.5s, show it. */
    setTimeout(() => {
      document.querySelectorAll('.reveal:not(.in)').forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('in');
      });
    }, 2500);
  } catch {
    showAllReveals();
  }
}

observeReveals();
