/**
 * "FG Code" support.
 *
 * Drama Live lets people share a whole playlist with a short code instead of a long url.
 * A code is a URL-safe base64 payload describing where the playlist lives, so it can be
 * shared in a chat message and pasted back on any device.
 *
 *   DL-M3U-<base64url>  → { u: playlistUrl, n: name }
 *   DL-XT-<base64url>   → { s: server, r: username, p: password, n: name }
 */

export type FgPayload =
  | { t: 'm3u'; u: string; n?: string; e?: string }
  | { t: 'xt'; s: string; r: string; p: string; n?: string };

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeFgCode(payload: FgPayload): string {
  const prefix = payload.t === 'xt' ? 'DL-XT' : 'DL-M3U';
  return `${prefix}-${toBase64Url(JSON.stringify(payload))}`;
}

export function isFgCode(value: string): boolean {
  return /^\s*(DL|FG)-(M3U|XT)-[A-Za-z0-9_-]+\s*$/i.test(value);
}

export function decodeFgCode(code: string): FgPayload | null {
  const match = code.trim().match(/^(DL|FG)-(M3U|XT)-([A-Za-z0-9_-]+)$/i);
  if (!match) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(match[3])) as FgPayload;
    if (match[2].toUpperCase() === 'XT' && parsed.t === 'xt') return parsed;
    if (parsed.t === 'm3u' && typeof parsed.u === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}

/** Accepts a url, an FG code, or a full pasted M3U document. */
export function classifyInput(value: string): 'url' | 'fg' | 'm3u-text' | 'unknown' {
  const trimmed = value.trim();
  if (isFgCode(trimmed)) return 'fg';
  if (trimmed.startsWith('#EXTM3U') || trimmed.includes('#EXTINF:')) return 'm3u-text';
  if (/^https?:\/\//i.test(trimmed)) return 'url';
  return 'unknown';
}
