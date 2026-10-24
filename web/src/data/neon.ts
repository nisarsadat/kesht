
import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';

const authUrl = `${window.location.origin}/api/auth`;

const dataApiUrl =
  (import.meta.env.VITE_NEON_DATA_API_URL as string | undefined)?.trim() ?? '';

/** True when both environment variables are present. */
export const isCloudConfigured = dataApiUrl.length > 0;

/**
 * Neon client.
 * Auth requests go through the same-origin Vercel proxy.
 * Data API requests continue to use Neon directly.
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
