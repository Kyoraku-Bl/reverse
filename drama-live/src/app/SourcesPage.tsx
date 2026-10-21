import { useRef, useState } from 'react';
import clsx from 'clsx';
import { Check, Copy, Download, FileUp, KeyRound, Link2, Plug, RefreshCw, Trash2, Wand2 } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useI18n } from '../hooks/useI18n';
import { Button, Card, Field, Spinner } from '../components/ui';
import { downloadText } from '../lib/m3u';
import { classifyInput, encodeFgCode } from '../lib/fgcode';
import { xtreamM3uUrl } from '../lib/xtream';
import { IPTV_ORG_PLAYLIST_URL } from '../lib/demo';
import type { SourceKind } from '../types';

type Tab = 'url' | 'file' | 'text' | 'xtream' | 'fg';

const TABS: { id: Tab; label: string; icon: typeof Link2 }[] = [
  { id: 'url', label: 'sources.tab.url', icon: Link2 },
  { id: 'file', label: 'sources.tab.file', icon: FileUp },
  { id: 'text', label: 'sources.tab.text', icon: FileUp },
  { id: 'xtream', label: 'sources.tab.xtream', icon: KeyRound },
  { id: 'fg', label: 'sources.tab.fg', icon: Wand2 },
];

export function SourcesPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('url');

  return (
    <div className="h-full overflow-y-auto p-3 lg:p-5">
      <div className="mx-auto max-w-5xl space-y-4">
        <header>
          <h1 className="text-lg font-extrabold text-white">{t('sources.title')}</h1>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{t('sources.subtitle')}</p>
        </header>

        <div className="no-scrollbar flex gap-1.5 overflow-x-auto rounded-xl border border-white/10 bg-ink-900/60 p-1.5">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={clsx(
                'grid-focus inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition',
                tab === item.id ? 'bg-brand-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
              )}
            >
              <item.icon className="h-4 w-4" />
              {t(item.label as never)}
            </button>
          ))}
        </div>

        {tab === 'url' ? <UrlForm /> : null}
        {tab === 'file' ? <FileForm /> : null}
        {tab === 'text' ? <TextForm /> : null}
        {tab === 'xtream' ? <XtreamForm /> : null}
        {tab === 'fg' ? <FgForm /> : null}

        <SourceList />
      </div>
    </div>
  );
}

function StatusLine({ busy, error, ok }: { busy: boolean; error: string | null; ok: string | null }) {
  if (busy) {
    return (
      <p className="flex items-center gap-2 text-xs text-slate-400">
        <Spinner />
      </p>
    );
  }
  if (error) return <p className="text-xs text-red-400">{error}</p>;
  if (ok) return <p className="text-xs text-emerald-400">{ok}</p>;
  return null;
}

function UrlForm() {
  const { t } = useI18n();
  const addSourceFromUrl = useAppStore((state) => state.addSourceFromUrl);
  const loadIptvOrg = useAppStore((state) => state.loadIptvOrg);
  const loadDemo = useAppStore((state) => state.loadDemo);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [epg, setEpg] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const submit = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const source = await addSourceFromUrl(name.trim() || 'My playlist', url.trim(), epg.trim() || undefined);
      setOk(`${source.channelCount} ${t('sources.channels')}`);
      setUrl('');
      setEpg('');
    } catch (cause) {
      setError(describe(cause, t));
    } finally {
      setBusy(false);
    }
  };

  const quick = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setOk(t('sources.load'));
    } catch (cause) {
      setError(describe(cause, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3">
      <Field label={t('sources.name')} value={name} onChange={(event) => setName(event.target.value)} placeholder="My playlist" />
      <Field label={t('sources.url')} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…/playlist.m3u8" />
      <Field label={t('sources.epg')} value={epg} onChange={(event) => setEpg(event.target.value)} placeholder="https://…/guide.xml" />
      <div className="flex flex-wrap gap-2">
        <Button onClick={submit} disabled={busy}>
          {busy ? <Spinner /> : null}
          {t('sources.load')}
        </Button>
        <Button variant="outline" onClick={() => quick(loadDemo)} disabled={busy}>
          {t('sources.demo')}
        </Button>
        <Button variant="outline" onClick={() => quick(() => loadIptvOrg())} disabled={busy}>
          {IPTV_ORG_PLAYLIST_URL.replace('https://', '')}
        </Button>
      </div>
      <StatusLine busy={busy} error={error} ok={ok} />
    </Card>
  );
}

function FileForm() {
  const { t } = useI18n();
  const addSourceFromFile = useAppStore((state) => state.addSourceFromFile);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  return (
    <Card className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept=".m3u,.m3u8,.txt,audio/x-mpegurl"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setBusy(true);
          setError(null);
          try {
            const text = await file.text();
            const source = await addSourceFromFile(file.name, text);
            setOk(`${source.channelCount} ${t('sources.channels')}`);
          } catch (cause) {
            setError(describe(cause, t));
          } finally {
            setBusy(false);
          }
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => inputRef.current?.click()} disabled={busy}>
          <FileUp className="h-4 w-4" />
          {t('sources.file.pick')}
        </Button>
        <span className="text-[11px] text-slate-500">.m3u · .m3u8 · .txt</span>
      </div>
      <StatusLine busy={busy} error={error} ok={ok} />
    </Card>
  );
}

