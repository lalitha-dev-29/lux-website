import type { AtlasBrandInput } from './supabaseAdmin';

export interface AtlasBrandFormValues {
  country_id: string;
  category_id: string;
  name: string;
  founded_year: string;
  founder: string;
  positioning: string;
  website_url: string;
  research_notes: string;
  display_order: string;
}

export function readAtlasBrandForm(): AtlasBrandFormValues {
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  return {
    country_id: val('fCountry'),
    category_id: val('fCategory'),
    name: val('fName').trim(),
    founded_year: val('fFoundedYear').trim(),
    founder: val('fFounder').trim(),
    positioning: val('fPositioning').trim(),
    website_url: val('fWebsiteUrl').trim(),
    research_notes: val('fResearchNotes').trim(),
    display_order: val('fDisplayOrder').trim(),
  };
}

export function writeAtlasBrandForm(values: {
  country_id: string;
  category_id: string | null;
  name: string;
  founded_year: number | null;
  founder: string | null;
  positioning: string | null;
  website_url: string | null;
  research_notes: string | null;
  display_order: number;
}): void {
  const set = (id: string, v: string | undefined | null) => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (el && v !== undefined && v !== null) el.value = v;
  };
  set('fCountry', values.country_id);
  set('fCategory', values.category_id ?? '');
  set('fName', values.name);
  set('fFoundedYear', values.founded_year !== null ? String(values.founded_year) : '');
  set('fFounder', values.founder ?? '');
  set('fPositioning', values.positioning ?? '');
  set('fWebsiteUrl', values.website_url ?? '');
  set('fResearchNotes', values.research_notes ?? '');
  set('fDisplayOrder', String(values.display_order));
}

export function validateAtlasBrandForm(values: AtlasBrandFormValues): string | null {
  if (!values.name) return 'Brand Name is required.';
  if (!values.country_id) return 'Country is required.';
  if (values.founded_year && !/^\d{3,4}$/.test(values.founded_year)) return 'Founded Year must be a valid year.';
  return null;
}

export function toAtlasBrandInput(values: AtlasBrandFormValues): AtlasBrandInput {
  return {
    country_id: values.country_id,
    category_id: values.category_id || null,
    name: values.name,
    founded_year: values.founded_year ? Number(values.founded_year) : null,
    founder: values.founder || null,
    positioning: values.positioning || null,
    website_url: values.website_url || null,
    research_notes: values.research_notes || null,
    display_order: Number(values.display_order) || 0,
  };
}
