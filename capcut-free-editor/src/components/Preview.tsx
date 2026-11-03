import { useProject } from '../store';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

interface PreviewProps {
  onSetPlayhead: (seconds: number) => void;
  onTogglePlay: () => void;
  isPlaying: boolean;
}

export function Preview({ onSetPlayhead, onTogglePlay, isPlaying }: PreviewProps) {
  const { state, dispatch } = useProject();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const rafRef = React.useRef<number>(0);

  const playheadPx = (state.playhead / Math.max(state.duration, 1)) * 100;

  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) v.play().catch(() => {});
    else v.pause();
    return () => {
      cancelAnimationFrame(rafRef.current);
      v.pause();
    };
  }, [isPlaying]);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, x / rect.width));
    const seconds = fraction * Math.max(state.duration, 1);
    onSetPlayhead(seconds);
    if (videoRef.current) videoRef.current.currentTime = seconds;
  };

  const timeFormat = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full h-[420px] bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center group">
      <div className="absolute inset-0 bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          className="max-h-full max-w-full object-contain"
          src={state.playhead > 0 ? state.playhead.toString() : ''}
          preload="metadata"
        />
        {!state.playhead && (
          <div className="text-slate-500 text-sm">
            No video preview — add a film from the left panel
          </div>
        )}
      </div>

      <div className="playhead pointer-events-none" style={{ left: `${playheadPx}%` }}></div>

      <div className="absolute bottom-4 left-0 right-0 flex items-center justify-between px-6 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const v = videoRef.current;
              if (v) v.currentTime = Math.max(0, v.currentTime - 5);
              onSetPlayhead(Math.max(0, state.playhead - 5));
            }}
            className="p-2 rounded hover:bg-white/10 text-slate-300"
          >
            <SkipBack size={20} />
          </button>
          <button onClick={onTogglePlay} className="p-2 rounded hover:bg-white/10 text-slate-300">
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            onClick={() => {
              const v = videoRef.current;
              const next = Math.min(state.duration, v ? v.currentTime + 5 : state.playhead + 5);
              if (v) v.currentTime = next;
              onSetPlayhead(next);
            }}
            className="p-2 rounded hover:bg-white/10 text-slate-300"
          >
            <SkipForward size={20} />
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>{timeFormat(state.playhead)}</span>
          <span className="text-slate-600">/</span>
          <span>{timeFormat(state.duration)}</span>
        </div>
        <button
          onClick={onTogglePlay}
          className="text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded hover:bg-emerald-500/20 border border-emerald-500/20"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800 cursor-pointer group-hover:bg-slate-700"
        onClick={seek}
      >
        <div className="h-full bg-emerald-500" style={{ width: `${playheadPx}%` }} />
      </div>
    </div>
  );
}

import React from 'react';
