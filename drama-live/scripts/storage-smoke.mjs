/**
 * Regression test: the app must still run when the browser refuses localStorage,
 * which is what happens inside a cross-origin iframe (the live-preview panel) or
 * in private mode. Before the memory fallback this crashed the whole app.
 *
 * Run with: node scripts/storage-smoke.mjs
 */
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const dom = new JSDOM('<!doctype html><html lang="ar" dir="rtl"><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/#/app/live',
  pretendToBeVisual: true,
});

const { window } = dom;
// Simulate a browser that throws on every storage access.
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  get() {
    throw new Error('SecurityError: storage access denied');
  },
});
globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true, writable: true });

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });

let checks = 0;
const ok = (label) => {
  checks += 1;
  console.log(`  ✓ ${label}`);
};

try {
  assert.throws(() => window.localStorage.getItem('x'), /denied/, 'storage really is blocked');
  ok('test harness blocks localStorage access');

  const { useAppStore } = await vite.ssrLoadModule('/src/store/appStore.ts');
  const { DEMO_PLAYLIST } = await vite.ssrLoadModule('/src/lib/demo.ts');

  const source = await useAppStore.getState().addSourceFromText({
    name: 'Demo',
    text: DEMO_PLAYLIST,
    kind: 'm3u-text',
    reference: 'demo',
  });
  assert.equal(source.channelCount, 11, 'playlist still loads');
  assert.equal(useAppStore.getState().channels.length, 11, 'channels available');
  ok('playlist loads with the in-memory fallback storage');

  useAppStore.getState().setSettings({ lang: 'en', qualityCap: 1080 });
  assert.equal(useAppStore.getState().settings.lang, 'en', 'settings still update');
  ok('settings update in memory');

  // resetAll must not throw either
  useAppStore.getState().resetAll();
  assert.equal(useAppStore.getState().channels.length, 0, 'reset works');
  ok('resetAll works without storage');

  console.log(`\nAll ${checks} storage-fallback checks passed.`);
} finally {
  await vite.close();
  window.close();
}
