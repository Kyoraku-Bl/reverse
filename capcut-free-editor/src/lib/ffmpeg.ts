import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let loading: Promise<void> | null = null;

export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;
  if (loading) return loading.then(() => ffmpeg!);

  loading = (async () => {
    const instance = new FFmpeg();
    instance.on('log', ({ message }: { message: string }) => {
      console.log('[ffmpeg]', message);
    });
    instance.on('progress', ({ ratio }: { ratio: number }) => {
      console.log('[ffmpeg progress]', Math.round(ratio * 100), '%');
    });
    await instance.load({
      coreURL:
        'https://unpkg.com/@ffmpeg/core@0.12.10/dist/ffmpeg-core.js',
      wasmURL:
        'https://unpkg.com/@ffmpeg/core@0.12.10/dist/ffmpeg-core.wasm',
    });
    ffmpeg = instance;
  })();

  await loading;
  return ffmpeg!;
}

const FILTER_VF: Record<Extract<import('../store').FilterName, string>, string> = {
  none: 'null',
  grayscale: 'format=gray',
  invert: 'negate',
  sepia:
    'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131:0',
  blur: 'gblur=sigma=5',
  brightness: 'eq=brightness=0.2',
  contrast: 'eq=contrast=1.4',
  saturate: 'eq=saturation=1.6',
};

export async function exportTimeline({
  clips,
  assets,
  width,
  height,
  fps,
}: {
  clips: Array<{
    id: string;
    assetId: string;
    start: number;
    sourceStart: number;
    duration: number;
    x: number;
    y: number;
    scale: number;
    opacity: number;
    filter: import('../store').FilterName;
    speed: number;
    volume: number;
    text?: string;
    fontSize?: number;
    color?: string;
  }>;
  assets: Array<{
    id: string;
    url: string;
    type: string;
    width?: number;
    height?: number;
  }>;
  width: number;
  height: number;
  fps: number;
}): Promise<Blob> {
  const ffmpeg = await getFFmpeg();

  if (clips.length === 0) {
    await ffmpeg.exec(
      '-f',
      'lavfi',
      '-i',
      `color=c=black:size=${width}x${height}:rate=${fps}:duration=2`,
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-y',
      'output.mp4',
    );
    const data = ffmpeg.readFile('output.mp4');
    return new Blob([data], { type: 'video/mp4' });
  }

  const uniqueAssets: Array<{ id: string; url: string }> = [];
  const inputIndexById = new Map<string, number>();
  for (const a of assets) {
    if (inputIndexById.has(a.id)) continue;
    inputIndexById.set(a.id, uniqueAssets.length);
    uniqueAssets.push({ id: a.id, url: a.url });
  }

  for (const a of uniqueAssets) {
    const res = await fetch(a.url);
    const buf = await res.arrayBuffer();
    ffmpeg.writeFile(`in_${a.id}`, new Uint8Array(buf));
  }

  const args: string[] = [];
  for (const a of uniqueAssets) {
    args.push('-i', `in_${a.id}`);
  }

  const totalDuration = Math.max(
    0,
    ...clips.map((c) => c.start + c.duration),
  );

  let filter = `nullsrc=size=${width}x${height}:rate=${fps}:duration=${totalDuration}[base];`;
  let videoCount = 0;
  let audioFilters: string[] = [];

  for (const clip of clips) {
    const asset = assets.find((a) => a.id === clip.assetId);
    if (!asset) continue;

    const inputIdx = inputIndexById.get(clip.assetId)!;
    const clipTag = `clip${videoCount}`;
    const nextBase = videoCount === 0 ? 'base' : `base${videoCount - 1}`;
    const outBase = `base${videoCount}`;

    const scaleW = Math.max(2, Math.round(clip.scale * width));
    const scaleH = Math.max(2, Math.round(clip.scale * height));
    const x = Math.round(clip.x);
    const y = Math.round(clip.y);
    const opacity = Math.max(0, Math.min(1, clip.opacity));
    const speed = Math.max(0.25, Math.min(4, clip.speed));
    const vf = FILTER_VF[clip.filter] ?? 'null';

    if (asset.type === 'video' || asset.type === 'image') {
      // trim source portion, apply speed (setpts), scale, filter, then overlay at [start, start+duration]
      filter += `[${inputIdx}:v]trim=start=${clip.sourceStart}:duration=${
        clip.duration / speed
      },setpts=PTS-STARTPTS+(STARTPTS/${speed}),scale=${scaleW}:${scaleH},${vf}[${clipTag}];`;
      filter += `[${nextBase}][${clipTag}]overlay=${x}:${y}:enable='between(t,${clip.start},${clip.start + clip.duration})':shortest=1[${outBase}];`;
      videoCount++;
    }

    if (asset.type === 'audio') {
      const vol = Math.max(0, Math.min(2, clip.volume));
      // atempo supports 0.5..2.0; chain if needed
      let atempo = '';
      const s = speed;
      if (s < 0.5 || s > 2) {
        const chains = Math.ceil(Math.log(s) / Math.log(2));
        const per = Math.pow(s, 1 / chains);
        atempo = Array(chains)
          .fill(`atempo=${per.toFixed(3)}`)
          .concat(`atempo=${per.toFixed(3)}`)
          .join(',');
      } else {
        atempo = `atempo=${s.toFixed(3)}`;
      }
      audioFilters.push(
        `[${inputIdx}:a]atrim=start=${clip.sourceStart}:duration=${
          clip.duration / speed
        },asetpts=PTS-STARTPTS,volume=${vol.toFixed(3)},${atempo}[a${videoCount}];`,
      );
    }
  }

  let filterComplex = filter + audioFilters.join('');

  const mapArgs: string[] = ['-map', `[base${videoCount > 0 ? videoCount - 1 : 0}]`];
  if (audioFilters.length > 0) {
    if (audioFilters.length > 1) {
      const audioTags = audioFilters.map((_, i) => `[a${i}]`).join('');
      filterComplex += `${audioTags}amerge=inputs=${audioFilters.length}[aout];`;
      mapArgs[1] = '[aout]';
    }
    mapArgs.push('-map', '[aout]');
    mapArgs.push('-c:a', 'aac');
    mapArgs.push('-shortest');
  } else {
    mapArgs.push('-an');
  }

  args.push('-filter_complex', filterComplex);
  args.push(...mapArgs);
  args.push('-c:v', 'libx264');
  args.push('-preset', 'ultrafast');
  args.push('-crf', '23');
  args.push('-r', String(fps));
  args.push('-y', 'output.mp4');

  await ffmpeg.exec(...args);
  const data = ffmpeg.readFile('output.mp4');
  return new Blob([data], { type: 'video/mp4' });
}
