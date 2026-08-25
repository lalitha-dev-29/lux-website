import type { AtlasCategoryInput } from './supabaseAdmin';

export interface AtlasCategoryFormValues {
  name: string;
  display_order: string;
}

export function readAtlasCategoryForm(): AtlasCategoryFormValues {
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement).value;
  return {
    name: val('fName').trim(),
    display_order: val('fDisplayOrder').trim(),
  };
}

export function writeAtlasCategoryForm(values: { name: string; display_order: number }): void {
  const set = (id: string, v: string) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.value = v;
  };
  set('fName', values.name);
  set('fDisplayOrder', String(values.display_order));
}

export function validateAtlasCategoryForm(values: AtlasCategoryFormValues): string | null {
  if (!values.name) return 'Category Name is required.';
  return null;
}

export function toAtlasCategoryInput(values: AtlasCategoryFormValues): AtlasCategoryInput {
  return {
    name: values.name,
    display_order: Number(values.display_order) || 0,
  };
}
