import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Channel, ChatMessage, HealthEntry, Programme, Settings, Source, SourceKind, XtreamCredentials } from '../types';
import { mergeServers, parsePlaylistText, serializePlaylist } from '../lib/m3u';
import { classifyInput, decodeFgCode, encodeFgCode } from '../lib/fgcode';
import { fetchXtreamChannels, xtreamM3uUrl } from '../lib/xtream';
import { parseXmltv } from '../lib/epg';
import { DEMO_PLAYLIST } from '../lib/demo';

const RAW_LIMIT = 2_200_000; // keep localStorage happy

export function channelKey(channel: Pick<Channel, 'name' | 'group' | 'kind'>): string {
  return `${channel.name.toLowerCase()}|${(channel.group ?? '').toLowerCase()}|${channel.kind}`;
}

export interface RecentItem {
  key: string;
  name: string;
  logo?: string;
  group?: string;
  at: number;
}

interface AppState {
  settings: Settings;
  sources: Source[];
  channels: Channel[];
  favorites: string[];
  recent: RecentItem[];
  multiview: string[];
  currentKey: string | null;
  epgByChannel: Map<string, Programme[]>;
  chat: ChatMessage[];
  hydrated: boolean;
  parentalUnlocked: boolean;
  health: Record<string, HealthEntry>;

  setSettings: (patch: Partial<Settings>) => void;
  addSourceFromText: (input: {
    name: string;
    text: string;
    kind: SourceKind;
    reference: string;
    xtream?: XtreamCredentials;
    epgUrl?: string;
  }) => Promise<Source>;
  addSourceFromUrl: (name: string, url: string, epgUrl?: string) => Promise<Source>;
  addSourceFromXtream: (creds: XtreamCredentials, name?: string) => Promise<Source>;
  addSourceFromFgCode: (code: string, name?: string) => Promise<Source>;
  addSourceFromFile: (name: string, text: string) => Promise<Source>;
  loadDemo: () => Promise<Source>;
  loadIptvOrg: () => Promise<Source>;
  removeSource: (id: string) => void;
  toggleSource: (id: string) => void;
  refreshSource: (id: string) => Promise<void>;
  loadEpg: (url: string) => Promise<number>;
  toggleFavorite: (key: string) => void;
  pushRecent: (channel: Channel) => void;
  setCurrent: (key: string | null) => void;
  setMultiview: (keys: string[]) => void;
  toggleMultiview: (key: string) => void;
  pushChat: (message: ChatMessage) => void;
  unlockParental: (pin: string) => boolean;
  lockParental: () => void;
  setHealth: (url: string, entry: HealthEntry) => void;
  clearHealth: () => void;
  clearChat: () => void;
  resetAll: () => void;
  exportM3u: () => string;
  makeFgCode: (sourceId: string) => string | null;
  /** Re-derives the channel list from the enabled sources (also runs after rehydration). */
  recompute: () => void;
}

const defaultSettings: Settings = {
  lang: 'ar',
  theme: 'dark',
  qualityCap: 0,
  autoReconnect: true,
  reconnectAttempts: 6,
  lowLatency: false,
  nativePlayer: false,
  // browsers only allow the first autoplay when it starts muted
  startMuted: true,
  volume: 1,
  autoplay: true,
  chatNickname: `مشاهد-${Math.floor(Math.random() * 9000 + 1000)}`,
  showChat: false,
  parentalPin: '',
  parentalEnabled: false,
  bufferLength: 30,
  sleepTimerMinutes: 0,
  tvMode: false,
  autoSkip: true,
  corsProxy: '',
};

/**
 * localStorage is not always usable: inside a cross-origin iframe (the live preview
 * panel) or in private mode the browser throws on access. Fall back to memory so the
 * app still runs — playlists just won't survive a reload.
 */
function safeStorage(): Storage {
  const memory = new Map<string, string>();
  const fallback: Storage = {
    get length() {
      return memory.size;
    },
    clear: () => memory.clear(),
    getItem: (key: string) => (memory.has(key) ? (memory.get(key) as string) : null),
    key: (index: number) => [...memory.keys()][index] ?? null,
    removeItem: (key: string) => {
      memory.delete(key);
    },
    setItem: (key: string, value: string) => {
      memory.set(key, String(value));
    },
  };

  if (typeof window === 'undefined') return fallback;
  try {
    const probe = '__drama_live_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return fallback;
  }
}

