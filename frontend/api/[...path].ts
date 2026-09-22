export const config = {
  runtime: 'edge',
};

// ─── Configuration ─────────────────────────────────────────────────────────────
const UPSTREAM = 'https://knowflow-ai-8ehi.onrender.com';

// Edge-owned HttpOnly cookie names. NEVER forwarded to upstream.
// The backend receives a Bearer token instead (injected by this proxy).
const AT_COOKIE = 'kf_at'; // Access token  — short-lived (1 h)
const RT_COOKIE = 'kf_rt'; // Refresh token — long-lived (14 d)

const ACCESS_MAX_AGE  = 60 * 60;            // 1 hour
const REFRESH_MAX_AGE = 14 * 24 * 60 * 60; // 14 days

// Auth endpoints whose JSON responses contain token pairs to be stored as cookies.
const TOKEN_ISSUING_PATHS = [
  '/api/v1/auth/google/',
  '/api/v1/auth/login/',
  '/api/v1/auth/register/',
  '/api/v1/auth/refresh/',
];

// ─── Cookie helpers ────────────────────────────────────────────────────────────
function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  }
  return out;
}

// SameSite=Lax is fine — frontend & API share the same Vercel domain.
function setCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

// ─── Decompress helper ─────────────────────────────────────────────────────────
// Vercel Edge Runtime (V8 isolate) may NOT auto-decompress upstream fetch responses.
// We force uncompressed upstream responses by stripping Accept-Encoding on auth paths,
// so we can safely call .text() / JSON.parse() without worrying about brotli/gzip.
// For non-auth streaming paths we keep the original encoding for performance.
async function safeText(res: Response): Promise<string | null> {
  try {
    return await res.text();
  } catch {
    return null;
  }
}

