import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';

const authUrl = (import.meta.env.VITE_NEON_AUTH_URL as string | undefined)?.trim() ?? '';
const dataApiUrl = (import.meta.env.VITE_NEON_DATA_API_URL as string | undefined)?.trim() ?? '';

/** True when both env vars are present, i.e. this build talks to Neon. */
export const isCloudConfigured = authUrl.length > 0 && dataApiUrl.length > 0;

/**
 * The database + auth client, or null when the build has no Neon credentials.
 *
 * In development without credentials the app falls back to storing everything
 * in this browser (see data/store.ts) so the UI still runs. A production build
 * without credentials shows a "not configured" notice instead of silently
 * keeping people's data in one browser.
 */
export const neon = isCloudConfigured
  ? createClient({
      auth: {
        url: authUrl,
        adapter: SupabaseAuthAdapter(),
      },
      dataApi: {
        url: dataApiUrl,
      },
    })
  : null;

/** True when the app runs on the real database. */
export const isCloudBuild = neon !== null;
