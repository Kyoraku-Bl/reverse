import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  Activity,
  Captions,
  Cast,
  ChevronDown,
  Gauge,
  Headphones,
  ListVideo,
  Maximize,
  Minimize,
  Moon,
  Music2,
  Pause,
  PictureInPicture2,
  Play,
  Radio,
  RefreshCw,
  Server,
  Settings2,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { Channel } from '../types';
import { channelKey, useAppStore } from '../store/appStore';
import { useHlsPlayer } from '../hooks/useHlsPlayer';
import { castSessionState, loadCastSdk, startCast, stopCast, watchCastState } from '../lib/cast';
import type { TKey } from '../i18n';
import { useI18n } from '../hooks/useI18n';
import { currentProgramme, formatTime, nextProgramme, programmeProgress } from '../lib/epg';
import { Badge } from './ui';

interface PlayerProps {
  channel: Channel | null;
  muted?: boolean;
  compact?: boolean;
  className?: string;
  onToggleChat?: () => void;
  onOpenMultiview?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export function Player({
  channel,
  muted = false,
  compact = false,
  className,
  onToggleChat,
  onOpenMultiview,
  onPrev,
  onNext,
}: PlayerProps) {
  const { t, lang } = useI18n();
  const settings = useAppStore((state) => state.settings);
  const setSettings = useAppStore((state) => state.setSettings);
  const favorites = useAppStore((state) => state.favorites);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const pushRecent = useAppStore((state) => state.pushRecent);
  const toggleMultiview = useAppStore((state) => state.toggleMultiview);
  const multiview = useAppStore((state) => state.multiview);
  const epgByChannel = useAppStore((state) => state.epgByChannel);

  const [serverIndex, setServerIndex] = useState(0);
  const [menu, setMenu] = useState<null | 'quality' | 'audio' | 'subs' | 'servers' | 'stats' | 'sleep'>(null);
  const [showControls, setShowControls] = useState(true);
  const [audioOnly, setAudioOnly] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [localMuted, setLocalMuted] = useState(settings.startMuted);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hideTimer = useRef<number | null>(null);

  // Chromecast
  const [castReady, setCastReady] = useState(false);
  const [casting, setCasting] = useState(false);
  const [castBusy, setCastBusy] = useState(false);
  const [castNote, setCastNote] = useState<TKey | null>(null);

  const key = channel ? channelKey(channel) : null;
  const isFavorite = key ? favorites.includes(key) : false;
  const inMultiview = key ? multiview.includes(key) : false;

  const url = channel ? (channel.urls[Math.min(serverIndex, channel.urls.length - 1)] ?? null) : null;

  const onFatal = useCallback(() => {
    if (!channel || channel.urls.length < 2) return;
    setServerIndex((current) => (current + 1) % channel.urls.length);
  }, [channel]);

  const player = useHlsPlayer({
    url,
    muted: muted || localMuted,
    volume: settings.volume,
    qualityCap: settings.qualityCap,
    autoReconnect: settings.autoReconnect,
    reconnectAttempts: settings.reconnectAttempts,
    lowLatency: settings.lowLatency,
    bufferLength: settings.bufferLength,
    nativePlayer: settings.nativePlayer,
    onFatal,
  });

  const { videoRef } = player;

  // reset per-channel state
  useEffect(() => {
    setServerIndex(0);
    setAudioOnly(false);
    setMenu(null);
    if (channel) pushRecent(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel?.id]);

  // background / lockscreen playback controls
  useEffect(() => {
    if (!('mediaSession' in navigator) || !channel) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: channel.name,
      artist: channel.group ?? 'Drama Live Web',
      album: 'Drama Live Web',
      artwork: channel.logo ? [{ src: channel.logo, sizes: '512x512', type: 'image/png' }] : [],
    });
    navigator.mediaSession.setActionHandler('play', () => player.togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => player.togglePlay());
    return () => {
      navigator.mediaSession.metadata = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel?.id]);

  const now = Date.now();
  const epgList = channel?.tvgId ? epgByChannel.get(channel.tvgId) : undefined;
  const nowProgramme = currentProgramme(epgList, now);
  const nextProgrammeItem = nextProgramme(epgList, now);

  const autoHide = useCallback(() => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    setShowControls(true);
    hideTimer.current = window.setTimeout(() => {
      if (menu === null) setShowControls(false);
    }, 3200);
  }, [menu]);

