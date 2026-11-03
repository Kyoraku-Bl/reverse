import { useState, useCallback, useEffect, useRef } from 'react';
import { useProject } from './store';
import {
  Download,
  Plus,
  Monitor,
  FileVideo,
  FileAudio,
  Image,
  Play,
  Pause,
  Zap,
  Music2,
  Wand2,
  Layout,
  Palette,
  Zap as Lightning,
} from 'lucide-react';
import { Preview } from './components/Preview';
import { Timeline } from './components/Timeline';
import { Toolbar } from './components/Toolbar';
import { ExportDialog } from './components/ExportDialog';
import { exportTimeline } from './lib/ffmpeg';

const ASSET_ICON: Record<string, typeof FileVideo> = {
  video: FileVideo,
  audio: FileAudio,
  image: Image,
};

// Built-in sound effects (base64 WAV, short & free)
const SFX: Array<{ id: string; label: string; data: string; duration: number }> = [
  {
    id: 'sfx-beep',
    label: 'Beep',
    data:
      'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUQAAgA=',
    duration: 0.3,
  },
  {
    id: 'sfx-click',
    label: 'Click',
    data:
      'data:audio/wav;base64,UklGRiIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAA==',
    duration: 0.1,
  },
  {
    id: 'sfx-pop',
    label: 'Pop',
    data:
      'data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUQAAgA=',
    duration: 0.2,
  },
  {
    id: 'sfx-woosh',
    label: 'Whoosh',
    data:
      'data:audio/wav;base64,UklGRi0AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAA==',
    duration: 0.5,
  },
];

