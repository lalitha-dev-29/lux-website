import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import { withBase } from './url';
import type { JournalPost, JournalStatus } from './journalTypes';

/**
 * Admin-only Supabase client. This module (and the @supabase/supabase-js
 * dependency it pulls in) is only ever imported by pages under /admin/, so it
 * never reaches the public site's bundle.
 *
 * Every read/write here still goes through Postgres Row Level Security
 * (supabase/schema.sql) — the `is_admin()` checks in this file are a client
 * UX convenience (redirect non-admins away, show the right buttons) and are
 * NOT the security boundary. A tampered client that skips these checks still
 * gets a 401/403 from Supabase on the actual insert/update/delete.
 */

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY (see .env.example).'
    );
  }
  client = createClient(url, anonKey);
  return client;
}

export async function signInAdmin(email: string, password: string): Promise<Session> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(error?.message || 'Sign in failed.');
  }
  const admin = await isCurrentUserAdmin();
  if (!admin) {
    await supabase.auth.signOut();
    throw new Error('This account does not have admin access.');
  }
  return data.session;
}

export async function signOutAdmin(): Promise<void> {
  await getSupabaseClient().auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session;
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;
  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  return !error && !!data;
}

/**
 * Client-side route guard for every /admin/* page (except /admin/login).
 * Redirects non-authenticated or non-admin visitors to the login page.
 * Real authorization is enforced by RLS regardless of whether this runs.
 */
export async function requireAdminOrRedirect(): Promise<Session | null> {
  const session = await getSession();
  if (!session || !(await isCurrentUserAdmin())) {
    window.location.href = withBase('/admin/login/');
    return null;
  }
  return session;
}

export interface JournalPostInput {
  title: string;
  slug: string;
  excerpt: string;
  content: string | null;
  external_url: string | null;
  category: string | null;
  tags: string[];
  cover_image: string | null;
}

export async function listAllJournalPosts(): Promise<JournalPost[]> {
  const { data, error } = await getSupabaseClient()
    .from('journal_posts')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as JournalPost[];
}

export async function getJournalPostById(id: string): Promise<JournalPost | null> {
  const { data, error } = await getSupabaseClient().from('journal_posts').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as JournalPost | null;
}

export async function createJournalPost(
  input: JournalPostInput,
  status: JournalStatus
): Promise<JournalPost> {
  const { data, error } = await getSupabaseClient()
    .from('journal_posts')
    .insert({
      ...input,
      status,
      published_at: status === 'published' ? new Date().toISOString() : null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as JournalPost;
}

export async function updateJournalPost(
  id: string,
  input: JournalPostInput
): Promise<JournalPost> {
  const { data, error } = await getSupabaseClient()
    .from('journal_posts')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as JournalPost;
}

export async function setJournalPostStatus(id: string, status: JournalStatus): Promise<JournalPost> {
  const { data, error } = await getSupabaseClient()
    .from('journal_posts')
    .update({
      status,
      published_at: status === 'published' ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as JournalPost;
}

export async function deleteJournalPost(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('journal_posts').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
