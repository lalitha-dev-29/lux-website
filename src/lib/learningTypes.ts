/** Shared types + formatting helpers for the Learning CMS (Overview, Right Now, Education, Certifications). */

export interface LearningOverview {
  heading: string;
  description: string;
  updated_at: string;
}

export const PUBLIC_LEARNING_OVERVIEW_FIELDS = 'heading,description,updated_at' as const;

export interface LearningRightNowItem {
  id: string;
  title: string;
  body: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export const PUBLIC_RIGHT_NOW_FIELDS = 'id,title,body,order_index' as const;

export interface LearningEducationItem {
  id: string;
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
  created_at: string;
  updated_at: string;
}

export const PUBLIC_EDUCATION_FIELDS =
  'id,institution,programme,description,location,start_month,start_year,end_month,end_year,is_current,order_index' as const;

export type CertFileType = 'image' | 'pdf';

export interface LearningCertification {
  id: string;
  name: string;
  issuer_portal: string | null;
  issuing_institution: string;
  cert_month: number;
  cert_year: number;
  file_url: string;
  file_type: CertFileType;
  file_name: string | null;
  credential_id: string;
  certificate_link: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export const PUBLIC_CERTIFICATION_FIELDS =
  'id,name,issuer_portal,issuing_institution,cert_month,cert_year,file_url,file_type,file_name,credential_id,certificate_link,order_index' as const;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? '';
}

/**
 * Reproduces the original hardcoded "Location, Year" display (see the
 * `education` array formerly in src/pages/learning.astro) from whatever
 * subset of location/date fields an entry actually has — the public page
 * keeps its exact visual output regardless of how loosely or precisely an
 * entry's dates are filled in.
 */
export function formatEducationPeriod(entry: {
  location: string | null;
  start_year: number | null;
  end_year: number | null;
  is_current: boolean;
}): string {
  const yearPart = entry.end_year
    ? String(entry.end_year)
    : entry.is_current
      ? 'Present'
      : entry.start_year
        ? String(entry.start_year)
        : '';
  if (entry.location && yearPart) return `${entry.location}, ${yearPart}`;
  return entry.location || yearPart;
}

/** "August 2026" — the display format the Certifications spec calls for. */
export function formatCertDate(entry: { cert_month: number; cert_year: number }): string {
  return `${monthName(entry.cert_month)} ${entry.cert_year}`;
}
