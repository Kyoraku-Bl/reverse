import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Plus, Search, X } from 'lucide-react';
import { channelKey, useAppStore } from '../store/appStore';
import { useI18n } from '../hooks/useI18n';
import { Player } from '../components/Player';
import type { Channel } from '../types';

export function MultiViewPage() {
  const { t } = useI18n();
  const channels = useAppStore((state) => state.channels);
  const multiview = useAppStore((state) => state.multiview);
  const toggleMultiview = useAppStore((state) => state.toggleMultiview);
  const [focused, setFocused] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  const active = useMemo(
    () => multiview.map((key) => channels.find((channel) => channelKey(channel) === key)).filter(Boolean) as Channel[],
    [multiview, channels],
  );

  const layout = active.length <= 1 ? 'grid-cols-1' : active.length === 3 ? 'grid-cols-2' : 'grid-cols-2';

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-sm font-extrabold text-white">{t('player.multiview')}</h1>
        <span className="text-[11px] text-slate-500">{t('player.multiview.hint')}</span>
        <div className="flex-1" />
        {active.length < 4 ? (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white hover:bg-brand-500"
          >
            <Plus className="h-4 w-4" />
            {t('player.multiview.add')}
          </button>
        ) : null}
      </div>

      <div className={clsx('grid min-h-0 flex-1 gap-3', layout, active.length === 0 && 'place-items-center')}>
        {active.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/10 p-10 text-center">
            <p className="text-sm text-slate-400">{t('player.multiview.hint')}</p>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20"
            >
              {t('player.multiview.add')}
            </button>
          </div>
        ) : null}

        {active.map((channel, index) => (
          <div
            key={channel.id}
            onClick={() => setFocused(index)}
            className={clsx(
              'relative min-h-0 overflow-hidden rounded-2xl transition',
              index === focused ? 'ring-2 ring-brand-500' : 'opacity-80 hover:opacity-100',
              active.length === 3 && index === 2 ? 'col-span-2' : '',
            )}
          >
            <Player channel={channel} muted={index !== focused} compact />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                toggleMultiview(channelKey(channel));
                setFocused(0);
              }}
              className="absolute end-2 top-2 z-30 grid h-8 w-8 place-items-center rounded-lg bg-black/70 text-slate-200 hover:bg-red-600"
              aria-label="remove"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {pickerOpen ? <Picker onClose={() => setPickerOpen(false)} /> : null}
    </div>
  );
}

function Picker({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const channels = useAppStore((state) => state.channels);
  const multiview = useAppStore((state) => state.multiview);
  const toggleMultiview = useAppStore((state) => state.toggleMultiview);
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return channels
      .filter((channel) => !needle || channel.name.toLowerCase().includes(needle))
      .filter((channel) => !multiview.includes(channelKey(channel)))
      .slice(0, 80);
  }, [channels, query, multiview]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-ink-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-3">
          <h2 className="text-sm font-bold text-white">{t('player.multiview.add')}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('player.search')}
              className="w-full rounded-xl border border-white/10 bg-ink-850 py-2.5 ps-9 pe-3 text-sm text-slate-100 focus:border-brand-500 focus-ring"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {results.map((channel) => (
            <button
              key={channel.id}
              type="button"
              onClick={() => {
                toggleMultiview(channelKey(channel));
                onClose();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start text-sm text-slate-200 hover:bg-white/5"
            >
              <span className="truncate font-semibold">{channel.name}</span>
              <span className="ms-auto shrink-0 text-[10px] text-slate-500">{channel.group ?? '—'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