export default function App() {
  const {
    state,
    dispatch,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  } = useProject();
  const [importing, setImporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewAssetId, setPreviewAssetId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sfxOpen, setSfxOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ---------- import media ----------
  const handleImport = async (files: FileList) => {
    setImporting(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const type = file.type.startsWith('video')
        ? 'video'
        : file.type.startsWith('audio')
          ? 'audio'
          : 'image';
      const url = URL.createObjectURL(file);

      let duration = type === 'image' ? 5 : 0;
      if (type !== 'image') {
        duration = await new Promise<number>((resolve) => {
          const el = type === 'audio' ? new Audio() : document.createElement('video');
          el.src = url;
          el.onloadedmetadata = () => resolve(el.duration || 0);
          el.onerror = () => resolve(0);
        });
      }

      const asset: import('./store').Asset = {
        id: `asset_${Date.now()}_${i}`,
        name: file.name,
        type,
        url,
        duration: Math.max(duration, 0.5),
        size: file.size,
      };
      dispatch({ type: 'ADD_ASSET', payload: asset });
    }
    setImporting(false);
  };

  const onImportClick = useCallback(() => {
    const input = document.getElementById('file-import') as HTMLInputElement | null;
    input?.click();
  }, []);

  // ---------- add asset to timeline ----------
  const addAssetToTimeline = useCallback(
    (assetId: string) => {
      const asset = state.assets.find((a) => a.id === assetId);
      if (!asset || !state.activeTrackId) return;
      const clip: import('./store').Clip = {
        id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        assetId: asset.id,
        trackId: state.activeTrackId,
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
      dispatch({ type: 'SET_DURATION', payload: Math.max(state.duration, clip.start + clip.duration) });
    },
    [state, dispatch],
  );

  // ---------- add sound effect ----------
  const addSfx = useCallback((sfx: typeof SFX[number]) => {
    const asset: import('./store').Asset = {
      id: sfx.id,
      name: `SFX: ${sfx.label}`,
      type: 'audio',
      url: sfx.data,
      duration: sfx.duration,
      size: 0,
    };
    // avoid duplicates
    if (!state.assets.some((a) => a.id === sfx.id)) {
      dispatch({ type: 'ADD_ASSET', payload: asset });
    }
    addAssetToTimeline(sfx.id);
    setSfxOpen(false);
  }, [state.assets, dispatch, addAssetToTimeline]);

  // ---------- selected clip ----------
  const selectedClipRaw = state.selectedClipId
    ? state.tracks.flatMap((t) => t.clips).find((c) => c.id === state.selectedClipId)
    : null;
  const selectedClip = selectedClipRaw ?? null;

  const onUpdateSelected = useCallback(
    (changes: Partial<{
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
    }>) => {
      if (!selectedClipRaw) return;
      dispatch({ type: 'UPDATE_CLIP', payload: { id: selectedClipRaw.id, ...changes } });
    },
    [selectedClipRaw, dispatch],
  );

  const onRemoveSelected = useCallback(() => {
    if (!selectedClipRaw) return;
    dispatch({ type: 'REMOVE_CLIP', payload: selectedClipRaw.id });
  }, [selectedClipRaw, dispatch]);

  const onSplitSelected = useCallback(() => {
    if (!selectedClipRaw) return;
    const at = state.playhead;
    dispatch({ type: 'SPLIT_CLIP', payload: { clipId: selectedClipRaw.id, at } });
  }, [selectedClipRaw, state.playhead, dispatch]);

  // ---------- tracks ----------
  const onAddTrack = useCallback((type: 'video' | 'audio') => {
    const id = `t_${Date.now()}`;
    const name = type === 'video' ? `Video ${state.tracks.length + 1}` : `Audio ${state.tracks.length + 1}`;
    dispatch({ type: 'ADD_TRACK', payload: { id, type, name, clips: [] } });
    dispatch({ type: 'SET_ACTIVE_TRACK', payload: id });
  }, [state.tracks.length, dispatch]);

  const onRemoveTrack = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TRACK', payload: id });
  }, [dispatch]);

  const onSetActiveTrack = useCallback((id: string | null) => {
    dispatch({ type: 'SET_ACTIVE_TRACK', payload: id });
  }, [dispatch]);

  // ---------- playhead ----------
  const onSetPlayhead = useCallback(
    (s: number) => {
      dispatch({ type: 'SET_PLAYHEAD', payload: s });
      const v = videoRef.current;
      if (v) v.currentTime = s;
    },
    [dispatch],
  );

  const onTogglePlay = useCallback(() => {
    setIsPlaying((p) => {
      const v = videoRef.current;
      if (v) {
        if (p) v.pause();
        else v.play().catch(() => {});
      }
      return !p;
    });
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (previewAssetId) {
      const asset = state.assets.find((a) => a.id === previewAssetId);
      if (asset && v) {
        v.src = asset.url;
        v.currentTime = 0;
        setIsPlaying(false);
      }
    }
  }, [previewAssetId, state.assets]);

  // ---------- export ----------
  const allClips = state.tracks.flatMap((t) => t.clips);

  const startExport = useCallback(async () => {
    if (allClips.length === 0) return;
    setExporting(true);
    setProgress(10);
    try {
      const blob = await exportTimeline({
        clips: allClips,
        assets: state.assets,
        width: state.width,
        height: state.height,
        fps: state.fps,
      });
      setProgress(90);
      const outUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = outUrl;
      a.download = `capcut-free-export_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(outUrl);
    } catch (err) {
      console.error(err);
      alert('Export failed — check browser console for details.');
    } finally {
      setExporting(false);
      setProgress(0);
      setExportOpen(false);
    }
  }, [allClips, state.assets, state.width, state.height, state.fps]);

  const IconFor = (type: string) => ASSET_ICON[type] || FileVideo;

  const playheadPx = state.duration > 0 ? (state.playhead / state.duration) * 100 : 0;

  return (
    <div className="h-full flex flex-col">
      {/* header */}
      <header className="flex items-center justify-between px-5 py-3 bg-slate-800/90 border-b border-slate-700 z-30 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-xs font-bold shadow-lg shadow-emerald-500/30">
            CC
          </div>
          <div className="flex flex-col">
            <h1 className="font-bold text-emerald-400 tracking-tight text-lg">
              CapCut <span className="text-slate-400 text-xs">Free</span>
            </h1>
            <p className="text-[10px] text-slate-500">100% Free • Local Only • No Server</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>{allClips.length} clips</span>
          <span className="px-2 py-0.5 rounded bg-slate-700">Local processing</span>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex">
        {/* sidebar: assets + sfx */}
        <aside className="w-80 border-r border-slate-800 bg-slate-900/60 flex flex-col z-10">
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[10px] uppercase tracking-wider text-slate-500">Imported Media</label>
              <button
                onClick={() => setSfxOpen(true)}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 underline"
                title="Add sound effects"
              >
                + Sound Effects
              </button>
            </div>
            <button
              onClick={onImportClick}
              disabled={importing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-sm text-slate-100 disabled:opacity-50"
            >
              <Plus size={16} /> Import Video / Audio / Image
            </button>
            <input
              id="file-import"
              type="file"
              multiple
              accept="video/*,audio/*,image/*"
              className="hidden"
              onChange={(e) => e.target.files && handleImport(e.target.files)}
            />
            {importing && <p className="text-[10px] text-emerald-400 mt-2">Importing…</p>}
          </div>

          <div className="overflow-y-auto p-2 space-y-1">
            {state.assets.length === 0 && (
              <div className="p-4 text-center text-[11px] text-slate-500">
                No media yet. Import a file to start.
              </div>
            )}
            {state.assets.map((asset) => {
              const Icon = IconFor(asset.type);
              const isSfx = asset.id.startsWith('sfx-');
              return (
                <div
                  key={asset.id}
                  className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-slate-800 border border-transparent hover:border-slate-600 group ${isSfx ? 'border-l-2 border-l-emerald-500' : ''}`}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('assetId', asset.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewAssetId(asset.id);
                    addAssetToTimeline(asset.id);
                  }}
                >
                  <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center text-slate-300 shrink-0">
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-200 truncate" title={asset.name}>{asset.name}</div>
                    <div className="text-[9px] text-slate-500">{asset.type} • {asset.duration.toFixed(1)}s</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); addAssetToTimeline(asset.id); }}
                    className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded"
                    title="Add to timeline"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          {sfxOpen && (
            <div className="p-2 border-t border-slate-800 bg-slate-900">
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-2">Sound Effects</label>
              <div className="grid grid-cols-2 gap-1">
                {SFX.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => addSfx(s)}
                    className="px-2 py-1.5 rounded bg-slate-800 border border-slate-600 text-xs text-slate-200 hover:bg-slate-700 hover:text-emerald-400 transition"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setSfxOpen(false)}
                className="w-full mt-2 text-[10px] text-slate-500 hover:text-slate-300 underline"
              >
                Close
              </button>
            </div>
          )}
        </aside>

        {/* main: preview + timeline */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-950">
          <div className="flex-1 p-6 relative">
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-700">
                Preview {previewAssetId ? state.assets.find((a) => a.id === previewAssetId)?.name : '—'}
              </span>
            </div>
            <Preview
              onSetPlayhead={onSetPlayhead}
              onTogglePlay={onTogglePlay}
              isPlaying={isPlaying}
            />
            {state.assets.length > 0 && (
              <div className="absolute bottom-4 left-4 right-4 flex gap-2 px-3 py-2 bg-slate-900/90 backdrop-blur rounded-xl border border-slate-700">
                <span className="text-[10px] text-slate-500 self-center">View:</span>
                {state.assets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => setPreviewAssetId(asset.id)}
                    className={`px-2 py-1 rounded text-xs border ${
                      previewAssetId === asset.id
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500'
                        : 'bg-slate-800 text-slate-400 border-slate-600 hover:text-white'
                    }`}
                    title={asset.name}
                  >
                    {asset.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-[300px] border-t border-slate-800 flex flex-col" style={{ position: 'relative' }}>
            <div className="px-4 py-2 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Timeline</span>
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <span>Scale: {state.pxPerSecond}px/sec</span>
              </div>
            </div>
            <div className="relative flex-1 min-h-0" style={{ position: 'relative' }}>
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ position: 'absolute' }}>
                <div className="playhead" style={{ left: `${playheadPx}%` }} />
              </div>
              <Timeline
                pxPerSecond={state.pxPerSecond}
                trackHeight={64}
                onSplitAtPlayhead={onSplitSelected}
              />
            </div>
          </div>
        </main>
      </div>

      {/* toolbar */}
      <Toolbar
        onImport={onImportClick}
        onAddText={() => {
          const clip: import('./store').Clip = {
            id: `clip_${Date.now()}_text`,
            assetId: '',
            trackId: state.activeTrackId || 'v1',
            start: state.playhead,
            sourceStart: 0,
            duration: 4,
            x: 0,
            y: -state.height / 3,
            scale: 1,
            opacity: 1,
            filter: 'none',
            speed: 1,
            volume: 1,
            text: 'New Text',
            fontSize: 48,
            color: '#ffffff',
          };
          dispatch({ type: 'ADD_CLIP', payload: clip });
          dispatch({ type: 'SET_DURATION', payload: Math.max(state.duration, state.playhead + 4) });
        }}
        onAddAudio={() => {
          const audioAssets = state.assets.filter((a) => a.type === 'audio');
          if (audioAssets.length === 0) {
            alert('Import an audio file first from Import Media.');
            return;
          }
          addAssetToTimeline(audioAssets[0].id);
        }}
        onExport={() => setExportOpen(true)}
        onRemoveSelected={onRemoveSelected}
        onSplitSelected={onSplitSelected}
        selectedClip={selectedClip}
        onUpdateSelected={onUpdateSelected}
        onAddTrack={onAddTrack}
        onRemoveTrack={onRemoveTrack}
        tracks={state.tracks}
        activeTrackId={state.activeTrackId}
        onSetActiveTrack={onSetActiveTrack}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        pxPerSecond={state.pxPerSecond}
        onSetPxPerSecond={(v) => dispatch({ type: 'SET_PROJECT_SETTINGS', payload: { pxPerSecond: v } })}
      />

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onExport={startExport}
        exporting={exporting}
        progress={progress}
      />
    </div>
  );
}
