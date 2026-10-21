import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls, { type ErrorData, type Level } from 'hls.js';
import type { QualityLevel } from '../types';

export type PlayerState = 'idle' | 'loading' | 'playing' | 'reconnecting' | 'error';

export interface HlsPlayerOptions {
  url: string | null;
  userAgent?: string;
  muted?: boolean;
  volume?: number;
  /** 0 = automatic, otherwise the maximum height in pixels */
  qualityCap?: number;
  autoReconnect?: boolean;
  reconnectAttempts?: number;
  lowLatency?: boolean;
  bufferLength?: number;
  /** Prefer the browser's built-in HLS stack over hls.js when both are available */
  nativePlayer?: boolean;
  /** When true the player keeps decoding but stays paused (used by multi-view panes) */
  paused?: boolean;
  /** Called when the player gives up on a url so the caller can switch server */
  onFatal?: (url: string) => void;
}

export interface StreamStats {
  width: number;
  height: number;
  bitrate: number;
  dropped: number;
  total: number;
  buffered: number;
  live: boolean;
  duration: number;
  currentTime: number;
}

export interface TrackInfo {
  id: number;
  name: string;
  lang?: string;
}

const DIRECT_MEDIA = /\.(mp4|m4v|webm|ogv|mov|mp3|m4a|aac|ogg|opus|wav|flac)(\?|$)/i;

function labelForHeight(height: number): string {
  if (height >= 2000) return '4K';
  if (height >= 1400) return 'QHD';
  if (height >= 1000) return 'FHD';
  if (height >= 700) return 'HD';
  if (height >= 480) return 'SD';
  return `${height}p`;
}

