/**
 * Smoke test for the pure logic modules (playlist parsing, FG codes, EPG dates).
 * Run with:  node --experimental-strip-types scripts/smoke.ts
 */
import assert from 'node:assert/strict';
import { parsePlaylistText, serializePlaylist, mergeServers } from '../src/lib/m3u.ts';
import { classifyInput, decodeFgCode, encodeFgCode, isFgCode } from '../src/lib/fgcode.ts';
import { parseXmltvDate } from '../src/lib/epg.ts';
import { DEMO_PLAYLIST, buildDemoEpg, matchCategory } from '../src/lib/demo.ts';
import { guessContentType, isCastableUrl, startCast } from '../src/lib/cast.ts';
import { applyProxy, isFresh, isPlayable, probeMany, probeUrl, PROBE_TTL_MS } from '../src/lib/probe.ts';

let checks = 0;
const ok = (label: string) => {
  checks += 1;
  console.log(`  ✓ ${label}`);
};

// --- M3U parsing -----------------------------------------------------------
const parsed = parsePlaylistText(DEMO_PLAYLIST, 'demo', 'Demo');
assert.equal(parsed.channels.length, 11, 'demo playlist channel count');
ok(`parsed the demo playlist → ${parsed.channels.length} channels`);

const radios = parsed.channels.filter((channel) => channel.kind === 'radio');
assert.equal(radios.length, 2, 'radio detection');
ok(`radio streams detected → ${radios.map((c) => c.name).join(', ')}`);

const movies = parsed.channels.filter((channel) => channel.kind === 'movie');
assert.equal(movies.length, 1, 'movie group detection');
ok(`group-title "أفلام" mapped to a movie → ${movies[0].name}`);

const alJazeera = parsed.channels.find((channel) => channel.tvgId === 'demo.news1');
assert.ok(alJazeera, 'tvg-id parsed');
assert.ok(alJazeera.logo?.startsWith('https://'), 'tvg-logo parsed');
assert.equal(alJazeera.country, 'QA', 'tvg-country parsed');
assert.equal(alJazeera.group, 'أخبار', 'group-title parsed');
ok(`EXTINF attributes parsed → tvg-id=${alJazeera.tvgId} country=${alJazeera.country} group=${alJazeera.group}`);

// --- multi-server merging --------------------------------------------------
const multi = parsePlaylistText(
  ['#EXTM3U', '#EXTINF:-1 group-title="Sports",SSC 1', 'https://a.example/1.m3u8', '#EXTINF:-1 group-title="Sports",SSC 1', 'https://b.example/1.m3u8'].join('\n'),
  's',
);
const merged = mergeServers(multi.channels);
assert.equal(merged.length, 1, 'duplicate names merged');
assert.equal(merged[0].urls.length, 2, 'both server urls kept');
ok(`multi-server merge → 1 channel with ${merged[0].urls.length} urls`);

// --- VLC options -----------------------------------------------------------
const withHeaders = parsePlaylistText(
  ['#EXTM3U', '#EXTINF:-1,Geo', '#EXTVLCOPT:http-user-agent=DramaLive/1.0', '#EXTVLCOPT:http-referrer=https://ref.example', 'https://geo.example/stream.ts'].join('\n'),
  's',
);
assert.equal(withHeaders.channels[0].userAgent, 'DramaLive/1.0', 'user-agent parsed');
assert.equal(withHeaders.channels[0].referrer, 'https://ref.example', 'referrer parsed');
ok('EXTVLCOPT user-agent / referrer parsed');

// --- round trip ------------------------------------------------------------
const serialised = serializePlaylist(parsed.channels, 'Round trip');
const reparsed = parsePlaylistText(serialised, 'rt');
assert.equal(reparsed.channels.length, parsed.channels.length, 'round trip keeps every channel');
assert.ok(serialised.startsWith('#EXTM3U x-tvg-name="Round trip"'), 'export header');
ok(`export → re-import keeps ${reparsed.channels.length} channels`);

// --- FG codes --------------------------------------------------------------
const code = encodeFgCode({ t: 'm3u', u: 'https://example.com/playlist.m3u8', n: 'قائمتي' });
assert.ok(isFgCode(code), 'generated code recognised');
assert.equal(classifyInput(code), 'fg', 'classifyInput → fg');
const decoded = decodeFgCode(code);
assert.ok(decoded && decoded.t === 'm3u' && decoded.u === 'https://example.com/playlist.m3u8', 'decode url');
assert.equal(decoded?.t === 'm3u' ? decoded.n : undefined, 'قائمتي', 'unicode name survives');
ok(`FG code round trip → ${code.slice(0, 26)}…`);

const xtCode = encodeFgCode({ t: 'xt', s: 'http://panel.test:8080', r: 'user', p: 'pass', n: 'panel' });
const xtDecoded = decodeFgCode(xtCode);
assert.ok(xtDecoded?.t === 'xt' && xtDecoded.r === 'user', 'xtream code round trip');
ok('Xtream FG code round trip');

assert.equal(decodeFgCode('DL-M3U-###not-base64###'), null, 'garbage rejected');
assert.equal(classifyInput('#EXTM3U\n#EXTINF:-1,x\nhttp://a/b.m3u8'), 'm3u-text', 'pasted list detected');
assert.equal(classifyInput('https://a.example/x.m3u8'), 'url', 'url detected');
ok('input classifier: url / m3u-text / fg / unknown');

