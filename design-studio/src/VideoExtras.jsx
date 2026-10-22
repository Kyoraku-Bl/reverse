import { videoLooks, videoEffects } from "../shared/effect-catalog.mjs";
import React, { useState, useRef, useEffect } from "react";
import {
  Download,
  Upload,
  Mic,
  Square,
  Plus,
  Trash2,
  RotateCcw,
  Image as ImageIcon,
  Volume2,
  Camera,
} from "lucide-react";
import { parseSrt, captionsToSrt } from "../shared/video-effects.mjs";
import { api } from "./api";
import { downloadBlob } from "./local-db";
const uid = () => crypto.randomUUID();
export function Effects({ clip, updateClip }) {
  if (!clip) return <p>Select a timeline clip to adjust its look.</p>;
  return (
    <>
      <p>
        Non-destructive adjustments. Appearance preview is approximate; the
        exported MP4 uses FFmpeg filters.
      </p>
      <label>
        Look
        <select
          aria-label="Clip filter"
          value={clip.filter || "none"}
          onChange={(e) => updateClip({ filter: e.target.value })}
        >
          {videoLooks.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Extra effect
        <select
          aria-label="Clip effect"
          value={clip.effect || "none"}
          onChange={(e) => updateClip({ effect: e.target.value })}
        >
          {videoEffects.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <p>
        20 looks + 10 extra effects. Combine a look with an effect and the
        adjustments below. Not the CapCut proprietary/AI library. Some effects
        are visible only in the exported MP4.
      </p>
      {[
        ["brightness", "Brightness", -0.5, 0.5, 0.05, 0],
        ["contrast", "Contrast", 0.5, 2, 0.05, 1],
        ["saturation", "Saturation", 0, 2, 0.05, 1],
        ["blur", "Blur", 0, 10, 1, 0],
        ["hue", "Hue rotation", -180, 180, 1, 0],
      ].map(([key, title, min, max, step, fallback]) => (
        <label key={key}>
          {title} · {(clip[key] ?? fallback).toFixed(2)}
          <input
            aria-label={"Clip " + key}
            type="range"
            min={min}
            max={max}
            step={step}
            value={clip[key] ?? fallback}
            onChange={(e) => updateClip({ [key]: +e.target.value })}
          />
        </label>
      ))}
      <label>
        Rotation
        <select
          aria-label="Clip rotation"
          value={clip.rotation || 0}
          onChange={(e) => updateClip({ rotation: +e.target.value })}
        >
          {[0, 90, 180, 270].map((v) => (
            <option key={v} value={v}>
              {v}°
            </option>
          ))}
        </select>
      </label>
      <h3 className="ve-subheading">Crop & two-point motion</h3>
      <p>
        Zoom and pan interpolate from the first to last frame of this clip. A
        zoom of 1 keeps the full fitted frame.
      </p>
      {[
        ["zoomStart", "Start zoom", 1, 2, 0.05, 1],
        ["zoomEnd", "End zoom", 1, 2, 0.05, 1],
        ["panX", "Start pan X (%)", 0, 100, 1, 50],
        ["panY", "Start pan Y (%)", 0, 100, 1, 50],
        ["panEndX", "End pan X (%)", 0, 100, 1, 50],
        ["panEndY", "End pan Y (%)", 0, 100, 1, 50],
      ].map(([key, label, min, max, step, fallback]) => (
        <label key={key}>
          {label}
          <input
            aria-label={"Clip " + key}
            type="number"
            min={min}
            max={max}
            step={step}
            value={clip[key] ?? fallback}
            onChange={(e) => updateClip({ [key]: +e.target.value })}
          />
        </label>
      ))}
      <div className="ve-extra-buttons">
        <button
          aria-pressed={!!clip.flipX}
          onClick={() => updateClip({ flipX: !clip.flipX })}
        >
          Flip horizontal
        </button>
        <button
          aria-pressed={!!clip.flipY}
          onClick={() => updateClip({ flipY: !clip.flipY })}
        >
          Flip vertical
        </button>
      </div>
      <button
        className="ve-wide"
        onClick={() =>
          updateClip({
            filter: "none",
            effect: "none",
            hue: 0,
            brightness: 0,
            contrast: 1,
            saturation: 1,
            blur: 0,
            rotation: 0,
            flipX: false,
            flipY: false,
            zoomStart: 1,
            zoomEnd: 1,
            panX: 50,
            panY: 50,
            panEndX: 50,
            panEndY: 50,
          })
        }
      >
        <RotateCcw size={16} /> Reset appearance
      </button>
    </>
  );
}
export function CaptionTools({ captions, change, message }) {
  const input = useRef();
  async function load(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 100000) throw new Error("Choose an SRT under 100 KB.");
      const next = parseSrt(await file.text());
      if (next.length + captions.length > 20)
        throw new Error("A montage supports up to 20 captions.");
      change((d) => ({ ...d, captions: [...d.captions, ...next] }));
      message("Subtitles imported. Check timing in the preview.");
    } catch (e) {
      message(e.message);
    }
  }
  return (
    <>
      <div className="ve-extra-buttons">
        <button onClick={() => input.current.click()}>
          <Upload size={14} /> Import SRT
        </button>
        <button
          disabled={!captions.length}
          onClick={() =>
            downloadBlob(
              new Blob([captionsToSrt(captions)], {
                type: "text/plain;charset=utf-8",
              }),
              "captions.srt",
            )
          }
        >
          <Download size={14} /> Export SRT
        </button>
      </div>
      <input
        ref={input}
        hidden
        type="file"
        accept=".srt,text/plain"
        onChange={load}
      />
      <small className="ve-hint">
        Manual captions and SRT files. Automatic transcription / AI captions are
        not included.
      </small>
    </>
  );
}
export function ImageLayers({ document: doc, media, change, playhead, total }) {
  const images = media.filter((m) => m.kind === "image"),
    layers = doc.overlays || [];
  const edit = (id, patch) =>
    change((d) => ({
      ...d,
      overlays: (d.overlays || []).map((o) =>
        o.id === id ? { ...o, ...patch } : o,
      ),
    }));
  return (
    <>
      <p>
        Add your own logos, stickers or pictures as timed layers. Upload PNG,
        JPEG or WebP in Media. Transparent PNG works well for logos.
      </p>
      <select
        aria-label="Add image overlay"
        value=""
        disabled={layers.length >= 10}
        onChange={(e) => {
          if (!e.target.value) return;
          change((d) => ({
            ...d,
            overlays: [
              ...(d.overlays || []),
              {
                id: uid(),
                assetId: e.target.value,
                start: Math.min(playhead, Math.max(0, total - 0.1)),
                end: Math.max(0.1, total || 3),
                x: 5,
                y: 5,
                width: 25,
                opacity: 1,
              },
            ],
          }));
        }}
      >
        <option value="">Choose image to add…</option>
        {images.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {layers.map((o, i) => (
        <div className="ve-caption-card" key={o.id}>
          <div>
            <b>
              Layer {i + 1} · {media.find((m) => m.id === o.assetId)?.name}
            </b>
            <button
              title={"Delete image layer " + (i + 1)}
              onClick={() =>
                change((d) => ({
                  ...d,
                  overlays: d.overlays.filter((v) => v.id !== o.id),
                }))
              }
            >
              <Trash2 size={14} />
            </button>
          </div>
          {["start", "end", "x", "y", "width", "opacity"].map((key) => (
            <label key={key}>
              {
                {
                  start: "Start (s)",
                  end: "End (s)",
                  x: "Left (%)",
                  y: "Top (%)",
                  width: "Width (%)",
                  opacity: "Opacity",
                }[key]
              }
              <input
                aria-label={`Image layer ${i + 1} ${key}`}
                type="number"
                step={key === "opacity" ? 0.05 : 0.1}
                min={key === "width" ? 5 : 0}
                max={
                  key === "opacity"
                    ? 1
                    : ["start", "end"].includes(key)
                      ? 600
                      : 100
                }
                value={o[key]}
                onChange={(e) => edit(o.id, { [key]: +e.target.value })}
              />
            </label>
          ))}
        </div>
      ))}
      {!images.length && (
        <small className="ve-hint">Import an image in Media first.</small>
      )}
    </>
  );
}
export function AudioLayers({
  document: doc,
  media,
  change,
  playhead,
  message,
  reloadMedia,
}) {
  const [recording, setRecording] = useState(false),
    [pending, setPending] = useState(false),
    recorder = useRef(),
    stream = useRef(),
    recordTimer = useRef(),
    mounted = useRef(true),
    tracks = doc.audioTracks || [];
  useEffect(
    () => () => {
      mounted.current = false;
      clearTimeout(recordTimer.current);
      if (recorder.current?.state === "recording") {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  const add = (m) =>
    change((d) => ({
      ...d,
      audioTracks: [
        ...(d.audioTracks || []),
        {
          id: uid(),
          assetId: m.id,
          start: playhead,
          in: 0,
          out: Math.min(m.duration, Math.max(0.1, 600 - playhead)),
          volume: 1,
          fadeIn: 0,
          fadeOut: 0,
        },
      ],
    }));
  const edit = (id, p) =>
    change((d) => ({
      ...d,
      audioTracks: (d.audioTracks || []).map((t) =>
        t.id === id ? { ...t, ...p } : t,
      ),
    }));
  async function record() {
    if (recording) {
      recorder.current.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) {
      message(
        "Voice recording needs a supported browser on HTTPS (or localhost).",
      );
      return;
    }
    if (tracks.length >= 5) {
      message("Use up to five extra audio layers.");
      return;
    }
    setPending(true);
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (!mounted.current) {
        audioStream.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = audioStream;
      const r = new MediaRecorder(audioStream),
        chunks = [];
      let length = 0,
        overflow = false;
      recorder.current = r;
      r.ondataavailable = (e) => {
        if (e.data.size) {
          length += e.data.size;
          if (length > 25 * 1024 * 1024) {
            overflow = true;
            if (r.state === "recording") r.stop();
          } else chunks.push(e.data);
        }
      };
      const timer = (recordTimer.current = setTimeout(() => {
        if (r.state === "recording") r.stop();
      }, 120000));
      r.onstop = async () => {
        clearTimeout(timer);
        audioStream.getTracks().forEach((t) => t.stop());
        if (!mounted.current) return;
        setRecording(false);
        setPending(true);
        try {
          if (overflow)
            throw new Error(
              "Recording reached its 25 MB safety limit. Try a shorter recording.",
            );
          const file = new File(
              chunks,
              "Voiceover-" +
                Date.now() +
                (r.mimeType.includes("mp4") ? ".m4a" : ".webm"),
              { type: r.mimeType || "audio/webm" },
            ),
            body = new FormData();
          body.append("file", file);
          const { media: source } = await api("/video/media", {
            method: "POST",
            body,
          });
          await reloadMedia();
          if (mounted.current) {
            add(source);
            message("Voiceover recorded and added as a timed audio layer.");
          }
        } catch (e) {
          if (mounted.current) message(e.message);
        } finally {
          if (mounted.current) setPending(false);
        }
      };
      r.start(1000);
      setRecording(true);
      message(
        "Recording microphone audio. Stop to add your voiceover (up to 2 minutes).",
      );
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      message("Microphone could not be opened: " + e.message);
    } finally {
      if (mounted.current) setPending(false);
    }
  }
  return (
    <>
      <h3 className="ve-subheading">Voiceovers & sound effects</h3>
      <p>
        Mix up to five timed audio layers alongside your clips and looping
        soundtrack. Preview uses an averaged mix; gains over 100% are
        approximate.
      </p>
      <button className="ve-wide" disabled={pending} onClick={record}>
        {recording ? <Square size={16} /> : <Mic size={16} />}{" "}
        {pending
          ? "Processing recording…"
          : recording
            ? "Stop recording"
            : "Record voiceover"}
      </button>
      <select
        aria-label="Add audio layer"
        disabled={tracks.length >= 5}
        value=""
        onChange={(e) => {
          const m = media.find((m) => m.id === e.target.value);
          if (m) add(m);
        }}
      >
        <option value="">Add an audio source…</option>
        {media
          .filter((m) => m.hasAudio)
          .map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
      </select>
      {tracks.map((t, i) => (
        <div key={t.id} className="ve-caption-card">
          <div>
            <b>
              Audio {i + 1} · {media.find((m) => m.id === t.assetId)?.name}
            </b>
            <button
              title={"Delete audio layer " + (i + 1)}
              onClick={() =>
                change((d) => ({
                  ...d,
                  audioTracks: d.audioTracks.filter((a) => a.id !== t.id),
                }))
              }
            >
              <Trash2 size={14} />
            </button>
          </div>
          {[
            ["start", "Timeline start", 600],
            [
              "in",
              "Source in",
              media.find((m) => m.id === t.assetId)?.duration || 1800,
            ],
            [
              "out",
              "Source out",
              media.find((m) => m.id === t.assetId)?.duration || 1800,
            ],
            ["volume", "Volume", 2],
            ["fadeIn", "Fade in", 3],
            ["fadeOut", "Fade out", 3],
          ].map(([key, title, max]) => (
            <label key={key}>
              {title}
              <input
                aria-label={`Audio layer ${i + 1} ${key}`}
                type="number"
                step={0.1}
                min={0}
                max={max}
                value={t[key]}
                onChange={(e) => edit(t.id, { [key]: +e.target.value })}
              />
            </label>
          ))}
        </div>
      ))}
    </>
  );
}
export function SourceTools({
  media,
  clip,
  video,
  message,
  reloadMedia,
  addClip,
}) {
  const [busy, setBusy] = useState(false);
  async function audio() {
    setBusy(true);
    try {
      const { extractAudio } = await import("./browser-media");
      const { read } = await import("./local-db");
      const source = await read("media/" + media.id);
      downloadBlob(
        await extractAudio(source, clip.in, clip.out),
        media.name.replace(/\.[^.]+$/, "") + "-audio.wav",
      );
      message("Source audio downloaded (WAV).");
    } catch (e) {
      message(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function addSource(file) {
    const body = new FormData();
    body.append("file", file);
    const { media: source } = await api("/video/media", {
      method: "POST",
      body,
    });
    await reloadMedia();
    addClip(source);
  }
  async function reverse() {
    setBusy(true);
    try {
      const { reverseSource } = await import("./browser-media"),
        { read } = await import("./local-db");
      const blob = await reverseSource(
        await read("media/" + media.id),
        clip.in,
        clip.out,
      );
      await addSource(
        new File([blob], "Reversed-" + media.name + ".mp4", {
          type: "video/mp4",
        }),
      );
      message(
        "Reversed copy added at the end of the timeline (up to 640 px). Original kept unchanged.",
      );
    } catch (e) {
      message(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function frame(freeze = false) {
    setBusy(true);
    try {
      const source = video.current;
      if (!source || source.readyState < 2)
        throw new Error("Play or seek a video frame first.");
      const canvas = document.createElement("canvas");
      canvas.width = source.videoWidth;
      canvas.height = source.videoHeight;
      canvas.getContext("2d").drawImage(source, 0, 0);
      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Frame capture failed."))),
          "image/png",
        ),
      );
      if (freeze) {
        await addSource(
          new File([blob], "Freeze-frame.png", { type: "image/png" }),
        );
        message(
          "Still frame added at the end of the timeline. Adjust its Out point to change duration.",
        );
      } else {
        downloadBlob(blob, "source-frame.png");
        message(
          "Original source frame downloaded, without montage effects or captions.",
        );
      }
    } catch (e) {
      message(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="ve-extra-buttons">
        <button disabled={busy || !media?.hasAudio} onClick={audio}>
          <Volume2 size={14} />
          {busy ? "Processing…" : "Extract audio WAV"}
        </button>
        <button
          disabled={busy || !media || media.kind === "image"}
          onClick={() => frame()}
        >
          <Camera size={14} /> Source frame PNG
        </button>
        <button
          disabled={busy || !media || media.kind === "image"}
          onClick={() => frame(true)}
        >
          <ImageIcon size={14} /> Add freeze frame
        </button>
        <button
          disabled={busy || !media || media.kind !== "video"}
          onClick={reverse}
        >
          <RotateCcw size={14} /> Create reversed copy
        </button>
      </div>
      <small className="ve-hint">
        Reverse copies: up to 10 seconds, maximum 640 px. Freeze frames and
        reversed copies are appended; drag them to your desired position.
      </small>
    </>
  );
}

export function TimelineLayer({
  item,
  length,
  pixels,
  label,
  kind,
  onOpen,
  onMove,
}) {
  const drag = useRef(0);
  return (
    <div className={"ve-layer-lane " + kind}>
      <button
        draggable
        aria-label={label}
        title={label + " · drag or use Left/Right (Shift: 1 second)"}
        style={{
          left: item.start * pixels,
          width: Math.max(12, length * pixels),
        }}
        onClick={onOpen}
        onDragStart={(e) => {
          drag.current = e.clientX;
          e.dataTransfer.setData("text/plain", "layer:" + item.id);
        }}
        onDragEnd={(e) => {
          if (e.clientX)
            onMove(item.start + (e.clientX - drag.current) / pixels);
        }}
        onKeyDown={(e) => {
          if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
            onMove(
              item.start +
                (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 1 : 0.1),
            );
          }
        }}
      >
        {kind === "audio" ? (
          <Volume2 size={12} />
        ) : kind === "image" ? (
          <ImageIcon size={12} />
        ) : (
          <span>T</span>
        )}
        {label}
      </button>
    </div>
  );
}
