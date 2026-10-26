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

    const prefix = '/api/auth/';

    if (!url.pathname.startsWith(prefix)) {
      return res.status(404).json({ error: 'Invalid authentication route.' });
    }

    const path = url.pathname.slice(prefix.length);

    const headers = new Headers();

    for (const [name, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        for (const item of value) headers.append(name, item);
      } else if (value !== undefined) {
        headers.set(name, value);
      }
    }

    let body;

    if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
      const chunks = [];

      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
      }

      if (chunks.length) {
        body = Buffer.concat(chunks);
      }
    }

    const request = new Request(url, {
      method: req.method,
      headers,
      ...(body ? { body, duplex: 'half' } : {}),
    });

    const response = await handleAuthProxyRequest({
      request,
      path,
      baseUrl,
      cookieSecret,
      sameSite: 'lax',
    });

    res.statusCode = response.status;

    response.headers.forEach((value, name) => {
      if (name.toLowerCase() !== 'set-cookie') {
        res.setHeader(name, value);
      }
    });

    appendCookies(res, collectSetCookies(response));

    const responseBody = Buffer.from(await response.arrayBuffer());
    return res.end(responseBody);
  } catch (error) {
    console.error('[Auth Proxy] Request failed:', error);

    return res.status(500).json({
      error: 'Authentication proxy request failed.',
    });
  }
}
