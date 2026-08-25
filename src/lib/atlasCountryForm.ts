import type { AtlasCountryInput } from './supabaseAdmin';
import type { AtlasCountryStatus } from './atlasTypes';

export interface AtlasCountryFormValues {
  name: string;
  map_id: string;
  country_code: string;
  short_description: string;
  heading: string;
  research_content: string;
  featured_image_url: string;
  display_order: string;
  is_featured: boolean;
}

export function readAtlasCountryForm(): AtlasCountryFormValues {
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  const checked = (id: string) => (document.getElementById(id) as HTMLInputElement).checked;
  return {
    name: val('fName').trim(),
    map_id: val('fMapId'),
    country_code: val('fCountryCode').trim().toUpperCase(),
    short_description: val('fShortDescription').trim(),
    heading: val('fHeading').trim(),
    research_content: val('fResearchContent').trim(),
    featured_image_url: val('fFeaturedImage').trim(),
    display_order: val('fDisplayOrder').trim(),
    is_featured: checked('fIsFeatured'),
  };
}

export function writeAtlasCountryForm(values: {
  name: string;
  map_id: string | null;
  country_code: string | null;
  short_description: string | null;
  heading: string;
  research_content: string | null;
  featured_image_url: string | null;
  display_order: number;
  is_featured: boolean;
}): void {
  const set = (id: string, v: string | undefined | null) => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (el && v !== undefined && v !== null) el.value = v;
  };
  set('fName', values.name);
  set('fMapId', values.map_id ?? '');
  set('fCountryCode', values.country_code ?? '');
  set('fShortDescription', values.short_description ?? '');
  set('fHeading', values.heading);
  set('fResearchContent', values.research_content ?? '');
  set('fFeaturedImage', values.featured_image_url ?? '');
  set('fDisplayOrder', String(values.display_order));
  const featuredEl = document.getElementById('fIsFeatured') as HTMLInputElement | null;
  if (featuredEl) featuredEl.checked = values.is_featured;
}

export function validateAtlasCountryForm(values: AtlasCountryFormValues, targetStatus: AtlasCountryStatus): string | null {
  if (!values.name) return 'Country Name is required.';
  if (!values.heading) return '"Why This Country Matters" is required.';
  if (values.country_code && !/^[A-Z]{2}$/.test(values.country_code)) return 'Country Code must be exactly 2 letters (e.g. FR).';
  if (targetStatus === 'published' && !values.map_id) return 'Map Identifier is required before a country can be published.';
  return null;
}

export function toAtlasCountryInput(values: AtlasCountryFormValues): AtlasCountryInput {
  return {
    name: values.name,
    map_id: values.map_id || null,
    country_code: values.country_code || null,
    short_description: values.short_description || null,
    heading: values.heading,
    research_content: values.research_content || null,
    featured_image_url: values.featured_image_url || null,
    display_order: Number(values.display_order) || 0,
    is_featured: values.is_featured,
  };
}