// ─── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req: Request) {
  const url      = new URL(req.url);
  const pathname = url.pathname;

  const isTokenEndpoint = TOKEN_ISSUING_PATHS.some(p => pathname.startsWith(p));
  const isLogout        = pathname.startsWith('/api/v1/auth/logout/');
  const isRefreshPath   = pathname === '/api/v1/auth/refresh/';

  // ── 1. Read edge-owned cookies ─────────────────────────────────────────────
  const rawCookie   = req.headers.get('cookie') || '';
  const cookies     = parseCookies(rawCookie);
  const accessToken = cookies[AT_COOKIE];
  const refreshToken= cookies[RT_COOKIE];

  // ── 2. Build upstream request headers ──────────────────────────────────────
  const upHeaders = new Headers(req.headers);
  upHeaders.set('host', 'knowflow-ai-8ehi.onrender.com');
  upHeaders.set('x-forwarded-host', url.host);
  upHeaders.set('x-forwarded-proto', 'https');
  upHeaders.delete('content-length');

  // ── KEY FIX: Force uncompressed upstream response on auth paths ─────────────
  // Brotli/gzip-encoded bodies break JSON.parse() when the Edge Runtime fetch()
  // does not auto-decompress. Stripping Accept-Encoding makes Render respond
  // with plain JSON we can safely parse to extract tokens and set cookies.
  if (isTokenEndpoint) {
    upHeaders.set('accept-encoding', 'identity');
  }

  // Inject Bearer token so the backend can authenticate without cookies.
  if (accessToken) {
    upHeaders.set('Authorization', `Bearer ${accessToken}`);
  }

  // Strip our edge cookies before forwarding — Render doesn't need them.
  const upstreamCookies = rawCookie
    .split(';')
    .filter(c => {
      const name = c.trim().split('=')[0];
      return name !== AT_COOKIE && name !== RT_COOKIE;
    })
    .join('; ')
    .trim();
  if (upstreamCookies) upHeaders.set('cookie', upstreamCookies);
  else upHeaders.delete('cookie');

  // ── 3. Build upstream request body ─────────────────────────────────────────
  const method  = req.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);
  let upBody: Uint8Array | undefined;

  if (hasBody) {
    if (isRefreshPath && refreshToken) {
      // Inject the edge-owned refresh token into the body.
      let existing: Record<string, any> = {};
      try {
        const t = await req.text();
        if (t && t !== '{}') existing = JSON.parse(t);
      } catch { /* empty body */ }
      if (!existing.refresh) existing.refresh = refreshToken;
      upBody = new TextEncoder().encode(JSON.stringify(existing));
      upHeaders.set('content-type', 'application/json');
      upHeaders.set('content-length', String(upBody.byteLength));
    } else {
      try {
        const buf = await req.arrayBuffer();
        if (buf.byteLength > 0) {
          upBody = new Uint8Array(buf);
          upHeaders.set('content-length', String(upBody.byteLength));
        }
      } catch { /* no body */ }
    }
  }

  // ── 4. Forward to Render ────────────────────────────────────────────────────
  const targetUrl = new URL(pathname + url.search, UPSTREAM).toString();
  const upResponse = await fetch(targetUrl, {
    method,
    headers: upHeaders,
    body: upBody,
    redirect: 'manual',
  });

  // ── 5. Build response headers — strip Set-Cookie from Render, we set our own ─
  const resHeaders = new Headers();
  upResponse.headers.forEach((value, key) => {
    const lk = key.toLowerCase();
    if (lk !== 'set-cookie' && lk !== 'content-encoding') {
      resHeaders.set(key, value);
    }
  });

  // Debug: tell the browser which version of the proxy handled this request.
  resHeaders.set('x-kf-proxy', 'bff-v3');

  // ── 6. Logout: clear edge cookies ──────────────────────────────────────────
  if (isLogout) {
    resHeaders.append('set-cookie', clearCookie(AT_COOKIE));
    resHeaders.append('set-cookie', clearCookie(RT_COOKIE));
    return new Response(upResponse.body, {
      status: upResponse.status,
      statusText: upResponse.statusText,
      headers: resHeaders,
    });
  }

  // ── 7. Auth endpoints: parse body, extract tokens, set edge cookies ─────────
  if (isTokenEndpoint && upResponse.ok) {
    const raw = await safeText(upResponse);
    let parsed: any = null;
    try {
      if (raw) parsed = JSON.parse(raw);
    } catch { /* not JSON */ }

    if (parsed) {
      const tokens = parsed?.data?.tokens || parsed?.tokens;
      if (tokens?.access) {
        resHeaders.append('set-cookie', setCookie(AT_COOKIE, tokens.access,  ACCESS_MAX_AGE));
        resHeaders.set('x-kf-at-set', 'true'); // debug
      }
      if (tokens?.refresh) {
        resHeaders.append('set-cookie', setCookie(RT_COOKIE, tokens.refresh, REFRESH_MAX_AGE));
        resHeaders.set('x-kf-rt-set', 'true'); // debug
      }

      // Strip raw tokens from the body — they now live only in HttpOnly cookies.
      if (parsed?.data?.tokens) delete parsed.data.tokens;
      else if (parsed?.tokens)  delete parsed.tokens;

      const out = new TextEncoder().encode(JSON.stringify(parsed));
      resHeaders.set('content-length', String(out.byteLength));
      resHeaders.set('content-type', 'application/json; charset=utf-8');
      return new Response(out, {
        status: upResponse.status,
        statusText: upResponse.statusText,
        headers: resHeaders,
      });
    }

    // JSON parse failed — return original body without cookies (safe fallback)
    const fallback = new TextEncoder().encode(raw ?? '{}');
    resHeaders.set('content-length', String(fallback.byteLength));
    return new Response(fallback, {
      status: upResponse.status,
      statusText: upResponse.statusText,
      headers: resHeaders,
    });
  }

  // ── 8. All other endpoints: stream through ─────────────────────────────────
  return new Response(upResponse.body, {
    status: upResponse.status,
    statusText: upResponse.statusText,
    headers: resHeaders,
  });
}
