import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  Activity,
  BadgeCheck,
  Cast,
  ChevronDown,
  Clapperboard,
  CloudDownload,
  Cpu,
  Gauge,
  Globe,
  Headphones,
  Layers,
  ListVideo,
  Monitor,
  Moon,
  Music2,
  Newspaper,
  Plug,
  Radio,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Star,
  Sun,
  Tv,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { useI18n } from '../hooks/useI18n';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { useHlsPlayer } from '../hooks/useHlsPlayer';
import { CATEGORY_PRESETS } from '../lib/demo';
import type { Lang } from '../i18n';

const HERO_STREAM = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

type Pair = [ar: string, en: string];
const pick = (pair: Pair, lang: Lang) => (lang === 'ar' ? pair[0] : pair[1]);

const FEATURES: { icon: typeof Tv; title: Pair; body: Pair }[] = [
  {
    icon: Plug,
    title: ['دعم تنسيقات متعددة', 'Multiple playlist formats'],
    body: [
      'شغّل قوائم M3U و M3U8 من رابط أو ملف أو نص، وسجّل دخولك في سيرفرات Xtream Codes، أو استخدم كود FG قصير قابل للمشاركة.',
      'Play M3U/M3U8 lists from a url, a file or pasted text, log into Xtream Codes panels, or use a short shareable FG code.',
    ],
  },
  {
    icon: Gauge,
    title: ['بث حتى 4K مع تحكم بالجودة', 'Streaming up to 4K with quality control'],
    body: [
      'اختر بين SD وHD وFHD و4K أو اترك الاختيار تلقائياً حسب سرعة اتصالك، مع إمكانية تثبيت جودة افتراضية لكل الجلسات.',
      'Pick SD, HD, FHD or 4K, or let the player adapt to your bandwidth — with a default cap you can set once.',
    ],
  },
  {
    icon: ListVideo,
    title: ['تشغيل متعدد القنوات', 'Multi-channel playback'],
    body: [
      'شاهد حتى 4 قنوات في وقت واحد على شبكة مقسّمة، مع صوت للقناة التي تركز عليها وتبديل فوري بينها.',
      'Watch up to four channels at once in a split grid, with audio on the focused pane and instant swapping.',
    ],
  },
  {
    icon: RefreshCw,
    title: ['إعادة اتصال تلقائي', 'Automatic reconnection'],
    body: [
      'عند انقطاع البث يعيد المشغل المحاولة تلقائياً بعدد محاولات قابل للضبط، وينتقل إلى الخادم الاحتياطي للقناة إن وُجد.',
      'When a stream drops the player retries with a configurable backoff and falls back to the channel backup server.',
    ],
  },
  {
    icon: Layers,
    title: ['تنسيقات فيديو وصوت متعددة', 'Many video and audio formats'],
    body: [
      'HLS وMP4 وWebM للصورة، وMP3 وAAC وOGG للراديو، مع دعم البث المباشر وملفات VOD في نفس الواجهة.',
      'HLS, MP4 and WebM for video; MP3, AAC and OGG for radio — live streams and VOD files in the same interface.',
    ],
  },
  {
    icon: Headphones,
    title: ['تشغيل في الخلفية', 'Background playback'],
    body: [
      'وضع صوت فقط يبقي التشغيل شغالاً مع إطفاء الشاشة، مع أزرار تحكم في شاشة القفل عبر Media Session.',
      'An audio-only mode keeps playing with the screen off, plus lock-screen controls through the Media Session API.',
    ],
  },
  {
    icon: Star,
    title: ['القنوات المفضلة', 'Favorite channels'],
    body: [
      'احفظ قنواتك وأفلامك بعلمة واحدة، وتُحفظ المفضلة في متصفحك لتجدها فوراً في المرة القادمة.',
      'Bookmark channels and movies with one tap; favorites are stored in your browser for instant access.',
    ],
  },
  {
    icon: Monitor,
    title: ['وضع صورة داخل صورة', 'Picture-in-picture'],
    body: [
      'نافذة عائمة صغيرة فوق أي تطبيق آخر، بزر واحد أو بالاختصار P.',
      'A small floating window over anything else, one tap or the P shortcut away.',
    ],
  },
  {
    icon: Activity,
    title: ['دردشة أثناء المشاهدة', 'Chat while you watch'],
    body: [
      'غرفة دردشة تعمل بين نوافذ وتبويبات المتصفح بدون خادم ولا تسجيل، مع إيموجي سريعة وذكر القناة الحالية.',
      'A chat room shared between browser tabs with no server and no sign-up, quick emoji and the current channel attached.',
    ],
  },
  {
    icon: Cast,
    title: ['بث إلى شاشة أكبر', 'Cast to a bigger screen'],
    body: [
      'ملء الشاشة على الكمبيوتر أو التلفاز الذكي، ووضع تلفاز خاص بالتنقّل بالأسهم للمسافات البعيدة.',
      'Fullscreen on a computer or smart TV, plus a TV mode with arrow-key navigation for the couch.',
    ],
  },
  {
    icon: Music2,
    title: ['اختيار المسار الصوتي والترجمة', 'Audio track & subtitle selection'],
    body: [
      'بدّل لغة الصوت ومسارات الترجمة المتاحة في البث مباشرة من قائمة المشغّل.',
      'Switch audio languages and subtitle tracks exposed by the stream straight from the player menu.',
    ],
  },
  {
    icon: Newspaper,
    title: ['دليل البرامج EPG', 'TV guide (EPG)'],
    body: [
      'استورد دليل XMLTV لترى ما يُعرض الآن والتالي لكل قناة مع شريط تقدّم للبرنامج الحالي.',
      'Import an XMLTV guide to see now/next for every channel with a progress bar on the current programme.',
    ],
  },
  {
    icon: Globe,
    title: ['تصنيف حسب المجموعة والدولة', 'Browse by group and country'],
    body: [
      'بحث فوري، مجموعات، دول، وأقسام جاهزة (رياضة، أخبار، أطفال، أفلام، وثائقي، موسيقى…).',
      'Instant search, groups, countries and ready-made sections (sports, news, kids, movies, docs, music…).',
    ],
  },
  {
    icon: ShieldCheck,
    title: ['لا محتوى مضمّن', 'No content included'],
    body: [
      'المشغل لا يستضيف ولا يبيع أي محتوى؛ أنت من يضيف مصدره، وكل شيء يبقى محلياً في جهازك.',
      'The player hosts and sells nothing — you add your own source and everything stays on your device.',
    ],
  },
  {
    icon: Cpu,
    title: ['خفيف وسريع', 'Lightweight'],
    body: [
      'يعمل في المتصفح بدون تثبيت، ويحمّل القوائم الكبيرة (آلاف القنوات) بدون تجميد الواجهة.',
      'Runs in the browser with no install, and handles huge playlists (thousands of channels) without freezing.',
    ],
  },
  {
    icon: Wallet,
    title: ['مجاني بالكامل وبدون إعلانات', 'Completely free, no ads'],
    body: [
      'لا اشتراك، لا عمليات شراء داخلية، ولا إعلانات تقطع المشاهدة. كل الميزات مفتوحة.',
      'No subscription, no in-app purchases, no ad breaks. Every feature is unlocked.',
    ],
  },
  {
    icon: Smartphone,
    title: ['يعمل على كل الأجهزة', 'Works on every device'],
    body: [
      'هاتف، لوحي، كمبيوتر، أندرويد TV وFire Stick — نفس الواجهة، ويمكن تثبيت الموقع كتطبيق.',
      'Phone, tablet, computer, Android TV and Fire Stick — same interface, and the site can be installed as an app.',
    ],
  },
  {
    icon: Moon,
    title: ['مؤقّت نوم ووضع ليلي', 'Sleep timer & dark mode'],
    body: [
      'أوقف التشغيل تلقائياً بعد مدة تحددها، واختر المظهر الداكن أو الفاتح واللغة العربية أو الإنجليزية.',
      'Stop playback automatically after a set time, and choose dark or light theme, Arabic or English.',
    ],
  },
];

