import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { CalendarDays, Clock, Radio, Tv } from 'lucide-react';
import { channelKey, useAppStore } from '../store/appStore';
import { useI18n } from '../hooks/useI18n';
import { currentProgramme, formatDay, formatTime, nextProgramme, programmeProgress } from '../lib/epg';
import { Button, Field, Spinner } from '../components/ui';
import { buildDemoEpg } from '../lib/demo';
import type { Programme } from '../types';

export function GuidePage() {
  const { t, lang } = useI18n();
  const channels = useAppStore((state) => state.channels);
  const epgByChannel = useAppStore((state) => state.epgByChannel);
  const loadEpg = useAppStore((state) => state.loadEpg);
  const setCurrent = useAppStore((state) => state.setCurrent);
  const pushRecent = useAppStore((state) => state.pushRecent);

  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const now = Date.now();
  const hasEpg = epgByChannel.size > 0;

  const rows = useMemo(
    () =>
      channels
        .filter((channel) => channel.kind === 'live' || channel.kind === 'radio')
        .slice(0, 200)
        .map((channel) => {
          const list = channel.tvgId ? epgByChannel.get(channel.tvgId) : undefined;
          return { channel, list };
        }),
    [channels, epgByChannel],
  );

  const selected = rows.find((row) => row.channel.id === selectedId) ?? rows[0];

  const load = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await loadEpg(url.trim());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'error');
    } finally {
      setBusy(false);
    }
  };

  const loadDemo = () => {
    const { byChannel } = buildDemoEpg(channels.slice(0, 60));
    useAppStore.setState((state) => {
      const next = new Map(state.epgByChannel);
      for (const [key, value] of byChannel) next.set(key, value);
      return { epgByChannel: next };
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3 lg:flex-row lg:overflow-hidden">
      <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-ink-900/50">
        <div className="space-y-3 border-b border-white/10 p-4">
          <h1 className="flex items-center gap-2 text-sm font-extrabold text-white">
            <CalendarDays className="h-4 w-4 text-brand-500" />
            {t('guide.title')}
          </h1>

          <div className="flex flex-wrap items-end gap-2">
            <Field
              className="min-w-[220px] flex-1"
              placeholder="https://…/guide.xml"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
            <Button onClick={load} disabled={busy}>
              {busy ? <Spinner /> : null}
              {t('sources.load')}
            </Button>
            <Button variant="outline" onClick={loadDemo}>
              {t('guide.load')}
            </Button>
          </div>

          {error ? <p className="text-[11px] text-red-400">{error}</p> : null}
          {!hasEpg ? <p className="text-[11px] text-slate-500">{t('guide.hint')}</p> : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {rows.map(({ channel, list }) => {
            const programme = currentProgramme(list, now);
            const upcoming = nextProgramme(list, now);
            const active = selected?.channel.id === channel.id;
            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => setSelectedId(channel.id)}
                className={clsx(
                  'grid-focus flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-start transition',
                  active ? 'bg-brand-600/20 ring-1 ring-brand-500/40' : 'hover:bg-white/5',
                )}
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-800">
                  {channel.radio ? <Radio className="h-4 w-4 text-slate-500" /> : <Tv className="h-4 w-4 text-slate-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">{channel.name}</p>
                  {programme ? (
                    <>
                      <p className="truncate text-[11px] text-slate-400">
                        {formatTime(programme.start, lang)} — {programme.title}
                      </p>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full bg-brand-500" style={{ width: `${programmeProgress(programme, now)}%` }} />
                      </div>
                    </>
                  ) : (
                    <p className="truncate text-[11px] text-slate-600">{t('guide.empty')}</p>
                  )}
                </div>
                {upcoming ? (
                  <span className="hidden shrink-0 text-[10px] text-slate-500 sm:block">
                    {formatTime(upcoming.start, lang)} {upcoming.title}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="min-h-0 w-full shrink-0 overflow-y-auto rounded-2xl border border-white/10 bg-ink-900/50 p-4 lg:w-96">
        {selected ? (
          <>
            <h2 className="text-sm font-extrabold text-white">{selected.channel.name}</h2>
            <p className="mb-3 text-[11px] text-slate-500">{formatDay(now, lang)}</p>

            <button
              type="button"
              onClick={() => {
                setCurrent(channelKey(selected.channel));
                pushRecent(selected.channel);
              }}
              className="mb-4 w-full rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-500"
            >
              ▶ {t('nav.app')}
            </button>

            {selected.list?.length ? (
              <ol className="space-y-2">
                {selected.list
                  .filter((item) => item.stop > now - 6 * 3600_000)
                  .slice(0, 30)
                  .map((item) => (
                    <TimelineItem key={`${item.start}-${item.title}`} programme={item} now={now} lang={lang} />
                  ))}
              </ol>
            ) : (
              <p className="text-xs text-slate-500">{t('guide.empty')}</p>
            )}
          </>
        ) : (
          <p className="text-xs text-slate-500">{t('guide.empty')}</p>
        )}
      </section>
    </div>
  );
}

function TimelineItem({ programme, now, lang }: { programme: Programme; now: number; lang: 'ar' | 'en' }) {
  const isNow = programme.start <= now && programme.stop > now;
  const past = programme.stop <= now;
  return (
    <li
      className={clsx(
        'rounded-xl border p-3 transition',
        isNow ? 'border-brand-500/40 bg-brand-600/10' : 'border-white/10 bg-white/[0.02]',
        past && 'opacity-50',
      )}
    >
      <div className="flex items-center gap-2">
        <Clock className={clsx('h-3.5 w-3.5', isNow ? 'text-brand-400' : 'text-slate-600')} />
        <span className="font-mono text-[11px] text-slate-400">
          {formatTime(programme.start, lang)} – {formatTime(programme.stop, lang)}
        </span>
        {isNow ? (
          <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[9px] font-black text-white">LIVE</span>
        ) : null}
      </div>
      <p className="mt-1 text-xs font-bold text-slate-100">{programme.title}</p>
      {programme.description ? (
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-400">{programme.description}</p>
      ) : null}
      {programme.category ? <p className="mt-1 text-[10px] text-slate-600">{programme.category}</p> : null}
    </li>
  );
}
