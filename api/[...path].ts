export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const targetUrl = new URL(url.pathname + url.search, 'https://knowflow-ai-8ehi.onrender.com');

  const headers = new Headers(req.headers);
  headers.set('host', 'knowflow-ai-8ehi.onrender.com');

  const method = req.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);

  const upstreamResponse = await fetch(targetUrl.toString(), {
    method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    redirect: 'manual',
  });

  return upstreamResponse;
}
