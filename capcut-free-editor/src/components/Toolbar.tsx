import { useProject } from '../store';
import {
  Plus,
  Music,
  TextCursor,
  Trash2,
  Download,
  RotateCw,
  Zap,
  Undo,
  Redo,
  Maximize,
  Minimize,
  Scissors,
  Film,
  Sliders,
} from 'lucide-react';

interface ToolbarProps {
  onImport: () => void;
  onAddText: () => void;
  onAddAudio: () => void;
  onExport: () => void;
  onRemoveSelected: () => void;
  onSplitSelected: () => void;
  selectedClip: {
    id: string;
    text?: string;
    fontSize?: number;
    color?: string;
    filter: string;
    speed: number;
    volume: number;
    x: number;
    y: number;
    scale: number;
    opacity: number;
  } | null;
  onUpdateSelected: (changes: Partial<{
    text: string;
    fontSize: number;
    color: string;
    filter: string;
    speed: number;
    volume: number;
    x: number;
    y: number;
    scale: number;
    opacity: number;
  }>) => void;
  onAddTrack: (type: 'video' | 'audio') => void;
  onRemoveTrack: (id: string) => void;
  tracks: Array<{ id: string; type: string; name: string }>;
  activeTrackId: string | null;
  onSetActiveTrack: (id: string | null) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  pxPerSecond: number;
  onSetPxPerSecond: (v: number) => void;
}

const FILTERS: Array<{ id: string; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'grayscale', label: 'Grayscale' },
  { id: 'invert', label: 'Invert' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'blur', label: 'Blur' },
  { id: 'brightness', label: 'Brightness' },
  { id: 'contrast', label: 'Contrast' },
  { id: 'saturate', label: 'Saturate' },
];

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

export function Toolbar({
  onImport,
  onAddText,
  onAddAudio,
  onExport,
  onRemoveSelected,
  onSplitSelected,
  selectedClip,
  onUpdateSelected,
  onAddTrack,
  onRemoveTrack,
  tracks,
  activeTrackId,
  onSetActiveTrack,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  pxPerSecond,
  onSetPxPerSecond,
}: ToolbarProps) {
  return (
    <div className="flex flex-col gap-3 p-4 bg-slate-800/60 backdrop-blur border-b border-slate-700 z-20">
      {/* row 1: main actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={onImport} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-sm">
            <Plus size={18} /> Import Media
          </button>
          <button onClick={onAddText} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-sm">
            <TextCursor size={18} /> Text
          </button>
          <button onClick={onAddAudio} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-sm">
            <Music size={18} /> Audio
          </button>
          <button onClick={onSplitSelected} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed" disabled={!selectedClip}>
            <Scissors size={18} /> Split Clip
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-2 rounded hover:bg-white/10 text-slate-300 disabled:opacity-40"
            title="Undo"
          >
            <Undo size={18} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-2 rounded hover:bg-white/10 text-slate-300 disabled:opacity-40"
            title="Redo"
          >
            <Redo size={18} />
          </button>
          <button onClick={onExport} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-900/20">
            <Download size={18} /> Export Video
          </button>
        </div>
      </div>

      {/* row 2: selected clip quick edits */}
      {selectedClip && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-700/50">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 uppercase">Text</label>
            <input
              value={selectedClip.text ?? ''}
              onChange={(e) => onUpdateSelected({ text: e.target.value })}
              className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-100 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 uppercase">Filter</label>
            <select
              value={selectedClip.filter}
              onChange={(e) => onUpdateSelected({ filter: e.target.value as any })}
              className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-100 focus:ring-1 focus:ring-emerald-500"
            >
              {FILTERS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 uppercase">Speed</label>
            <select
              value={String(selectedClip.speed)}
              onChange={(e) => onUpdateSelected({ speed: Number(e.target.value) })}
              className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-100 focus:ring-1 focus:ring-emerald-500"
            >
              {SPEEDS.map((s) => (
                <option key={s} value={String(s)}>
                  {s}×
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 uppercase">Volume</label>
            <input
              type="range"
              min="0" max="2" step="0.1"
              value={selectedClip.volume}
              onChange={(e) => onUpdateSelected({ volume: Number(e.target.value) })}
              className="h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="text-[10px] text-slate-500">
              {Math.round(selectedClip.volume * 100)}%
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 uppercase">Scale</label>
            <input
              type="range"
              min="0.1" max="2" step="0.1"
              value={selectedClip.scale}
              onChange={(e) => onUpdateSelected({ scale: Number(e.target.value) })}
              className="h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="text-[10px] text-slate-500">
              {Math.round(selectedClip.scale * 100)}%
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 uppercase">Opacity</label>
            <input
              type="range"
              min="0" max="1" step="0.1"
              value={selectedClip.opacity}
              onChange={(e) => onUpdateSelected({ opacity: Number(e.target.value) })}
              className="h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="text-[10px] text-slate-500">
              {Math.round(selectedClip.opacity * 100)}%
            </div>
          </div>
        </div>
      )}

      {/* row 3: tracks & zoom */}
      <div className="pt-2 border-t border-slate-700/50 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400">Track:</span>
          {tracks.map((t) => (
            <button
              key={t.id}
              onClick={() => onSetActiveTrack(t.id)}
              className={`px-2 py-1 rounded text-xs border ${
                activeTrackId === t.id
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500'
                  : 'bg-slate-800 text-slate-400 border-slate-600 hover:text-white'
              }`}
            >
              {t.type === 'video' ? '🎬' : '🎵'} {t.name}
            </button>
          ))}
          <button
            onClick={() => onAddTrack('video')}
            className="text-[10px] text-slate-400 hover:text-emerald-400 px-1.5"
            title="Add video track"
          >
            <Plus size={12} />
          </button>
          {tracks.length > 1 && (
            <button
              onClick={() => onRemoveTrack(activeTrackId ?? '')}
              className="text-[10px] text-slate-400 hover:text-red-400 px-1.5"
              title="Remove active track"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <span className="text-[10px] text-slate-400">Timeline zoom:</span>
          <input
            type="range"
            min="40" max="220" step="10"
            value={pxPerSecond}
            onChange={(e) => onSetPxPerSecond(Number(e.target.value))}
            className="flex-1 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <span className="text-[10px] text-slate-500 w-16 text-right">{pxPerSecond}px/sec</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="hidden md:flex p-1.5 rounded hover:bg-white/10 text-slate-300 disabled:opacity-40"
            title="Undo"
          >
            <Undo size={16} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="hidden md:flex p-1.5 rounded hover:bg-white/10 text-slate-300 disabled:opacity-40"
            title="Redo"
          >
            <Redo size={16} />
          </button>
          <button
            onClick={onRemoveSelected}
            className="p-2 rounded hover:bg-red-500/20 hover:text-red-400 text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!selectedClip}
            title="Delete selected clip"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