function TextForm() {
  const { t } = useI18n();
  const addSourceFromText = useAppStore((state) => state.addSourceFromText);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  return (
    <Card className="space-y-3">
      <Field label={t('sources.name')} value={name} onChange={(event) => setName(event.target.value)} placeholder="Pasted list" />
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={t('sources.text.placeholder')}
        rows={8}
        className="w-full rounded-xl border border-white/10 bg-ink-900/70 p-3 font-mono text-[11px] leading-relaxed text-slate-200 focus:border-brand-500 focus-ring"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || !text.trim()}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const kind: SourceKind = classifyInput(text) === 'fg' ? 'fg-code' : 'm3u-text';
              const source = await addSourceFromText({
                name: name.trim() || 'Pasted list',
                text,
                kind,
                reference: 'pasted',
              });
              setOk(`${source.channelCount} ${t('sources.channels')}`);
            } catch (cause) {
              setError(describe(cause, t));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Spinner /> : null}
          {t('sources.load')}
        </Button>
      </div>
      <StatusLine busy={busy} error={error} ok={ok} />
    </Card>
  );
}

function XtreamForm() {
  const { t } = useI18n();
  const addSourceFromXtream = useAppStore((state) => state.addSourceFromXtream);
  const [server, setServer] = useState('http://');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  return (
    <Card className="space-y-3">
      <Field label={t('sources.xtream.server')} value={server} onChange={(event) => setServer(event.target.value)} placeholder="http://server.com:8080" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('sources.xtream.user')} value={username} onChange={(event) => setUsername(event.target.value)} />
        <Field label={t('sources.xtream.pass')} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || !username || !password || !server.includes('://')}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const source = await addSourceFromXtream({ server: server.trim(), username, password });
              setOk(`${source.channelCount} ${t('sources.channels')}`);
            } catch (cause) {
              setError(describe(cause, t));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Spinner /> : null}
          {t('sources.xtream.connect')}
        </Button>
        <Button
          variant="outline"
          disabled={!username || !password || !server.includes('://')}
          onClick={() => {
            const link = xtreamM3uUrl({ server: server.trim(), username, password });
            navigator.clipboard?.writeText(link);
            setOk(link);
          }}
        >
          <Copy className="h-4 w-4" />
          M3U export
        </Button>
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">{t('sources.xtream.cors')}</p>
      <StatusLine busy={busy} error={error} ok={ok} />
    </Card>
  );
}

