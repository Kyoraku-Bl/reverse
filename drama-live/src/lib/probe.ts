/**
 * Channel health probing.
 *
 * Browsers are stricter than set-top boxes: a stream that plays in an IPTV app can
 * fail here because the server sends no CORS headers, is offline, or answers 404.
 * Instead of guessing, we ask the stream — from the user's own machine — and say
 * exactly why it failed.
 */

export type ProbeStatus = 'ok' | 'cors' | 'missing' | 'timeout' | 'error';

export interface ProbeResult {
  status: ProbeStatus;
  /** Round-trip time in ms, -1 when the request never completed */
  ms: number;
  detail?: string;
}

export interface ProbeOptions {
  timeoutMs?: number;
  /** Optional user-supplied proxy template, e.g. "https://my.proxy/?u={url}" */
  proxy?: string;
}

/** Applies a user proxy template to a stream url. Empty template = no proxy. */
export function applyProxy(proxy: string | undefined, url: string): string {
  const template = (proxy ?? '').trim();
  if (!template) return url;
  if (template.includes('{url}')) return template.replace('{url}', encodeURIComponent(url));
  if (/[=?]$/.test(template)) return `${template}${encodeURIComponent(url)}`;
  return `${template.replace(/\/$/, '')}/${encodeURIComponent(url)}`;
}

/**
 * Fetches only the response headers, so probing a channel costs almost no bandwidth.
 * A `TypeError` from fetch means the browser blocked the response (CORS or offline),
 * which is the single most common reason an IPTV channel fails in a web player.
 */
export async function probeUrl(url: string, options: ProbeOptions = {}): Promise<ProbeResult> {
  const { timeoutMs = 8000, proxy } = options;
  const target = applyProxy(proxy, url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    const response = await fetch(target, {
      method: 'GET',
      signal: controller.signal,
      headers: { Range: 'bytes=0-1024' },
      redirect: 'follow',
    });
    const ms = Date.now() - started;
    // Release the body: we only cared about the headers.
    response.body?.cancel().catch(() => undefined);

    if (response.ok || response.status === 206) return { status: 'ok', ms };
    if ([403, 404, 410, 451].includes(response.status)) {
      return { status: 'missing', ms, detail: `HTTP ${response.status}` };
    }
    return { status: 'error', ms, detail: `HTTP ${response.status}` };
  } catch (error) {
    const ms = Date.now() - started;
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { status: 'timeout', ms, detail: `${timeoutMs}ms` };
    }
    if (error instanceof TypeError) {
      return { status: 'cors', ms, detail: 'blocked by the browser (CORS) or unreachable' };
    }
    return { status: 'error', ms, detail: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

export function isPlayable(status: ProbeStatus | undefined): boolean {
  return status === undefined || status === 'ok';
}

/** Probes many urls with a bounded concurrency so big playlists stay responsive. */
export async function probeMany(
  urls: string[],
  options: ProbeOptions & { concurrency?: number; onResult?: (url: string, result: ProbeResult) => void } = {},
): Promise<Map<string, ProbeResult>> {
  const { concurrency = 6, onResult } = options;
  const results = new Map<string, ProbeResult>();
  let cursor = 0;

  const worker = async () => {
    while (cursor < urls.length) {
      const url = urls[cursor];
      cursor += 1;
      const result = await probeUrl(url, options);
      results.set(url, result);
      onResult?.(url, result);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, urls.length)) }, worker));
  return results;
}

/** A cached probe is only meaningful for a few minutes — live streams come and go. */
export const PROBE_TTL_MS = 10 * 60 * 1000;

export function isFresh(at: number, now = Date.now()): boolean {
  return now - at < PROBE_TTL_MS;
}