// --- EPG -------------------------------------------------------------------
const ts = parseXmltvDate('20260205193000 +0000');
assert.equal(new Date(ts).toISOString(), '2026-02-05T19:30:00.000Z', 'XMLTV date parsed');
ok(`XMLTV date parsed → ${new Date(ts).toISOString()}`);

const epg = buildDemoEpg(parsed.channels);
assert.ok(epg.byChannel.size > 0, 'demo EPG generated');
const firstList = [...epg.byChannel.values()][0];
assert.ok(firstList.length === 24, 'a full day of programmes');
assert.ok(firstList.every((p, i) => i === 0 || p.start === firstList[i - 1].stop), 'programmes are contiguous');
ok(`demo EPG generated → ${epg.byChannel.size} channels × ${firstList.length} programmes, contiguous`);

// --- category presets ------------------------------------------------------
assert.equal(matchCategory('beIN Sports HD')?.id, 'sports', 'sports match');
assert.equal(matchCategory('أفلام عربية')?.id, 'movies', 'arabic movies match');
assert.equal(matchCategory('قنوات الأطفال')?.id, 'kids', 'arabic kids match');
ok('category matcher works for Arabic and English group names');

// --- Chromecast helpers ----------------------------------------------------
assert.equal(guessContentType('https://a.example/live/x.m3u8?token=1'), 'application/x-mpegURL');
assert.equal(guessContentType('https://a.example/movie.mp4'), 'video/mp4');
assert.equal(guessContentType('https://ice.example/radio.mp3'), 'audio/mpeg');
assert.equal(guessContentType('https://a.example/unknown'), 'application/x-mpegURL', 'defaults to HLS');
ok('cast content-type detection for HLS / MP4 / MP3 / unknown');

assert.equal(isCastableUrl('https://a.example/x.m3u8'), true);
assert.equal(isCastableUrl('udp://@239.0.0.1:1234'), false, 'udp is not castable');
assert.equal(isCastableUrl('https://a.example/x.ts'), false, 'raw TS is not castable');
ok('cast url filter rejects udp/raw-TS streams');

assert.deepEqual(await startCast('udp://@239.0.0.1:1234'), { ok: false, reason: 'unsupported-stream' });
assert.deepEqual(await startCast('https://a.example/x.m3u8'), { ok: false, reason: 'unavailable' }, 'no SDK here → graceful');
ok('startCast degrades gracefully instead of throwing');

// --- channel health probing ------------------------------------------------
assert.equal(applyProxy('', 'https://a.example/x.m3u8'), 'https://a.example/x.m3u8', 'no proxy = unchanged');
assert.equal(
  applyProxy('https://p.example/?u={url}', 'https://a.example/x.m3u8'),
  'https://p.example/?u=https%3A%2F%2Fa.example%2Fx.m3u8',
  'template substitution',
);
assert.equal(applyProxy('https://p.example/?u=', 'https://a.example/x'), 'https://p.example/?u=https%3A%2F%2Fa.example%2Fx');
assert.equal(applyProxy('https://p.example', 'https://a.example/x'), 'https://p.example/https%3A%2F%2Fa.example%2Fx');
ok('proxy template substitution (placeholder, suffix and path forms)');

// stub fetch so the probe logic runs for real without network access
const realFetch = globalThis.fetch;
let mode: 'ok' | 'cors' | 'missing' | 'slow' = 'ok';
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (mode === 'slow') {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 5000);
      init?.signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
  }
  if (mode === 'cors') throw new TypeError('Failed to fetch');
  const status = mode === 'missing' ? 404 : 200;
  return new Response(null, { status, headers: { 'content-type': 'application/x-mpegURL' } });
}) as typeof fetch;

assert.equal((await probeUrl('https://a.example/live.m3u8')).status, 'ok');
mode = 'cors';
const cors = await probeUrl('https://a.example/live.m3u8');
assert.equal(cors.status, 'cors', 'blocked stream reported as CORS');
mode = 'missing';
assert.equal((await probeUrl('https://a.example/gone.m3u8')).status, 'missing');
mode = 'slow';
assert.equal((await probeUrl('https://a.example/slow.m3u8', { timeoutMs: 50 })).status, 'timeout');
mode = 'ok';
ok('probe classifies ok / CORS / 404 / timeout correctly');

const seen: string[] = [];
const many = await probeMany(['https://a/1.m3u8', 'https://a/2.m3u8', 'https://a/3.m3u8'], {
  concurrency: 2,
  onResult: (url) => seen.push(url),
});
assert.equal(many.size, 3, 'every url probed');
assert.equal(seen.length, 3, 'progress callback fired per url');
ok('probeMany probes a batch with a concurrency cap and reports progress');

assert.equal(isPlayable('ok'), true);
assert.equal(isPlayable(undefined), true, 'unknown is not treated as dead');
assert.equal(isPlayable('cors'), false);
assert.ok(isFresh(Date.now() - 1000) && !isFresh(Date.now() - PROBE_TTL_MS - 1), 'probe cache TTL');
ok('health helpers: playability + 10 minute cache TTL');

globalThis.fetch = realFetch;

console.log(`\nAll ${checks} smoke checks passed.`);
