import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  ReactNode,
  useEffect,
  useRef,
} from 'react';

export type AssetType = 'video' | 'audio' | 'image';

export type FilterName =
  | 'none'
  | 'grayscale'
  | 'invert'
  | 'sepia'
  | 'blur'
  | 'brightness'
  | 'contrast'
  | 'saturate';

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  url: string;
  duration: number;
  width?: number;
  height?: number;
  size: number;
}

export interface Clip {
  id: string;
  assetId: string;
  trackId: string;
  start: number;
  sourceStart: number;
  duration: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  filter: FilterName;
  speed: number; // 0.25 .. 4
  volume: number; // 0 .. 2
  text?: string;
  fontSize?: number;
  color?: string;
}

export interface Track {
  id: string;
  type: 'video' | 'audio';
  name: string;
  clips: Clip[];
}

export interface ProjectState {
  assets: Asset[];
  tracks: Track[];
  playhead: number;
  duration: number;
  selectedClipId: string | null;
  activeTrackId: string | null;
  width: number;
  height: number;
  fps: number;
  pxPerSecond: number; // zoom
}

const INITIAL: ProjectState = {
  assets: [],
  tracks: [
    { id: 'v1', type: 'video', name: 'فيديو 1', clips: [] },
    { id: 'v2', type: 'video', name: 'فيديو 2', clips: [] },
    { id: 'a1', type: 'audio', name: 'صوت', clips: [] },
  ],
  playhead: 0,
  duration: 0,
  selectedClipId: null,
  activeTrackId: 'v1',
  width: 1920,
  height: 1080,
  fps: 30,
  pxPerSecond: 100,
};

type Action =
  | { type: 'SET_ASSETS'; payload: Asset[] }
  | { type: 'ADD_ASSET'; payload: Asset }
  | { type: 'REMOVE_ASSET'; payload: string }
  | { type: 'ADD_CLIP'; payload: Clip }
  | { type: 'UPDATE_CLIP'; payload: Partial<Clip> & { id: string } }
  | { type: 'REMOVE_CLIP'; payload: string }
  | { type: 'SPLIT_CLIP'; payload: { clipId: string; at: number } }
  | { type: 'SET_PLAYHEAD'; payload: number }
  | { type: 'SET_DURATION'; payload: number }
  | { type: 'SELECT_CLIP'; payload: string | null }
  | { type: 'SET_ACTIVE_TRACK'; payload: string | null }
  | { type: 'SET_PROJECT_SETTINGS'; payload: Partial<ProjectState> }
  | { type: 'ADD_TRACK'; payload: Track }
  | { type: 'REMOVE_TRACK'; payload: string }
  | { type: 'RESTORE'; payload: ProjectState }
  | { type: 'CLEAR_PROJECT' };

