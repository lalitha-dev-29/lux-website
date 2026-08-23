import type { ContentLink, LinkPlatform } from './contentLinks';

/** Wires the "+ Add Link" button inside a <LinksEditor id={rootId} /> instance. Call once per form on page load. */
export function initLinksEditor(rootId: string): void {
  const root = document.getElementById(rootId);
  const addBtn = root?.querySelector<HTMLButtonElement>('.add-link-btn');
  addBtn?.addEventListener('click', () => addLinkRow(rootId));
}

export function addLinkRow(rootId: string, link?: ContentLink): void {
  const root = document.getElementById(rootId);
  const rows = root?.querySelector<HTMLElement>('.link-rows');
  const template = root?.querySelector<HTMLTemplateElement>('template');
  if (!rows || !template) return;

  const node = (template.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
  const select = node.querySelector<HTMLSelectElement>('.link-platform')!;
  const urlInput = node.querySelector<HTMLInputElement>('.link-url')!;
  const labelInput = node.querySelector<HTMLInputElement>('.link-label')!;
  const removeBtn = node.querySelector<HTMLButtonElement>('.link-remove')!;

  if (link) {
    select.value = link.platform;
    urlInput.value = link.url;
    labelInput.value = link.label ?? '';
  }
  labelInput.hidden = select.value !== 'other';
  select.addEventListener('change', () => {
    labelInput.hidden = select.value !== 'other';
  });
  removeBtn.addEventListener('click', () => node.remove());

  rows.appendChild(node);
}

export function readLinks(rootId: string): ContentLink[] {
  const root = document.getElementById(rootId);
  if (!root) return [];
  const links: ContentLink[] = [];
  root.querySelectorAll<HTMLElement>('.link-rows .link-row').forEach((row) => {
    const platform = row.querySelector<HTMLSelectElement>('.link-platform')!.value as LinkPlatform;
    const url = row.querySelector<HTMLInputElement>('.link-url')!.value.trim();
    const label = row.querySelector<HTMLInputElement>('.link-label')!.value.trim();
    if (!url) return;
    links.push(platform === 'other' && label ? { platform, url, label } : { platform, url });
  });
  return links;
}

export function writeLinks(rootId: string, links: ContentLink[]): void {
  const root = document.getElementById(rootId);
  const rows = root?.querySelector<HTMLElement>('.link-rows');
  if (rows) rows.innerHTML = '';
  links.forEach((link) => addLinkRow(rootId, link));
}