export function useHlsPlayer(options: HlsPlayerOptions) {
  const {
    url,
    muted = false,
    volume = 1,
    qualityCap = 0,
    autoReconnect = true,
    reconnectAttempts = 6,
    lowLatency = false,
    bufferLength = 30,
    nativePlayer = false,
    paused = false,
    onFatal,
  } = options;

  // A state-backed callback ref: effects must re-run when the <video> element
  // mounts later (the player renders without one until a channel is selected).
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const videoRef = useCallback((node: HTMLVideoElement | null) => setVideoEl(node), []);
  const hlsRef = useRef<Hls | null>(null);
  const attemptsRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const [state, setState] = useState<PlayerState>('idle');
  const [playing, setPlaying] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [audioTracks, setAudioTracks] = useState<TrackInfo[]>([]);
  const [currentAudio, setCurrentAudio] = useState(-1);
  const [subtitles, setSubtitles] = useState<TrackInfo[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState(-1);
  const [stats, setStats] = useState<StreamStats>({
    width: 0,
    height: 0,
    bitrate: 0,
    dropped: 0,
    total: 0,
    buffered: 0,
    live: true,
    duration: 0,
    currentTime: 0,
  });

  const isDirectMedia = useMemo(() => (url ? DIRECT_MEDIA.test(url) : false), [url]);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const destroyHls = () => {
    clearTimer();
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  };

  useEffect(() => {
    const video = videoEl;
    if (!video) return;
    destroyHls();
    attemptsRef.current = 0;
    setAttempt(0);
    setLevels([]);
    setAudioTracks([]);
    setSubtitles([]);
    if (!url) {
      setState('idle');
      video.removeAttribute('src');
      video.load();
      return;
    }

    setState('loading');

    const playSafe = () => {
      const promise = video.play();
      if (promise && typeof promise.catch === 'function') promise.catch(() => undefined);
    };

    const scheduleRetry = () => {
      if (!autoReconnect) {
        setState('error');
        onFatal?.(url);
        return;
      }
      attemptsRef.current += 1;
      setAttempt(attemptsRef.current);
      if (attemptsRef.current > reconnectAttempts) {
        setState('error');
        onFatal?.(url);
        return;
      }
      setState('reconnecting');
      const delay = Math.min(8000, 800 * 2 ** (attemptsRef.current - 1));
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        const hls = hlsRef.current;
        if (hls) {
          hls.startLoad();
          playSafe();
        } else if (video) {
          video.load();
          playSafe();
        }
      }, delay);
    };

    const handleError = (_event: string, data: ErrorData) => {
      if (!data.fatal) return;
      const hls = hlsRef.current;
      if (!hls) {
        scheduleRetry();
        return;
      }
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hls.recoverMediaError();
        return;
      }
      scheduleRetry();
    };

    const supportsNativeHls = Boolean(video.canPlayType('application/vnd.apple.mpegurl') || video.canPlayType('application/x-mpegURL'));
    if (isDirectMedia || !Hls.isSupported() || (nativePlayer && supportsNativeHls)) {
      video.src = url;
      if (!paused) playSafe();
      video.addEventListener('error', () => scheduleRetry(), { once: false });
      return;
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: lowLatency,
      backBufferLength: 30,
      maxBufferLength: bufferLength,
      maxMaxBufferLength: Math.max(bufferLength * 2, 60),
      capLevelToPlayerSize: qualityCap === 0,
      startLevel: qualityCap === 0 ? -1 : undefined,
      liveDurationInfinity: true,
      xhrSetup: (xhr) => {
        xhr.withCredentials = false;
      },
    });
    hlsRef.current = hls;

    hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      const parsed: QualityLevel[] = data.levels
        .map((level: Level, index: number) => ({
          index,
          height: level.height || 0,
          width: level.width || 0,
          bitrate: level.bitrate || 0,
          label: level.height ? labelForHeight(level.height) : `${Math.round((level.bitrate || 0) / 1000)}kbps`,
        }))
        .sort((a, b) => b.height - a.height);
      setLevels(parsed);
      if (qualityCap > 0) {
        const target = parsed.find((level) => level.height && level.height <= qualityCap);
        if (target) hls.currentLevel = target.index;
      }
      if (!paused) playSafe();
      setState('playing');
      attemptsRef.current = 0;
      setAttempt(0);
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => setCurrentLevel(data.level));
    hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event, data) => {
      setAudioTracks(data.audioTracks.map((track) => ({ id: track.id, name: track.name || track.lang || `Track ${track.id + 1}`, lang: track.lang })));
    });
    hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_event, data) => setCurrentAudio(data.id));
    hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_event, data) => {
      setSubtitles(data.subtitleTracks.map((track) => ({ id: track.id, name: track.name || track.lang || `Subtitle ${track.id + 1}`, lang: track.lang })));
    });
    hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_event, data) => setCurrentSubtitle(data.id));
    hls.on(Hls.Events.ERROR, handleError as never);

    hls.loadSource(url);
    hls.attachMedia(video);

    return () => {
      destroyHls();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, lowLatency, bufferLength, qualityCap, videoEl]);

  // keep the real play/pause state in sync with the media element
  useEffect(() => {
    const video = videoEl;
    if (!video) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    video.addEventListener('play', onPlay);
    video.addEventListener('playing', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('playing', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [url, videoEl]);

  // volume / mute / pause side effects
  useEffect(() => {
    const video = videoEl;
    if (!video) return;
    video.muted = muted;
    video.volume = volume;
  }, [muted, volume, videoEl]);

  useEffect(() => {
    const video = videoEl;
    if (!video) return;
    if (paused && !video.paused) video.pause();
    if (!paused && video.paused) {
      const promise = video.play();
      if (promise && typeof promise.catch === 'function') promise.catch(() => undefined);
    }
  }, [paused, videoEl]);

  // stats polling
  useEffect(() => {
    const id = window.setInterval(() => {
      const video = videoEl;
      if (!video) return;
      const hls = hlsRef.current;
      const activeLevel = hls && hls.currentLevel >= 0 ? hls.levels[hls.currentLevel] : undefined;
      const quality = video.getVideoPlaybackQuality?.();
      const bufferedEnd = video.buffered.length ? video.buffered.end(video.buffered.length - 1) - video.currentTime : 0;
      setStats({
        width: activeLevel?.width ?? video.videoWidth,
        height: activeLevel?.height ?? video.videoHeight,
        bitrate: activeLevel?.bitrate ?? 0,
        dropped: quality?.droppedVideoFrames ?? 0,
        total: quality?.totalVideoFrames ?? 0,
        buffered: Math.max(0, bufferedEnd),
        live: !Number.isFinite(video.duration) || video.duration === Infinity || Math.abs(video.duration) < 1e-6,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        currentTime: video.currentTime,
      });
      if (hls && video.paused === false && state === 'reconnecting') setState('playing');
    }, 1000);
    return () => window.clearInterval(id);
  }, [state, videoEl]);

  const setLevel = useCallback((index: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = index;
    setCurrentLevel(index);
  }, []);

  const setAudioTrack = useCallback((id: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.audioTrack = id;
    setCurrentAudio(id);
  }, []);

  const setSubtitleTrack = useCallback((id: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.subtitleTrack = id;
    setCurrentSubtitle(id);
  }, []);

  const retry = useCallback(() => {
    attemptsRef.current = 0;
    setAttempt(0);
    const hls = hlsRef.current;
    const video = videoEl;
    setState('loading');
    if (hls) {
      hls.startLoad();
    } else if (video && video.src) {
      video.load();
    }
  }, []);

  const pip = useCallback(async () => {
    const video = videoEl;
    if (!video || !document.pictureInPictureEnabled) throw new Error('unsupported');
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else await video.requestPictureInPicture();
  }, []);

  const seek = useCallback((seconds: number) => {
    const video = videoEl;
    if (!video) return;
    video.currentTime = seconds;
  }, []);

  const pause = useCallback(() => {
    const video = videoEl;
    if (video) video.pause();
  }, [videoEl]);

  const togglePlay = useCallback(() => {
    const video = videoEl;
    if (!video) return;
    if (video.paused) {
      const promise = video.play();
      if (promise && typeof promise.catch === 'function') promise.catch(() => undefined);
    } else {
      video.pause();
    }
  }, []);

  const setRate = useCallback((rate: number) => {
    const video = videoEl;
    if (video) video.playbackRate = rate;
  }, []);

  return {
    videoRef,
    state,
    playing,
    attempt,
    levels,
    currentLevel,
    setLevel,
    audioTracks,
    currentAudio,
    setAudioTrack,
    subtitles,
    currentSubtitle,
    setSubtitleTrack,
    stats,
    retry,
    pip,
    seek,
    pause,
    togglePlay,
    setRate,
    isDirectMedia,
    hls: hlsRef,
  };
}
