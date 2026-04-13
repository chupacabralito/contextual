declare global {
  interface Window {
    __CONTEXTUAL_SERVER_URL__?: string;
  }
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  const envUrl = (import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  }).env?.VITE_CONTEXTUAL_SERVER_URL;
  if (typeof envUrl === 'string' && envUrl.trim()) {
    return normalizeBaseUrl(envUrl.trim());
  }

  if (typeof window !== 'undefined') {
    const runtimeUrl = window.__CONTEXTUAL_SERVER_URL__;
    if (typeof runtimeUrl === 'string' && runtimeUrl.trim()) {
      return normalizeBaseUrl(runtimeUrl.trim());
    }
  }

  return 'http://localhost:4700';
}

export function apiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(input), init);
}
