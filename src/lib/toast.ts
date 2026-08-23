/** Small reusable admin notification, replacing scattered inline notice/error paragraphs. Lazily creates one fixed-position container per page. */
let container: HTMLElement | null = null;

function getContainer(): HTMLElement {
  if (container && document.body.contains(container)) return container;
  container = document.createElement('div');
  container.id = 'adminToastStack';
  container.setAttribute('role', 'status');
  container.setAttribute('aria-live', 'polite');
  document.body.appendChild(container);
  return container;
}

export function showToast(message: string, variant: 'success' | 'error' = 'success'): void {
  const stack = getContainer();
  const toast = document.createElement('div');
  toast.className = `admin-toast admin-toast-${variant}`;
  toast.textContent = message;
  stack.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add('admin-toast-out');
    window.setTimeout(() => toast.remove(), 250);
  }, 4000);
}
