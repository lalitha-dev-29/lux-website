import type { GuestLectureInput } from './supabaseAdmin';

export interface GuestLectureFormValues {
  title: string;
  speaker: string;
  organisation: string;
  lecture_date: string;
  key_learnings: string;
}

const FIELD_IDS = {
  title: 'fTitle',
  speaker: 'fSpeaker',
  organisation: 'fOrganisation',
  lecture_date: 'fLectureDate',
  key_learnings: 'fKeyLearnings',
} as const;

export function readGuestLectureForm(): GuestLectureFormValues {
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement).value.trim();
  return {
    title: val(FIELD_IDS.title),
    speaker: val(FIELD_IDS.speaker),
    organisation: val(FIELD_IDS.organisation),
    lecture_date: val(FIELD_IDS.lecture_date),
    key_learnings: val(FIELD_IDS.key_learnings),
  };
}

export function writeGuestLectureForm(values: {
  title: string;
  speaker: string;
  organisation: string | null;
  lecture_date: string;
  key_learnings: string;
}): void {
  const set = (id: string, v: string) => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    if (el) el.value = v;
  };
  set(FIELD_IDS.title, values.title);
  set(FIELD_IDS.speaker, values.speaker);
  set(FIELD_IDS.organisation, values.organisation ?? '');
  set(FIELD_IDS.lecture_date, values.lecture_date);
  set(FIELD_IDS.key_learnings, values.key_learnings);
}

export function validateGuestLectureForm(values: GuestLectureFormValues): string | null {
  if (!values.title) return 'Lecture title is required.';
  if (!values.speaker) return 'Speaker is required.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.lecture_date)) return 'Lecture date is required.';
  if (!values.key_learnings) return 'Key learnings are required.';
  return null;
}

export function toGuestLectureInput(values: GuestLectureFormValues): GuestLectureInput {
  return {
    title: values.title,
    speaker: values.speaker,
    organisation: values.organisation || null,
    lecture_date: values.lecture_date,
    key_learnings: values.key_learnings,
  };
}
