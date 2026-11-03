import { useProject } from '../store';
import { X, CheckCircle2, Loader2 } from 'lucide-react';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (opts: { width: number; height: number; fps: number }) => void;
  exporting: boolean;
  progress: number;
}

export function ExportDialog({
  open,
  onClose,
  onExport,
  exporting,
  progress,
}: ExportDialogProps) {
  if (!open) return null;
  const { state } = useProject();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Export Project</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Resolution</label>
            <select
              defaultValue={`${state.width}x${state.height}`}
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="1920x1080">1080p (Full HD)</option>
              <option value="1280x720">720p (HD)</option>
              <option value="3840x2160">4K (slow in browser)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Frame Rate (fps)</label>
            <select
              defaultValue={String(state.fps)}
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="24">24</option>
              <option value="30">30</option>
              <option value="60">60</option>
            </select>
          </div>

          {exporting ? (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Exporting…</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-slate-500">ffmpeg.wasm runs entirely in your browser — no files uploaded to any server.</p>
            </div>
          ) : (
            <button
              onClick={() => {
                const [w, h] = state.width ? [state.width, state.height] : [1920, 1080];
                onExport({ width: w, height: h, fps: state.fps });
              }}
              disabled={exporting}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold shadow-lg"
            >
              <Loader2 size={18} className={exporting ? 'animate-spin' : ''} />
              {exporting ? 'Rendering…' : 'Start Export'}
            </button>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500">
          100% Free — all processing happens locally in your browser, no server and no paid plan.
        </div>
      </div>
    </div>
  );
}