const storage = safeStorage();

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function rebuildChannels(sources: Source[], rawBySource: Map<string, string>): Channel[] {
  const all: Channel[] = [];
  for (const source of sources) {
    if (!source.enabled) continue;
    const raw = rawBySource.get(source.id);
    if (!raw) continue;
    all.push(...parsePlaylistText(raw, source.id, source.name).channels);
  }
  return mergeServers(all);
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      sources: [],
      channels: [],
      favorites: [],
      recent: [],
      multiview: [],
      currentKey: null,
      epgByChannel: new Map(),
      chat: [],
      hydrated: false,
      parentalUnlocked: false,
      health: {},

      setSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),

      addSourceFromText: async ({ name, text, kind, reference, xtream, epgUrl }) => {
        const id = newId('src');
        const parsed = parsePlaylistText(text, id, name);
        const channels = mergeServers(parsed.channels);
        const source: Source = {
          id,
          name: name || parsed.title || 'Playlist',
          kind,
          reference,
          xtream,
          epgUrl: epgUrl || parsed.epgUrl,
          channelCount: channels.length,
          addedAt: Date.now(),
          updatedAt: Date.now(),
          enabled: true,
          raw: text.length <= RAW_LIMIT ? text : undefined,
          error: text.length > RAW_LIMIT ? 'too-large-to-persist' : undefined,
        };
        set((state) => ({ sources: [...state.sources, source] }));
        get().recompute();
        if (source.epgUrl) void get().loadEpg(source.epgUrl);
        return source;
      },

      addSourceFromUrl: async (name, url, epgUrl) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        return get().addSourceFromText({ name, text, kind: 'm3u-url', reference: url, epgUrl });
      },

      addSourceFromFile: async (name, text) =>
        get().addSourceFromText({ name, text, kind: 'm3u-file', reference: `file:${name}` }),

      addSourceFromXtream: async (creds, name) => {
        const label = name || `${creds.username}@${new URL(creds.server).host}`;
        try {
          const id = newId('src');
          const channels = await fetchXtreamChannels(creds, id);
          const text = serializePlaylist(channels, label);
          const source: Source = {
            id,
            name: label,
            kind: 'xtream',
            reference: xtreamM3uUrl(creds),
            xtream: creds,
            channelCount: channels.length,
            addedAt: Date.now(),
            updatedAt: Date.now(),
            enabled: true,
            raw: text.length <= RAW_LIMIT ? text : undefined,
          };
          set((state) => ({ sources: [...state.sources, source] }));
          get().recompute();
          return source;
        } catch (error) {
          // Panels without CORS headers still expose the classic M3U export.
          const text = await fetch(xtreamM3uUrl(creds)).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.text();
          });
          return get().addSourceFromText({
            name: label,
            text,
            kind: 'xtream',
            reference: xtreamM3uUrl(creds),
            xtream: creds,
          });
        }
      },

      addSourceFromFgCode: async (code, name) => {
        const payload = decodeFgCode(code);
        if (!payload) throw new Error('bad-fg-code');
        if (payload.t === 'xt') {
          return get().addSourceFromXtream({ server: payload.s, username: payload.r, password: payload.p }, payload.n);
        }
        return get().addSourceFromUrl(payload.u, payload.n ?? name ?? 'FG playlist');
      },

      loadDemo: async () =>
        get().addSourceFromText({ name: 'Demo · تجريبي', text: DEMO_PLAYLIST, kind: 'm3u-text', reference: 'demo' }),

      loadIptvOrg: async () =>
        get().addSourceFromUrl('iptv-org (public)', 'https://iptv-org.github.io/iptv/index.m3u'),

      removeSource: (id) => {
        set((state) => ({ sources: state.sources.filter((s) => s.id !== id) }));
        get().recompute();
      },

      toggleSource: (id) => {
        set((state) => ({
          sources: state.sources.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
        }));
        get().recompute();
      },

      refreshSource: async (id) => {
        const source = get().sources.find((s) => s.id === id);
        if (!source) return;
        if (source.kind === 'xtream' && source.xtream) {
          get().removeSource(id);
          await get().addSourceFromXtream(source.xtream, source.name);
          return;
        }
        if (source.kind === 'm3u-url') {
          const response = await fetch(source.reference);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const text = await response.text();
          get().removeSource(id);
          await get().addSourceFromText({
            name: source.name,
            text,
            kind: source.kind,
            reference: source.reference,
            epgUrl: source.epgUrl,
          });
        }
      },

      loadEpg: async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const xml = await response.text();
        const parsed = parseXmltv(xml);
        set((state) => {
          const next = new Map(state.epgByChannel);
          for (const [key, value] of parsed.byChannel) next.set(key, value);
          return { epgByChannel: next };
        });
        return parsed.programmes.length;
      },

      toggleFavorite: (key) =>
        set((state) => ({
          favorites: state.favorites.includes(key)
            ? state.favorites.filter((f) => f !== key)
            : [...state.favorites, key],
        })),

      pushRecent: (channel) => {
        const key = channelKey(channel);
        set((state) => ({
          recent: [
            { key, name: channel.name, logo: channel.logo, group: channel.group, at: Date.now() },
            ...state.recent.filter((item) => item.key !== key),
          ].slice(0, 24),
          currentKey: key,
        }));
      },

      setCurrent: (key) => set({ currentKey: key }),

      setMultiview: (keys) => set({ multiview: keys.slice(0, 4) }),

      toggleMultiview: (key) =>
        set((state) => {
          const has = state.multiview.includes(key);
          if (has) return { multiview: state.multiview.filter((k) => k !== key) };
          if (state.multiview.length >= 4) return state;
          return { multiview: [...state.multiview, key] };
        }),

      unlockParental: (pin) => {
        const settings = get().settings;
        if (!settings.parentalEnabled || settings.parentalPin === pin) {
          set({ parentalUnlocked: true });
          return true;
        }
        return false;
      },

      lockParental: () => set({ parentalUnlocked: false }),

      setHealth: (url, entry) =>
        set((state) => {
          const next = { ...state.health, [url]: entry };
          // keep the persisted map bounded
          const keys = Object.keys(next);
          if (keys.length > 600) {
            for (const key of keys.slice(0, keys.length - 600)) delete next[key];
          }
          return { health: next };
        }),

      clearHealth: () => set({ health: {} }),

      pushChat: (message) => set((state) => ({ chat: [...state.chat, message].slice(-200) })),

      clearChat: () => set({ chat: [] }),

      resetAll: () => {
        storage.removeItem('drama-live-web');
        set({
          settings: defaultSettings,
          sources: [],
          channels: [],
          favorites: [],
          recent: [],
          multiview: [],
          currentKey: null,
          epgByChannel: new Map(),
          chat: [],
          parentalUnlocked: false,
        });
      },

      exportM3u: () => serializePlaylist(get().channels, 'Drama Live Web'),

      makeFgCode: (sourceId) => {
        const source = get().sources.find((s) => s.id === sourceId);
        if (!source) return null;
        if (source.kind === 'xtream' && source.xtream) {
          return encodeFgCode({
            t: 'xt',
            s: source.xtream.server,
            r: source.xtream.username,
            p: source.xtream.password,
            n: source.name,
          });
        }
        if (source.kind === 'm3u-url') return encodeFgCode({ t: 'm3u', u: source.reference, n: source.name, e: source.epgUrl });
        return null;
      },

      recompute: () => {
        const state = get();
        const rawBySource = new Map<string, string>();
        for (const source of state.sources) {
          if (source.raw) rawBySource.set(source.id, source.raw);
        }
        set({ channels: rebuildChannels(state.sources, rawBySource) });
      },
    }),
    {
      name: 'drama-live-web',
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        settings: state.settings,
        sources: state.sources,
        favorites: state.favorites,
        recent: state.recent,
        health: state.health,
        chat: state.chat.slice(-50),
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.recompute();
        useAppStore.setState({ hydrated: true });
      },
    },
  ),
);

/** Helper used by the UI to accept anything the user pastes into the source box. */
export function detectInputKind(value: string): SourceKind | null {
  const kind = classifyInput(value);
  if (kind === 'url') return 'm3u-url';
  if (kind === 'fg') return 'fg-code';
  if (kind === 'm3u-text') return 'm3u-text';
  return null;
}
