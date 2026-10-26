/**
 * Neon Auth's browser cache uses Response.json(...), which is missing on
 * older iOS WebKit (Safari / iPhone Chrome). Without this, getSession crashes
 * with "Response.json is not a function" and auth never finishes.
 */
export function installPolyfills(): void {
  if (typeof Response === 'undefined') return;

  if (typeof Response.json !== 'function') {
    Object.defineProperty(Response, 'json', {
      configurable: true,
      writable: true,
      value(data: unknown, init?: ResponseInit): Response {
        const headers = new Headers(init?.headers);
        if (!headers.has('content-type')) {
          headers.set('content-type', 'application/json');
        }
        return new Response(JSON.stringify(data), {
          ...init,
          headers,
        });
      },
    });
  }
}

installPolyfills();
