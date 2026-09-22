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

  const method = req.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);

  const upstreamResponse = await fetch(targetUrl.toString(), {
    method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    redirect: 'manual',
  });

  const responseHeaders = new Headers();
  // Copy upstream headers
  upstreamResponse.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey !== 'set-cookie' && lowerKey !== 'content-encoding') {
      responseHeaders.set(key, value);
    }
  });

  // Extract all Set-Cookie headers and ensure they are scoped to the host domain
  const rawCookies: string[] =
    typeof (upstreamResponse.headers as any).getSetCookie === 'function'
      ? (upstreamResponse.headers as any).getSetCookie()
      : upstreamResponse.headers.get('set-cookie')
      ? [upstreamResponse.headers.get('set-cookie')!]
      : [];

  for (const cookieStr of rawCookies) {
    // Remove explicit Domain attribute from upstream so cookie attaches directly to Vercel domain
    const cleanedCookie = cookieStr.replace(/;\s*domain=[^;]+/gi, '');
    responseHeaders.append('set-cookie', cleanedCookie);
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}
