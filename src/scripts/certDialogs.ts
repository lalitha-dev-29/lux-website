/**
 * Wires the per-certificate lightbox <dialog> rendered by
 * LearningCertCard.astro — click a card's thumbnail or "View Certificate" to
 * open it, click the close button/backdrop, or press Escape (native
 * <dialog> behavior) to dismiss.
 */
export function initCertDialogs(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-open-dialog]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const dialog = document.getElementById(trigger.dataset.openDialog!) as HTMLDialogElement | null;
      dialog?.showModal();
    });
  });

  document.querySelectorAll<HTMLDialogElement>('.cert-dialog').forEach((dialog) => {
    dialog.querySelector('[data-close-dialog]')?.addEventListener('click', () => dialog.close());
    // A click that lands on the <dialog> element itself (not a descendant)
    // is a click on the backdrop area within its own box — close on that,
    // same convention as most native-<dialog> lightboxes.
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
  });
}
