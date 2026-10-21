/**
 * Chromecast support through the Cast Application Framework.
 *
 * The SDK is loaded on demand from Google's CDN (the browser fetches it, not the
 * server), and everything degrades gracefully: no SDK, no cast device or a
 * blocked iframe simply reports "unavailable" instead of throwing at the user.
 */

declare global {
  interface Window {
    chrome?: {
      cast?: {
        AutoJoinPolicy: Record<string, string>;
        media: {
          DEFAULT_MEDIA_RECEIVER_APP_ID: string;
          MediaInfo: new (url: string, contentType: string) => unknown;
          LoadRequest: new (media: unknown) => unknown;
          StreamType: Record<string, string>;
        };
      };
    };
    cast?: {
      framework?: {
        CastContext: {
          getInstance: () => {
            setOptions: (options: Record<string, unknown>) => void;
            requestSession: () => Promise<CastSession>;
            getCurrentSession: () => CastSession | null;
            getSessionState: () => string;
            addEventListener: (event: string, handler: () => void) => void;
            removeEventListener: (event: string, handler: () => void) => void;
          };
        };
        CastContextEventType: Record<string, string>;
      };
    };
    __onGCastApiAvailable?: (available: boolean) => void;
  }
}

interface CastSession {
  loadMedia: (request: unknown) => Promise<unknown>;
  endSession: (stop?: boolean) => void;
}

const SDK_URL = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';

const TYPES: [RegExp, string][] = [
  [/\.m3u8(\?|$)/i, 'application/x-mpegURL'],
  [/\.mpd(\?|$)/i, 'application/dash+xml'],
  [/\.mp4(\?|$)/i, 'video/mp4'],
  [/\.m4v(\?|$)/i, 'video/mp4'],
  [/\.webm(\?|$)/i, 'video/webm'],
  [/\.mkv(\?|$)/i, 'video/x-matroska'],
  [/\.ts(\?|$)/i, 'video/mp2t'],
  [/\.mp3(\?|$)/i, 'audio/mpeg'],
  [/\.aac(\?|$)/i, 'audio/aac'],
  [/\.m4a(\?|$)/i, 'audio/mp4'],
  [/\.ogg?(\?|$)/i, 'audio/ogg'],
  [/\.opus(\?|$)/i, 'audio/ogg'],
  [/\.wav(\?|$)/i, 'audio/wav'],
  [/\.flac(\?|$)/i, 'audio/flac'],
];

/** Guess the MIME type a cast receiver needs, defaulting to an HLS playlist. */
export function guessContentType(url: string): string {
  const clean = url.split('#')[0];
  for (const [pattern, type] of TYPES) {
    if (pattern.test(clean)) return type;
  }
  return 'application/x-mpegURL';
}

/** Streams a receiver cannot play directly (raw TS over UDP, RTMP…) need transcoding. */
export function isCastableUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) && !/\.(ts|flv)(\?|$)/i.test(url.split('#')[0]);
}

let sdkPromise: Promise<boolean> | null = null;

/** Injects the cast sender SDK once and resolves with whether the API came up. */
export function loadCastSdk(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.cast?.framework && window.chrome?.cast) return Promise.resolve(true);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    window.__onGCastApiAvailable = (available: boolean) => finish(Boolean(available));

    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onerror = () => finish(false);
    document.head.appendChild(script);

    // The SDK never calls back when the page is not allowed to cast (e.g. some iframes).
    window.setTimeout(() => finish(Boolean(window.cast?.framework && window.chrome?.cast)), 4000);
  });

  return sdkPromise;
}

export function castContext() {
  const CastContext = window.cast?.framework?.CastContext;
  if (!CastContext || !window.chrome?.cast) return null;
  return CastContext.getInstance();
}

export function castSessionState(): string {
  const context = castContext();
  if (!context) return 'unavailable';
  try {
    return context.getSessionState();
  } catch {
    return 'unavailable';
  }
}

export type CastOutcome = { ok: true } | { ok: false; reason: 'unavailable' | 'cancelled' | 'failed' | 'unsupported-stream' };

/** Opens a session (user gesture required) and sends the stream to the receiver. */
export async function startCast(url: string): Promise<CastOutcome> {
  if (!isCastableUrl(url)) return { ok: false, reason: 'unsupported-stream' };
  const loaded = await loadCastSdk();
  if (!loaded) return { ok: false, reason: 'unavailable' };

  const context = castContext();
  const chromeCast = window.chrome?.cast;
  if (!context || !chromeCast) return { ok: false, reason: 'unavailable' };

  try {
    context.setOptions({
      receiverApplicationId: chromeCast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
      autoJoinPolicy: chromeCast.AutoJoinPolicy.ORIGIN_SCOPED,
    });
    const session = context.getCurrentSession() ?? (await context.requestSession());
    const media = new chromeCast.media.MediaInfo(url, guessContentType(url));
    (media as { streamType?: string }).streamType = chromeCast.media.StreamType.BUFFERED;
    await session.loadMedia(new chromeCast.media.LoadRequest(media));
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/cancel/i.test(message)) return { ok: false, reason: 'cancelled' };
    return { ok: false, reason: 'failed' };
  }
}

export function stopCast(): void {
  const context = castContext();
  context?.getCurrentSession()?.endSession(true);
}

export function watchCastState(handler: (state: string) => void): () => void {
  const context = castContext();
  const events = window.cast?.framework?.CastContextEventType;
  if (!context || !events) return () => undefined;
  const onChange = () => handler(castSessionState());
  context.addEventListener(events.SESSION_STATE_CHANGED, onChange);
  return () => context.removeEventListener(events.SESSION_STATE_CHANGED, onChange);
}
