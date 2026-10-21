import { memo, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Radio, Search, Star, Tv } from 'lucide-react';
import type { Channel } from '../types';
import type { TKey } from '../i18n';
import { channelKey, useAppStore } from '../store/appStore';
import { useI18n } from '../hooks/useI18n';
import { currentProgramme, formatTime } from '../lib/epg';

const PAGE_SIZE = 120;

const HEALTH_LABEL: Record<string, 'player.health.ok' | 'player.health.cors' | 'player.health.missing' | 'player.health.timeout' | 'player.health.error'> = {
  ok: 'player.health.ok',
  cors: 'player.health.cors',
  missing: 'player.health.missing',
  timeout: 'player.health.timeout',
  error: 'player.health.error',
};

const HEALTH_COLOR: Record<string, string> = {
  ok: 'bg-emerald-500',
  cors: 'bg-amber-500',
  missing: 'bg-red-500',
  timeout: 'bg-orange-500',
  error: 'bg-red-500',
};

function healthDot(status: string | undefined, t: (key: TKey) => string) {
  if (!status) return null;
  return (
    <span
      title={`${t(HEALTH_LABEL[status] ?? 'player.health.error')}`}
      className={clsx('h-2 w-2 shrink-0 rounded-full', HEALTH_COLOR[status] ?? 'bg-slate-500')}
    />
  );
}

export function useChannelFilters(channels: Channel[]) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, number>();
    for (const channel of channels) {
      const key = channel.group || '—';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [channels]);

  const countries = useMemo(() => {
    const map = new Map<string, number>();
    for (const channel of channels) {
      if (!channel.country) continue;
      for (const code of channel.country.split(';')) {
        const key = code.trim().toUpperCase();
        if (key) map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
  }, [channels]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return channels.filter((channel) => {
      if (group && (channel.group || '—') !== group) return false;
      if (country && !(channel.country ?? '').toUpperCase().includes(country)) return false;
      if (!needle) return true;
      return (
        channel.name.toLowerCase().includes(needle) ||
        (channel.group ?? '').toLowerCase().includes(needle) ||
        (channel.tvgId ?? '').toLowerCase().includes(needle)
      );
    });
  }, [channels, query, group, country]);

  return { query, setQuery, group, setGroup, country, setCountry, groups, countries, filtered };
}

export function ChannelSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-ink-850 py-2.5 ps-9 pe-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-500 focus-ring"
      />
    </div>
  );
}

export function GroupChips({
  groups,
  active,
  onSelect,
  allLabel,
}: {
  groups: [string, number][];
  active: string | null;
  onSelect: (group: string | null) => void;
  allLabel: string;
}) {
  return (
    <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
      <Chip active={active === null} onClick={() => onSelect(null)} label={`${allLabel} · ${groups.reduce((sum, [, count]) => sum + count, 0)}`} />
      {groups.slice(0, 60).map(([name, count]) => (
        <Chip key={name} active={active === name} onClick={() => onSelect(name)} label={`${name} · ${count}`} />
      ))}
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition focus-ring',
        active ? 'bg-brand-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200',
      )}
    >
      {label}
    </button>
  );
}

