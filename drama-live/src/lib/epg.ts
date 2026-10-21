import type { Programme } from '../types';

/** Parse an XMLTV date such as "20260205120000 +0000". */
export function parseXmltvDate(raw: string): number {
  const match = raw.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?$/);
  if (!match) {
    const fallback = Date.parse(raw);
    return Number.isNaN(fallback) ? 0 : fallback;
  }
  const [, y, mo, d, h, mi, s, tz] = match;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s ?? '00'}${tz ? `${tz.slice(0, 3)}:${tz.slice(3)}` : 'Z'}`;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? 0 : time;
}

export interface ParsedEpg {
  programmes: Programme[];
  byChannel: Map<string, Programme[]>;
}

export function parseXmltv(xml: string): ParsedEpg {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const nodes = Array.from(doc.getElementsByTagName('programme'));
  const programmes: Programme[] = [];
  const byChannel = new Map<string, Programme[]>();

  for (const node of nodes) {
    const channelId = node.getAttribute('channel');
    if (!channelId) continue;
    const start = parseXmltvDate(node.getAttribute('start') ?? '');
    const stop = parseXmltvDate(node.getAttribute('stop') ?? '');
    if (!start) continue;
    const programme: Programme = {
      channelId,
      title: node.getElementsByTagName('title')[0]?.textContent?.trim() || '—',
      description: node.getElementsByTagName('desc')[0]?.textContent?.trim() || undefined,
      category: node.getElementsByTagName('category')[0]?.textContent?.trim() || undefined,
      start,
      stop: stop || start + 30 * 60 * 1000,
    };
    programmes.push(programme);
    const list = byChannel.get(channelId);
    if (list) list.push(programme);
    else byChannel.set(channelId, [programme]);
  }

  for (const list of byChannel.values()) list.sort((a, b) => a.start - b.start);
  return { programmes, byChannel };
}

export function currentProgramme(list: Programme[] | undefined, at = Date.now()): Programme | undefined {
  if (!list?.length) return undefined;
  return list.find((p) => p.start <= at && p.stop > at) ?? list[list.length - 1];
}

export function nextProgramme(list: Programme[] | undefined, at = Date.now()): Programme | undefined {
  if (!list?.length) return undefined;
  return list.find((p) => p.start > at);
}

export function programmeProgress(programme: Programme, at = Date.now()): number {
  const total = Math.max(1, programme.stop - programme.start);
  return Math.min(100, Math.max(0, ((at - programme.start) / total) * 100));
}

export function formatTime(value: number, lang: 'ar' | 'en'): string {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-MA' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatDay(value: number, lang: 'ar' | 'en'): string {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-MA' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(value));
}
