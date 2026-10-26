import { handleAuthProxyRequest } from '@neondatabase/auth/server';

/**
 * Rewrite Set-Cookie for Safari/WebKit:
 * - force Path=/ so get-session can read cookies set on sign-in
 * - strip Domain so cookies are host-only for this origin
 * Never comma-join cookies (corrupts Expires dates).
 */
function normalizeSetCookie(raw) {
  const parts = raw.split(';').map((part) => part.trim());
  if (!parts.length || !parts[0]) return null;

  const [nameValue, ...attributes] = parts;
  const kept = [nameValue];
  let hasPath = false;

  for (const attribute of attributes) {
    const lower = attribute.toLowerCase();
    if (lower.startsWith('domain=')) continue;
    if (lower.startsWith('path=')) {
      hasPath = true;
      kept.push('Path=/');
      continue;
    }
    kept.push(attribute);
  }

  if (!hasPath) kept.push('Path=/');
  return kept.join('; ');
}

function collectSetCookies(response) {
  const fromGetter = response.headers.getSetCookie?.();
  if (fromGetter?.length) return fromGetter;

  // Last resort: single header only (do not split on commas).
  const single = response.headers.get('set-cookie');
  return single ? [single] : [];
}

function appendCookies(res, cookies) {
  for (const raw of cookies) {
    const normalized = normalizeSetCookie(raw);
    if (!normalized) continue;

    if (typeof res.appendHeader === 'function') {
      res.appendHeader('Set-Cookie', normalized);
    } else if (typeof res.append === 'function') {
      res.append('Set-Cookie', normalized);
    } else {
      const existing = res.getHeader?.('Set-Cookie');
      if (!existing) {
        res.setHeader('Set-Cookie', normalized);
      } else if (Array.isArray(existing)) {
        res.setHeader('Set-Cookie', [...existing, normalized]);
      } else {
        res.setHeader('Set-Cookie', [String(existing), normalized]);
      }
    }
  }
}

function pathFromValue(value) {
  if (Array.isArray(value) && value.length) {
    return value.filter(Boolean).join('/');
  }

  if (typeof value === 'string' && value.length) {
    return value.replace(/^\/+/, '');
  }

  return null;
}

/**
 * Resolve the Neon Auth path after Vercel rewrites /api/auth/:path* → /api/auth.
 * Prefer the rewrite query param; fall back to original URI / pathname.
 */
function getProxyPath(req, url) {
  const fromQuery =
    pathFromValue(req.query?.path) ??
    pathFromValue(req.query?.['...path']);

  if (fromQuery !== null) return fromQuery;

  const forwarded = req.headers['x-forwarded-uri'] || req.headers['x-invoke-path'];
  const forwardedPath =
    typeof forwarded === 'string' ? forwarded.split('?')[0] : null;

  for (const candidate of [forwardedPath, url.pathname]) {
    if (!candidate) continue;
    const prefix = '/api/auth/';
    if (candidate.startsWith(prefix)) {
      return candidate.slice(prefix.length);
    }
  }

  return null;
}

/** Vercel may already parse JSON bodies; prefer that over an empty stream. */
async function readBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string' && req.body.length) {
    return Buffer.from(req.body);
  }
  if (req.body && typeof req.body === 'object') {
    return Buffer.from(JSON.stringify(req.body));
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

const SKIP_RESPONSE_HEADERS = new Set([
  'set-cookie',
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
]);

export default async function handler(req, res) {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;

  if (!baseUrl || !cookieSecret) {
    return res.status(500).json({
      error: 'Authentication proxy environment variables are missing.',
    });
  }

  try {
    const host = req.headers.host;
    const protoHeader = req.headers['x-forwarded-proto'];
    const proto = (
      Array.isArray(protoHeader) ? protoHeader[0] : protoHeader
    )
      ?.split(',')[0]
      ?.trim() || 'https';
    const url = new URL(req.url || '/', `${proto}://${host}`);

    const path = getProxyPath(req, url);

    if (path === null) {
      return res.status(404).json({ error: 'Invalid authentication route.' });
    }

    const headers = new Headers();

    for (const [name, value] of Object.entries(req.headers)) {
      // Node/undici rejects certain hop-by-hop headers on Request.
      const lower = name.toLowerCase();
      if (
        lower === 'host' ||
        lower === 'connection' ||
        lower === 'content-length' ||
        lower === 'transfer-encoding'
      ) {
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) headers.append(name, item);
      } else if (value !== undefined) {
        headers.set(name, value);
      }
    }

    let body;
    if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
      body = await readBody(req);
    }

    // Drop the rewrite-only `path` query param before proxying upstream.
    const upstreamSearch = new URLSearchParams(url.search);
    upstreamSearch.delete('path');
    upstreamSearch.delete('...path');

    // Cookie-cache for get-session omits set-auth-jwt, so Data API gets an
    // opaque session token and rejects it as "not a valid JWT encoding".
    if (path === 'get-session' || path.startsWith('get-session?')) {
      upstreamSearch.set('disableCookieCache', 'true');
    }

    const search = upstreamSearch.toString();
    const requestUrl = new URL(
      path
        ? `/api/auth/${path.split('?')[0]}${search ? `?${search}` : ''}`
        : `/api/auth${search ? `?${search}` : ''}`,
      `${proto}://${host}`,
    );

    const request = new Request(requestUrl, {
      method: req.method,
      headers,
      ...(body ? { body, duplex: 'half' } : {}),
    });

    const response = await handleAuthProxyRequest({
      request,
      path: path.split('?')[0],
      baseUrl,
      cookieSecret,
      sameSite: 'lax',
    });

    res.statusCode = response.status;

    response.headers.forEach((value, name) => {
      if (!SKIP_RESPONSE_HEADERS.has(name.toLowerCase())) {
        res.setHeader(name, value);
      }
    });

    appendCookies(res, collectSetCookies(response));

    // Forward JWT header used by the Neon client to talk to Data API.
    const jwt = response.headers.get('set-auth-jwt');
    if (jwt) res.setHeader('set-auth-jwt', jwt);
    const authToken = response.headers.get('set-auth-token');
    if (authToken) res.setHeader('set-auth-token', authToken);

    const responseBody = Buffer.from(await response.arrayBuffer());
    if (!res.getHeader('content-type') && responseBody.length) {
      res.setHeader('content-type', 'application/json; charset=utf-8');
    }
    return res.end(responseBody);
  } catch (error) {
    console.error('[Auth Proxy] Request failed:', error);

    return res.status(500).json({
      error: 'Authentication proxy request failed.',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
