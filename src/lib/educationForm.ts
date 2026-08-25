import type { EducationInput } from './supabaseAdmin';

export interface EducationFormValues {
  institution: string;
  programme: string;
  description: string;
  location: string;
  start_month: string;
  start_year: string;
  end_month: string;
  end_year: string;
  is_current: boolean;
  order_index: string;
}

export function readEducationForm(): EducationFormValues {
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  const checked = (id: string) => (document.getElementById(id) as HTMLInputElement).checked;
  return {
    institution: val('fInstitution').trim(),
    programme: val('fProgramme').trim(),
    description: val('fDescription').trim(),
    location: val('fLocation').trim(),
    start_month: val('fStartMonth'),
    start_year: val('fStartYear').trim(),
    end_month: val('fEndMonth'),
    end_year: val('fEndYear').trim(),
    is_current: checked('fIsCurrent'),
    order_index: val('fOrderIndex').trim(),
  };
}

export function writeEducationForm(values: {
  institution: string;
  programme: string;
  description: string;
  location: string | null;
  start_month: number | null;
  start_year: number | null;
  end_month: number | null;
  end_year: number | null;
  is_current: boolean;
  order_index: number;
}): void {
  const set = (id: string, v: string) => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (el) el.value = v;
  };
  set('fInstitution', values.institution);
  set('fProgramme', values.programme);
  set('fDescription', values.description);
  set('fLocation', values.location ?? '');
  set('fStartMonth', values.start_month ? String(values.start_month) : '');
  set('fStartYear', values.start_year ? String(values.start_year) : '');
  set('fEndMonth', values.end_month ? String(values.end_month) : '');
  set('fEndYear', values.end_year ? String(values.end_year) : '');
  set('fOrderIndex', String(values.order_index));
  const currentEl = document.getElementById('fIsCurrent') as HTMLInputElement | null;
  if (currentEl) currentEl.checked = values.is_current;
  toggleEndDateDisabled(values.is_current);
}

/** "Present" disables the End Date pickers rather than letting them hold a stale value. Called on load and on the checkbox's own change event. */
export function toggleEndDateDisabled(isCurrent: boolean): void {
  const endMonth = document.getElementById('fEndMonth') as HTMLSelectElement | null;
  const endYear = document.getElementById('fEndYear') as HTMLInputElement | null;
  if (endMonth) endMonth.disabled = isCurrent;
  if (endYear) endYear.disabled = isCurrent;
  if (isCurrent) {
    if (endMonth) endMonth.value = '';
    if (endYear) endYear.value = '';
  }
}

export function validateEducationForm(values: EducationFormValues): string | null {
  if (!values.institution) return 'Institution is required.';
  if (!values.programme) return 'Degree / Programme is required.';
  if (!values.description) return 'Description is required.';
  if (values.start_year && !/^\d{4}$/.test(values.start_year)) return 'Start Year must be a 4-digit year.';
  if (values.end_year && !/^\d{4}$/.test(values.end_year)) return 'End Year must be a 4-digit year.';
  return null;
}

export function toEducationInput(values: EducationFormValues, fallbackOrder: number): EducationInput {
  return {
    institution: values.institution,
    programme: values.programme,
    description: values.description,
    location: values.location || null,
    start_month: values.start_month ? Number(values.start_month) : null,
    start_year: values.start_year ? Number(values.start_year) : null,
    end_month: values.is_current || !values.end_month ? null : Number(values.end_month),
    end_year: values.is_current || !values.end_year ? null : Number(values.end_year),
    is_current: values.is_current,
    order_index: values.order_index ? Number(values.order_index) : fallbackOrder,
  };
}