const PREMIUM: { icon: typeof Zap; title: Pair; body: Pair }[] = [
  { icon: Zap, title: ['كل الميزات مفتوحة', 'Every feature unlocked'], body: ['المشاهدة المتعددة، الدردشة، PiP والتشغيل الخلفي متاحة من أول ثانية.', 'Multi-view, chat, PiP and background playback are available from the first second.'] },
  { icon: BadgeCheck, title: ['بدون إعلانات', 'Ad-free'], body: ['لا فواصل إعلانية ولا لافتات داخل المشغّل.', 'No ad breaks, no banners inside the player.'] },
  { icon: Globe, title: ['قوائم عربية جاهزة', 'Arabic-ready'], body: ['واجهة عربية كاملة باتجاه RTL، ودعم قنوات الدول العربية في البحث والمجموعات.', 'A full RTL Arabic UI with Arabic country groups in search and filters.'] },
  { icon: Tv, title: ['دعم التلفاز', 'TV support'], body: ['وضع تلفاء مخصص للتنقّل بالأسهم والتركيز الواضح لعشرة أقدام.', 'A TV mode with arrow navigation and clear focus for ten-foot use.'] },
];

const STEPS: Record<string, Pair[]> = {
  android: [
    ['افتح الموقع في متصفح كروم على هاتفك الأندرويد.', 'Open this site in Chrome on your Android phone.'],
    ['اضغط زر «تثبيت كتطبيق» أو اختر «إضافة إلى الشاشة الرئيسية» من قائمة المتصفح.', 'Tap "Install as an app", or choose "Add to Home screen" from the browser menu.'],
    ['افتح أيقونة دراما لايف ويب من الشاشة الرئيسية كأي تطبيق عادي.', 'Open the Drama Live Web icon from your home screen like any app.'],
    ['من صفحة المصادر أضف رابط M3U أو اشتراك Xtream Codes أو كود FG.', 'From Sources, add an M3U url, an Xtream Codes login or an FG code.'],
    ['ابدأ المشاهدة — القنوات تُحفظ في جهازك ولا حاجة لإعادة الإدخال.', 'Start watching — the list is saved on your device, no need to re-enter it.'],
  ],
  ios: [
    ['افتح الموقع في Safari على آيفون أو آيباد.', 'Open this site in Safari on iPhone or iPad.'],
    ['اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».', 'Tap Share, then "Add to Home Screen".'],
    ['افتح التطبيق من الشاشة الرئيسية؛ يعمل بملء الشاشة بدون شريط المتصفح.', 'Launch it from the home screen; it runs fullscreen without the browser bar.'],
    ['أضف قائمتك من صفحة المصادر واستخدم وضع «صوت فقط» للاستماع في الخلفية.', 'Add your playlist on Sources, and use audio-only mode to listen in the background.'],
  ],
  pc: [
    ['افتح الموقع في أي متصفح حديث (كروم، إيدج، فايرفوكس).', 'Open the site in any modern browser (Chrome, Edge, Firefox).'],
    ['ثبّته كتطبيق من زر «تثبيت كتطبيق» في صفحة الإعدادات ليصبح نافذة مستقلة.', 'Install it from the button on the Settings page to get a standalone window.'],
    ['استخدم F لملء الشاشة، وP لصورة داخل صورة، والأسهم للتنقل بين القنوات.', 'Use F for fullscreen, P for picture-in-picture, and the arrows to change channel.'],
    ['صدّر قائمتك كملف M3U من صفحة المصادر لاستعمالها في أي مشغل آخر.', 'Export your list as an M3U file from Sources to reuse it in any other player.'],
  ],
  tv: [
    ['افتح متصفح التلفاز (أو متصفح Fire Stick / Android TV) وادخل إلى الموقع.', 'Open your TV browser (or Fire Stick / Android TV browser) and load the site.'],
    ['فعّل «وضع التلفاز» من الإعدادات لتكبير عناصر التحكم والتنقّل بالأسهم.', 'Turn on TV mode in Settings for larger controls and arrow navigation.'],
    ['اربط لوحة مفاتيح أو جهاز تحكم USB للتنقّل بسهولة.', 'Pair a keyboard or a USB remote for easy navigation.'],
    ['استخدم المشاهدة المتعددة لمتابعة أكثر من مباراة على نفس الشاشة.', 'Use multi-view to follow more than one match on the same screen.'],
  ],
};

