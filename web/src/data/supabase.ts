import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

/** True when both env vars are present, i.e. this build talks to Supabase. */
export const isCloudConfigured = url.length > 0 && anonKey.length > 0;

/**
 * The database client, or null when the build has no Supabase credentials.
 *
 * In development without credentials the app falls back to storing everything
 * in this browser (see data/store.ts) so the UI still runs. A production build
 * without credentials shows a "not configured" notice instead of silently
 * keeping people's data in one browser.
 */
export const supabase: SupabaseClient | null = isCloudConfigured
  ? createClient(url, anonKey, {
      auth: {
        // PKCE keeps auth codes out of the URL hash, which is what makes the
        // email confirmation and password recovery links work with a router.
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** True when the app runs on the real database. */
export const isCloudBuild = supabase !== null;