function reducer(state: ProjectState, action: Action): ProjectState {
  switch (action.type) {
    case 'SET_ASSETS':
      return { ...state, assets: action.payload };
    case 'ADD_ASSET':
      return { ...state, assets: [...state.assets, action.payload] };
    case 'REMOVE_ASSET': {
      const id = action.payload;
      return {
        ...state,
        assets: state.assets.filter((a) => a.id !== id),
        tracks: state.tracks.map((t) => ({
          ...t,
          clips: t.clips.filter((c) => c.assetId !== id),
        })),
        selectedClipId:
          state.selectedClipId &&
          state.assets.some((a) => a.id === id)
            ? null
            : state.selectedClipId,
      };
    }
    case 'ADD_CLIP': {
      const clip = action.payload;
      const track = state.tracks.find((t) => t.id === clip.trackId);
      if (!track) return state;
      return {
        ...state,
        duration: Math.max(state.duration, clip.start + clip.duration),
        tracks: state.tracks.map((t) =>
          t.id === clip.trackId ? { ...t, clips: [...t.clips, clip] } : t,
        ),
      };
    }
    case 'UPDATE_CLIP': {
      const { id, ...changes } = action.payload;
      return {
        ...state,
        tracks: state.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) => (c.id === id ? { ...c, ...changes } : c)),
        })),
      };
    }
    case 'REMOVE_CLIP': {
      const id = action.payload;
      return {
        ...state,
        tracks: state.tracks.map((t) => ({
          ...t,
          clips: t.clips.filter((c) => c.id !== id),
        })),
        selectedClipId: state.selectedClipId === id ? null : state.selectedClipId,
      };
    }
    case 'SPLIT_CLIP': {
      const { clipId, at } = action.payload;
      let found: { track: Track; clip: Clip; idx: number } | null = null;
      for (const t of state.tracks) {
        const idx = t.clips.findIndex((c) => c.id === clipId);
        if (idx >= 0) {
          found = { track: t, clip: t.clips[idx], idx };
          break;
        }
      }
      if (!found) return state;
      const { track, clip, idx } = found;
      // split at `at` (absolute timeline seconds). Left keeps [start, at), right [at, end)
      if (at <= clip.start || at >= clip.start + clip.duration) return state;
      const leftDur = at - clip.start;
      const rightStart = at;
      const rightDur = clip.start + clip.duration - at;
      const left: Clip = { ...clip, id: `clip_${Date.now()}_L`, duration: leftDur };
      const right: Clip = {
        ...clip,
        id: `clip_${Date.now()}_R`,
        start: rightStart,
        sourceStart: clip.sourceStart + leftDur / clip.speed,
        duration: rightDur,
      };
      const newClips = [...track.clips];
      newClips.splice(idx, 1, left, right);
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === track.id ? { ...t, clips: newClips } : t,
        ),
        selectedClipId: right.id,
      };
    }
    case 'SET_PLAYHEAD':
      return { ...state, playhead: Math.max(0, Math.min(state.duration, action.payload)) };
    case 'SET_DURATION':
      return { ...state, duration: action.payload };
    case 'SELECT_CLIP':
      return { ...state, selectedClipId: action.payload };
    case 'SET_ACTIVE_TRACK':
      return { ...state, activeTrackId: action.payload };
    case 'SET_PROJECT_SETTINGS':
      return { ...state, ...action.payload };
    case 'ADD_TRACK':
      return { ...state, tracks: [...state.tracks, action.payload] };
    case 'REMOVE_TRACK': {
      const id = action.payload;
      if (state.tracks.length <= 1) return state;
      return {
        ...state,
        tracks: state.tracks.filter((t) => t.id !== id),
        activeTrackId: state.activeTrackId === id ? state.tracks[0]?.id ?? null : state.activeTrackId,
        selectedClipId: state.selectedClipId
          ? state.tracks.some((t) => t.clips.some((c) => c.id === state.selectedClipId))
            ? state.selectedClipId
            : null
          : null,
      };
    }
    case 'RESTORE':
      return action.payload;
    case 'CLEAR_PROJECT':
      return INITIAL;
    default:
      return state;
  }
}

const StoreContext = createContext<{
  state: ProjectState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

// undo / reframe history
const HISTORY_LIMIT = 50;

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const past = useRef<ProjectState[]>([]);
  const future = useRef<ProjectState[]>([]);
  const recording = useRef(true);

  // record after every change except RESTORE
  useEffect(() => {
    if (!recording.current) {
      recording.current = true;
      return;
    }
    const p = past.current;
    if (p.length === 0 || p[p.length - 1] !== state) {
      p.push(state);
      if (p.length > HISTORY_LIMIT) p.shift();
    }
    future.current = [];
  }, [state]);

  const undo = useCallback(() => {
    const p = past.current;
    if (p.length === 0) return;
    const current = state;
    const prev = p.pop()!;
    recording.current = false;
    future.current = [current, ...future.current];
    dispatch({ type: 'RESTORE', payload: prev });
  }, [state]);

  const redo = useCallback(() => {
    const f = future.current;
    if (f.length === 0) return;
    const current = state;
    const next = f.shift()!;
    recording.current = false;
    past.current.push(current);
    dispatch({ type: 'RESTORE', payload: next });
  }, [state]);

  const clearHistory = useCallback(() => {
    past.current = [];
    future.current = [];
  }, []);

  const ctx = {
    state,
    dispatch,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    clearHistory,
  };
  return <StoreContext.Provider value={ctx}>{children}</StoreContext.Provider>;
}

export function useProject() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useProject must be used inside ProjectProvider');
  return ctx;
}

export function findClip(
  state: ProjectState,
  clipId: string,
): { track: Track; clip: Clip } | null {
  for (const t of state.tracks) {
    const c = t.clips.find((x) => x.id === clipId);
    if (c) return { track: t, clip: c };
  }
  return null;
}

export function clipEndsAt(state: ProjectState) {
  return Math.max(
    0,
    ...state.tracks.flatMap((t) => t.clips.map((c) => c.start + c.duration)),
  );
}
