import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  Clapperboard,
  Globe,
  Heart,
  LayoutGrid,
  List,
  Menu,
  Moon,
  Radio,
  Settings,
  Sun,
  Tv,
  X,
  CalendarDays,
  Plug,
} from 'lucide-react';
import { useI18n } from '../hooks/useI18n';
import { useAppStore } from '../store/appStore';
import { Badge } from '../components/ui';
import type { TKey } from '../i18n';

interface NavItem {
  to: string;
  icon: typeof Tv;
  label: TKey;
}

const NAV: NavItem[] = [
  { to: '/app/live', icon: Tv, label: 'nav.live' },
  { to: '/app/movies', icon: Clapperboard, label: 'nav.movies' },
  { to: '/app/series', icon: List, label: 'nav.series' },
  { to: '/app/radio', icon: Radio, label: 'nav.radio' },
  { to: '/app/favorites', icon: Heart, label: 'nav.favorites' },
  { to: '/app/multiview', icon: LayoutGrid, label: 'nav.multiview' },
  { to: '/app/guide', icon: CalendarDays, label: 'nav.guide' },
  { to: '/app/sources', icon: Plug, label: 'nav.sources' },
  { to: '/app/settings', icon: Settings, label: 'nav.settings' },
];

export function AppLayout() {
  const { t, lang, setLang, theme, toggleTheme } = useI18n();
  const [open, setOpen] = useState(false);
  const channels = useAppStore((state) => state.channels);
  const sources = useAppStore((state) => state.sources);
  const seeded = useRef(false);

  // First visit: seed the free demo playlist so the player has something to play.
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const { sources: existing, loadDemo } = useAppStore.getState();
    if (existing.length === 0) void loadDemo();
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-ink-950 text-slate-100">
      <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-ink-900/80 px-3 backdrop-blur sm:px-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 lg:hidden"
          aria-label="menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-black text-white">
            DL
          </span>
          <span className="hidden text-sm font-extrabold sm:inline">{t('brand.name')}</span>
        </Link>

        <Badge tone="ok">{channels.length.toLocaleString(lang === 'ar' ? 'ar-MA' : 'en-GB')} {t('player.channelsCount')}</Badge>
        {sources.length ? <Badge>{sources.length} {t('nav.sources')}</Badge> : null}

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-bold hover:bg-white/10"
        >
          <Globe className="h-4 w-4" />
          {lang === 'ar' ? 'EN' : 'عربي'}
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 hover:bg-white/10"
          aria-label="theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <Link
          to="/"
          className="hidden rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold hover:bg-white/10 sm:inline-block"
        >
          {t('nav.back')}
        </Link>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className={clsx(
            'z-40 w-60 shrink-0 overflow-y-auto border-e border-white/10 bg-ink-900 p-3 lg:block',
            'max-lg:fixed max-lg:inset-y-0 max-lg:start-0 max-lg:h-dvh max-lg:pt-4',
            open ? 'max-lg:block' : 'max-lg:hidden',
          )}
        >
          <div className="mb-3 flex items-center justify-between lg:hidden">
            <span className="text-xs font-bold text-slate-400">{t('brand.name')}</span>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>
          <nav className="space-y-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  clsx(
                    'grid-focus flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                    isActive ? 'bg-brand-600/20 text-brand-300 ring-1 ring-brand-500/30' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
                  )
                }
              >
                <item.icon className="h-4.5 w-4.5" />
                {t(item.label)}
              </NavLink>
            ))}
          </nav>
        </aside>

        {open ? (
          <button
            type="button"
            aria-label="close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          />
        ) : null}

        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
