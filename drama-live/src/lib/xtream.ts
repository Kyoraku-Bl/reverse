import type { Channel, XtreamCredentials } from '../types';

export interface XtreamApiBase {
  url: string;
  user_info?: { auth: number; status: string; active_cons: string; max_connections: string };
  server_info?: { url: string; port: string; https_port: string };
}

function trimServer(server: string): string {
  return server.trim().replace(/\/+$/, '');
}

export function xtreamApiUrl(creds: XtreamCredentials, action?: string, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({ username: creds.username, password: creds.password });
  if (action) params.set('action', action);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return `${trimServer(creds.server)}/player_api.php?${params.toString()}`;
}

/** The classic "export my playlist as M3U" endpoint offered by every Xtream Codes panel. */
export function xtreamM3uUrl(creds: XtreamCredentials, type: 'm3u_plus' | 'm3u' = 'm3u_plus', output = 'ts'): string {
  const params = new URLSearchParams({
    username: creds.username,
    password: creds.password,
    type,
    output,
  });
  return `${trimServer(creds.server)}/get.php?${params.toString()}`;
}

export function xtreamLiveUrl(creds: XtreamCredentials, streamId: string | number, ext = 'm3u8'): string {
  return `${trimServer(creds.server)}/live/${creds.username}/${creds.password}/${streamId}.${ext}`;
}

export function xtreamMovieUrl(creds: XtreamCredentials, streamId: string | number, ext = 'mp4'): string {
  return `${trimServer(creds.server)}/movie/${creds.username}/${creds.password}/${streamId}.${ext}`;
}

export function xtreamSeriesUrl(creds: XtreamCredentials, episodeId: string | number, ext = 'mp4'): string {
  return `${trimServer(creds.server)}/series/${creds.username}/${creds.password}/${episodeId}.${ext}`;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

interface XtreamCategory {
  category_id: string;
  category_name: string;
}

interface XtreamStream {
  num?: number;
  name: string;
  stream_id: number;
  stream_icon?: string;
  category_id?: string;
  epg_channel_id?: string;
  container_extension?: string;
  rating?: string;
}

/**
 * Pull live + VOD + series from an Xtream Codes panel.
 * Panels that do not send CORS headers will fail here; the caller should then
 * fall back to the get.php M3U export.
 */
export async function fetchXtreamChannels(creds: XtreamCredentials, sourceId: string): Promise<Channel[]> {
  const base = await getJson<XtreamApiBase>(xtreamApiUrl(creds));
  if (base.user_info && Number(base.user_info.auth) !== 1) {
    throw new Error('auth-failed');
  }

  const [liveCats, liveStreams, vodCats, vodStreams] = await Promise.all([
    getJson<XtreamCategory[]>(xtreamApiUrl(creds, 'get_live_categories')).catch(() => [] as XtreamCategory[]),
    getJson<XtreamStream[]>(xtreamApiUrl(creds, 'get_live_streams')).catch(() => [] as XtreamStream[]),
    getJson<XtreamCategory[]>(xtreamApiUrl(creds, 'get_vod_categories')).catch(() => [] as XtreamCategory[]),
    getJson<XtreamStream[]>(xtreamApiUrl(creds, 'get_vod_streams')).catch(() => [] as XtreamStream[]),
  ]);

  const liveNames = new Map(liveCats.map((c) => [c.category_id, c.category_name]));
  const vodNames = new Map(vodCats.map((c) => [c.category_id, c.category_name]));
  const channels: Channel[] = [];

  liveStreams.forEach((stream, index) => {
    channels.push({
      id: `${sourceId}:live:${stream.stream_id ?? index}`,
      name: stream.name,
      urls: [xtreamLiveUrl(creds, stream.stream_id)],
      logo: stream.stream_icon || undefined,
      group: liveNames.get(String(stream.category_id)) || 'Live',
      tvgId: stream.epg_channel_id || undefined,
      kind: 'live',
      sourceId,
    });
  });

  vodStreams.forEach((stream, index) => {
    const ext = stream.container_extension || 'mp4';
    channels.push({
      id: `${sourceId}:vod:${stream.stream_id ?? index}`,
      name: stream.name,
      urls: [xtreamMovieUrl(creds, stream.stream_id, ext)],
      logo: stream.stream_icon || undefined,
      group: vodNames.get(String(stream.category_id)) || 'VOD',
      kind: 'movie',
      sourceId,
    });
  });

  return channels;
}
