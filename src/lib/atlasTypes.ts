export type AtlasCountryStatus = 'draft' | 'published' | 'unpublished';
export type AtlasBrandStatus = 'draft' | 'published';

export interface AtlasCategory {
  id: string;
  name: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface AtlasCountry {
  id: string;
  name: string;
  map_id: string | null;
  country_code: string | null;
  short_description: string | null;
  heading: string;
  research_content: string | null;
  featured_image_url: string | null;
  status: AtlasCountryStatus;
  is_featured: boolean;
  display_order: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AtlasBrand {
  id: string;
  country_id: string;
  category_id: string | null;
  name: string;
  founded_year: number | null;
  founder: string | null;
  description: string | null;
  positioning: string | null;
  website_url: string | null;
  instagram_url: string | null;
  logo_url: string | null;
  image_url: string | null;
  research_notes: string | null;
  status: AtlasBrandStatus;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/** Fields the public site is allowed to render — never expose more than this to anon requests. */
export const PUBLIC_ATLAS_COUNTRY_FIELDS =
  'id,name,map_id,country_code,short_description,heading,research_content,featured_image_url,status,is_featured,display_order,published_at' as const;

export const PUBLIC_ATLAS_BRAND_FIELDS =
  'id,country_id,category_id,name,founded_year,founder,description,positioning,website_url,instagram_url,logo_url,image_url,status,display_order' as const;

export const PUBLIC_ATLAS_CATEGORY_FIELDS = 'id,name,display_order' as const;
