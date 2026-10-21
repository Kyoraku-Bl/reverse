import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { ChatMessage } from '../types';
import { useAppStore } from '../store/appStore';
import { useI18n } from '../hooks/useI18n';

const ROOM = 'drama-live-web-chat';
const QUICK = ['👏', '🔥', '😂', '❤️', '⚽', '🎬'];

interface WireMessage {
  type: 'chat' | 'watching';
  message: ChatMessage;
}

/**
 * Live chat. Messages travel through a BroadcastChannel, so every tab/window of the
 * browser on this device shares one room — no server, no accounts, no tracking.
 */
export function ChatPanel({ channelName, onClose }: { channelName?: string; onClose: () => void }) {
  const { t } = useI18n();
  const chat = useAppStore((state) => state.chat);
  const pushChat = useAppStore((state) => state.pushChat);
  const clearChat = useAppStore((state) => state.clearChat);
  const nickname = useAppStore((state) => state.settings.chatNickname);
  const setSettings = useAppStore((state) => state.setSettings);

  const [draft, setDraft] = useState('');
  const [joined, setJoined] = useState(false);
  const [nameInput, setNameInput] = useState(nickname);
  const wireRef = useRef<BroadcastChannel | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const wire = new BroadcastChannel(ROOM);
    wireRef.current = wire;
    wire.onmessage = (event: MessageEvent<WireMessage>) => {
      const data = event.data;
      if (!data?.message) return;
      pushChat({ ...data.message, self: false });
    };
    return () => {
      wire.close();
      wireRef.current = null;
    };
  }, [pushChat]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat.length]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const message: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      author: nickname,
      text: trimmed,
      at: Date.now(),
      channelName,
      self: true,
    };
    pushChat(message);
    wireRef.current?.postMessage({ type: 'chat', message } satisfies WireMessage);
    setDraft('');
  };

  if (!joined) {
    return (
      <aside className="flex h-full flex-col rounded-2xl border border-white/10 bg-ink-900/70 p-4">
        <Header title={t('chat.title')} onClose={onClose} />
        <div className="flex flex-1 flex-col justify-center gap-3">
          <p className="text-xs leading-relaxed text-slate-400">{t('chat.local')}</p>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-400">{t('chat.nickname')}</span>
            <input
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-ink-850 px-3 py-2.5 text-sm text-slate-100 focus:border-brand-500 focus-ring"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setSettings({ chatNickname: nameInput.trim() || nickname });
              setJoined(true);
              const message: ChatMessage = {
                id: `${Date.now()}-join`,
                author: nameInput.trim() || nickname,
                text: t('chat.system.joined'),
                at: Date.now(),
                system: true,
                self: true,
              };
              pushChat(message);
              wireRef.current?.postMessage({ type: 'chat', message } satisfies WireMessage);
            }}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-500 focus-ring"
          >
            {t('chat.join')}
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-2xl border border-white/10 bg-ink-900/70">
      <Header title={t('chat.title')} onClose={onClose} onClear={clearChat} />

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {chat.length === 0 ? <p className="py-8 text-center text-xs text-slate-500">{t('chat.empty')}</p> : null}
        {chat.map((message) => (
          <div key={message.id} className={message.system ? 'text-center' : message.self ? 'text-end' : 'text-start'}>
            {message.system ? (
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-slate-400">
                {message.author} {message.text}
              </span>
            ) : (
              <div
                className={
                  message.self
                    ? 'inline-block max-w-[85%] rounded-2xl rounded-te-sm bg-brand-600 px-3 py-2 text-xs text-white'
                    : 'inline-block max-w-[85%] rounded-2xl rounded-ts-sm bg-white/10 px-3 py-2 text-xs text-slate-100'
                }
              >
                {!message.self ? <p className="mb-0.5 text-[10px] font-bold text-gold-400">{message.author}</p> : null}
                <p className="break-words leading-relaxed">{message.text}</p>
                {message.channelName ? (
                  <p className="mt-1 text-[9px] opacity-70">📺 {message.channelName}</p>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="mb-2 flex gap-1.5">
          {QUICK.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => send(emoji)}
              className="rounded-lg bg-white/5 px-2 py-1 text-sm transition hover:bg-white/10"
            >
              {emoji}
            </button>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send(draft);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('chat.placeholder')}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-ink-850 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-brand-500 focus-ring"
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-brand-500 focus-ring"
          >
            {t('chat.send')}
          </button>
        </form>
      </div>
    </aside>
  );
}

function Header({ title, onClose, onClear }: { title: string; onClose: () => void; onClear?: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
      <h3 className="text-sm font-bold text-white">{title}</h3>
      <div className="flex items-center gap-1">
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-300"
          >
            ✕
          </button>
        ) : null}
        <button type="button" onClick={onClose} aria-label="close" className="rounded-lg p-1 text-slate-400 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
