/**
 * Client-render smoke test: mounts the real <App /> into a jsdom document with
 * react-dom/client so effects actually run (store seeding, player init, routing).
 *
 * Run with: node scripts/client-smoke.mjs
 */
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const dom = new JSDOM('<!doctype html><html lang="ar" dir="rtl" class="dark"><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/#/app/live',
  pretendToBeVisual: true,
});

const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true, writable: true });
globalThis.localStorage = window.localStorage;
for (const key of ['HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'HTMLInputElement']) {
  globalThis[key] = window[key];
}
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.self = window;
window.scrollTo = () => {};
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};
window.HTMLMediaElement.prototype.load = () => {};

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });

let checks = 0;
const ok = (label) => {
  checks += 1;
  console.log(`  ✓ ${label}`);
};

const storeModule = await vite.ssrLoadModule('/src/store/appStore.ts');
const { useAppStore } = storeModule;
const appModule = await vite.ssrLoadModule('/src/App.tsx');
const App = appModule.default;

const container = window.document.getElementById('root');
const root = createRoot(container);

try {
  await act(async () => {
    root.render(React.createElement(App));
  });

  const html = container.innerHTML;
  assert.ok(html.includes('بث مباشر'), 'live section rendered client-side');
  assert.ok(html.includes('ابحث عن قناة'), 'channel search rendered client-side');
  ok('the app mounts client-side at #/app/live without crashing');

  // AppLayout seeds the free demo playlist on a fresh profile
  assert.equal(useAppStore.getState().sources.length, 1, 'demo playlist seeded');
  assert.equal(useAppStore.getState().channels.length, 11, 'channels available after seeding');
  ok(`first-run seeding loaded the demo playlist → ${useAppStore.getState().channels.length} channels`);

  const video = window.document.querySelector('video');
  assert.ok(video, 'a video element is mounted');
  assert.equal(video.muted, true, 'starts muted so autoplay is allowed');
  assert.ok(video.getAttribute('src')?.startsWith('https://'), 'the player attached a stream url');
  ok(`player mounted with a stream attached → ${video.getAttribute('src')}`);

  // the demo playlist has 11 entries: 8 live, 2 radio, 1 movie
  const channelRows = window.document.querySelectorAll('[role="button"][tabindex="0"]');
  assert.equal(channelRows.length, 8, 'live section shows the 8 live channels only');
  ok(`live section rendered ${channelRows.length} of 11 demo channels (radio/movies live in their own sections)`);

  // switching channel through the real UI
  await act(async () => {
    channelRows[3].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  const channels = useAppStore.getState().channels;
  const selectedKey = useAppStore.getState().currentKey;
  assert.ok(selectedKey, 'a channel is selected after clicking a row');
  assert.ok(
    channels.some((channel) => `${channel.name.toLowerCase()}|${(channel.group ?? '').toLowerCase()}|${channel.kind}` === selectedKey),
    'selected key matches a real channel',
  );
  ok(`clicking a channel row selects it → ${selectedKey}`);

  // favorites through the real DOM
  await act(async () => {
    const favButton = channelRows[3].querySelector('button[aria-label="favorite"]');
    favButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  assert.equal(useAppStore.getState().favorites.length, 1, 'favorite stored');
  ok('starring a channel from the list stores it as a favorite');

  // no cast SDK / device in this environment → the button must stay hidden
  assert.equal(window.document.querySelector('[aria-label*="Chromecast"]'), null, 'cast button hidden without a device');
  ok('Chromecast button degrades gracefully when the SDK is unavailable');

  // language switch through the store + re-render
  await act(async () => {
    useAppStore.getState().setSettings({ lang: 'en' });
  });
  assert.equal(window.document.documentElement.lang, 'en', 'document language updated');
  assert.equal(window.document.documentElement.dir, 'ltr', 'direction flipped to ltr');
  ok('switching to English flips <html lang/dir> on the real document');

  console.log(`\nAll ${checks} client-render checks passed.`);
} finally {
  await act(async () => root.unmount());
  await vite.close();
  window.close();
}
