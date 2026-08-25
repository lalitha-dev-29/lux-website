import type { CertificationInput } from './supabaseAdmin';

export interface CertificationFormValues {
  name: string;
  issuer_portal: string;
  issuing_institution: string;
  cert_month: string;
  cert_year: string;
  credential_id: string;
  certificate_link: string;
  order_index: string;
}

const CREDENTIAL_ID_PATTERN = /^[A-Za-z0-9._ -]+$/;

export function readCertificationForm(): CertificationFormValues {
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLSelectElement).value;
  return {
    name: val('fCertName').trim(),
    issuer_portal: val('fIssuerPortal').trim(),
    issuing_institution: val('fIssuingInstitution').trim(),
    cert_month: val('fCertMonth'),
    cert_year: val('fCertYear').trim(),
    credential_id: val('fCredentialId').trim(),
    certificate_link: val('fCertificateLink').trim(),
    order_index: val('fOrderIndex').trim(),
  };
}

export function writeCertificationForm(values: {
  name: string;
  issuer_portal: string | null;
  issuing_institution: string;
  cert_month: number;
  cert_year: number;
  credential_id: string;
  certificate_link: string;
  order_index: number;
}): void {
  const set = (id: string, v: string) => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
    if (el) el.value = v;
  };
  set('fCertName', values.name);
  set('fIssuerPortal', values.issuer_portal ?? '');
  set('fIssuingInstitution', values.issuing_institution);
  set('fCertMonth', String(values.cert_month));
  set('fCertYear', String(values.cert_year));
  set('fCredentialId', values.credential_id);
  set('fCertificateLink', values.certificate_link);
  set('fOrderIndex', String(values.order_index));
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateCertificationForm(values: CertificationFormValues): string | null {
  if (!values.name) return 'Certificate Name is required.';
  if (!values.issuing_institution) return 'Certificate Issuing Institution is required.';
  if (!values.cert_month || !values.cert_year) return 'Certification Date (month and year) is required.';
  if (!/^\d{4}$/.test(values.cert_year)) return 'Certification Date year must be a 4-digit year.';
  if (!values.credential_id) return 'Credential ID is required.';
  if (!CREDENTIAL_ID_PATTERN.test(values.credential_id)) {
    return 'Credential ID may only contain letters, numbers, spaces, hyphens, underscores and periods.';
  }
  if (!values.certificate_link) return 'Certificate Link is required.';
  if (!isValidHttpUrl(values.certificate_link)) return 'Please enter a valid certificate link (starting with https:// or http://).';
  return null;
}

export function toCertificationMetadata(
  values: CertificationFormValues,
  fallbackOrder: number
): Omit<CertificationInput, 'file_url' | 'file_type' | 'file_name'> {
  return {
    name: values.name,
    issuer_portal: values.issuer_portal || null,
    issuing_institution: values.issuing_institution,
    cert_month: Number(values.cert_month),
    cert_year: Number(values.cert_year),
    credential_id: values.credential_id,
    certificate_link: values.certificate_link,
    order_index: values.order_index ? Number(values.order_index) : fallbackOrder,
  };
}
