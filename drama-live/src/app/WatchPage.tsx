import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Channel, ChannelKind } from '../types';
import { channelKey, useAppStore } from '../store/appStore';
import { useI18n } from '../hooks/useI18n';
import { Player } from '../components/Player';
import { ChatPanel } from '../components/ChatPanel';
import {
  ChannelList,
  ChannelPosterGrid,
  ChannelSearch,
  GroupChips,
  useChannelFilters,
} from '../components/ChannelList';
import type { TKey } from '../i18n';
import { Plug, Stethoscope, Filter } from 'lucide-react';
import { probeMany } from '../lib/probe';
import { isAdult } from '../lib/filters';

export function WatchPage({
  kinds,
  favoriteOnly = false,
  title,
  view = 'list',
}: {
  kinds: ChannelKind[];
  favoriteOnly?: boolean;
  title: TKey;
  view?: 'list' | 'grid';
}) {
  const { t } = useI18n();
  const allChannels = useAppStore((state) => state.channels);
  const favorites = useAppStore((state) => state.favorites);
  const currentKey = useAppStore((state) => state.currentKey);
  const setCurrent = useAppStore((state) => state.setCurrent);
  const pushRecent = useAppStore((state) => state.pushRecent);
  const settings = useAppStore((state) => state.settings);
  const setSettings = useAppStore((state) => state.setSettings);
  const parentalUnlocked = useAppStore((state) => state.parentalUnlocked);
  const health = useAppStore((state) => state.health);
  const setHealth = useAppStore((state) => state.setHealth);

  const [onlyWorking, setOnlyWorking] = useState(false);
  const [probing, setProbing] = useState<{ done: number; total: number } | null>(null);
  const skipCount = useRef(0);

  const scoped = useMemo(
    () =>
      allChannels.filter((channel) => {
        if (!kinds.includes(channel.kind)) return false;
        if (favoriteOnly) return favorites.includes(channelKey(channel));
        if (settings.parentalEnabled && !parentalUnlocked && isAdult(channel)) return false;
        return true;
      }),
    [allChannels, kinds, favoriteOnly, favorites, settings.parentalEnabled, parentalUnlocked],
  );

  const { query, setQuery, group, setGroup, groups, filtered: matched } = useChannelFilters(scoped);

  const filtered = useMemo(() => {
    if (!onlyWorking) return matched;
    return matched.filter((channel) => health[channel.urls[0]]?.status === 'ok');
  }, [matched, onlyWorking, health]);

  const current = filtered.find((channel) => channelKey(channel) === currentKey) ?? null;

  /** Ask the streams themselves which channels actually play from this device. */
  const runProbe = useCallback(async () => {
    const targets = matched.slice(0, 80);
    if (!targets.length) return;
    setProbing({ done: 0, total: targets.length });
    let done = 0;
    await probeMany(targets.map((channel) => channel.urls[0]), {
      concurrency: 6,
      timeoutMs: 7000,
      proxy: settings.corsProxy,
      onResult: (url, result) => {
        done += 1;
        setHealth(url, { status: result.status, at: Date.now(), detail: result.detail });
        setProbing({ done, total: targets.length });
      },
    });
    setProbing(null);
  }, [matched, setHealth, settings.corsProxy]);

  const autoNext = useCallback(() => {
    // never loop forever through a dead playlist
    if (skipCount.current >= 5) return;
    skipCount.current += 1;
    step(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetSkips = useCallback(() => {
    skipCount.current = 0;
  }, []);

  // autoplay the first channel of the section
  useEffect(() => {
    if (!settings.autoplay) return;
    if (current) return;
    const first = filtered[0];
    if (first) setCurrent(channelKey(first));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoplay, filtered.length, currentKey]);

  const step = (direction: -1 | 1) => {
    if (!filtered.length) return;
    const index = filtered.findIndex((channel) => channelKey(channel) === currentKey);
    const next = filtered[(index + direction + filtered.length) % filtered.length] ?? filtered[0];
    if (next) {
      setCurrent(channelKey(next));
      pushRecent(next);
    }
  };

  const select = (channel: Channel) => {
    setCurrent(channelKey(channel));
    pushRecent(channel);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3 lg:flex-row">
      <section className="order-1 flex min-h-0 flex-1 flex-col gap-3 lg:order-2">
        <div className="min-h-0 flex-1">
          <Player
            channel={current}
            onToggleChat={() => setSettings({ showChat: !settings.showChat })}
            onOpenMultiview={() => {
              if (current) useAppStore.getState().toggleMultiview(channelKey(current));
            }}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            onAutoNext={autoNext}
            onPlaying={resetSkips}
          />
        </div>

        {current ? (
          <div className="shrink-0 rounded-2xl border border-white/10 bg-ink-900/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold text-white">{current.name}</h2>
                <p className="truncate text-xs text-slate-500">
                  {current.group ?? '—'} {current.country ? `· ${current.country}` : ''}
                </p>
              </div>
              <Link
                to="/app/multiview"
                className="shrink-0 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-white/10"
              >
                {t('player.multiview')}
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      <section className="order-2 flex min-h-0 w-full shrink-0 flex-col rounded-2xl border border-white/10 bg-ink-900/50 lg:order-1 lg:w-80 xl:w-96">
        <div className="space-y-2.5 border-b border-white/10 p-3">
          <h1 className="text-sm font-extrabold text-white">{t(title)}</h1>
          <ChannelSearch value={query} onChange={setQuery} placeholder={t('player.search')} />
          {groups.length > 1 ? (
            <GroupChips groups={groups} active={group} onSelect={setGroup} allLabel={t('player.all')} />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runProbe}
              disabled={Boolean(probing)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-white/20 disabled:opacity-50"
            >
              <Stethoscope className="h-3.5 w-3.5" />
              {probing ? `${t('player.probe.running')} ${probing.done}/${probing.total}` : t('player.probe')}
            </button>
            <button
              type="button"
              onClick={() => setOnlyWorking((value) => !value)}
              className={
                onlyWorking
                  ? 'inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white'
                  : 'inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-white/20'
              }
            >
              <Filter className="h-3.5 w-3.5" />
              {t('player.probe.onlyWorking')}
            </button>
            <span className="text-[11px] text-slate-500">
              {filtered.length.toLocaleString()} {t('player.channelsCount')}
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {view === 'grid' ? (
            <ChannelPosterGrid
              channels={filtered}
              selectedKey={currentKey}
              onSelect={select}
              emptyLabel={t('player.noResults')}
            />
          ) : filtered.length ? (
            <ChannelList
              channels={filtered}
              selectedKey={currentKey}
              onSelect={select}
              emptyLabel={t('player.noResults')}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm font-semibold text-slate-300">{t('player.empty')}</p>
              <p className="text-xs text-slate-500">{t('player.emptyHint')}</p>
              <Link
                to="/app/sources"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-500"
              >
                <Plug className="h-4 w-4" />
                {t('player.addSource')}
              </Link>
            </div>
          )}
        </div>
      </section>

      {settings.showChat ? (
        <>
          <section className="order-3 hidden min-h-0 w-80 shrink-0 lg:block">
            <ChatPanel channelName={current?.name} onClose={() => setSettings({ showChat: false })} />
          </section>
          <div className="fixed inset-x-0 bottom-0 z-50 h-[60dvh] p-2 lg:hidden">
            <ChatPanel channelName={current?.name} onClose={() => setSettings({ showChat: false })} />
          </div>
        </>
      ) : null}
    </div>
  );
}
