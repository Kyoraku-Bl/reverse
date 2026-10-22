import { assetUrl } from "./config";
import {
  duration,
  clipDuration,
  videoDocumentSchema,
} from "../shared/video.mjs";
import { visualFilters, tempoFilter } from "../shared/video-effects.mjs";
let tail = Promise.resolve();
const abortError = () => new DOMException("Operation cancelled", "AbortError");
// A single WASM worker at a time. Termination releases its filesystem and linear memory.
function withEngine(task, { signal, progress = () => {} } = {}) {
  const operation = tail
    .catch(() => {})
    .then(async () => {
      if (signal?.aborted) throw abortError();
      const { FFmpeg } = await import(
        /* @vite-ignore */ new URL(
          assetUrl("engine/ffmpeg/index.js"),
          location.href,
        ).href
      );
      const ff = new FFmpeg(),
        logs = [];
      let active = true;
      const abort = () => {
        if (active) ff.terminate();
      };
      signal?.addEventListener("abort", abort, { once: true });
      try {
        if (signal?.aborted) throw abortError();
        ff.on("log", ({ message }) => {
          logs.push(message);
          if (logs.length > 30) logs.shift();
        });
        await ff.load({
          coreURL: new URL(
            assetUrl("engine/core/ffmpeg-core.js"),
            location.href,
          ).href,
          wasmURL: new URL(
            assetUrl("engine/core/ffmpeg-core.wasm"),
            location.href,
          ).href,
        });
        const exec = async (args, base = 0, span = 0) => {
          if (signal?.aborted) throw abortError();
          const onProgress = ({ progress: p }) =>
            progress(
              Math.min(
                99,
                Math.round(base + Math.max(0, Math.min(1, p)) * span),
              ),
            );
          ff.on("progress", onProgress);
          let code;
          try {
            code = await ff.exec(
              [
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-threads",
                "1",
                "-filter_complex_threads",
                "1",
                ...args,
              ],
              600000,
            );
          } finally {
            ff.off("progress", onProgress);
          }
          if (code !== 0)
            throw new Error(
              "Video processing failed: " +
                logs.slice(-5).join(" ").slice(-900),
            );
          progress(Math.round(base + span));
        };
        return await task(ff, exec);
      } catch (error) {
        if (signal?.aborted) throw abortError();
        throw error;
      } finally {
        active = false;
        signal?.removeEventListener("abort", abort);
        ff.terminate();
      }
    });
  tail = operation;
  return operation;
}
export async function probeMedia(file) {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const imageMime =
    head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47
      ? "image/png"
      : head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
        ? "image/jpeg"
        : String.fromCharCode(...head.slice(0, 4)) === "RIFF" &&
            String.fromCharCode(...head.slice(8, 12)) === "WEBP"
          ? "image/webp"
          : null;
  if (imageMime) {
    const bitmap = await createImageBitmap(file);
    const result = {
      mime: imageMime,
      kind: "image",
      hasVideo: true,
      hasAudio: false,
      width: bitmap.width,
      height: bitmap.height,
      duration: 5,
    };
    bitmap.close();
    if (result.width > 4096 || result.height > 4096)
      throw new Error("Use images up to 4096 pixels per side.");
    return result;
  }
  return withEngine(async (ff) => {
    await ff.writeFile("source", new Uint8Array(await file.arrayBuffer()));
    const code = await ff.ffprobe([
      "-v",
      "error",
      "-show_streams",
      "-show_format",
      "-of",
      "json",
      "-o",
      "info.json",
      "source",
    ]);
    // This core leaves ret=-1 for successful ffprobe. A fresh worker must still produce valid JSON and streams.
    if (code !== 0 && code !== -1)
      throw new Error(
        "Unsupported or damaged media file. Try H.264 MP4, WebM, MP3 or WAV.",
      );
    const info = JSON.parse(await ff.readFile("info.json", "utf8"));
    const video = info.streams?.find(
        (s) => s.codec_type === "video" && !s.disposition?.attached_pic,
      ),
      audio = info.streams?.find((s) => s.codec_type === "audio");
    let length = Number(
      info.format?.duration || video?.duration || audio?.duration,
    );
    // MediaRecorder's streaming WebM often has no duration header. Measure packet
    // timestamps instead of rejecting recordings or trusting a client-supplied duration.
    if (!Number.isFinite(length) || length <= 0) {
      await ff.ffprobe([
        "-v",
        "error",
        "-show_packets",
        "-show_entries",
        "packet=pts_time,duration_time",
        "-of",
        "json",
        "-o",
        "packets.json",
        "source",
      ]);
      const packets =
        JSON.parse(await ff.readFile("packets.json", "utf8")).packets || [];
      length = packets.reduce(
        (max, p) =>
          Math.max(
            max,
            (Number(p.pts_time) || 0) + (Number(p.duration_time) || 0),
          ),
        0,
      );
    }
    if (
      (!video && !audio) ||
      !Number.isFinite(length) ||
      length < 0.1 ||
      length > 1800
    )
      throw new Error(
        "Media must contain audio/video and last between 0.1 seconds and 30 minutes.",
      );
    if (video && (video.width > 4096 || video.height > 4096))
      throw new Error("Use media up to 4096 pixels per side.");
    const format = info.format?.format_name || "",
      prefix = video ? "video/" : "audio/";
    const mime = /mov|mp4/.test(format)
      ? prefix + "mp4"
      : /matroska|webm/.test(format)
        ? prefix + "webm"
        : format === "mp3"
          ? "audio/mpeg"
          : format === "wav"
            ? "audio/wav"
            : format === "flac"
              ? "audio/flac"
              : format === "ogg"
                ? prefix + "ogg"
                : format === "aac"
                  ? "audio/aac"
                  : format === "avi"
                    ? "video/x-msvideo"
                    : "application/octet-stream";
    return {
      format,
      mime,
      kind: video ? "video" : "audio",
      hasVideo: !!video,
      hasAudio: !!audio,
      width: video?.width || 0,
      height: video?.height || 0,
      duration: length,
    };
  });
}
const encoding = (quality = "balanced") => [
  "-c:v",
  "libx264",
  "-preset",
  "ultrafast",
  "-crf",
  quality === "high" ? "18" : quality === "draft" ? "30" : "23",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-b:a",
  "128k",
  "-ar",
  "48000",
  "-ac",
  "2",
  "-movflags",
  "+faststart",
];
export function validateRender(doc, media) {
  doc = videoDocumentSchema.parse(doc);
  if (!doc.clips.length) throw new Error("Add a clip before exporting.");
  const total = duration(doc);
  if (total > 120)
    throw new Error(
      "Browser export is limited to 2 minutes per montage. Split longer projects into parts.",
    );
  if (doc.width * doc.height > 1280 * 720 && total > 30)
    throw new Error(
      "For browser memory safety, use 720p for videos over 30 seconds.",
    );
  const ids = new Set(
    [
      ...doc.clips,
      ...doc.overlays,
      ...doc.audioTracks,
      ...(doc.soundtrack ? [doc.soundtrack] : []),
    ].map((c) => c.assetId),
  );
  let bytes = 0;
  for (const id of ids) {
    const item = media.find((m) => m.id === id);
    if (!item?.blob)
      throw new Error(
        "A source file is missing. Restore a complete workspace backup.",
      );
    bytes += item.blob.size;
  }
  if (bytes > 150 * 1024 * 1024)
    throw new Error("Use at most 150 MB of source files per browser export.");
  for (const c of doc.clips) {
    const m = media.find((m) => m.id === c.assetId);
    if (!m.hasVideo || (m.kind !== "image" && c.out > m.duration + 0.05))
      throw new Error("A clip extends beyond its source.");
  }
  for (const c of doc.audioTracks) {
    const m = media.find((m) => m.id === c.assetId);
    if (!m.hasAudio || c.out > m.duration + 0.05)
      throw new Error("An audio layer extends beyond its source.");
  }
  for (const o of doc.overlays)
    if (media.find((m) => m.id === o.assetId).kind !== "image")
      throw new Error("Overlay sources must be PNG, JPEG or WebP images.");
  if (
    doc.soundtrack &&
    !media.find((m) => m.id === doc.soundtrack.assetId).hasAudio
  )
    throw new Error("Choose an audio soundtrack.");
  return doc;
}
export async function renderVideo(document, media, options) {
  const doc = validateRender(document, media),
    total = duration(doc),
    sources = new Map(media.map((m) => [m.id, m]));
  return withEngine(async (ff, exec) => {
    const writeSource = async (id, name) => {
      await ff.writeFile(
        name,
        new Uint8Array(await sources.get(id).blob.arrayBuffer()),
      );
      return name;
    };
    let elapsed = 0;
    for (let i = 0; i < doc.clips.length; i++) {
      const c = doc.clips[i],
        info = sources.get(c.assetId),
        length = clipDuration(c),
        fade = Math.min(c.fade, length / 2),
        input = "input-" + i;
      await writeSource(c.assetId, input);
      const scale =
        c.fit === "cover"
          ? `scale=${doc.width}:${doc.height}:force_original_aspect_ratio=increase,crop=${doc.width}:${doc.height}`
          : `scale=${doc.width}:${doc.height}:force_original_aspect_ratio=decrease,pad=${doc.width}:${doc.height}:(ow-iw)/2:(oh-ih)/2:black`;
      const v = [
        `setpts=(PTS-STARTPTS)/${c.speed}`,
        ...visualFilters(c),
        scale,
        "setsar=1",
        `fps=${doc.fps}`,
        ...(c.zoomStart !== 1 ||
        c.zoomEnd !== 1 ||
        c.panX !== c.panEndX ||
        c.panY !== c.panEndY
          ? [
              `zoompan=z='${c.zoomStart}+(${c.zoomEnd}-${c.zoomStart})*min(on/${Math.max(1, Math.round(length * doc.fps) - 1)},1)':x='(iw-iw/zoom)*(${c.panX}+(${c.panEndX}-${c.panX})*min(on/${Math.max(1, Math.round(length * doc.fps) - 1)},1))/100':y='(ih-ih/zoom)*(${c.panY}+(${c.panEndY}-${c.panY})*min(on/${Math.max(1, Math.round(length * doc.fps) - 1)},1))/100':d=1:s=${doc.width}x${doc.height}:fps=${doc.fps}`,
            ]
          : []),
        "format=yuv420p",
        ...(fade
          ? [
              `fade=t=in:st=0:d=${fade}`,
              `fade=t=out:st=${Math.max(0, length - fade)}:d=${fade}`,
            ]
          : []),
      ].join(",");
      const a = `asetpts=PTS-STARTPTS,${tempoFilter(c.speed)},aresample=48000,aformat=channel_layouts=stereo,volume=${c.volume}${fade ? `,afade=t=in:st=0:d=${fade},afade=t=out:st=${Math.max(0, length - fade)}:d=${fade}` : ""}`;
      await exec(
        [
          ...(info.kind === "image"
            ? ["-loop", "1", "-framerate", String(doc.fps)]
            : ["-ss", String(c.in)]),
          "-t",
          String(c.out - c.in),
          "-i",
          input,
          ...(!info.hasAudio
            ? ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
            : []),
          "-filter_complex",
          `[0:v]${v}[v];[${info.hasAudio ? 0 : 1}:a]${a}[a]`,
          "-map",
          "[v]",
          "-map",
          "[a]",
          "-t",
          String(length),
          ...encoding(doc.quality),
          `segment-${i}.mp4`,
        ],
        5 + (elapsed / total) * 55,
        (length / total) * 55,
      );
      await ff.deleteFile(input);
      elapsed += length;
    }
    await ff.writeFile(
      "segments.txt",
      new TextEncoder().encode(
        doc.clips.map((_, i) => `file 'segment-${i}.mp4'`).join("\n"),
      ),
    );
    await exec(
      [
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        "segments.txt",
        "-c",
        "copy",
        "combined.mp4",
      ],
      60,
      5,
    );
    for (let i = 0; i < doc.clips.length; i++)
      await ff.deleteFile(`segment-${i}.mp4`);
    const filters = [],
      inputs = ["-i", "combined.mp4"];
    let inputIndex = 1,
      video = "0:v",
      audio = "0:a";
    // Raster caption layers use the browser's text shaping (including Arabic), not shell/filter interpolation.
    for (let i = 0; i < doc.captions.length; i++) {
      const c = doc.captions[i],
        canvas = globalThis.document.createElement("canvas");
      canvas.width = doc.width;
      canvas.height = doc.height;
      await Promise.all([
        globalThis.document.fonts.load(`${c.size}px "DM Sans"`, c.text),
        globalThis.document.fonts.load(
          `${c.size}px "Noto Sans Arabic"`,
          c.text,
        ),
      ]);
      const ctx = canvas.getContext("2d"),
        lines = c.text.split("\n"),
        lineHeight = c.size * 1.3;
      ctx.font = `${c.size}px "DM Sans", "Noto Sans Arabic", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.direction = /\p{Script=Arabic}/u.test(
        c.text.match(/\p{L}/u)?.[0] || "",
      )
        ? "rtl"
        : "ltr";
      const top =
        c.position === "top"
          ? doc.height * 0.08
          : c.position === "center"
            ? (doc.height - lines.length * lineHeight) / 2
            : doc.height * 0.92 - lines.length * lineHeight;
      const maxWidth = Math.max(...lines.map((t) => ctx.measureText(t).width));
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.fillRect(
        (doc.width - maxWidth) / 2 - 10,
        top - 5,
        maxWidth + 20,
        lines.length * lineHeight + 10,
      );
      ctx.fillStyle = c.color;
      lines.forEach((text, j) =>
        ctx.fillText(text, doc.width / 2, top + j * lineHeight),
      );
      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Caption image failed."))),
          "image/png",
        ),
      );
      const file = `caption-${i}.png`;
      await ff.writeFile(file, new Uint8Array(await blob.arrayBuffer()));
      inputs.push("-loop", "1", "-framerate", String(doc.fps), "-i", file);
      const out = `vc${i}`;
      filters.push(
        `[${video}][${inputIndex++}:v]overlay=0:0:enable='between(t,${c.start},${c.end})':shortest=1[${out}]`,
      );
      video = out;
    }
    for (let i = 0; i < doc.overlays.length; i++) {
      const o = doc.overlays[i],
        file = `overlay-${i}`;
      await writeSource(o.assetId, file);
      inputs.push("-loop", "1", "-framerate", String(doc.fps), "-i", file);
      const overlay = `ol${i}`,
        out = `vo${i}`;
      filters.push(
        `[${inputIndex++}:v]scale=${Math.max(2, Math.round((doc.width * o.width) / 100))}:-1,format=rgba,colorchannelmixer=aa=${o.opacity}[${overlay}]`,
      );
      filters.push(
        `[${video}][${overlay}]overlay=x=${(doc.width * o.x) / 100}:y=${(doc.height * o.y) / 100}:enable='between(t,${o.start},${o.end})':shortest=1[${out}]`,
      );
      video = out;
    }
    const mix = ["0:a"];
    if (doc.soundtrack) {
      const s = doc.soundtrack;
      await writeSource(s.assetId, "music");
      inputs.push(
        "-stream_loop",
        "-1",
        "-ss",
        String(s.offset % sources.get(s.assetId).duration),
        "-i",
        "music",
      );
      filters.push(
        `[${inputIndex++}:a]asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,volume=${s.volume},afade=t=out:st=${Math.max(0, total - Math.min(0.5, total))}:d=${Math.min(0.5, total)}[music]`,
      );
      mix.push("music");
    }
    for (let i = 0; i < doc.audioTracks.length; i++) {
      const t = doc.audioTracks[i],
        length = t.out - t.in,
        file = `audio-${i}`;
      await writeSource(t.assetId, file);
      inputs.push("-ss", String(t.in), "-t", String(length), "-i", file);
      const name = "at" + i;
      filters.push(
        `[${inputIndex++}:a]asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,volume=${t.volume}${t.fadeIn ? `,afade=t=in:st=0:d=${Math.min(t.fadeIn, length / 2)}` : ""}${t.fadeOut ? `,afade=t=out:st=${Math.max(0, length - Math.min(t.fadeOut, length / 2))}:d=${Math.min(t.fadeOut, length / 2)}` : ""},adelay=${Math.round(t.start * 1000)}|${Math.round(t.start * 1000)},apad,atrim=duration=${total}[${name}]`,
      );
      mix.push(name);
    }
    if (mix.length > 1) {
      filters.push(
        mix.map((v) => `[${v}]`).join("") +
          `amix=inputs=${mix.length}:duration=first:dropout_transition=0[mix]`,
      );
      audio = "mix";
    }
    await exec(
      [
        ...inputs,
        ...(filters.length ? ["-filter_complex", filters.join(";")] : []),
        "-map",
        video === "0:v" ? video : `[${video}]`,
        "-map",
        audio === "0:a" ? audio : `[${audio}]`,
        "-t",
        String(total),
        ...encoding(doc.quality),
        "output.mp4",
      ],
      65,
      34,
    );
    const result = await ff.readFile("output.mp4");
    return new Blob([result], { type: "video/mp4" });
  }, options);
}
export function extractAudio(media, start = 0, end = media.duration) {
  if (end - start > 120)
    return Promise.reject(
      new Error(
        "Audio extraction is limited to 2 minutes per WAV file for browser memory safety.",
      ),
    );
  if (!media.hasAudio)
    return Promise.reject(new Error("This source has no audio stream."));
  return withEngine(async (ff, exec) => {
    await ff.writeFile(
      "source",
      new Uint8Array(await media.blob.arrayBuffer()),
    );
    await exec([
      "-ss",
      String(start),
      "-t",
      String(end - start),
      "-i",
      "source",
      "-vn",
      "-c:a",
      "pcm_s16le",
      "-ar",
      "48000",
      "-ac",
      "2",
      "audio.wav",
    ]);
    return new Blob([await ff.readFile("audio.wav")], { type: "audio/wav" });
  });
}

export function reverseSource(media, start, end) {
  if (media.kind !== "video" || end - start > 10 || end - start < 0.1)
    return Promise.reject(
      new Error(
        "Reverse a video segment between 0.1 and 10 seconds. Longer reverse buffers can exhaust browser memory.",
      ),
    );
  return withEngine(async (ff, exec) => {
    await ff.writeFile(
      "source",
      new Uint8Array(await media.blob.arrayBuffer()),
    );
    await exec([
      "-ss",
      String(start),
      "-t",
      String(end - start),
      "-i",
      "source",
      "-vf",
      "scale=640:640:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30,reverse",
      ...(media.hasAudio ? ["-af", "areverse"] : ["-an"]),
      ...encoding("balanced"),
      "reversed.mp4",
    ]);
    return new Blob([await ff.readFile("reversed.mp4")], { type: "video/mp4" });
  });
}
