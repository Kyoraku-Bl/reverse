import type { Channel, ChannelKind } from '../types';

const ATTR_RE = /([a-zA-Z0-9_-]+)="([^"]*)"/g;

const MOVIE_HINTS = ['movie', 'vod', 'film', 'أفلام', 'افلام', 'سينما', 'cinema', 'film'];
const SERIES_HINTS = ['series', 'serie', 'مسلسل', 'مسلسلات', 'دراما', 'drama'];
const RADIO_HINTS = ['radio', 'راديو', 'إذاعة', 'اذاعة', 'audio'];
const AUDIO_EXT = ['.mp3', '.aac', '.ogg', '.opus', '.m4a', '.flac', '.wav'];

export interface ParsedPlaylist {
  channels: Channel[];
  epgUrl?: string;
  title?: string;
}

function normaliseUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (/^(https?|rtmp|rtsp|mms|udp|rtp):\/\//i.test(url)) return url;
  if (/^[\w-]+:\/\/|^\/\//i.test(url)) return url;
  return null;
}

function detectKind(group: string, url: string, radioAttr: string): ChannelKind {
  const g = group.toLowerCase();
  if (radioAttr === 'true' || RADIO_HINTS.some((h) => g.includes(h))) return 'radio';
  if (AUDIO_EXT.some((ext) => url.split('?')[0].toLowerCase().endsWith(ext))) return 'radio';
  if (SERIES_HINTS.some((h) => g.includes(h))) return 'series';
  if (MOVIE_HINTS.some((h) => g.includes(h))) return 'movie';
  return 'live';
}

/** Parse an M3U / M3U8 extended playlist into channels. */
export function parsePlaylistText(text: string, sourceId: string, sourceName = ''): ParsedPlaylist {
  const lines = text.split(/\r?\n/);
  const channels: Channel[] = [];
  const seen = new Set<string>();

  let epgUrl: string | undefined;
  let title: string | undefined;

  let pending: Partial<Channel> | null = null;
  let radioFlag = '';
  let groupName = '';
  let userAgent: string | undefined;
  let referrer: string | undefined;

  const flush = (url: string | null) => {
    if (!url || !pending) {
      pending = null;
      return;
    }
    const group = pending.group || groupName || undefined;
    // The same stream may legitimately appear in several groups, so the identity is
    // url + name + group rather than the url alone.
    const identity = `${url}|${(pending.name ?? '').toLowerCase()}|${(group ?? '').toLowerCase()}`;
    if (seen.has(identity)) {
      pending = null;
      return;
    }
    seen.add(identity);
    const kind = detectKind(group ?? '', url, radioFlag);
    channels.push({
      id: `${sourceId}:${channels.length}`,
      name: pending.name?.trim() || `Channel ${channels.length + 1}`,
      urls: [url],
      logo: pending.logo || undefined,
      group,
      country: pending.country || undefined,
      language: pending.language || undefined,
      tvgId: pending.tvgId || undefined,
      tvgChno: pending.tvgChno || undefined,
      kind,
      sourceId,
      userAgent,
      referrer,
      radio: kind === 'radio',
    });
    radioFlag = '';
    pending = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTM3U')) {
      const attrs = readAttributes(line);
      epgUrl = attrs['x-tvg-url'] || attrs['url-tvg'] || epgUrl;
      title = attrs['x-tvg-name'] || sourceName || title;
      continue;
    }

    if (line.startsWith('#EXTINF')) {
      const commaIndex = line.indexOf(',');
      const head = commaIndex === -1 ? line : line.slice(0, commaIndex);
      const displayName = commaIndex === -1 ? '' : line.slice(commaIndex + 1);
      const attrs = readAttributes(head);
      radioFlag = attrs['radio'] ?? '';
      pending = {
        name: (attrs['tvg-name'] || displayName || '').trim(),
        logo: attrs['tvg-logo'],
        group: attrs['group-title'],
        country: attrs['tvg-country'],
        language: attrs['tvg-language'],
        tvgId: attrs['tvg-id'],
        tvgChno: attrs['tvg-chno'],
      };
      continue;
    }

    if (line.startsWith('#EXTGRP:')) {
      groupName = line.slice(8).trim();
      continue;
    }

    if (line.startsWith('#EXTVLCOPT:') || line.startsWith('#KODIPROP:')) {
      const value = line.slice(line.indexOf(':') + 1);
      if (value.startsWith('http-user-agent=')) userAgent = value.slice(16).trim();
      if (value.startsWith('http-referrer=')) referrer = value.slice(14).trim();
      if (value.startsWith('http-referer=')) referrer = value.slice(13).trim();
      continue;
    }

    if (line.startsWith('#')) continue;

    const url = normaliseUrl(line);
    if (url) {
      if (!pending) pending = { name: guessNameFromUrl(url) };
      flush(url);
    }
  }

  return { channels, epgUrl, title };
}

function readAttributes(head: string): Record<string, string> {
  const out: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let match: RegExpExecArray | null = ATTR_RE.exec(head);
  while (match) {
    out[match[1].toLowerCase()] = match[2];
    match = ATTR_RE.exec(head);
  }
  return out;
}

function guessNameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const last = path.split('/').filter(Boolean).pop();
    return decodeURIComponent(last || url).replace(/\.[a-z0-9]+$/i, '');
  } catch {
    return url;
  }
}

/** Merge duplicate names so a channel with several servers keeps them together. */
export function mergeServers(channels: Channel[]): Channel[] {
  const byName = new Map<string, Channel>();
  const out: Channel[] = [];
  for (const channel of channels) {
    const key = `${channel.name.toLowerCase()}|${channel.group ?? ''}`;
    const existing = byName.get(key);
    if (existing && existing.kind === channel.kind) {
      for (const url of channel.urls) {
        if (!existing.urls.includes(url)) existing.urls.push(url);
      }
      existing.logo = existing.logo || channel.logo;
    } else {
      byName.set(key, channel);
      out.push(channel);
    }
  }
  return out;
}

/** Serialise channels back into an M3U playlist (used by the export feature). */
export function serializePlaylist(channels: Channel[], title = 'Drama Live Web'): string {
  const lines = [`#EXTM3U x-tvg-name="${title.replace(/"/g, '')}"`];
  for (const channel of channels) {
    const attrs = [
      `tvg-id="${channel.tvgId ?? ''}"`,
      `tvg-logo="${channel.logo ?? ''}"`,
      `tvg-country="${channel.country ?? ''}"`,
      `group-title="${channel.group ?? ''}"`,
    ].join(' ');
    for (const url of channel.urls) {
      lines.push(`#EXTINF:-1 ${attrs},${channel.name}`);
      lines.push(url);
    }
  }
  return `${lines.join('\n')}\n`;
}

export function downloadText(filename: string, text: string, mime = 'audio/x-mpegurl'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
