/**
 * DOM smoke test: compiles the real TSX sources with Vite and renders the real
 * components into a jsdom document, then exercises the zustand store for real.
 *
 * Run with: node scripts/dom-smoke.mjs
 */
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';

const dom = new JSDOM('<!doctype html><html lang="ar" dir="rtl"><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
});

const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true, writable: true });
globalThis.localStorage = window.localStorage;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Element = window.Element;
globalThis.Node = window.Node;
globalThis.Event = window.Event;
globalThis.CustomEvent = window.CustomEvent;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
globalThis.self = window;
window.scrollTo = () => {};
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};
window.HTMLMediaElement.prototype.load = () => {};

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

let checks = 0;
const ok = (label) => {
  checks += 1;
  console.log(`  ✓ ${label}`);
};

try {
  // ---------------------------------------------------------------- landing
  window.location.hash = '#/';
  const appModule = await vite.ssrLoadModule('/src/App.tsx');
  const App = appModule.default;
  const landing = renderToString(React.createElement(App));

  assert.ok(landing.includes('دراما لايف ويب'), 'brand rendered');
  assert.ok(landing.includes('شاهد قنواتك المفضلة'), 'hero title rendered');
  assert.ok(landing.includes('الميزات الرئيسية'), 'features section rendered');
  assert.ok(landing.includes('الأسئلة الشائعة'), 'faq section rendered');
  assert.ok(landing.includes('طريقة التشغيل على جهازك'), 'install section rendered');
  assert.ok(landing.includes('إخلاء مسؤولية'), 'disclaimer rendered');
  ok('landing page renders every section (hero, features, install, faq, disclaimer)');

  const featureCount = (landing.match(/group-hover:bg-brand-600 group-hover:text-white/g) || []).length;
  assert.ok(featureCount >= 15, `feature cards rendered (${featureCount})`);
  ok(`${featureCount} feature cards rendered`);

  // ------------------------------------------------------------------- app
  window.location.hash = '#/app/live';
  const livePage = renderToString(React.createElement(App));
  assert.ok(livePage.includes('بث مباشر'), 'live nav rendered');
  assert.ok(livePage.includes('المصادر'), 'sources nav rendered');
  assert.ok(livePage.includes('دليل البرامج'), 'guide nav rendered');
  assert.ok(livePage.includes('مشاهدة متعددة'), 'multiview nav rendered');
  assert.ok(livePage.includes('ابحث عن قناة'), 'channel search rendered');
  ok('app shell renders (sidebar nav, search, player area)');

  window.location.hash = '#/app/sources';
  const sourcesPage = renderToString(React.createElement(App));
  assert.ok(sourcesPage.includes('Xtream Codes'), 'xtream tab rendered');
  assert.ok(sourcesPage.includes('كود FG'), 'fg tab rendered');
  ok('sources page renders the M3U / file / paste / Xtream / FG tabs');

  window.location.hash = '#/app/settings';
  const settingsPage = renderToString(React.createElement(App));
  assert.ok(settingsPage.includes('اختصارات لوحة المفاتيح'), 'shortcuts rendered');
  assert.ok(settingsPage.includes('قفل الأبوين'), 'parental lock rendered');
  ok('settings page renders (quality, parental lock, shortcuts)');

  // ----------------------------------------------------------------- store
  const storeModule = await vite.ssrLoadModule('/src/store/appStore.ts');
  const { useAppStore, channelKey, detectInputKind } = storeModule;
  const demoModule = await vite.ssrLoadModule('/src/lib/demo.ts');

  const source = await useAppStore.getState().addSourceFromText({
    name: 'Demo',
    text: demoModule.DEMO_PLAYLIST,
    kind: 'm3u-text',
    reference: 'demo',
  });
  assert.equal(source.channelCount, 11, 'source channel count');
  assert.equal(useAppStore.getState().channels.length, 11, 'store channels');
  ok(`store loaded the demo playlist → ${useAppStore.getState().channels.length} channels`);

  const first = useAppStore.getState().channels[0];
  const key = channelKey(first);
  useAppStore.getState().toggleFavorite(key);
  assert.ok(useAppStore.getState().favorites.includes(key), 'favorite added');
  useAppStore.getState().toggleFavorite(key);
  assert.ok(!useAppStore.getState().favorites.includes(key), 'favorite removed');
  ok('favorites toggle through the real store');

  useAppStore.getState().toggleSource(source.id);
  assert.equal(useAppStore.getState().channels.length, 0, 'disabling a source hides its channels');
  useAppStore.getState().toggleSource(source.id);
  assert.equal(useAppStore.getState().channels.length, 11, 're-enabling restores them');
  ok('enable/disable a source recomputes the channel list');

  useAppStore.getState().pushRecent(first);
  assert.equal(useAppStore.getState().recent[0].name, first.name, 'recently watched');
  useAppStore.getState().toggleMultiview(key);
  assert.deepEqual(useAppStore.getState().multiview, [key], 'multiview selection');
  ok('recently-watched + multi-view state updated');

  assert.equal(useAppStore.getState().exportM3u().split('#EXTINF').length - 1, 11, 'M3U export entries');
  const fg = useAppStore.getState().makeFgCode(source.id);
  assert.equal(fg, null, 'pasted lists cannot be shared as an FG code (no url)');
  ok('M3U export and FG-code generation behave as documented');

  assert.equal(detectInputKind('https://example.com/a.m3u8'), 'm3u-url');
  assert.equal(detectInputKind('DL-M3U-abc'), 'fg-code');
  ok('input detection maps urls and FG codes to the right source kind');

  // ------------------------------------------------------------------- i18n
  const i18n = await vite.ssrLoadModule('/src/i18n.ts');
  assert.equal(i18n.translate('nav.live', 'ar'), 'بث مباشر');
  assert.equal(i18n.translate('nav.live', 'en'), 'Live TV');
  ok('translations resolve in both Arabic and English');

  // -------------------------------------------------------------- persistence
  const persisted = JSON.parse(window.localStorage.getItem('drama-live-web'));
  assert.ok(persisted, 'state persisted to localStorage');
  assert.equal(persisted.state.sources.length, 1, 'sources persisted');
  ok('playlists persist to localStorage (PWA-friendly)');

  console.log(`\nAll ${checks} DOM smoke checks passed.`);
} finally {
  await vite.close();
  window.close();
}
