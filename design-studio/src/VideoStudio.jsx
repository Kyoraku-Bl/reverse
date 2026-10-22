import React, { useState, useEffect, useRef } from "react";
import {
  Video,
  Plus,
  ArrowLeft,
  Upload,
  Play,
  Pause,
  Scissors,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Save,
  Download,
  Type,
  Music,
  Film,
  ChevronRight,
  LoaderCircle,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { api } from "./api";
import {
  emptyVideo,
  timeline,
  duration,
  clipDuration,
  locate,
  timecode,
  videoDocumentSchema,
} from "../shared/video.mjs";
import "./video.css";
const uid = () => crypto.randomUUID();
export default function VideoStudio() {
  const [projects, setProjects] = useState([]),
    [editor, setEditor] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const load = () =>
    api("/video/projects")
      .then((r) => setProjects(r.projects))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);
  async function remove(project) {
    if (
      !confirm(
        "Delete this montage and its exports? Original media stays in your library.",
      )
    )
      return;
    try {
      await api("/video/projects/" + project.id, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  async function duplicate(project) {
    try {
      await api("/video/projects", {
        method: "POST",
        body: JSON.stringify({
          title: project.title + " (copy)",
          document: project.document,
        }),
      });
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <section className="video-studio">
      <div className="section-heading">
        <div>
          <span className="eyebrow">YOUR STORY, IN MOTION</span>
          <h1>Make every moment count.</h1>
          <p>
            A real timeline, your own clips, and free MP4 exports. No watermark.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() =>
            setEditor({ title: "Untitled montage", document: emptyVideo() })
          }
        >
          <Plus size={17} />
          New video
        </button>
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <p className="vs-loading">Loading your videos…</p>
      ) : !projects.length ? (
        <div className="video-empty">
          <span>
            <Film size={38} />
          </span>
          <h2>A little footage. A whole new story.</h2>
          <p>
            Trim and arrange clips, add music and captions, then export your
            montage as an MP4.
          </p>
          <button
            className="primary-button"
            onClick={() =>
              setEditor({ title: "Untitled montage", document: emptyVideo() })
            }
          >
            Create your first video <ChevronRight size={17} />
          </button>
          <small>MP4 · WebM · MOV inputs · Up to 1080p output</small>
        </div>
      ) : (
        <div className="vs-grid">
          {projects.map((p) => (
            <article key={p.id}>
              <button className="vs-thumbnail" onClick={() => setEditor(p)}>
                <Film size={36} />
                <span>{timecode(duration(p.document))}</span>
                <b>
                  {p.document.width} × {p.document.height}
                </b>
              </button>
              <div>
                <button onClick={() => setEditor(p)}>
                  <h3>{p.title}</h3>
                </button>
                <small>
                  {p.document.clips.length} clips ·{" "}
                  {new Date(p.updatedAt).toLocaleDateString()}
                </small>
              </div>
              <div className="vs-actions">
                <button
                  onClick={() => duplicate(p)}
                  title={`Duplicate ${p.title}`}
                >
                  <Copy size={15} />
                </button>
                <button onClick={() => remove(p)} title={`Delete ${p.title}`}>
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {editor && (
        <VideoEditor
          initial={editor}
          onClose={() => {
            setEditor(null);
            load();
          }}
        />
      )}
    </section>
  );
}
function VideoEditor({ initial, onClose }) {
  const [document, setDocument] = useState(() =>
      structuredClone(initial.document),
    ),
    [title, setTitle] = useState(initial.title),
    [media, setMedia] = useState([]),
    [tab, setTab] = useState("Media"),
    [selected, setSelected] = useState(initial.document.clips[0]?.id || null),
    [playhead, setPlayhead] = useState(0),
    [playing, setPlaying] = useState(false),
    [dirty, setDirty] = useState(!initial.id),
    [saving, setSaving] = useState(false),
    [uploading, setUploading] = useState(false),
    [message, setMessage] = useState(""),
    [job, setJob] = useState(null),
    [renderBusy, setRenderBusy] = useState(false),
    [pixels, setPixels] = useState(65),
    [frameSize, setFrameSize] = useState({ width: 640, height: 360 });
  const fileRef = useRef(),
    videoRef = useRef(),
    audioRef = useRef(),
    stageRef = useRef(),
    trackRef = useRef(),
    record = useRef(initial),
    docRef = useRef(document),
    titleRef = useRef(title),
    changed = useRef(!initial.id ? 1 : 0),
    savedVersion = useRef(0),
    savingRef = useRef(false),
    timeRef = useRef(playhead),
    playingRef = useRef(playing),
    activeRef = useRef(),
    saveRef = useRef(),
    requestRef = useRef(0);
  docRef.current = document;
  titleRef.current = title;
  timeRef.current = playhead;
  playingRef.current = playing;
  const total = duration(document),
    clips = timeline(document),
    active = locate(document, Math.min(playhead, total)),
    activeMedia = media.find((m) => m.id === active?.assetId),
    selectedClip = document.clips.find((c) => c.id === selected),
    selectedMedia = media.find((m) => m.id === selectedClip?.assetId),
    sound = document.soundtrack,
    soundMedia = media.find((m) => m.id === sound?.assetId);
  activeRef.current = active;
  const change = (fn) => {
    setDocument((old) => {
      const next = typeof fn === "function" ? fn(old) : fn;
      docRef.current = next;
      return next;
    });
    changed.current++;
    setDirty(true);
  };
  const loadMedia = async () => {
    const r = await api("/video/media");
    setMedia(r.media);
    return r.media;
  };
  useEffect(() => {
    loadMedia().catch((e) => setMessage(e.message));
    if (initial.id)
      api("/video/jobs")
        .then((r) =>
          setJob(r.jobs.find((j) => j.projectId === initial.id) || null),
        )
        .catch((e) => setMessage(e.message));
    return () => {
      videoRef.current?.pause();
      audioRef.current?.pause();
    };
  }, []);
  useEffect(() => {
    const warn = (e) => {
      if (changed.current !== savedVersion.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    const timer = setInterval(() => {
      if (changed.current !== savedVersion.current && !savingRef.current)
        saveRef.current?.(true);
    }, 15000);
    return () => {
      window.removeEventListener("beforeunload", warn);
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!job || !["queued", "rendering"].includes(job.status)) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        api("/video/jobs/" + job.id, { signal: controller.signal })
          .then((r) => {
            requestRef.current = 0;
            setJob(r.job);
          })
          .catch((e) => {
            if (e.name !== "AbortError") {
              setMessage("Render status could not be refreshed: " + e.message);
              if (++requestRef.current < 5)
                setJob((previous) => ({ ...previous }));
            }
          }),
      800,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [job]);
  useEffect(() => {
    const resize = () => {
      const r = stageRef.current?.getBoundingClientRect();
      if (!r) return;
      const ratio = document.width / document.height;
      const width = Math.max(
        80,
        Math.min(r.width - 50, (r.height - 45) * ratio),
      );
      setFrameSize({ width, height: width / ratio });
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (stageRef.current) observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [document.width, document.height]);
  useEffect(() => {
    if (playhead > total) seek(total);
    if (!document.clips.length) setPlaying(false);
  }, [total, document.clips.length]);
  function syncVideo() {
    const el = videoRef.current,
      c = activeRef.current;
    if (!el || !c || el.readyState < 1) return;
    const target = Math.max(
      c.in,
      Math.min(c.out - 0.001, c.in + (timeRef.current - c.start) * c.speed),
    );
    if (Math.abs(el.currentTime - target) > 0.06) el.currentTime = target;
    el.playbackRate = c.speed;
    setVolumes();
    if (playingRef.current)
      el.play().catch(() => {
        setPlaying(false);
        setMessage(
          "Your browser cannot play this codec. Try an H.264 MP4 or VP8/VP9 WebM; server export may still work.",
        );
      });
  }
  function setVolumes() {
    const c = activeRef.current,
      el = videoRef.current,
      s = docRef.current.soundtrack;
    if (c && el) {
      const fade = Math.min(c.fade, (c.end - c.start) / 2);
      const gain = fade
        ? Math.max(
            0,
            Math.min(
              1,
              (timeRef.current - c.start) / fade,
              (c.end - timeRef.current) / fade,
            ),
          )
        : 1;
      el.volume = Math.min(1, (c.volume * gain) / (s ? 2 : 1));
    }
    if (audioRef.current)
      audioRef.current.volume = Math.min(1, (s?.volume || 0) / 2);
  }
  function syncMusic() {
    const audio = audioRef.current,
      s = docRef.current.soundtrack;
    if (!audio || !s || !Number.isFinite(audio.duration) || !audio.duration)
      return;
    const target = (s.offset + timeRef.current) % audio.duration;
    if (Math.abs(audio.currentTime - target) > 0.3) audio.currentTime = target;
    setVolumes();
    if (playingRef.current)
      audio
        .play()
        .catch(() =>
          setMessage(
            "The soundtrack cannot play in this browser. Try WAV or MP3.",
          ),
        );
  }
  useEffect(() => {
    syncVideo();
    syncMusic();
  }, [active?.id, activeMedia?.url]);
  useEffect(() => {
    if (playing) {
      syncVideo();
      syncMusic();
    } else {
      videoRef.current?.pause();
      audioRef.current?.pause();
    }
  }, [playing]);
  useEffect(() => {
    syncMusic();
  }, [sound?.assetId, sound?.offset]);
  useEffect(() => {
    setVolumes();
    if (videoRef.current && active)
      videoRef.current.playbackRate = active.speed;
  }, [selectedClip?.volume, active?.speed, sound?.volume]);
  useEffect(() => {
    if (!playing) return;
    let frame,
      last = 0;
    const tick = (now) => {
      if (now - last > 25) {
        last = now;
        const c = activeRef.current,
          video = videoRef.current;
        if (c && video && video.readyState >= 2 && !video.seeking) {
          const t = c.start + (video.currentTime - c.in) / c.speed;
          if (video.currentTime >= c.out - 0.02 || video.ended) {
            const list = timeline(docRef.current),
              index = list.findIndex((item) => item.id === c.id);
            if (index < list.length - 1) {
              video.pause();
              const next = list[index + 1].start + 0.001;
              timeRef.current = next;
              setPlayhead(next);
            } else {
              setPlaying(false);
              setPlayhead(duration(docRef.current));
              audioRef.current?.pause();
            }
          } else {
            timeRef.current = Math.max(c.start, Math.min(c.end, t));
            setPlayhead(timeRef.current);
            setVolumes();
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  useEffect(() => {
    const keys = (e) => {
      if (e.target.closest('input,textarea,select,[contenteditable="true"]'))
        return;
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveRef.current?.();
      }
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === "Delete" && selected) removeClip(selected);
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  });
  async function save(automatic = false) {
    if (savingRef.current || uploading) return null;
    savingRef.current = true;
    setSaving(true);
    const version = changed.current;
    try {
      const result = videoDocumentSchema.safeParse(docRef.current);
      if (!result.success) throw new Error(result.error.issues[0].message);
      const current = record.current;
      const body = {
        title: titleRef.current.trim() || "Untitled montage",
        document: result.data,
        ...(current.id ? { revision: current.revision } : {}),
      };
      const r = await api(
        current.id ? "/video/projects/" + current.id : "/video/projects",
        { method: current.id ? "PUT" : "POST", body: JSON.stringify(body) },
      );
      record.current = r.project;
      savedVersion.current = version;
      setDirty(changed.current !== version);
      setMessage(
        automatic ? "Video automatically saved" : "Video saved to your account",
      );
      return r.project;
    } catch (e) {
      setMessage(e.message);
      return null;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  saveRef.current = save;
  async function upload(e) {
    const files = [...e.target.files];
    e.target.value = "";
    if (!files.length) return;
    if (files.length > 30) {
      setMessage("Choose up to 30 files at a time.");
      return;
    }
    setUploading(true);
    try {
      for (const file of files.slice(0, 30)) {
        if (file.size > 100 * 1024 * 1024)
          throw new Error(`${file.name} exceeds 100 MB`);
        setMessage("Uploading and analysing " + file.name + "…");
        const body = new FormData();
        body.append("file", file);
        await api("/video/media", { method: "POST", body });
      }
      await loadMedia();
      setMessage(
        "Media uploaded. Add a video to your timeline or choose an audio track.",
      );
    } catch (e) {
      setMessage(e.message);
      await loadMedia().catch(() => {});
    } finally {
      setUploading(false);
    }
  }
  async function deleteMedia(asset) {
    if (
      docRef.current.clips.some((c) => c.assetId === asset.id) ||
      docRef.current.soundtrack?.assetId === asset.id
    ) {
      setMessage(
        "Remove this media from your timeline or soundtrack, then save the project before deleting the source.",
      );
      return;
    }
    if (
      !confirm(
        "Delete this unused original from your library? This cannot be undone.",
      )
    )
      return;
    try {
      await api("/video/media/" + asset.id, { method: "DELETE" });
      await loadMedia();
      setMessage("Unused media deleted");
    } catch (e) {
      setMessage(e.message);
    }
  }
  function addClip(asset) {
    if (document.clips.length >= 30) {
      setMessage("A montage supports up to 30 clips");
      return;
    }
    const c = {
      id: uid(),
      assetId: asset.id,
      in: 0,
      out: Math.min(asset.duration, 60),
      volume: 1,
      speed: 1,
      fit: "contain",
      fade: 0,
    };
    if (total + clipDuration(c) > 600) {
      setMessage("Keep your montage under 10 minutes");
      return;
    }
    change((d) => ({ ...d, clips: [...d.clips, c] }));
    setSelected(c.id);
    setTab("Clip");
    seek(total);
    setMessage(
      asset.duration > 60
        ? "Added the first 60 seconds. Extend Out in the clip controls if needed."
        : "Clip added to the timeline",
    );
  }
  function updateClip(patch) {
    if (!selectedClip) return;
    const next = { ...selectedClip, ...patch };
    if (
      next.in < 0 ||
      next.out > selectedMedia.duration + 0.02 ||
      next.out - next.in < 0.1
    ) {
      setMessage(
        "Keep In and Out inside the source, with at least 0.1 seconds between them.",
      );
      return;
    }
    change((d) => ({
      ...d,
      clips: d.clips.map((c) => (c.id === next.id ? next : c)),
    }));
    setPlaying(false);
    setTimeout(() => syncVideo(), 0);
  }
  function seek(time) {
    const t = Math.max(0, Math.min(duration(docRef.current), time));
    timeRef.current = t;
    setPlayhead(t);
    const c = locate(docRef.current, t);
    if (c?.id === activeRef.current?.id) {
      if (videoRef.current?.readyState >= 1)
        videoRef.current.currentTime = c.in + (t - c.start) * c.speed;
      syncMusic();
    } else audioRef.current?.pause();
  }
  function togglePlay() {
    if (!document.clips.length) return;
    if (!playing && playhead >= total - 0.01) seek(0);
    setPlaying((p) => !p);
  }
  function removeClip(id) {
    setPlaying(false);
    change((d) => ({ ...d, clips: d.clips.filter((c) => c.id !== id) }));
    if (selected === id) setSelected(null);
  }
  function reorder(id, target) {
    const list = [...document.clips],
      index = list.findIndex((c) => c.id === id);
    if (index < 0 || target < 0 || target >= list.length) return;
    const [item] = list.splice(index, 1);
    list.splice(target, 0, item);
    setPlaying(false);
    change((d) => ({ ...d, clips: list }));
  }
  function duplicate() {
    if (!selectedClip || document.clips.length >= 30) return;
    const list = [...document.clips],
      index = list.findIndex((c) => c.id === selected);
    const next = { ...selectedClip, id: uid() };
    list.splice(index + 1, 0, next);
    if (list.reduce((s, c) => s + clipDuration(c), 0) > 600) {
      setMessage("Keep your montage under 10 minutes");
      return;
    }
    change((d) => ({ ...d, clips: list }));
    setSelected(next.id);
  }
  function split() {
    const c = clips.find((c) => c.id === selected),
      source = c ? c.in + (playhead - c.start) * c.speed : 0;
    if (!c || source - c.in < 0.1 || c.out - source < 0.1) {
      setMessage(
        "Move the playhead inside the selected clip before splitting.",
      );
      return;
    }
    const next = { ...c, id: uid(), in: source };
    change((d) => ({
      ...d,
      clips: d.clips.flatMap((item) =>
        item.id === c.id
          ? [
              { ...item, out: source },
              { ...next, start: undefined, end: undefined },
            ]
          : [item],
      ),
    }));
    setSelected(next.id);
    setPlaying(false);
  }
  function addCaption() {
    const start = Math.max(0, Math.min(playhead, Math.max(0, total - 0.1))),
      end = Math.max(start + 0.1, Math.min(total || 3, start + 3));
    change((d) => ({
      ...d,
      captions: [
        ...d.captions,
        {
          id: uid(),
          text: "Your story starts here",
          start,
          end,
          size: 48,
          color: "#ffffff",
          position: "bottom",
        },
      ],
    }));
  }
  function editCaption(id, patch) {
    change((d) => ({
      ...d,
      captions: d.captions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }
  async function render() {
    setRenderBusy(true);
    setPlaying(false);
    try {
      const saved = await save();
      if (!saved) return;
      const r = await api("/video/projects/" + saved.id + "/render", {
        method: "POST",
        body: JSON.stringify({ revision: saved.revision }),
      });
      requestRef.current = 0;
      setJob(r.job);
      setTab("Export");
      setMessage(
        "Rendering the saved version. You can keep editing while the server works.",
      );
    } catch (e) {
      setMessage(e.message);
    } finally {
      setRenderBusy(false);
    }
  }
  function close() {
    if (dirty && !confirm("Close without saving your latest video edits?"))
      return;
    videoRef.current?.pause();
    audioRef.current?.pause();
    onClose();
  }
  const renderActive = job && ["queued", "rendering"].includes(job.status),
    step = pixels < 40 ? 10 : 5;
  return (
    <div className="video-editor">
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/ogg,audio/flac,audio/mp4,.mkv,.m4a,.aac"
        hidden
        onChange={upload}
      />
      <header className="ve-header">
        <button
          className="ve-back"
          onClick={close}
          title="Back to video projects"
        >
          <ArrowLeft size={19} />
          <b>Open Studio</b>
          <span>VIDEO</span>
        </button>
        <input
          aria-label="Video title"
          maxLength={150}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            titleRef.current = e.target.value;
            changed.current++;
            setDirty(true);
          }}
        />
        <small>
          {saving
            ? "Saving…"
            : dirty
              ? "Unsaved changes"
              : "Saved to your account"}
        </small>
        <button
          onClick={() => save()}
          disabled={saving || uploading}
          className="ve-save"
        >
          <Save size={16} />
          <span>Save</span>
        </button>
        <button
          className="ve-primary"
          disabled={renderBusy || !document.clips.length || renderActive}
          onClick={render}
        >
          <Download size={16} />
          <span>Export MP4</span>
        </button>
      </header>
      <div className="ve-body">
        <nav className="ve-nav">
          {[
            { name: "Media", icon: Film },
            { name: "Clip", icon: Scissors },
            { name: "Text", icon: Type },
            { name: "Audio", icon: Music },
            { name: "Export", icon: Download },
          ].map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={tab === name ? "active" : ""}
              onClick={() => setTab(name)}
            >
              <Icon size={20} />
              {name}
            </button>
          ))}
        </nav>
        <aside className="ve-panel">
          <div className="ve-panel-title">
            <h2>
              {tab === "Media"
                ? "Your footage"
                : tab === "Clip"
                  ? "Make the cut"
                  : tab === "Text"
                    ? "Words in motion"
                    : tab === "Audio"
                      ? "Set the mood"
                      : "Ready for the world."}
            </h2>
            <span className="free-badge">FREE</span>
          </div>
          {tab === "Media" && (
            <>
              <p>
                Your own videos and audio. Private, saved, and ready to use.
              </p>
              <button
                className="ve-wide"
                disabled={uploading}
                onClick={() => fileRef.current.click()}
              >
                {uploading ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Upload size={16} />
                )}
                Upload video / audio
              </button>
              <small className="ve-hint">
                Up to 100 MB per file · 1 GB library safety limit · MP4, WebM,
                MOV, MP3, WAV
              </small>
              <div className="ve-media-list">
                {media.map((m) => (
                  <div key={m.id}>
                    <span className="ve-media-icon">
                      {m.hasVideo ? <Film size={21} /> : <Music size={21} />}
                    </span>
                    <div>
                      <b title={m.name}>{m.name}</b>
                      <small>
                        {timecode(m.duration)}
                        {m.hasVideo
                          ? ` · ${m.width} × ${m.height}`
                          : " · Audio"}
                      </small>
                    </div>
                    <button
                      title={
                        m.hasVideo
                          ? `Add ${m.name} to timeline`
                          : `Use ${m.name} as soundtrack`
                      }
                      onClick={() =>
                        m.hasVideo
                          ? addClip(m)
                          : (change((d) => ({
                              ...d,
                              soundtrack: {
                                assetId: m.id,
                                offset: 0,
                                volume: 0.5,
                              },
                            })),
                            setTab("Audio"))
                      }
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      title={`Delete unused ${m.name}`}
                      onClick={() => deleteMedia(m)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              {!media.length && (
                <div className="ve-empty-library">
                  <Upload size={27} />
                  <p>
                    Your footage belongs here.
                    <br />
                    Upload a clip to get started.
                  </p>
                </div>
              )}
            </>
          )}
          {tab === "Clip" &&
            (!selectedClip ? (
              <>
                <p>
                  Select a clip on the timeline to trim, split, resize, or
                  adjust its sound.
                </p>
                <button className="ve-wide" onClick={() => setTab("Media")}>
                  <Film size={16} />
                  Open media library
                </button>
              </>
            ) : (
              <>
                <h3 className="ve-source-name">
                  {selectedMedia?.name || "Loading source…"}
                </h3>
                <p>
                  Trim the original source. Drag clips on the timeline to
                  reorder them.
                </p>
                <div className="ve-fields">
                  <label>
                    In (seconds)
                    <input
                      aria-label="Clip in"
                      type="number"
                      min={0}
                      max={Math.max(0, selectedClip.out - 0.1)}
                      step={0.1}
                      value={Number(selectedClip.in.toFixed(3))}
                      onChange={(e) =>
                        updateClip({ in: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Out (seconds)
                    <input
                      aria-label="Clip out"
                      type="number"
                      min={selectedClip.in + 0.1}
                      max={selectedMedia?.duration}
                      step={0.1}
                      value={Number(selectedClip.out.toFixed(3))}
                      onChange={(e) =>
                        updateClip({ out: Number(e.target.value) })
                      }
                    />
                  </label>
                </div>
                <label>
                  Playback speed
                  <select
                    aria-label="Clip speed"
                    value={selectedClip.speed}
                    onChange={(e) =>
                      updateClip({ speed: Number(e.target.value) })
                    }
                  >
                    {[0.5, 1, 1.5, 2].map((v) => (
                      <option key={v} value={v}>
                        {v}×
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Fit to frame
                  <select
                    aria-label="Clip fit"
                    value={selectedClip.fit}
                    onChange={(e) => updateClip({ fit: e.target.value })}
                  >
                    <option value="contain">Fit (keep whole video)</option>
                    <option value="cover">Fill (crop to frame)</option>
                  </select>
                </label>
                <label>
                  Clip volume · {Math.round(selectedClip.volume * 100)}%
                  <input
                    aria-label="Clip volume"
                    type="range"
                    min={0}
                    max={2}
                    step={0.05}
                    value={selectedClip.volume}
                    onChange={(e) =>
                      updateClip({ volume: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Fade in / out
                  <select
                    aria-label="Clip fade"
                    value={selectedClip.fade}
                    onChange={(e) =>
                      updateClip({ fade: Number(e.target.value) })
                    }
                  >
                    <option value={0}>No fade</option>
                    <option value={0.25}>0.25 seconds</option>
                    <option value={0.5}>0.5 seconds</option>
                    <option value={1}>1 second</option>
                  </select>
                </label>
                <div className="ve-clip-tools">
                  <button
                    title="Move clip earlier"
                    onClick={() =>
                      reorder(
                        selected,
                        document.clips.findIndex((c) => c.id === selected) - 1,
                      )
                    }
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    title="Move clip later"
                    onClick={() =>
                      reorder(
                        selected,
                        document.clips.findIndex((c) => c.id === selected) + 1,
                      )
                    }
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button title="Duplicate clip" onClick={duplicate}>
                    <Copy size={16} />
                  </button>
                  <button
                    title="Delete clip"
                    onClick={() => removeClip(selected)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <button className="ve-wide" onClick={split}>
                  <Scissors size={16} />
                  Split at playhead
                </button>
                <small className="ve-hint">
                  Selected clip: {timecode(clipDuration(selectedClip))}. No
                  destructive changes to your original file.
                </small>
              </>
            ))}
          {tab === "Text" && (
            <>
              <p>
                Add timed text over the complete montage. Use line breaks for
                longer captions.
              </p>
              <button
                className="ve-wide"
                disabled={document.captions.length >= 20}
                onClick={addCaption}
              >
                <Plus size={16} />
                Add caption
              </button>
              {document.captions.map((c, i) => (
                <div className="ve-caption-card" key={c.id}>
                  <div>
                    <b>Caption {i + 1}</b>
                    <button
                      title={`Delete caption ${i + 1}`}
                      onClick={() =>
                        change((d) => ({
                          ...d,
                          captions: d.captions.filter((x) => x.id !== c.id),
                        }))
                      }
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <textarea
                    aria-label={`Caption ${i + 1} text`}
                    value={c.text}
                    maxLength={200}
                    onChange={(e) =>
                      editCaption(c.id, { text: e.target.value })
                    }
                  />
                  <div className="ve-fields">
                    <label>
                      Start
                      <input
                        aria-label={`Caption ${i + 1} start`}
                        type="number"
                        min={0}
                        max={600}
                        step={0.1}
                        value={c.start}
                        onChange={(e) =>
                          editCaption(c.id, { start: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label>
                      End
                      <input
                        aria-label={`Caption ${i + 1} end`}
                        type="number"
                        min={0}
                        max={600}
                        step={0.1}
                        value={c.end}
                        onChange={(e) =>
                          editCaption(c.id, { end: Number(e.target.value) })
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Position
                    <select
                      aria-label={`Caption ${i + 1} position`}
                      value={c.position}
                      onChange={(e) =>
                        editCaption(c.id, { position: e.target.value })
                      }
                    >
                      {["top", "center", "bottom"].map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                  <div className="ve-fields">
                    <label>
                      Font size
                      <input
                        aria-label={`Caption ${i + 1} size`}
                        type="number"
                        min={16}
                        max={120}
                        value={c.size}
                        onChange={(e) =>
                          editCaption(c.id, { size: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label>
                      Color
                      <input
                        aria-label={`Caption ${i + 1} color`}
                        type="color"
                        value={c.color}
                        onChange={(e) =>
                          editCaption(c.id, { color: e.target.value })
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}
            </>
          )}
          {tab === "Audio" && (
            <>
              <p>
                Add a soundtrack. It loops to fit your montage and mixes with
                your clips.
              </p>
              <button
                className="ve-wide"
                onClick={() => fileRef.current.click()}
                disabled={uploading}
              >
                <Upload size={16} />
                Upload audio
              </button>
              <label>
                Soundtrack
                <select
                  aria-label="Soundtrack"
                  value={sound?.assetId || ""}
                  onChange={(e) =>
                    change((d) => ({
                      ...d,
                      soundtrack: e.target.value
                        ? { assetId: e.target.value, offset: 0, volume: 0.5 }
                        : null,
                    }))
                  }
                >
                  <option value="">No background music</option>
                  {media
                    .filter((m) => m.hasAudio)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </label>
              {sound && (
                <>
                  <label>
                    Music volume · {Math.round(sound.volume * 100)}%
                    <input
                      aria-label="Music volume"
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      value={sound.volume}
                      onChange={(e) =>
                        change((d) => ({
                          ...d,
                          soundtrack: {
                            ...d.soundtrack,
                            volume: Number(e.target.value),
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Start from source (seconds)
                    <input
                      aria-label="Music offset"
                      type="number"
                      min={0}
                      max={Math.max(0, (soundMedia?.duration || 0.1) - 0.1)}
                      step={0.1}
                      value={sound.offset}
                      onChange={(e) =>
                        change((d) => ({
                          ...d,
                          soundtrack: {
                            ...d.soundtrack,
                            offset: Number(e.target.value),
                          },
                        }))
                      }
                    />
                  </label>
                </>
              )}
              <small className="ve-hint">
                Use Clip controls to mute individual videos. Boost above 100% is
                applied in the export; browser preview may clamp the gain.
              </small>
            </>
          )}
          {tab === "Export" && (
            <>
              <p>
                Real server-rendered MP4. H.264 video + AAC audio, with every
                clip, trim, caption, and soundtrack included.
              </p>
              <label>
                Canvas format
                <select
                  aria-label="Video format"
                  value={`${document.width}x${document.height}`}
                  onChange={(e) => {
                    const [width, height] = e.target.value
                      .split("x")
                      .map(Number);
                    change((d) => ({ ...d, width, height }));
                  }}
                >
                  {[
                    [1280, 720, "Landscape · 720p"],
                    [1920, 1080, "Landscape · 1080p"],
                    [720, 1280, "Portrait · Stories / Reels"],
                    [1080, 1920, "Portrait · 1080p"],
                    [1080, 1080, "Square · Social"],
                    [640, 360, "Compact · 360p"],
                  ].map(([w, h, label]) => (
                    <option key={`${w}x${h}`} value={`${w}x${h}`}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Frame rate
                <select
                  aria-label="Frame rate"
                  value={document.fps}
                  onChange={(e) =>
                    change((d) => ({ ...d, fps: Number(e.target.value) }))
                  }
                >
                  <option value={24}>24 fps</option>
                  <option value={30}>30 fps</option>
                </select>
              </label>
              <button
                className="ve-primary ve-wide"
                disabled={
                  !document.clips.length ||
                  renderBusy ||
                  renderActive ||
                  uploading
                }
                onClick={render}
              >
                {renderBusy ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <Download size={17} />
                )}
                Render MP4 — free
              </button>
              <small className="ve-hint">
                {document.width} × {document.height} · {document.fps} fps ·{" "}
                {timecode(total)}
                <br />
                Up to 30 clips / 10 minutes. Latest 5 finished exports retained.
              </small>
              {job && (
                <div className={`ve-job ${job.status}`}>
                  <b>
                    {job.status === "completed"
                      ? "Your video is ready."
                      : job.status === "queued"
                        ? "Waiting in the render queue…"
                        : job.status === "rendering"
                          ? `Rendering… ${job.progress}%`
                          : job.status === "cancelled"
                            ? "Render cancelled"
                            : "Render failed"}
                  </b>
                  {renderActive && (
                    <>
                      <progress max={100} value={job.progress} />
                      <button
                        className="ve-wide"
                        onClick={() => {
                          requestRef.current = 0;
                          api("/video/jobs/" + job.id)
                            .then((r) => setJob(r.job))
                            .catch((e) => setMessage(e.message));
                        }}
                      >
                        Refresh render status
                      </button>
                      <button
                        className="ve-wide"
                        onClick={() =>
                          api("/video/jobs/" + job.id + "/cancel", {
                            method: "POST",
                          }).catch((e) => setMessage(e.message))
                        }
                      >
                        Cancel render
                      </button>
                    </>
                  )}
                  {job.error && <p>{job.error}</p>}
                  {job.status === "completed" && (
                    <a className="ve-primary" href={job.downloadUrl} download>
                      <Download size={16} />
                      Download MP4
                    </a>
                  )}
                </div>
              )}
            </>
          )}
        </aside>
        <section className="ve-workspace">
          <div className="ve-preview-info">
            <span>
              <Video size={14} /> {document.width} × {document.height}
            </span>
            <span>
              Preview · {activeMedia?.name || "Your next great story"}
            </span>
          </div>
          <div className="ve-stage" ref={stageRef}>
            <div
              className="ve-preview-frame"
              style={{ width: frameSize.width, height: frameSize.height }}
            >
              {activeMedia ? (
                <>
                  <video
                    ref={videoRef}
                    src={activeMedia.url}
                    playsInline
                    preload="auto"
                    style={{
                      objectFit: active?.fit,
                      opacity: active?.fade
                        ? Math.max(
                            0,
                            Math.min(
                              1,
                              (playhead - active.start) /
                                Math.min(
                                  active.fade,
                                  (active.end - active.start) / 2,
                                ),
                              (active.end - playhead) /
                                Math.min(
                                  active.fade,
                                  (active.end - active.start) / 2,
                                ),
                            ),
                          )
                        : 1,
                    }}
                    onLoadedMetadata={syncVideo}
                    onError={() =>
                      setMessage(
                        "This codec cannot be previewed in your browser. Try H.264 MP4 or WebM; the server may still be able to render it.",
                      )
                    }
                  />
                  {document.captions
                    .filter((c) => playhead >= c.start && playhead < c.end)
                    .map((c) => (
                      <div
                        key={c.id}
                        className={`ve-preview-caption ${c.position}`}
                        style={{
                          fontSize: (c.size * frameSize.width) / document.width,
                          color: c.color,
                        }}
                      >
                        {c.text}
                      </div>
                    ))}
                </>
              ) : (
                <div className="ve-start">
                  <Film size={42} />
                  <b>Your story starts here.</b>
                  <span>Upload a video and add it to the timeline.</span>
                  <button
                    onClick={() => fileRef.current.click()}
                    disabled={uploading}
                  >
                    <Plus size={15} />
                    Upload footage
                  </button>
                </div>
              )}
            </div>
          </div>
          {soundMedia && (
            <audio
              ref={audioRef}
              src={soundMedia.url}
              loop
              preload="auto"
              onLoadedMetadata={syncMusic}
            />
          )}
          <div className="ve-playback">
            <button
              title={playing ? "Pause video" : "Play video"}
              disabled={!document.clips.length}
              onClick={togglePlay}
            >
              {playing ? <Pause size={19} /> : <Play size={19} />}
            </button>
            <span>
              {timecode(playhead)} <i>/</i> {timecode(total)}
            </span>
            <input
              aria-label="Video playhead"
              type="range"
              min={0}
              max={Math.max(0.1, total)}
              step={0.01}
              value={Math.min(playhead, total)}
              disabled={!document.clips.length}
              onChange={(e) => seek(Number(e.target.value))}
            />
            <button
              title="Split selected clip"
              disabled={!selectedClip}
              onClick={split}
            >
              <Scissors size={17} />
            </button>
          </div>
          <div className="ve-timeline-tools">
            <span>
              <Film size={14} /> Your timeline{" "}
              <small>{document.clips.length} clips</small>
            </span>
            <div>
              <button
                title="Timeline zoom out"
                onClick={() => setPixels((p) => Math.max(20, p - 15))}
              >
                <ZoomOut size={15} />
              </button>
              <span>{pixels}px/s</span>
              <button
                title="Timeline zoom in"
                onClick={() => setPixels((p) => Math.min(150, p + 15))}
              >
                <ZoomIn size={15} />
              </button>
            </div>
          </div>
          <div className="ve-timeline-scroll">
            <div
              className="ve-timeline-track"
              ref={trackRef}
              style={{ width: Math.max(500, total * pixels + 80) }}
            >
              <div
                className="ve-ruler"
                onClick={(e) =>
                  seek(
                    (e.clientX -
                      trackRef.current.getBoundingClientRect().left) /
                      pixels,
                  )
                }
              >
                {Array.from(
                  { length: Math.ceil(Math.max(total, 10) / step) + 1 },
                  (_, i) => (
                    <span key={i} style={{ left: i * step * pixels }}>
                      {timecode(i * step)}
                    </span>
                  ),
                )}
              </div>
              <div
                className="ve-clips-lane"
                onClick={(e) => {
                  if (e.target === e.currentTarget)
                    seek(
                      (e.clientX -
                        trackRef.current.getBoundingClientRect().left) /
                        pixels,
                    );
                }}
              >
                {clips.map((c, i) => {
                  const asset = media.find((m) => m.id === c.assetId);
                  return (
                    <button
                      key={c.id}
                      draggable
                      className={`ve-timeline-clip ${selected === c.id ? "selected" : ""}`}
                      style={{
                        left: c.start * pixels,
                        width: Math.max(4, (c.end - c.start) * pixels - 3),
                      }}
                      onDragStart={(e) =>
                        e.dataTransfer.setData("text/plain", c.id)
                      }
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        reorder(e.dataTransfer.getData("text/plain"), i);
                      }}
                      onClick={(e) => {
                        setSelected(c.id);
                        setTab("Clip");
                        seek(
                          (e.clientX -
                            trackRef.current.getBoundingClientRect().left) /
                            pixels,
                        );
                      }}
                      aria-label={`Select clip ${i + 1}: ${asset?.name || "Video"}`}
                    >
                      <Film size={14} />
                      <span>{asset?.name || "Video"}</span>
                      <small>
                        {timecode(clipDuration(c))}{" "}
                        {c.speed !== 1 ? `· ${c.speed}×` : ""}
                      </small>
                    </button>
                  );
                })}
                {!document.clips.length && (
                  <button
                    className="ve-timeline-empty"
                    onClick={() => setTab("Media")}
                  >
                    <Plus size={17} />
                    Add your first clip from the media library
                  </button>
                )}
              </div>
              <div className="ve-audio-lane">
                {sound && (
                  <span style={{ width: Math.max(20, total * pixels) }}>
                    <Music size={13} />
                    {soundMedia?.name || "Soundtrack"} ·{" "}
                    {Math.round(sound.volume * 100)}%
                  </span>
                )}
                {!sound && (
                  <button onClick={() => setTab("Audio")}>
                    <Music size={13} />
                    Add a soundtrack
                  </button>
                )}
              </div>
              {document.captions.length > 0 && (
                <div className="ve-captions-lane">
                  {document.captions.map((c) => (
                    <button
                      key={c.id}
                      style={{
                        left: c.start * pixels,
                        width: Math.max(
                          5,
                          (Math.min(c.end, total) - c.start) * pixels,
                        ),
                      }}
                      onClick={() => {
                        setTab("Text");
                        seek(c.start);
                      }}
                      title={c.text}
                    >
                      <Type size={12} />
                      {c.text}
                    </button>
                  ))}
                </div>
              )}
              <div
                className="ve-playhead-line"
                style={{ left: Math.min(playhead, total) * pixels }}
              >
                <i />
              </div>
            </div>
          </div>
          <div className="ve-status" role="status">
            {message ||
              "Drag clips to reorder · Space to play/pause · Ctrl/Cmd S to save"}
          </div>
        </section>
      </div>
    </div>
  );
}
