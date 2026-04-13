import type { Connect, Plugin } from 'vite';

const DEFAULT_SERVER_URL = 'http://localhost:4700';
const PROXY_PREFIXES = [
  '/api/',
  '/tools',
  '/health',
  '/suggest',
  '/resolve',
  '/passes',
  '/outcomes',
  '/inspect',
];

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function getServerBaseUrl(): string {
  const envUrl =
    process.env.VITE_CONTEXTUAL_SERVER_URL ??
    process.env.CONTEXTUAL_SERVER_URL ??
    DEFAULT_SERVER_URL;

  return normalizeBaseUrl(envUrl);
}

function shouldProxy(pathname: string): boolean {
  return PROXY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

async function readRequestBody(req: Connect.IncomingMessage): Promise<Buffer | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return undefined;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

function copyResponseHeaders(
  upstreamHeaders: Headers,
  res: Connect.ServerResponse
): void {
  upstreamHeaders.forEach((value, key) => {
    if (key.toLowerCase() === 'content-length') {
      return;
    }
    res.setHeader(key, value);
  });
}

export function localFilesPlugin(): Plugin {
  const serverBaseUrl = getServerBaseUrl();

  return {
    name: 'context-manager-server-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) {
          next();
          return;
        }

        const url = new URL(req.url, 'http://localhost');
        if (!shouldProxy(url.pathname)) {
          next();
          return;
        }

        try {
          const body = await readRequestBody(req);
          // Build a safe headers object — Node.js IncomingMessage headers can be
          // string | string[] | undefined, but fetch expects string values only.
          const safeHeaders: Record<string, string> = {};
          for (const [key, value] of Object.entries(req.headers)) {
            if (value === undefined) continue;
            safeHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
          }
          const upstream = await fetch(`${serverBaseUrl}${url.pathname}${url.search}`, {
            method: req.method,
            headers: safeHeaders,
            body,
            duplex: body ? 'half' : undefined,
          });

          res.statusCode = upstream.status;
          copyResponseHeaders(upstream.headers, res);
          const payload = Buffer.from(await upstream.arrayBuffer());
          res.end(payload);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to proxy request';
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: message, serverBaseUrl }));
        }
      });
    },
  };
}
