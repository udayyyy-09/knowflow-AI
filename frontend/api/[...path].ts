export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const targetUrl = new URL(url.pathname + url.search, 'https://knowflow-ai-8ehi.onrender.com');

  // Clone headers and rewrite host for upstream server
  const headers = new Headers(req.headers);
  headers.set('host', 'knowflow-ai-8ehi.onrender.com');
  headers.set('x-forwarded-host', url.host);
  headers.set('x-forwarded-proto', 'https');
  // Remove any content-length to avoid mismatch after body re-reading
  headers.delete('content-length');

  const method = req.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);

  let bodyBuffer: ArrayBuffer | undefined;
  if (hasBody) {
    try {
      bodyBuffer = await req.arrayBuffer();
      if (bodyBuffer.byteLength > 0) {
        headers.set('content-length', String(bodyBuffer.byteLength));
      }
    } catch {
      bodyBuffer = undefined;
    }
  }

  const upstreamResponse = await fetch(targetUrl.toString(), {
    method,
    headers,
    body: hasBody && bodyBuffer && bodyBuffer.byteLength > 0 ? bodyBuffer : undefined,
    redirect: 'manual',
  });

  // Build response headers — copy everything except set-cookie and content-encoding
  const responseHeaders = new Headers();
  upstreamResponse.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey !== 'set-cookie' && lowerKey !== 'content-encoding') {
      responseHeaders.set(key, value);
    }
  });

  // ── Reliable multi-cookie forwarding ─────────────────────────────────────
  // The Fetch API collapses multiple Set-Cookie headers into one comma-joined
  // string via headers.get('set-cookie'), which corrupts multi-cookie responses.
  // We use three strategies in priority order to extract individual cookie strings:
  //
  // 1. getSetCookie() — the correct modern API (available in some edge runtimes)
  // 2. Raw header string splitting via the internal entries iterator
  // 3. Manual comma-splitting of headers.get('set-cookie') as a last resort
  //    (imperfect but better than dropping all cookies)

  let rawCookies: string[] = [];

  // Strategy 1: getSetCookie() — returns each Set-Cookie as a separate string
  if (typeof (upstreamResponse.headers as any).getSetCookie === 'function') {
    rawCookies = (upstreamResponse.headers as any).getSetCookie() as string[];
  }

  // Strategy 2: Iterate raw header entries — some runtimes expose duplicates here
  if (rawCookies.length === 0) {
    for (const [key, value] of (upstreamResponse.headers as any).entries()) {
      if (key.toLowerCase() === 'set-cookie') {
        rawCookies.push(value);
      }
    }
  }

  // Strategy 3: Manual split on the comma-joined string — last resort
  if (rawCookies.length === 0) {
    const joined = upstreamResponse.headers.get('set-cookie');
    if (joined) {
      // Split on commas that precede a known cookie attribute or a new cookie name
      // Avoid splitting on commas inside Expires date values (e.g., "Thu, 01 Jan 2026")
      rawCookies = joined.split(/,(?=[^ ])/);
    }
  }

  // Strip Domain attribute so cookies attach to the Vercel domain, not Render
  for (const cookieStr of rawCookies) {
    const cleaned = cookieStr.replace(/;\s*domain=[^;]+/gi, '').trim();
    if (cleaned) {
      responseHeaders.append('set-cookie', cleaned);
    }
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}
