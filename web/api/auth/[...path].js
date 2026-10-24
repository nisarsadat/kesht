
import { handleAuthProxyRequest } from '@neondatabase/auth/server';

const baseUrl = process.env.NEON_AUTH_BASE_URL;
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;

async function handle(request) {
  if (!baseUrl || !cookieSecret) {
    return Response.json(
      { error: 'Authentication proxy is not configured.' },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const prefix = '/api/auth/';

  if (!url.pathname.startsWith(prefix)) {
    return Response.json(
      { error: 'Invalid authentication route.' },
      { status: 404 }
    );
  }

  const path = url.pathname.slice(prefix.length);

  return handleAuthProxyRequest({
    request,
    path,
    baseUrl,
    cookieSecret,
    sameSite: 'lax',
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
