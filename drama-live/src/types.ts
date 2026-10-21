export type ChannelKind = 'live' | 'movie' | 'series' | 'radio';

export interface Channel {
  /** Stable id inside the playlist */
  id: string;
  name: string;
  /** All playable urls for this channel (multi-server support) */
  urls: string[];
  logo?: string;
  group?: string;
  country?: string;
  language?: string;
  tvgId?: string;
  tvgChno?: string;
  kind: ChannelKind;
  /** Source (playlist) this channel came from */
  sourceId: string;
  /** Raw HTTP headers requested by the playlist (#EXTVLCOPT / #KODIPROP) */
  userAgent?: string;
  referrer?: string;
  /** True when the entry is an audio-only stream */
  radio?: boolean;
}

export type SourceKind = 'm3u-url' | 'm3u-file' | 'm3u-text' | 'xtream' | 'fg-code';

export interface XtreamCredentials {
  server: string;
  username: string;
  password: string;
}

export interface Source {
  id: string;
  name: string;
  kind: SourceKind;
  /** Original url / raw text / serialised credentials used to build the playlist */
  reference: string;
  xtream?: XtreamCredentials;
  channelCount: number;
  addedAt: number;
  updatedAt: number;
  enabled: boolean;
  /** Raw playlist text kept so it can be re-parsed after a reload (may be empty if too large) */
  raw?: string;
  epgUrl?: string;
  error?: string;
}

export interface Programme {
  channelId: string;
  title: string;
  description?: string;
  start: number;
  stop: number;
  category?: string;
}

export interface ChatMessage {
  id: string;
  author: string;
  text: string;
  at: number;
  channelName?: string;
  system?: boolean;
  self?: boolean;
}

export interface Settings {
  lang: 'ar' | 'en';
  theme: 'dark' | 'light';
  /** Preferred quality cap in pixels of vertical resolution, 0 = auto */
  qualityCap: number;
  autoReconnect: boolean;
  reconnectAttempts: number;
  lowLatency: boolean;
  /** Use the browser's built-in HLS stack when it supports it (saves battery on Safari/iOS) */
  nativePlayer: boolean;
  startMuted: boolean;
  volume: number;
  autoplay: boolean;
  chatNickname: string;
  showChat: boolean;
  parentalPin: string;
  parentalEnabled: boolean;
  bufferLength: number;
  sleepTimerMinutes: number;
  tvMode: boolean;
}

export interface QualityLevel {
  index: number;
  height: number;
  width: number;
  bitrate: number;
  label: string;
}