const FAQ: { q: Pair; a: Pair }[] = [
  {
    q: ['هل الموقع مجاني فعلاً؟', 'Is the site really free?'],
    a: ['نعم، مجاني بالكامل بدون إعلانات أو اشتراكات أو عمليات شراء داخلية، وكل الميزات مفتوحة.', 'Yes — completely free, with no ads, subscriptions or in-app purchases, and every feature unlocked.'],
  },
  {
    q: ['من أين يأتي المحتوى؟', 'Where does the content come from?'],
    a: ['المشغل لا يتضمن أي محتوى. أنت من يضيف مصدره: رابط M3U، اشتراك Xtream Codes، أو كود FG من مزوّدك.', 'The player ships no content. You bring your own source: an M3U url, an Xtream Codes subscription, or an FG code from your provider.'],
  },
  {
    q: ['لماذا لا تعمل بعض القنوات؟', 'Why do some channels not play?'],
    a: ['غالباً لأن السيرفر يمنع المتصفح من القراءة المباشرة (CORS) أو يتطلب ترويسات خاصة. جرّب قناة أخرى أو مصدراً آخر، أو استخدم وضع Native HLS من الإعدادات.', 'Usually because the server blocks direct browser access (CORS) or needs special headers. Try another channel or source, or enable Native HLS in Settings.'],
  },
  {
    q: ['هل تُحفظ بياناتي على خادم؟', 'Is my data stored on a server?'],
    a: ['لا. القوائم والمفضلة والإعدادات والدردشة كلها داخل متصفحك فقط (localStorage)، والدردشة تنتقل بين تبويبات جهازك فقط.', 'No. Playlists, favorites, settings and chat live in your browser only (localStorage), and chat only travels between tabs on your device.'],
  },
  {
    q: ['هل يمكن استخدامه على التلفاز؟', 'Can I use it on a TV?'],
    a: ['نعم، عبر متصفح التلفاز الذكي أو Fire Stick، مع وضع تلفاء مخصص وملء الشاشة. ويمكنك أيضاً بث نافذة المتصفح من الكمبيوتر.', 'Yes, through a smart-TV or Fire Stick browser, with a dedicated TV mode and fullscreen. You can also cast a browser tab from a computer.'],
  },
  {
    q: ['ما هو كود FG؟', 'What is an FG code?'],
    a: ['اختصار قصير يمثّل قائمة كاملة، يسهل مشاركته في رسالة بدل رابط طويل. أنشئه من صفحة المصادر والصقه في أي جهاز آخر.', 'A short string that stands for a whole playlist, easier to share than a long url. Generate it on the Sources page and paste it on another device.'],
  },
  {
    q: ['هل يدعم دليل البرامج؟', 'Does it support a TV guide?'],
    a: ['نعم، أضف رابط XMLTV في صفحة المصادر وستظهر مواعيد «الآن/التالي» وشريط تقدّم لكل قناة.', 'Yes — add an XMLTV url on the Sources page and you get now/next times and a progress bar per channel.'],
  },
];

