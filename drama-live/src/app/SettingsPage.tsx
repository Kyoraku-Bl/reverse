import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Download, Keyboard, Lock, Monitor, Trash2, Unlock } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useI18n } from '../hooks/useI18n';
import { Button, Card, Field, Toggle } from '../components/ui';
import { downloadText } from '../lib/m3u';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

const QUALITIES: { value: number; label: string }[] = [
  { value: 0, label: 'Auto' },
  { value: 480, label: 'SD · 480p' },
  { value: 720, label: 'HD · 720p' },
  { value: 1080, label: 'FHD · 1080p' },
  { value: 2160, label: '4K · 2160p' },
];

export function SettingsPage() {
  const { t, lang, setLang, theme } = useI18n();
  const settings = useAppStore((state) => state.settings);
  const setSettings = useAppStore((state) => state.setSettings);
  const resetAll = useAppStore((state) => state.resetAll);
  const exportM3u = useAppStore((state) => state.exportM3u);
  const parentalUnlocked = useAppStore((state) => state.parentalUnlocked);
  const unlockParental = useAppStore((state) => state.unlockParental);
  const lockParental = useAppStore((state) => state.lockParental);
  const channels = useAppStore((state) => state.channels);

  const [pin, setPin] = useState(settings.parentalPin);
  const [pinError, setPinError] = useState(false);
  const install = useInstallPrompt();

  useEffect(() => setPin(settings.parentalPin), [settings.parentalPin]);

  return (
    <div className="h-full overflow-y-auto p-3 lg:p-5">
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-lg font-extrabold text-white">{t('settings.title')}</h1>

        <Card className="space-y-4">
          <h2 className="text-sm font-extrabold text-white">{t('settings.appearance')}</h2>

          <SegmentedRow
            label={t('settings.language')}
            options={[
              { value: 'ar', label: 'العربية' },
              { value: 'en', label: 'English' },
            ]}
            value={lang}
            onChange={(value) => setLang(value as 'ar' | 'en')}
          />

          <SegmentedRow
            label={`${t('settings.appearance')}`}
            options={[
              { value: 'dark', label: t('settings.theme.dark') },
              { value: 'light', label: t('settings.theme.light') },
            ]}
            value={theme}
            onChange={(value) => setSettings({ theme: value as 'dark' | 'light' })}
          />

          <Toggle
            label={t('settings.tvMode')}
            checked={settings.tvMode}
            onChange={(value) => setSettings({ tvMode: value })}
          />
        </Card>

        <Card className="space-y-1">
          <h2 className="mb-2 text-sm font-extrabold text-white">{t('settings.playback')}</h2>

          <SegmentedRow
            label={t('settings.quality')}
            options={QUALITIES.map((item) => ({ value: String(item.value), label: item.label }))}
            value={String(settings.qualityCap)}
            onChange={(value) => setSettings({ qualityCap: Number(value) })}
          />

          <Toggle
            label={t('settings.reconnect')}
            description={`${t('settings.reconnectAttempts')}: ${settings.reconnectAttempts}`}
            checked={settings.autoReconnect}
            onChange={(value) => setSettings({ autoReconnect: value })}
          />
          <Slider
            label={t('settings.reconnectAttempts')}
            min={1}
            max={12}
            value={settings.reconnectAttempts}
            onChange={(value) => setSettings({ reconnectAttempts: value })}
          />
          <Slider
            label={t('settings.buffer')}
            min={10}
            max={90}
            step={5}
            value={settings.bufferLength}
            onChange={(value) => setSettings({ bufferLength: value })}
          />
          <Slider
            label={t('player.volume')}
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            onChange={(value) => setSettings({ volume: value })}
          />

          <Toggle
            label={t('settings.lowLatency')}
            checked={settings.lowLatency}
            onChange={(value) => setSettings({ lowLatency: value })}
          />
          <Toggle
            label="Native HLS player"
            description={lang === 'ar' ? 'استخدم مشغل المتصفح المدمج عندما يدعم HLS (أخف على البطارية)' : "Use the browser's built-in HLS stack when it supports HLS (lighter on battery)"}
            checked={settings.nativePlayer}
            onChange={(value) => setSettings({ nativePlayer: value })}
          />
          <Toggle label={t('settings.startMuted')} checked={settings.startMuted} onChange={(value) => setSettings({ startMuted: value })} />
          <Toggle label={t('settings.autoplay')} checked={settings.autoplay} onChange={(value) => setSettings({ autoplay: value })} />
        </Card>

        <Card className="space-y-1">
          <h2 className="mb-2 text-sm font-extrabold text-white">{t('settings.social')}</h2>
          <Field
            label={t('chat.nickname')}
            value={settings.chatNickname}
            onChange={(event) => setSettings({ chatNickname: event.target.value })}
          />
          <Toggle label={t('chat.title')} checked={settings.showChat} onChange={(value) => setSettings({ showChat: value })} />
        </Card>

        <Card className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-white">
            <Lock className="h-4 w-4 text-brand-500" />
            {t('settings.privacy')}
          </h2>

          <Toggle
            label={t('settings.parental')}
            description={lang === 'ar' ? 'إخفاء القنوات المصنّفة للبالغين حتى إدخال الرمز' : 'Hide adult-labelled channels until the PIN is entered'}
            checked={settings.parentalEnabled}
            onChange={(value) => {
              setSettings({ parentalEnabled: value });
              if (!value) lockParental();
            }}
          />

          <div className="flex flex-wrap items-end gap-2">
            <Field label={t('settings.parentalPin')} value={pin} onChange={(event) => setPin(event.target.value)} className="w-40" />
            <Button variant="outline" onClick={() => setSettings({ parentalPin: pin })}>
              {t('common.save')}
            </Button>
            {settings.parentalEnabled ? (
              parentalUnlocked ? (
                <Button variant="danger" onClick={lockParental}>
                  <Lock className="h-4 w-4" />
                  {lang === 'ar' ? 'إعادة القفل' : 'Lock again'}
                </Button>
              ) : (
                <Button
                  variant="gold"
                  onClick={() => {
                    const ok = unlockParental(pin);
                    setPinError(!ok);
                  }}
                >
                  <Unlock className="h-4 w-4" />
                  {lang === 'ar' ? 'فتح' : 'Unlock'}
                </Button>
              )
            ) : null}
          </div>
          {pinError ? <p className="text-xs text-red-400">{lang === 'ar' ? 'رمز خاطئ' : 'Wrong PIN'}</p> : null}
        </Card>

        <Card className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-white">
            <Monitor className="h-4 w-4 text-brand-500" />
            {t('settings.data')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {install.available ? (
              <Button variant="gold" onClick={install.prompt}>
                {t('settings.install')}
              </Button>
            ) : null}
            {channels.length ? (
              <Button variant="outline" onClick={() => downloadText('drama-live-web.m3u', exportM3u())}>
                <Download className="h-4 w-4" />
                {t('sources.export')}
              </Button>
            ) : null}
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm(lang === 'ar' ? 'حذف كل القوائم والمفضلة؟' : 'Delete every playlist and favorite?')) resetAll();
              }}
            >
              <Trash2 className="h-4 w-4" />
              {t('settings.clear')}
            </Button>
          </div>
          <p className="text-[11px] text-slate-500">
            {lang === 'ar'
              ? 'تُحفظ القوائم والمفضلة والإعدادات في متصفحك فقط (localStorage) ولا تُرسل إلى أي خادم.'
              : 'Playlists, favorites and settings stay in your browser only (localStorage). Nothing is sent to a server.'}
          </p>
        </Card>

        <Card className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-white">
            <Keyboard className="h-4 w-4 text-brand-500" />
            {t('settings.shortcuts')}
          </h2>
          <ul className="grid gap-1.5 text-xs text-slate-400 sm:grid-cols-2">
            {[
              ['Space / K', lang === 'ar' ? 'تشغيل أو إيقاف' : 'Play / pause'],
              ['↑ / ↓', lang === 'ar' ? 'القناة السابقة / التالية' : 'Previous / next channel'],
              ['M', lang === 'ar' ? 'كتم الصوت' : 'Mute'],
              ['F', lang === 'ar' ? 'ملء الشاشة' : 'Fullscreen'],
              ['P', lang === 'ar' ? 'صورة داخل صورة' : 'Picture in picture'],
              ['Tab / Enter', lang === 'ar' ? 'تنقّل التلفاز' : 'TV remote navigation'],
            ].map(([key, description]) => (
              <li key={key} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
                <kbd className="rounded-md border border-white/10 bg-ink-800 px-2 py-0.5 font-mono text-[10px] text-slate-200">{key}</kbd>
                <span className="text-start">{description}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function SegmentedRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm font-semibold text-slate-200">{label}</span>
      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-ink-900 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={clsx(
              'shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition',
              value === option.value ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-100',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="py-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-200">{label}</span>
        <span className="font-mono text-xs text-slate-400">{step < 1 ? Math.round(value * 100) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-brand-500"
      />
    </div>
  );
}
