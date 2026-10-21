/**
 * A tiny built-in playlist so the app is usable the first second it opens.
 * Every stream below is a free / public test stream (no paid or pirated content).
 * Users normally add their own M3U link, Xtream login or FG code in "المصادر".
 */
export const DEMO_PLAYLIST = `#EXTM3U x-tvg-name="Drama Live Demo"
#EXTINF:-1 tvg-id="demo.live1" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/220px-Big_buck_bunny_poster_big.jpg" group-title="تجريبي مباشر" tvg-country="INT",قناة التجربة HD (بث عام)
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
#EXTINF:-1 tvg-id="demo.live2" group-title="تجريبي مباشر" tvg-country="INT",بث اختبار مباشر Akamai
https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8
#EXTINF:-1 tvg-id="demo.news1" tvg-logo="https://upload.wikimedia.org/wikipedia/en/thumb/c/c1/Al_Jazeera_Media_Network_Logo.svg/220px-Al_Jazeera_Media_Network_Logo.svg.png" group-title="أخبار" tvg-country="QA",الجزيرة مباشر (بث عام)
https://live-hls-web-aja.getaj.net/AJA/index.m3u8
#EXTINF:-1 tvg-id="demo.news2" group-title="أخبار" tvg-country="FR",France 24 العربية (بث عام)
https://static.france24.com/live/F24_AR_HI_HLS/live_web.m3u8
#EXTINF:-1 tvg-id="demo.news3" group-title="أخبار" tvg-country="DE",DW العربية (بث عام)
https://dwamdstream104.akamaized.net/hls/live/2015530/dwstream104/index.m3u8
#EXTINF:-1 tvg-id="demo.kids1" group-title="أطفال" tvg-country="INT",Sintel فيلم قصير (بث عام)
https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8
#EXTINF:-1 tvg-id="demo.doc1" group-title="وثائقي" tvg-country="INT",Apple BipBop متقدم 4K/HDR (بث عام)
https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8
#EXTINF:-1 tvg-id="demo.doc2" group-title="وثائقي" tvg-country="INT",Tears of Steel (بث عام)
https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8
#EXTINF:-1 tvg-id="demo.movie1" group-title="أفلام" tvg-country="INT",Big Buck Bunny 1080p (بث عام)
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
#EXTINF:-1 tvg-id="demo.radio1" group-title="راديو" radio="true" tvg-country="US",SomaFM Groove Salad (راديو)
https://ice1.somafm.com/groovesalad-128-mp3
#EXTINF:-1 tvg-id="demo.radio2" group-title="راديو" radio="true" tvg-country="US",SomaFM DEF CON (راديو)
https://ice1.somafm.com/defcon-128-mp3
`;

/** iptv-org publishes a free, openly licensed index of public streams. */
export const IPTV_ORG_PLAYLIST_URL = 'https://iptv-org.github.io/iptv/index.m3u';

export const PUBLIC_EPG_SOURCES = [
  { name: 'iptv-org EPG (عالمي)', url: 'https://iptv-org.github.io/epg/guides/ma.xml' },
];

export interface CategoryPreset {
  id: string;
  ar: string;
  en: string;
  match: string[];
}

/** Groups used on the landing page and to bucket channels when a playlist has no groups. */
export const CATEGORY_PRESETS: CategoryPreset[] = [
  { id: 'sports', ar: 'رياضة', en: 'Sports', match: ['sport', 'رياض', 'ssc', 'bein', 'ksa'] },
  { id: 'news', ar: 'أخبار', en: 'News', match: ['news', 'خبر', 'اخبار', 'أخبار'] },
  { id: 'entertainment', ar: 'ترفيه', en: 'Entertainment', match: ['entertain', 'ترفيه', 'mbc', 'general'] },
  { id: 'movies', ar: 'أفلام', en: 'Movies', match: ['movie', 'film', 'cinema', 'أفلام', 'افلام', 'سينما', 'vod'] },
  { id: 'series', ar: 'مسلسلات', en: 'Series', match: ['series', 'مسلسل', 'دراما', 'drama'] },
  { id: 'kids', ar: 'أطفال', en: 'Kids', match: ['kid', 'child', 'أطفال', 'اطفال', 'cartoon', 'toons'] },
  { id: 'religious', ar: 'دينية', en: 'Religious', match: ['relig', 'islam', 'quran', 'قرآن', 'قران', 'ديني', 'اسلام'] },
  { id: 'documentary', ar: 'وثائقي', en: 'Documentary', match: ['doc', 'وثائق', 'nature', 'history'] },
  { id: 'music', ar: 'موسيقى', en: 'Music', match: ['music', 'موسيق', 'اغاني', 'أغاني'] },
  { id: 'radio', ar: 'راديو', en: 'Radio', match: ['radio', 'راديو', 'إذاعة', 'اذاعة'] },
];

export function matchCategory(group?: string): CategoryPreset | undefined {
  if (!group) return undefined;
  const value = group.toLowerCase();
  return CATEGORY_PRESETS.find((preset) => preset.match.some((needle) => value.includes(needle)));
}

/**
 * Builds an offline EPG so the guide view works even without an XMLTV source.
 * Programme titles are generated from the channel name — clearly synthetic demo data.
 */
export function buildDemoEpg(channels: { name: string; tvgId?: string; group?: string }[]): {
  programmes: import('../types').Programme[];
  byChannel: Map<string, import('../types').Programme[]>;
} {
  const programmes: import('../types').Programme[] = [];
  const byChannel = new Map<string, import('../types').Programme[]>();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  channels.forEach((channel, channelIndex) => {
    const id = channel.tvgId;
    if (!id) return;
    let cursor = startOfDay.getTime();
    const list: import('../types').Programme[] = [];
    for (let slot = 0; slot < 24; slot += 1) {
      const seed = (channelIndex * 31 + slot * 17) % 7;
      const duration = [30, 45, 60, 90, 120][seed % 5] * 60_000;
      const stop = cursor + duration;
      const programme: import('../types').Programme = {
        channelId: id,
        title: `${channel.name} · ${channel.group ?? 'TV'} #${slot + 1}`,
        description: `${channel.name} — بث مستمر (${duration / 60000} دقيقة).`,
        start: cursor,
        stop,
        category: channel.group,
      };
      programmes.push(programme);
      list.push(programme);
      cursor = stop;
    }
    byChannel.set(id, list);
  });

  return { programmes, byChannel };
}
