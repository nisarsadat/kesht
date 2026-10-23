
import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';

const authUrl =
  (import.meta.env.VITE_NEON_AUTH_URL as string | undefined)?.trim() ?? '';

const dataApiUrl =
  (import.meta.env.VITE_NEON_DATA_API_URL as string | undefined)?.trim() ?? '';

/** True when both environment variables are present. */
export const isCloudConfigured =
  authUrl.length > 0 && dataApiUrl.length > 0;

/**
 * Neon client.
 * Without credentials, the application falls back to local development mode.
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

/** True when the app runs against Neon. */
export const isCloudBuild = neon !== null;
