
import { handleAuthProxyRequest } from '@neondatabase/auth/server';

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
    const url = new URL(req.url || '/', `https://${host}`);

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

    const cookies = response.headers.getSetCookie?.();

    if (cookies?.length) {
      res.setHeader('Set-Cookie', cookies);
    } else {
      const cookie = response.headers.get('set-cookie');
      if (cookie) res.setHeader('Set-Cookie', cookie);
    }

    const responseBody = Buffer.from(await response.arrayBuffer());
    return res.end(responseBody);
  } catch (error) {
    console.error('[Auth Proxy] Request failed:', error);

    return res.status(500).json({
      error: 'Authentication proxy request failed.',
    });
  }
}