export const ChannelList = memo(function ChannelList({
  channels,
  selectedKey,
  onSelect,
  emptyLabel,
  emptyHint,
}: {
  channels: Channel[];
  selectedKey: string | null;
  onSelect: (channel: Channel) => void;
  emptyLabel: string;
  emptyHint?: string;
}) {
  const { lang, t } = useI18n();
  const health = useAppStore((state) => state.health);
  const favorites = useAppStore((state) => state.favorites);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const epgByChannel = useAppStore((state) => state.epgByChannel);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const visible = channels.slice(0, limit);
  const now = Date.now();

  if (!channels.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <Tv className="h-10 w-10 text-slate-700" />
        <p className="text-sm font-semibold text-slate-300">{emptyLabel}</p>
        {emptyHint ? <p className="text-xs text-slate-500">{emptyHint}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {visible.map((channel) => {
        const key = channelKey(channel);
        const active = key === selectedKey;
        const isFavorite = favorites.includes(key);
        const programme = channel.tvgId ? currentProgramme(epgByChannel.get(channel.tvgId), now) : undefined;
        return (
          <div
            key={channel.id}
            className={clsx(
              'group grid-focus relative flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition',
              active ? 'bg-brand-600/20 ring-1 ring-brand-500/40' : 'hover:bg-white/5',
            )}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(channel)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(channel);
              }
            }}
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-ink-800">
              {channel.logo ? (
                <img
                  src={channel.logo}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-contain"
                  onError={(event) => {
                    (event.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : channel.radio ? (
                <Radio className="h-5 w-5 text-slate-500" />
              ) : (
                <Tv className="h-5 w-5 text-slate-500" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className={clsx('truncate text-sm font-semibold', active ? 'text-white' : 'text-slate-200')}>
                {channel.name}
              </p>
              <p className="truncate text-[11px] text-slate-500">
                {programme
                  ? `${formatTime(programme.start, lang)} ${programme.title}`
                  : (channel.group ?? channel.country ?? '—')}
              </p>
            </div>

            {channel.urls.length > 1 ? (
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
                ×{channel.urls.length}
              </span>
            ) : null}

            {healthDot(health[channel.urls[0]]?.status, t)}

            <button
              type="button"
              aria-label="favorite"
              onClick={(event) => {
                event.stopPropagation();
                toggleFavorite(key);
              }}
              className={clsx(
                'grid h-8 w-8 shrink-0 place-items-center rounded-lg transition',
                isFavorite ? 'text-gold-400' : 'text-slate-600 opacity-0 group-hover:opacity-100 hover:text-gold-400',
              )}
            >
              <Star className={clsx('h-4 w-4', isFavorite && 'fill-current')} />
            </button>
          </div>
        );
      })}

      {channels.length > limit ? (
        <button
          type="button"
          onClick={() => setLimit((value) => value + PAGE_SIZE)}
          className="w-full rounded-xl border border-dashed border-white/10 py-3 text-xs font-bold text-slate-400 hover:border-brand-500 hover:text-brand-400"
        >
          + {Math.min(PAGE_SIZE, channels.length - limit)}
        </button>
      ) : null}
    </div>
  );
});

export function ChannelPosterGrid({
  channels,
  selectedKey,
  onSelect,
  emptyLabel,
}: {
  channels: Channel[];
  selectedKey: string | null;
  onSelect: (channel: Channel) => void;
  emptyLabel: string;
}) {
  const favorites = useAppStore((state) => state.favorites);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const [limit, setLimit] = useState(60);
  const visible = channels.slice(0, limit);

  if (!channels.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
        <Tv className="h-10 w-10 text-slate-700" />
        <p className="text-sm text-slate-400">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {visible.map((channel) => {
          const key = channelKey(channel);
          const active = key === selectedKey;
          const isFavorite = favorites.includes(key);
          return (
            <button
              key={channel.id}
              type="button"
              onClick={() => onSelect(channel)}
              className={clsx(
                'grid-focus group relative overflow-hidden rounded-2xl border bg-ink-850 p-3 text-start transition hover:-translate-y-0.5 hover:border-brand-500/60',
                active ? 'border-brand-500 ring-1 ring-brand-500/40' : 'border-white/10',
              )}
            >
              <div className="grid aspect-video place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-ink-800 to-ink-900">
                {channel.logo ? (
                  <img
                    src={channel.logo}
                    alt=""
                    loading="lazy"
                    className="max-h-full max-w-full object-contain p-2"
                    onError={(event) => {
                      (event.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <Tv className="h-8 w-8 text-slate-600" />
                )}
              </div>
              <p className="mt-2 truncate text-xs font-bold text-slate-100">{channel.name}</p>
              <p className="truncate text-[10px] text-slate-500">{channel.group ?? '—'}</p>
              <span
                role="button"
                tabIndex={-1}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleFavorite(key);
                }}
                className={clsx(
                  'absolute end-2 top-2 grid h-7 w-7 place-items-center rounded-lg bg-black/60 transition',
                  isFavorite ? 'text-gold-400' : 'text-slate-400 opacity-0 group-hover:opacity-100',
                )}
              >
                <Star className={clsx('h-3.5 w-3.5', isFavorite && 'fill-current')} />
              </span>
            </button>
          );
        })}
      </div>
      {channels.length > limit ? (
        <button
          type="button"
          onClick={() => setLimit((value) => value + 60)}
          className="mt-4 w-full rounded-xl border border-dashed border-white/10 py-3 text-xs font-bold text-slate-400 hover:border-brand-500 hover:text-brand-400"
        >
          + {Math.min(60, channels.length - limit)}
        </button>
      ) : null}
    </div>
  );
}