const APP_INFO: { label: Pair; value: Pair }[] = [
  { label: ['الاسم', 'Name'], value: ['دراما لايف ويب', 'Drama Live Web'] },
  { label: ['تم التحديث', 'Updated'], value: ['اليوم', 'Today'] },
  { label: ['متوافق مع', 'Compatible with'], value: ['أي متصفح حديث — أندرويد، iOS، ويندوز، ماك، Android TV', 'Any modern browser — Android, iOS, Windows, macOS, Android TV'] },
  { label: ['الإصدار', 'Version'], value: ['1.0.0 (Web)', '1.0.0 (Web)'] },
  { label: ['الحجم', 'Size'], value: ['يعمل في المتصفح — لا تحميل', 'Runs in the browser — nothing to download'] },
  { label: ['التنزيلات', 'Installs'], value: ['تثبيت اختياري كتطبيق (PWA)', 'Optional install as an app (PWA)'] },
  { label: ['المطوّر', 'Developer'], value: ['Drama Live Web', 'Drama Live Web'] },
  { label: ['السعر', 'Price'], value: ['مجاني', 'Free'] },
];

export function Landing() {
  const { t, lang, setLang, theme, toggleTheme } = useI18n();
  const install = useInstallPrompt();
  const [tab, setTab] = useState<keyof typeof STEPS>('android');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-dvh bg-white text-ink-900 dark:bg-ink-950 dark:text-slate-100">
      <TopBar
        lang={lang}
        setLang={setLang}
        theme={theme}
        toggleTheme={toggleTheme}
        onInstall={install.available ? install.prompt : undefined}
      />

      <Hero lang={lang} />

      {/* app info table */}
      <section id="info" className="mx-auto max-w-5xl px-4 py-14">
        <div className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-ink-900">
          <div className="flex flex-wrap items-center gap-4 border-b border-black/5 p-5 dark:border-white/10">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-base font-black text-white">
              DL
            </span>
            <div>
              <h2 className="text-lg font-extrabold">{t('info.title')}</h2>
              <p className="text-xs text-slate-500">{t('brand.tagline')}</p>
            </div>
          </div>
          <dl className="divide-y divide-black/5 dark:divide-white/10">
            {APP_INFO.map((row) => (
              <div key={row.label[1]} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <dt className="text-xs font-bold text-slate-500">{pick(row.label, lang)}</dt>
                <dd className="text-sm font-semibold">{pick(row.value, lang)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* what is */}
      <section className="mx-auto max-w-5xl px-4 pb-14">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">{t('what.title')}</h2>
            <p className="mt-4 leading-relaxed text-slate-500 dark:text-slate-400">{t('what.body')}</p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {([
                ['M3U / M3U8', 'Xtream Codes'],
                ['FG Code', 'XMLTV EPG'],
              ] as Pair[]).map((pair) => (
                <li
                  key={pair[0]}
                  className="flex items-center gap-2 rounded-xl border border-black/5 bg-white px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-ink-900"
                >
                  <BadgeCheck className="h-4 w-4 text-brand-500" />
                  {pair[0]} · {pair[1]}
                </li>
              ))}
            </ul>
          </div>
          <MockApp />
        </div>
      </section>

      {/* features */}
      <section id="features" className="border-y border-black/5 bg-slate-50 py-16 dark:border-white/10 dark:bg-ink-900/40">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHead eyebrow={t('features.live')} title={t('features.title')} subtitle={t('features.subtitle')} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <article
                key={feature.title[1]}
                className="group rounded-2xl border border-black/5 bg-white p-5 transition hover:-translate-y-1 hover:border-brand-500/40 hover:shadow-lg dark:border-white/10 dark:bg-ink-900"
              >
                <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-brand-600/10 text-brand-500 transition group-hover:bg-brand-600 group-hover:text-white">
                  <feature.icon className="h-5 w-5" />
                </span>
                <h3 className="text-sm font-extrabold">{pick(feature.title, lang)}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{pick(feature.body, lang)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* premium */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <SectionHead eyebrow={t('hero.stat.free')} title={t('premium.title')} subtitle={t('premium.subtitle')} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PREMIUM.map((item) => (
            <div key={item.title[1]} className="rounded-2xl border border-gold-500/25 bg-gold-500/5 p-5">
              <item.icon className="mb-3 h-5 w-5 text-gold-500" />
              <h3 className="text-sm font-extrabold">{pick(item.title, lang)}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{pick(item.body, lang)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* categories */}
      <section id="categories" className="border-y border-black/5 bg-slate-50 py-16 dark:border-white/10 dark:bg-ink-900/40">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHead eyebrow={t('nav.categories')} title={t('cats.title')} subtitle={t('cats.subtitle')} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {CATEGORY_PRESETS.map((preset, index) => (
              <Link
                key={preset.id}
                to="/app/live"
                className="flex flex-col items-center gap-2 rounded-2xl border border-black/5 bg-white p-5 text-center transition hover:-translate-y-1 hover:border-brand-500/50 dark:border-white/10 dark:bg-ink-900"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600/10 text-brand-500">
                  <CategoryIcon index={index} />
                </span>
                <span className="text-xs font-extrabold">{lang === 'ar' ? preset.ar : preset.en}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* install */}
      <section id="install" className="mx-auto max-w-5xl px-4 py-16">
        <SectionHead eyebrow={t('nav.download')} title={t('install.title')} subtitle={t('install.subtitle')} />
        <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto">
          {(Object.keys(STEPS) as (keyof typeof STEPS)[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={clsx(
                'shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition',
                tab === key
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/25'
                  : 'border border-black/10 text-slate-500 hover:border-brand-500 dark:border-white/10 dark:text-slate-300',
              )}
            >
              {t(`install.${key}` as never)}
            </button>
          ))}
        </div>

        <ol className="space-y-3">
          {STEPS[tab].map((step, index) => (
            <li key={step[1]} className="flex gap-4 rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-ink-900">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-black text-white">
                {index + 1}
              </span>
              <p className="pt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{pick(step, lang)}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/app/sources"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-500"
          >
            <Plug className="h-4 w-4" />
            {t('player.addSource')}
          </Link>
          {install.available ? (
            <button
              type="button"
              onClick={install.prompt}
              className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-5 py-3 text-sm font-bold hover:border-brand-500 dark:border-white/15"
            >
              <CloudDownload className="h-4 w-4" />
              {t('settings.install')}
            </button>
          ) : null}
        </div>
      </section>

      {/* faq */}
      <section id="faq" className="border-t border-black/5 bg-slate-50 py-16 dark:border-white/10 dark:bg-ink-900/40">
        <div className="mx-auto max-w-3xl px-4">
          <SectionHead eyebrow={t('nav.faq')} title={t('faq.title')} />
          <div className="space-y-2">
            {FAQ.map((item, index) => {
              const open = openFaq === index;
              return (
                <div key={item.q[1]} className="overflow-hidden rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-ink-900">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : index)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start"
                  >
                    <span className="text-sm font-extrabold">{pick(item.q, lang)}</span>
                    <ChevronDown className={clsx('h-4 w-4 shrink-0 transition', open && 'rotate-180')} />
                  </button>
                  {open ? (
                    <p className="border-t border-black/5 px-5 py-4 text-sm leading-relaxed text-slate-500 dark:border-white/10 dark:text-slate-400">
                      {pick(item.a, lang)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* disclaimer */}
      <section className="mx-auto max-w-3xl px-4 py-14">
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-6">
          <h2 className="flex items-center gap-2 text-sm font-extrabold">
            <ShieldCheck className="h-4 w-4 text-amber-500" />
            {t('disclaimer.title')}
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t('disclaimer.body')}</p>
        </div>
      </section>

      <footer className="border-t border-black/5 bg-white py-10 dark:border-white/10 dark:bg-ink-900">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-center sm:flex-row sm:justify-between sm:text-start">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-black text-white">
              DL
            </span>
            <div>
              <p className="text-sm font-extrabold">{t('brand.name')}</p>
              <p className="text-[11px] text-slate-500">{t('footer.built')}</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            © {new Date().getFullYear()} {t('brand.name')} · {t('footer.rights')}
          </p>
          <Link
            to="/app"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-500"
          >
            <Tv className="h-4 w-4" />
            {t('hero.cta.primary')}
          </Link>
        </div>
      </footer>
    </div>
  );
}

function TopBar({
  lang,
  setLang,
  theme,
  toggleTheme,
  onInstall,
}: {
  lang: Lang;
  setLang: (lang: Lang) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  onInstall?: () => void;
}) {
  const { t } = useI18n();
  const links = [
    { href: '#features', label: t('nav.features') },
    { href: '#categories', label: t('nav.categories') },
    { href: '#install', label: t('nav.install') },
    { href: '#faq', label: t('nav.faq') },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-ink-950/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <a href="#top" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-black text-white">
            DL
          </span>
          <span className="text-sm font-extrabold">{t('brand.name')}</span>
        </a>

        <nav className="mx-auto hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:text-brand-500">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2 md:ms-0">
          {onInstall ? (
            <button
              type="button"
              onClick={onInstall}
              className="hidden rounded-xl border border-black/10 px-3 py-2 text-xs font-bold hover:border-brand-500 sm:inline-flex dark:border-white/15"
            >
              <CloudDownload className="me-1.5 h-3.5 w-3.5" />
              {t('settings.install')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-2.5 py-2 text-xs font-bold dark:border-white/15"
          >
            <Globe className="h-3.5 w-3.5" />
            {lang === 'ar' ? 'EN' : 'عربي'}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="theme"
            className="grid h-9 w-9 place-items-center rounded-xl border border-black/10 dark:border-white/15"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link
            to="/app"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-500"
          >
            <Tv className="h-4 w-4" />
            {t('hero.cta.primary')}
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero({ lang }: { lang: Lang }) {
  const { t } = useI18n();
  const stats: [string, string][] = [
    ['10,000+', t('hero.stat.channels')],
    ['4', t('hero.stat.formats')],
    ['4K', t('hero.stat.quality')],
    ['0$', t('hero.stat.price')],
  ];

  return (
    <section id="top" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 start-1/4 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="absolute -bottom-32 end-1/4 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-[11px] font-bold text-brand-500">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-brand-500" />
            {t('hero.badge')}
          </span>

          <h1 className="mt-5 text-balance text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            {t('hero.title')}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-400 sm:text-base">
            {t('hero.subtitle')}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/app"
              className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-6 py-3.5 text-sm font-extrabold text-white shadow-xl shadow-brand-600/30 transition hover:-translate-y-0.5 hover:bg-brand-500"
            >
              <Tv className="h-5 w-5" />
              {t('hero.cta.primary')}
            </Link>
            <Link
              to="/app/live"
              className="inline-flex items-center gap-2 rounded-2xl border border-black/10 px-6 py-3.5 text-sm font-extrabold transition hover:border-brand-500 dark:border-white/15"
            >
              <Play className="h-4 w-4" />
              {t('hero.cta.secondary')}
            </Link>
          </div>

          <p className="mt-4 flex items-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            {t('hero.note')}
          </p>

          <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-black/5 bg-white p-3 text-center dark:border-white/10 dark:bg-ink-900">
                <dt className="text-lg font-black text-brand-500">{value}</dt>
                <dd className="text-[10px] font-semibold text-slate-500">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <HeroPreview lang={lang} />
      </div>
    </section>
  );
}

function HeroPreview({ lang }: { lang: Lang }) {
  const { t } = useI18n();
  const player = useHlsPlayer({ url: HERO_STREAM, muted: true, autoReconnect: true, reconnectAttempts: 2 });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (player.state === 'error') setFailed(true);
  }, [player.state]);

  const bars = useMemo(() => [60, 85, 45, 70, 95, 55, 78], []);

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-3xl border border-black/10 bg-ink-900 shadow-2xl dark:border-white/10">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          <span className="ms-3 text-[10px] font-bold text-slate-500">{t('brand.name')}</span>
          <span className="ms-auto flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] font-black text-red-400">
            <span className="live-dot h-1 w-1 rounded-full bg-red-500" />
            {t('player.live')}
          </span>
        </div>

        <div className="relative aspect-video bg-black">
          {!failed ? (
            <video ref={player.videoRef} muted playsInline autoPlay className="h-full w-full object-cover" />
          ) : null}
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-transparent to-transparent p-4">
            <p className="text-sm font-extrabold text-white">
              {lang === 'ar' ? 'بث تجريبي عام — يعمل الآن في متصفحك' : 'Public test stream — playing in your browser'}
            </p>
            <p className="text-[11px] text-slate-300">
              {player.stats.height ? `${player.stats.width}×${player.stats.height}` : 'HLS'} ·{' '}
              {player.stats.bitrate ? `${(player.stats.bitrate / 1_000_000).toFixed(1)} Mbps` : '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-3">
          <div className="flex flex-1 items-end gap-1">
            {bars.map((height, index) => (
              <span
                key={index}
                className="w-1.5 rounded-full bg-brand-500/80"
                style={{ height: `${height / 4}px`, animation: `pulse-live ${0.9 + index * 0.12}s ease-in-out infinite` }}
              />
            ))}
          </div>
          <span className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold text-slate-300">FHD</span>
          <span className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold text-slate-300">PiP</span>
          <span className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold text-slate-300">×4</span>
        </div>
      </div>

      <div className="absolute -bottom-5 -start-4 hidden rounded-2xl border border-black/5 bg-white p-3 shadow-xl sm:block dark:border-white/10 dark:bg-ink-900">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-500" />
          <div>
            <p className="text-[10px] font-black">{t('chat.title')}</p>
            <p className="text-[9px] text-slate-500">{t('chat.local').slice(0, 40)}…</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockApp() {
  const { t, lang } = useI18n();
  const rows = [
    { icon: Tv, name: lang === 'ar' ? 'قناة الأخبار 24' : 'News 24', meta: '19:00 · نشرة مسائية' },
    { icon: Clapperboard, name: lang === 'ar' ? 'أفلام HD' : 'Movies HD', meta: 'FHD · 1080p' },
    { icon: Radio, name: lang === 'ar' ? 'راديو موسيقى' : 'Music radio', meta: 'MP3 · 128kbps' },
    { icon: ListVideo, name: lang === 'ar' ? 'مشاهدة متعددة' : 'Multi view', meta: '×4' },
  ];
  return (
    <div className="rounded-3xl border border-black/5 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-ink-900">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-extrabold">{t('nav.live')}</p>
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-500">
          {t('sources.enabled')}
        </span>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-2.5 dark:bg-white/[0.04]">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600/10 text-brand-500">
              <row.icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold">{row.name}</p>
              <p className="truncate text-[10px] text-slate-500">{row.meta}</p>
            </div>
            <Star className="ms-auto h-3.5 w-3.5 text-gold-500" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryIcon({ index }: { index: number }) {
  const icons = [Zap, Newspaper, Tv, Clapperboard, ListVideo, Radio, ShieldCheck, Globe, Music2, Headphones];
  const Icon = icons[index % icons.length];
  return <Icon className="h-5 w-5" />;
}

function SectionHead({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      <span className="mb-3 inline-block rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-[11px] font-bold text-brand-500">
        {eyebrow}
      </span>
      <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h2>
      {subtitle ? <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
    </div>
  );
}

function Play(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11-6.86a1 1 0 0 0 0-1.7l-11-6.86A1 1 0 0 0 8 5.14z" />
    </svg>
  );
}