function FgForm() {
  const { t } = useI18n();
  const addSourceFromFgCode = useAppStore((state) => state.addSourceFromFgCode);
  const sources = useAppStore((state) => state.sources);
  const makeFgCode = useAppStore((state) => state.makeFgCode);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [generated, setGenerated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shareable = sources.filter((source) => source.kind === 'm3u-url' || source.kind === 'xtream');

  return (
    <Card className="space-y-3">
      <p className="text-[11px] leading-relaxed text-slate-500">{t('sources.fg.explain')}</p>
      <Field label={t('sources.tab.fg')} value={code} onChange={(event) => setCode(event.target.value)} placeholder="DL-M3U-…" />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || !code.trim()}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const source = await addSourceFromFgCode(code.trim());
              setOk(`${source.channelCount} ${t('sources.channels')}`);
              setCode('');
            } catch (cause) {
              setError(describe(cause, t));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Spinner /> : null}
          {t('sources.load')}
        </Button>
      </div>

      {shareable.length ? (
        <div className="space-y-2 border-t border-white/10 pt-3">
          <p className="text-xs font-bold text-slate-300">{t('sources.fg.generate')}</p>
          <div className="flex flex-wrap gap-2">
            {shareable.map((source) => (
              <Button key={source.id} variant="outline" onClick={() => setGenerated(makeFgCode(source.id))}>
                <Wand2 className="h-4 w-4" />
                {source.name}
              </Button>
            ))}
          </div>
          {generated ? (
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink-900 p-2">
              <code className="min-w-0 flex-1 truncate text-[11px] text-gold-400">{generated}</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(generated);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-white/20"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? t('common.copied') : t('sources.fg.copy')}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <StatusLine busy={busy} error={error} ok={ok} />
    </Card>
  );
}

function SourceList() {
  const { t } = useI18n();
  const sources = useAppStore((state) => state.sources);
  const removeSource = useAppStore((state) => state.removeSource);
  const toggleSource = useAppStore((state) => state.toggleSource);
  const refreshSource = useAppStore((state) => state.refreshSource);
  const exportM3u = useAppStore((state) => state.exportM3u);
  const channels = useAppStore((state) => state.channels);
  const [busyId, setBusyId] = useState<string | null>(null);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-extrabold text-white">{t('sources.list.title')}</h2>
        <div className="flex-1" />
        {channels.length ? (
          <Button variant="outline" onClick={() => downloadText('drama-live-web.m3u', exportM3u())}>
            <Download className="h-4 w-4" />
            {t('sources.export')}
          </Button>
        ) : null}
      </div>

      {sources.length === 0 ? (
        <Card>
          <p className="flex items-center gap-2 text-xs text-slate-400">
            <Plug className="h-4 w-4" />
            {t('sources.list.empty')}
          </p>
        </Card>
      ) : null}

      <div className="space-y-2">
        {sources.map((source) => (
          <div key={source.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-ink-900/60 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-100">{source.name}</p>
              <p className="truncate text-[11px] text-slate-500">
                {source.channelCount} {t('sources.channels')} · {source.kind}
              </p>
              {source.error ? <p className="text-[10px] text-amber-400">{source.error}</p> : null}
            </div>

            <button
              type="button"
              onClick={() => toggleSource(source.id)}
              className={clsx(
                'rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition',
                source.enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-slate-500',
              )}
            >
              {source.enabled ? t('sources.enabled') : t('sources.disabled')}
            </button>

            {source.kind === 'm3u-url' || source.kind === 'xtream' ? (
              <button
                type="button"
                disabled={busyId === source.id}
                onClick={async () => {
                  setBusyId(source.id);
                  try {
                    await refreshSource(source.id);
                  } finally {
                    setBusyId(null);
                  }
                }}
                className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-slate-300 hover:bg-white/10"
                aria-label={t('sources.refresh')}
              >
                <RefreshCw className={clsx('h-4 w-4', busyId === source.id && 'animate-spin')} />
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => removeSource(source.id)}
              className="grid h-8 w-8 place-items-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
              aria-label={t('sources.remove')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-slate-600">
        FG: <code className="text-slate-500">{encodeFgCode({ t: 'm3u', u: 'https://example.com/playlist.m3u8' })}</code>
      </p>
    </section>
  );
}

function describe(cause: unknown, t: (key: 'sources.error') => string): string {
  const message = cause instanceof Error ? cause.message : String(cause);
  if (message === 'Failed to fetch' || message.includes('NetworkError')) {
    return `${t('sources.error')}: CORS / network`;
  }
  if (message === 'auth-failed') return `${t('sources.error')}: auth`;
  if (message === 'bad-fg-code') return `${t('sources.error')}: FG`;
  return `${t('sources.error')}: ${message}`;
}