  useEffect(() => autoHide(), [autoHide]);
  useEffect(() => {
    if (menu !== null) setShowControls(true);
  }, [menu]);

  const toggleFullscreen = useCallback(async () => {
    const node = containerRef.current;
    if (!node) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      setIsFull(false);
    } else {
      await node.requestFullscreen().catch(() => undefined);
      setIsFull(true);
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // sleep timer
  useEffect(() => {
    if (!settings.sleepTimerMinutes) return;
    const id = window.setTimeout(() => {
      player.pause();
      setSettings({ sleepTimerMinutes: 0 });
    }, settings.sleepTimerMinutes * 60_000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.sleepTimerMinutes, setSettings]);

  useEffect(() => {
    let active = true;
    void loadCastSdk().then((available) => {
      if (!active) return;
      setCastReady(available);
      setCasting(castSessionState() === 'SESSION_STARTED');
    });
    const stop = watchCastState((state) => setCasting(state === 'SESSION_STARTED'));
    return () => {
      active = false;
      stop();
    };
  }, []);

  const handleCast = async () => {
    if (casting) {
      stopCast();
      setCasting(false);
      return;
    }
    if (!url) return;
    setCastBusy(true);
    setCastNote(null);
    const outcome = await startCast(url);
    setCastBusy(false);
    if (outcome.ok) {
      setCasting(true);
      setCastNote('player.cast.connected');
    } else {
      const reason: Record<string, TKey> = {
        unavailable: 'player.cast.unavailable',
        cancelled: 'player.cast.cancelled',
        failed: 'player.cast.failed',
        'unsupported-stream': 'player.cast.unsupported',
      };
      setCastNote(reason[outcome.reason] ?? 'player.cast.failed');
    }
    window.setTimeout(() => setCastNote(null), 3500);
  };

  // keyboard / TV remote shortcuts
  const shortcuts = useRef({ togglePlay: player.togglePlay, pip: player.pip, toggleFullscreen, onPrev, onNext, setLocalMuted });
  shortcuts.current = { togglePlay: player.togglePlay, pip: player.pip, toggleFullscreen, onPrev, onNext, setLocalMuted };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const actions = shortcuts.current;
      switch (event.key) {
        case ' ':
        case 'k':
          event.preventDefault();
          actions.togglePlay();
          break;
        case 'm':
          actions.setLocalMuted((value: boolean) => !value);
          break;
        case 'f':
          void actions.toggleFullscreen();
          break;
        case 'p':
          void actions.pip().catch(() => undefined);
          break;
        case 'ArrowUp':
          event.preventDefault();
          actions.onPrev?.();
          break;
        case 'ArrowDown':
          event.preventDefault();
          actions.onNext?.();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const volume = muted ? 0 : settings.volume;
  const isRadio = channel?.radio ?? false;

  const qualityLabel = useMemo(() => {
    if (player.currentLevel < 0) return t('player.auto');
    const level = player.levels.find((item) => item.index === player.currentLevel);
    if (!level) return t('player.auto');
    return `${level.label}${level.height ? ` · ${level.height}p` : ''}`;
  }, [player.currentLevel, player.levels, t]);

  const stateBadge = useMemo(() => {
    switch (player.state) {
      case 'playing':
        return { tone: 'ok' as const, label: t('player.live') };
      case 'loading':
        return { tone: 'default' as const, label: t('common.loading') };
      case 'reconnecting':
        return { tone: 'live' as const, label: `${t('player.reconnecting')} (${t('player.attempt')} ${player.attempt})` };
      case 'error':
        return { tone: 'live' as const, label: t('player.failed') };
      default:
        return { tone: 'default' as const, label: t('player.live') };
    }
  }, [player.state, player.attempt, t]);

  if (!channel) {
    return (
      <div
        className={clsx(
          'flex h-full w-full flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-white/10 bg-ink-900/60 p-10 text-center',
          className,
        )}
      >
        <ListVideo className="h-12 w-12 text-slate-600" />
        <p className="text-sm text-slate-400">{t('player.emptyHint')}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={autoHide}
      onTouchStart={autoHide}
      className={clsx(
        'group relative isolate flex h-full w-full flex-col overflow-hidden rounded-3xl bg-black',
        className,
      )}
    >
      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          autoPlay
          className={clsx(
            'h-full w-full bg-black object-contain transition-opacity duration-300',
            (audioOnly || isRadio) && 'opacity-0',
          )}
          onClick={() => player.togglePlay()}
        />

        {audioOnly || isRadio ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-ink-900 via-ink-950 to-black">
            {channel.logo ? (
              <img src={channel.logo} alt="" className="h-24 w-24 rounded-2xl object-contain" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
            ) : null}
            <div className="flex items-end gap-1">
              {[0, 1, 2, 3, 4, 5, 6].map((bar) => (
                <span
                  key={bar}
                  className="w-1.5 rounded-full bg-brand-500"
                  style={{
                    height: `${12 + ((bar * 7) % 26)}px`,
                    animation: `pulse-live ${0.9 + bar * 0.13}s ease-in-out infinite`,
                  }}
                />
              ))}
            </div>
            <p className="text-lg font-bold text-white">{channel.name}</p>
            <p className="text-xs text-slate-400">{t('player.audioOnly')}</p>
          </div>
        ) : null}

        {/* top bar */}
        <div
          className={clsx(
            'pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent p-4 transition-opacity duration-300',
            showControls ? 'opacity-100' : 'opacity-0',
          )}
        >
          <div className="pointer-events-auto min-w-0">
            <div className="flex items-center gap-2">
              <Badge tone={stateBadge.tone}>
                {player.state === 'playing' ? <span className="live-dot h-1.5 w-1.5 rounded-full bg-red-500" /> : null}
                {stateBadge.label}
              </Badge>
              {channel.urls.length > 1 ? <Badge tone="gold">{channel.urls.length} {t('player.servers')}</Badge> : null}
            </div>
            <h3 className="mt-1.5 truncate text-base font-bold text-white sm:text-lg">{channel.name}</h3>
            {nowProgramme ? (
              <p className="truncate text-xs text-slate-300">
                {formatTime(nowProgramme.start, lang)} · {nowProgramme.title}
              </p>
            ) : null}
          </div>

          {!compact ? (
            <div className="pointer-events-auto flex items-center gap-1.5">
              <IconButton
                active={isFavorite}
                label={isFavorite ? t('player.favorite.remove') : t('player.favorite.add')}
                onClick={() => key && toggleFavorite(key)}
              >
                <Star className={clsx('h-5 w-5', isFavorite && 'fill-gold-400 text-gold-400')} />
              </IconButton>
              <IconButton
                active={inMultiview}
                label={t('player.multiview')}
                onClick={() => {
                  if (key) toggleMultiview(key);
                  onOpenMultiview?.();
                }}
              >
                <ListVideo className="h-5 w-5" />
              </IconButton>
              {onToggleChat ? (
                <IconButton active={settings.showChat} label={t('chat.title')} onClick={onToggleChat}>
                  <Activity className="h-5 w-5" />
                </IconButton>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* reconnect / error overlay */}
        {player.state === 'error' ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center">
            <p className="text-sm font-bold text-white">{t('player.failed')}</p>
            <p className="max-w-md text-xs text-slate-400">{t('player.failedHint')}</p>
            <button
              type="button"
              onClick={player.retry}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20"
            >
              <RefreshCw className="h-4 w-4" />
              {t('sources.refresh')}
            </button>
          </div>
        ) : null}

        {player.state === 'reconnecting' ? (
          <div className="absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center">
            <div className="flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-xs font-bold text-white">
              <RefreshCw className="h-4 w-4 animate-spin" />
              {t('player.reconnecting')} · {t('player.attempt')} {player.attempt}/{settings.reconnectAttempts}
            </div>
          </div>
        ) : null}

        {/* controls */}
        <div
          className={clsx(
            'absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pb-3 pt-10 transition-opacity duration-300 sm:px-4',
            showControls ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          {!player.stats.live && player.stats.duration > 0 ? (
            <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-300">
              <span>{formatClock(player.stats.currentTime)}</span>
              <input
                type="range"
                min={0}
                max={player.stats.duration || 0}
                step={1}
                value={player.stats.currentTime}
                onChange={(event) => player.seek(Number(event.target.value))}
                className="h-1 flex-1 accent-brand-500"
              />
              <span>{formatClock(player.stats.duration)}</span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-1.5">
            <IconButton label={t('nav.live')} onClick={player.togglePlay}>
              {player.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </IconButton>

            <IconButton
              label={muted || localMuted ? t('player.mute') : t('player.volume')}
              onClick={() => setLocalMuted((value) => !value)}
            >
              {muted || localMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </IconButton>

            {!muted ? (
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.volume}
                onChange={(event) => setSettings({ volume: Number(event.target.value) })}
                className="h-1 w-16 accent-brand-500 sm:w-24"
                aria-label={t('player.volume')}
              />
            ) : null}

            <div className="flex-1" />

            <MenuButton label={qualityLabel} icon={<Gauge className="h-4 w-4" />} open={menu === 'quality'} onClick={() => setMenu(menu === 'quality' ? null : 'quality')}>
              <MenuItem active={player.currentLevel === -1} onClick={() => { player.setLevel(-1); setMenu(null); }}>
                {t('player.auto')}
              </MenuItem>
              {player.levels.map((level) => (
                <MenuItem
                  key={level.index}
                  active={player.currentLevel === level.index}
                  onClick={() => { player.setLevel(level.index); setMenu(null); }}
                >
                  {level.label}
                  {level.height ? ` · ${level.height}p` : ''}
                  <span className="ms-auto text-[10px] text-slate-500">{Math.round(level.bitrate / 1000)}k</span>
                </MenuItem>
              ))}
            </MenuButton>

            {player.audioTracks.length > 1 ? (
              <MenuButton label={t('player.audio')} icon={<Music2 className="h-4 w-4" />} open={menu === 'audio'} onClick={() => setMenu(menu === 'audio' ? null : 'audio')}>
                {player.audioTracks.map((track) => (
                  <MenuItem key={track.id} active={player.currentAudio === track.id} onClick={() => { player.setAudioTrack(track.id); setMenu(null); }}>
                    {track.name}
                  </MenuItem>
                ))}
              </MenuButton>
            ) : null}

            {player.subtitles.length > 0 ? (
              <MenuButton label={t('player.subs')} icon={<Captions className="h-4 w-4" />} open={menu === 'subs'} onClick={() => setMenu(menu === 'subs' ? null : 'subs')}>
                <MenuItem active={player.currentSubtitle === -1} onClick={() => { player.setSubtitleTrack(-1); setMenu(null); }}>
                  {t('player.subs.off')}
                </MenuItem>
                {player.subtitles.map((track) => (
                  <MenuItem key={track.id} active={player.currentSubtitle === track.id} onClick={() => { player.setSubtitleTrack(track.id); setMenu(null); }}>
                    {track.name}
                  </MenuItem>
                ))}
              </MenuButton>
            ) : null}

            {channel.urls.length > 1 ? (
              <MenuButton label={t('player.servers')} icon={<Server className="h-4 w-4" />} open={menu === 'servers'} onClick={() => setMenu(menu === 'servers' ? null : 'servers')}>
                {channel.urls.map((item, index) => (
                  <MenuItem key={item} active={index === serverIndex} onClick={() => { setServerIndex(index); setMenu(null); }}>
                    {lang === 'ar' ? `خادم ${index + 1}` : `Server ${index + 1}`}
                  </MenuItem>
                ))}
              </MenuButton>
            ) : null}

            <MenuButton label={t('player.sleep')} icon={<Moon className="h-4 w-4" />} open={menu === 'sleep'} onClick={() => setMenu(menu === 'sleep' ? null : 'sleep')}>
              {[0, 15, 30, 45, 60, 90].map((minutes) => (
                <MenuItem key={minutes} active={settings.sleepTimerMinutes === minutes} onClick={() => { setSettings({ sleepTimerMinutes: minutes }); setMenu(null); }}>
                  {minutes === 0 ? t('player.sleep.off') : `${minutes} ${t('player.sleep.minutes')}`}
                </MenuItem>
              ))}
            </MenuButton>

            <IconButton
              label={t('player.audioOnly')}
              active={audioOnly}
              onClick={() => setAudioOnly((value) => !value)}
            >
              <Headphones className="h-5 w-5" />
            </IconButton>

            {castReady ? (
              <IconButton
                label={casting ? t('player.cast.stop') : t('player.cast')}
                active={casting}
                onClick={handleCast}
              >
                <Cast className={clsx('h-5 w-5', castBusy && 'animate-pulse')} />
              </IconButton>
            ) : null}

            <IconButton label={t('player.pip')} onClick={() => player.pip().catch(() => window.alert(t('player.pip.unsupported')))}>
              <PictureInPicture2 className="h-5 w-5" />
            </IconButton>

            <MenuButton label={t('player.stats')} icon={<Settings2 className="h-4 w-4" />} open={menu === 'stats'} onClick={() => setMenu(menu === 'stats' ? null : 'stats')}>
              <div className="space-y-1 px-3 py-2 text-[11px] text-slate-300">
                <StatRow label={t('player.stats.resolution')} value={player.stats.height ? `${player.stats.width}×${player.stats.height}` : '—'} />
                <StatRow label={t('player.stats.bitrate')} value={player.stats.bitrate ? `${(player.stats.bitrate / 1_000_000).toFixed(2)} Mbps` : '—'} />
                <StatRow label={t('player.stats.buffer')} value={`${player.stats.buffered.toFixed(1)}s`} />
                <StatRow label={t('player.stats.dropped')} value={`${player.stats.dropped}/${player.stats.total}`} />
              </div>
            </MenuButton>

            <IconButton label={isFull ? t('player.fullscreen') : t('player.fullscreen')} onClick={toggleFullscreen}>
              {isFull ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </IconButton>
          </div>

          {castNote ? (
            <p className="mt-2 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white">{t(castNote)}</p>
          ) : null}

          {nowProgramme ? (
            <div className="mt-2.5">
              <div className="h-1 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${programmeProgress(nowProgramme)}%` }} />
              </div>
              <p className="mt-1 truncate text-[11px] text-slate-300">
                <span className="font-bold text-white">{nowProgramme.title}</span>
                {nextProgrammeItem ? ` · ${t('guide.next')}: ${formatTime(nextProgrammeItem.start, lang)} ${nextProgrammeItem.title}` : null}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {isRadio ? (
        <div className="flex items-center gap-2 border-t border-white/5 bg-ink-900 px-4 py-2 text-[11px] text-slate-400">
          <Radio className="h-3.5 w-3.5 text-brand-500" />
          {t('nav.radio')}
        </div>
      ) : null}
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={clsx(
        'grid h-9 w-9 place-items-center rounded-lg text-slate-200 transition focus-ring',
        active ? 'bg-brand-600 text-white' : 'bg-white/10 hover:bg-white/20',
      )}
    >
      {children}
    </button>
  );
}

function MenuButton({
  children,
  label,
  icon,
  open,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  icon: React.ReactNode;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        title={label}
        className={clsx(
          'inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-200 transition focus-ring',
          open ? 'bg-brand-600 text-white' : 'bg-white/10 hover:bg-white/20',
        )}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      {open ? (
        <div className="absolute bottom-11 end-0 z-30 max-h-64 w-52 overflow-auto rounded-xl border border-white/10 bg-ink-900/95 p-1.5 shadow-2xl backdrop-blur">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-xs transition',
        active ? 'bg-brand-600/20 text-brand-300' : 'text-slate-300 hover:bg-white/10',
      )}
    >
      {children}
    </button>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono text-slate-200">{value}</span>
    </div>
  );
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds)) return '--:--';
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
}
