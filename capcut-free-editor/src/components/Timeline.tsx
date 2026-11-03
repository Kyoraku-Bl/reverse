import { useProject } from '../store';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Scissors, Plus } from 'lucide-react';
import { findClip, clipEndsAt } from '../store';

const EDGE = 6;

const FILTER_DOT: Record<string, string> = {
  grayscale: 'bg-gray-400',
  invert: 'bg-purple-400',
  sepia: 'bg-orange-400',
  blur: 'bg-blue-400',
  brightness: 'bg-yellow-400',
  contrast: 'bg-pink-400',
  saturate: 'bg-green-400',
};

interface TimelineProps {
  pxPerSecond: number;
  trackHeight: number;
  onSplitAtPlayhead: () => void;
}

export function Timeline({
  pxPerSecond,
  trackHeight,
  onSplitAtPlayhead,
}: TimelineProps) {
  const { state, dispatch } = useProject();
  const containerRef = useRef<HTMLDivElement>(null);

  const [dragging, setDragging] = useState<{
    clipId: string;
    mode: 'move' | 'resize-left' | 'resize-right';
    startX: number;
    initialStart: number;
    initialDuration: number;
  } | null>(null);

  const duration = Math.max(state.duration, 5);
  const width = duration * pxPerSecond;

  const snap = (v: number) => Math.round(v * 10) / 10;

  const onMouseDown = (
    e: React.MouseEvent,
    clip: ClipLike,
    mode: 'move' | 'resize-left' | 'resize-right',
  ) => {
    e.stopPropagation();
    const rect = containerRef.current!.getBoundingClientRect();
    setDragging({
      clipId: clip.id,
      mode,
      startX: e.clientX - rect.left,
      initialStart: clip.start,
      initialDuration: clip.duration,
    });
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const rect = containerRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const dx = (x - dragging.startX) / pxPerSecond;

      const update: Partial<import('../store').Clip> & { id: string } = {
        id: dragging.clipId,
      };

      if (dragging.mode === 'move') {
        let start = snap(dragging.initialStart + dx);
        start = Math.max(0, start);
        update.start = start;
      } else if (dragging.mode === 'resize-right') {
        let dur = snap(dragging.initialDuration + dx);
        dur = Math.max(0.3, dur);
        update.duration = dur;
      } else if (dragging.mode === 'resize-left') {
        let start = snap(dragging.initialStart + dx);
        const end = dragging.initialStart + dragging.initialDuration;
        start = Math.max(0, Math.min(start, end - 0.3));
        update.start = start;
        update.duration = end - start;
      }
      dispatch({ type: 'UPDATE_CLIP', payload: update });
      dispatch({ type: 'SET_DURATION', payload: clipEndsAt(state) });
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, pxPerSecond, state]);

  return (
    <div className="relative w-full max-w-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
      {/* ruler */}
      <div className="timeline-ruler w-full">
        <div className="w-12"></div>
        <div className="flex-1 flex" style={{ minWidth: `${width}px` }}>
          {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => {
            const t = i;
            const left = (t * pxPerSecond) / width;
            return (
              <div
                key={i}
                className="flex flex-col items-center text-[10px] text-slate-500 w-[60px] shrink-0"
                style={{ marginLeft: `${left * 100}%` }}
              >
                <div className="w-[1px] h-3 bg-slate-700 mb-1" />
                <div>{t}s</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* tracks */}
      <div
        ref={containerRef}
        className="relative w-full min-w-[600px] overflow-x-auto overflow-y-hidden pb-2"
        onWheel={(e) => {
          if (e.deltaY !== 0) {
            const el = containerRef.current;
            if (el) el.scrollLeft += e.deltaY;
          }
        }}
        style={{ minWidth: `${width + 120}px` }}
      >
        {state.tracks.map((track) => {
          const isActive = track.id === state.activeTrackId;
          const isAudio = track.type === 'audio';
          return (
            <div
              key={track.id}
              className={`timeline-track w-full ${
                isActive ? 'bg-slate-800/30' : ''
              } flex items-center`}
              style={{ minWidth: `${width + 120}px` }}
            >
              <div className="w-12 shrink-0 p-2 text-[11px] text-slate-500 border-r border-slate-800">
                {track.type === 'video' ? '🎬' : '🎵'} {track.name}
              </div>

              <div
                className="absolute inset-0 h-full z-0"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData('assetId');
                  if (id) {
                    const asset = state.assets.find((a) => a.id === id);
                    if (asset) {
                      const clip: import('../store').Clip = {
                        id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                        assetId: asset.id,
                        trackId: state.activeTrackId!,
                        start: state.playhead,
                        sourceStart: 0,
                        duration: Math.min(asset.duration, 8),
                        x: 0,
                        y: 0,
                        scale: 1,
                        opacity: 1,
                        filter: 'none',
                        speed: 1,
                        volume: 1,
                      };
                      dispatch({ type: 'ADD_CLIP', payload: clip });
                      dispatch({ type: 'SET_DURATION', payload: clipEndsAt(state) });
                    }
                  }
                }}
              />

              {track.clips.map((clip) => {
                const asset = state.assets.find((a) => a.id === clip.assetId);
                const selected = state.selectedClipId === clip.id;
                const left = (clip.start * pxPerSecond) / width;
                const pctWidth = (clip.duration * pxPerSecond) / width;
                const isAudioClip = asset?.type === 'audio';
                const filterDot = clip.filter && clip.filter !== 'none' ? FILTER_DOT[clip.filter] : null;

                return (
                  <div
                    key={clip.id}
                    className={`clip rounded-r-none ${
                      selected ? 'clip-selected' : ''
                    } ${isAudioClip ? 'bg-blue-600/30 border-blue-500/40' : 'bg-slate-700'}`}
                    style={{
                      left: `${left * 100}%`,
                      width: `${Math.max(pctWidth * 100, 2.5)}%`,
                    }}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('clipId', clip.id);
                    }}
                    onMouseDown={(e) => {
                      dispatch({ type: 'SELECT_CLIP', payload: clip.id });
                      dispatch({ type: 'SET_ACTIVE_TRACK', payload: track.id });
                      onMouseDown(e, clip, 'move');
                    }}
                    onClick={(e) => e.stopPropagation()}
                    title={`${asset?.name ?? clip.assetId} — ${clip.duration.toFixed(1)}s${clip.filter !== 'none' ? ` • Filter: ${clip.filter}` : ''} • Speed ${clip.speed}×`}
                  >
                    <div className="absolute left-1 top-1 h-[calc(100%-2px)] w-[3px] bg-white/40" />
                    <div className="px-2 text-[10px] text-slate-200 truncate leading-tight">
                      {asset?.name ?? 'Clip'}
                    </div>
                    {filterDot && (
                      <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${filterDot} border border-white/20`} />
                    )}
                    <div className="absolute bottom-1 right-1 text-[9px] text-slate-400">
                      {clip.duration.toFixed(1)}s
                    </div>
                    <div
                      className="absolute top-0 bottom-0 w-1.5 cursor-ew-resize z-20"
                      style={{ left: `-${EDGE / 2}px` }}
                      onMouseDown={(e) => onMouseDown(e, clip, 'resize-left')}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-1.5 cursor-ew-resize z-20"
                      style={{ right: `-${EDGE / 2}px` }}
                      onMouseDown={(e) => onMouseDown(e, clip, 'resize-right')}
                    />
                  </div>
                );
              })}

              <div className="playhead" style={{ left: '0%' }} />

              {isActive && state.selectedClipId && (
                <button
                  onClick={onSplitAtPlayhead}
                  className="absolute top-1/2 left-[calc(var(--playhead-left,0%)+4px)] -translate-y-1/2 bg-emerald-500 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity z-30 hover:(shadow-lg opacity-100)"
                  title="Split clip here"
                >
                  ✂
                </button>
              )}
            </div>
          );
        })}
      </div>

      {state.tracks.every((t) => t.clips.length === 0) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
          <Plus size={32} className="mb-2 opacity-50" />
          <p className="text-sm">Drag media from the left panel, or click a file to add it at the playhead position</p>
        </div>
      )}
    </div>
  );
}

interface ClipLike {
  id: string;
  start: number;
  duration: number;
}
