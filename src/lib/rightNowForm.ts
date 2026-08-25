import type { RightNowInput } from './supabaseAdmin';

export interface RightNowFormValues {
  title: string;
  body: string;
  order_index: string;
}

export function readRightNowForm(): RightNowFormValues {
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement).value;
  return {
    title: val('fTitle').trim(),
    body: val('fBody').trim(),
    order_index: val('fOrderIndex').trim(),
  };
}

export function writeRightNowForm(values: { title: string; body: string; order_index: number }): void {
  const set = (id: string, v: string) => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    if (el) el.value = v;
  };
  set('fTitle', values.title);
  set('fBody', values.body);
  set('fOrderIndex', String(values.order_index));
}

export function validateRightNowForm(values: RightNowFormValues): string | null {
  if (!values.title) return 'Title is required.';
  if (!values.body) return 'Description is required.';
  return null;
}

export function toRightNowInput(values: RightNowFormValues, fallbackOrder: number): RightNowInput {
  return {
    title: values.title,
    body: values.body,
    order_index: values.order_index ? Number(values.order_index) : fallbackOrder,
  };
}
