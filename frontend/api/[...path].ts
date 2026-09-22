export const config = {
  runtime: 'edge',
};

// ─── Configuration ────────────────────────────────────────────────────────────
const UPSTREAM       = 'https://knowflow-ai-8ehi.onrender.com';

// Names of the HttpOnly cookies that THIS edge function owns and manages.
// These are NEVER forwarded to the upstream — the backend uses Bearer tokens instead.
const AT_COOKIE = 'kf_at';   // Access token  — short-lived
const RT_COOKIE = 'kf_rt';   // Refresh token — long-lived

const ACCESS_MAX_AGE  = 60 * 60;            // 1 hour  (must match backend SIMPLE_JWT setting)
const REFRESH_MAX_AGE = 14 * 24 * 60 * 60; // 14 days (must match backend SIMPLE_JWT setting)

// Auth endpoints whose successful JSON responses contain token pairs to store as cookies.
const TOKEN_ISSUING_PATHS = [
  '/api/v1/auth/google/',
  '/api/v1/auth/login/',
  '/api/v1/auth/register/',
  '/api/v1/auth/refresh/',
];

// ─── Cookie helpers ───────────────────────────────────────────────────────────
function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  }
  return out;
}

function setCookie(name: string, value: string, maxAge: number): string {
  // SameSite=Lax is sufficient here because the frontend and API share the same
  // Vercel domain. No need for SameSite=None (which requires cross-origin headers).
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req: Request) {
  const url      = new URL(req.url);
  const pathname = url.pathname; // e.g. /api/v1/auth/google/

  // ── 1. Read edge-owned auth cookies from the browser request ───────────────
  const rawCookie    = req.headers.get('cookie') || '';
  const cookies      = parseCookies(rawCookie);
  const accessToken  = cookies[AT_COOKIE];
  const refreshToken = cookies[RT_COOKIE];

  // ── 2. Build upstream request headers ─────────────────────────────────────
  const upHeaders = new Headers(req.headers);
  upHeaders.set('host', 'knowflow-ai-8ehi.onrender.com');
  upHeaders.set('x-forwarded-host', url.host);
  upHeaders.set('x-forwarded-proto', 'https');
  upHeaders.delete('content-length'); // recalculated below if body changes

  // Inject Bearer token — backend authenticates via Authorization header.
  // This is always reliable: no SameSite/domain/cookie-forwarding complexity.
  if (accessToken) {
    upHeaders.set('Authorization', `Bearer ${accessToken}`);
  }

  // Strip our edge-owned cookies before forwarding to upstream (Render doesn't know them).
  // Keep any other cookies the browser may send (e.g., Django session if ever used).
  const forwardedCookies = rawCookie
    .split(';')
    .filter(c => {
      const name = c.trim().split('=')[0];
      return name !== AT_COOKIE && name !== RT_COOKIE;
    })
    .join('; ')
    .trim();
  if (forwardedCookies) {
    upHeaders.set('cookie', forwardedCookies);
  } else {
    upHeaders.delete('cookie');
  }

  // ── 3. Build upstream request body ────────────────────────────────────────
  const method  = req.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);
  let upBody: ArrayBuffer | undefined;

  if (hasBody) {
    const isRefreshEndpoint = pathname === '/api/v1/auth/refresh/';

    if (isRefreshEndpoint && refreshToken) {
      // Inject the edge-owned refresh token into the request body so the backend
      // can validate it without needing a cookie it never set itself.
      let existing: Record<string, any> = {};
      try {
        const text = await req.text();
        if (text) existing = JSON.parse(text);
      } catch { /* empty or non-JSON body */ }

      if (!existing.refresh) existing.refresh = refreshToken;

      const encoded = new TextEncoder().encode(JSON.stringify(existing));
      upBody = encoded.buffer as ArrayBuffer;
      upHeaders.set('content-type', 'application/json');
      upHeaders.set('content-length', String(encoded.byteLength));
    } else {
      try {
        upBody = await req.arrayBuffer();
        if (upBody.byteLength > 0) {
          upHeaders.set('content-length', String(upBody.byteLength));
        }
      } catch { upBody = undefined; }
    }
  }

  // ── 4. Send to upstream Render backend ─────────────────────────────────────
  const upResponse = await fetch(new URL(pathname + url.search, UPSTREAM).toString(), {
    method,
    headers: upHeaders,
    body: hasBody && upBody && upBody.byteLength > 0 ? upBody : undefined,
    redirect: 'manual',
  });

  // ── 5. Build response headers (strip backend Set-Cookie — we manage our own) ─
  const resHeaders = new Headers();
  upResponse.headers.forEach((value, key) => {
    const lk = key.toLowerCase();
    // Drop Set-Cookie from Render: we replace with our own edge cookies below.
    // Drop content-encoding: we may re-encode the body for auth responses.
    if (lk !== 'set-cookie' && lk !== 'content-encoding') {
      resHeaders.set(key, value);
    }
  });

  // ── 6. Auth endpoint: buffer body, extract tokens, set edge cookies ─────────
  const isTokenEndpoint = TOKEN_ISSUING_PATHS.some(p => pathname.startsWith(p));
  const isLogout        = pathname.startsWith('/api/v1/auth/logout/');

  if (isLogout) {
    resHeaders.append('set-cookie', clearCookie(AT_COOKIE));
    resHeaders.append('set-cookie', clearCookie(RT_COOKIE));
    const body = await upResponse.arrayBuffer();
    return new Response(body, { status: upResponse.status, statusText: upResponse.statusText, headers: resHeaders });
  }

  if (isTokenEndpoint && upResponse.ok) {
    let rawText = '';
    let parsed: any = null;
    try {
      rawText = await upResponse.text();
      parsed  = JSON.parse(rawText);
    } catch {
      // Non-JSON or empty: stream through unchanged
      const body = await upResponse.arrayBuffer();
      return new Response(body, { status: upResponse.status, statusText: upResponse.statusText, headers: resHeaders });
    }

    // Extract token pair from response body
    const tokens = parsed?.data?.tokens || parsed?.tokens;
    if (tokens?.access) {
      resHeaders.append('set-cookie', setCookie(AT_COOKIE, tokens.access,  ACCESS_MAX_AGE));
    }
    if (tokens?.refresh) {
      resHeaders.append('set-cookie', setCookie(RT_COOKIE, tokens.refresh, REFRESH_MAX_AGE));
    }

    // Remove raw tokens from the response body — they now live in HttpOnly cookies.
    // The frontend only needs user profile data, never the token strings.
    if (parsed?.data?.tokens) {
      delete parsed.data.tokens;
    } else if (parsed?.tokens) {
      delete parsed.tokens;
    }

    const sanitized = new TextEncoder().encode(JSON.stringify(parsed));
    resHeaders.set('content-length', String(sanitized.byteLength));
    resHeaders.set('content-type', 'application/json; charset=utf-8');
    return new Response(sanitized.buffer as ArrayBuffer, {
      status: upResponse.status,
      statusText: upResponse.statusText,
      headers: resHeaders,
    });
  }

  // ── 7. All other endpoints: stream through unchanged ─────────────────────
  return new Response(upResponse.body, {
    status: upResponse.status,
    statusText: upResponse.statusText,
    headers: resHeaders,
  });
}
