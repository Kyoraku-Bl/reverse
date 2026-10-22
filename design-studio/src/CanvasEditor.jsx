import SelectionEditor from "./SelectionEditor";
import TemplatePreview from "./TemplatePreview";
import ShortcutHelp from "./ShortcutHelp";
import { isTyping, canvasShortcuts } from "./shortcuts";
import {
  imageSettings,
  cropSettings,
  setImageAdjustment,
  applyImagePreset,
  setImageCrop,
} from "./image-editing";
import { IS_STATIC, assetUrl } from "./config";
import React, { useState, useEffect, useRef } from "react";
import {
  Canvas,
  Shadow,
  Textbox,
  Rect,
  Circle,
  Triangle,
  Line,
  ActiveSelection,
  Group,
  FabricImage,
  PencilBrush,
  filters,
} from "fabric";

import {
  ArrowLeft,
  Check,
  Download,
  Undo2,
  Redo2,
  Type,
  Shapes,
  Image,
  Layers,
  Palette,
  Plus,
  Trash2,
  Copy,
  Lock,
  Unlock,
  ArrowUp,
  ArrowDown,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Group as GroupIcon,
  Ungroup,
  ZoomIn,
  ZoomOut,
  Maximize,
  Upload,
  Share2,
  History,
  FileJson,
  Pencil,
  LoaderCircle,
  X,
  Link,
  Save,
} from "lucide-react";
import { api, uploadAsset } from "./api";
import {
  documentFromTemplate,
  uid,
  validateImport,
  serializeCanvas,
} from "./design";
import "./editor.css";
const fonts = [
  "DM Sans",
  "Manrope",
  "Noto Sans Arabic",
  "Georgia",
  "Arial",
  "monospace",
];
const colors = [
  "#eee8dd",
  "#d6f281",
  "#b8d8db",
  "#e6c4ff",
  "#f2b7ac",
  "#b9c8ff",
  "#c9d7c0",
  "#ffffff",
  "#252e29",
];
export default function CanvasEditor({
  project,
  onSave,
  onClose,
  templates = [],
  brand,
  readOnly = false,
}) {
  const canvasEl = useRef(),
    fabric = useRef(),
    stage = useRef(),
    doc = useRef(project.document),
    record = useRef(project),
    pageRef = useRef(0),
    loading = useRef(true),
    histories = useRef({}),
    change = useRef(!readOnly && !project.revision ? 1 : 0),
    savedChange = useRef(0),
    savingRef = useRef(false),
    saveRef = useRef(),
    clipboard = useRef(),
    fileRef = useRef(),
    jsonRef = useRef(),
    replaceRef = useRef();
  const [ready, setReady] = useState(false),
    [shortcutHelp, setShortcutHelp] = useState(false),
    [tab, setTab] = useState(
      readOnly ? "Export" : project.style === "photo" ? "Edit" : "Design",
    ),
    [page, setPage] = useState(0),
    [pages, setPages] = useState(project.document?.pages || []),
    [title, setTitle] = useState(project.title),
    [dirty, setDirty] = useState(!readOnly && !project.revision),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [selected, setSelected] = useState(null),
    [objects, setObjects] = useState([]),
    [zoom, setZoom] = useState(0.5),
    [bg, setBg] = useState("#eee8dd"),
    [assets, setAssets] = useState([]),
    [versions, setVersions] = useState([]),
    [share, setShare] = useState(null),
    [drawing, setDrawing] = useState(false),
    [exportFormat, setExportFormat] = useState("png"),
    [exportScale, setExportScale] = useState(1),
    [historyTick, setHistoryTick] = useState(0);
  const feedback = (message) => setStatus(message);
  const refreshSelection = () => {
    const c = fabric.current;
    if (!c) return;
    const o = c.getActiveObject();
    setSelected(
      o
        ? {
            type: o.type,
            fill: typeof o.fill === "string" ? o.fill : "#29352b",
            fontSize: o.fontSize || 40,
            fontFamily: o.fontFamily || "DM Sans",
            fontWeight: o.fontWeight,
            fontStyle: o.fontStyle,
            textAlign: o.textAlign,
            opacity: o.opacity ?? 1,
            angle: o.angle || 0,
            left: Math.round(o.left),
            top: Math.round(o.top),
            text: o.text || "",
            charSpacing: o.charSpacing || 0,
            lineHeight: o.lineHeight || 1.16,
            underline: !!o.underline,
            linethrough: !!o.linethrough,
            width: o.width * Math.abs(o.scaleX),
            height: o.height * Math.abs(o.scaleY),
            nativeWidth: o.width || 1,
            nativeHeight: o.height || 1,
            flipX: !!o.flipX,
            flipY: !!o.flipY,
            stroke: o.stroke,
            strokeWidth: o.strokeWidth || 0,
            shadow: !!o.shadow,
            rx: o.rx || 0,
            ...(o instanceof FabricImage
              ? { image: imageSettings(o), crop: cropSettings(o) }
              : {}),
            locked: !!o.lockMovementX,
          }
        : null,
    );
    setObjects(
      [...c.getObjects()].reverse().map((o, i) => ({
        object: o,
        index: c.getObjects().length - i - 1,
        label: o.text?.slice(0, 25) || o.type,
        locked: !!o.lockMovementX,
        active: o === c.getActiveObject(),
      })),
    );
  };
  const snapshot = () => serializeCanvas(fabric.current);
  const commit = () => {
    if (loading.current || readOnly || !fabric.current || !doc.current) return;
    const json = snapshot();
    const p = doc.current.pages[pageRef.current];
    p.canvas = json;
    const h = histories.current[p.id] || { entries: [], index: -1 };
    if (JSON.stringify(h.entries[h.index]) !== JSON.stringify(json)) {
      h.entries = h.entries.slice(0, h.index + 1);
      h.entries.push(structuredClone(json));
      if (h.entries.length > 60) h.entries.shift();
      h.index = h.entries.length - 1;
      histories.current[p.id] = h;
    }
    change.current++;
    setDirty(true);
    setBg(
      typeof fabric.current.backgroundColor === "string"
        ? fabric.current.backgroundColor
        : "#ffffff",
    );
    refreshSelection();
    setHistoryTick((n) => n + 1);
  };
  const loadPage = async (index) => {
    const c = fabric.current;
    if (!c || !doc.current) return;
    loading.current = true;
    try {
      c.discardActiveObject();
      await c.loadFromJSON(doc.current.pages[index].canvas);
      c.setDimensions({ width: doc.current.width, height: doc.current.height });
      c.setDimensions(
        { width: doc.current.width * zoom, height: doc.current.height * zoom },
        { cssOnly: true },
      );
      if (readOnly)
        c.getObjects().forEach((o) =>
          o.set({ selectable: false, evented: false }),
        );
      c.renderAll();
      pageRef.current = index;
      setPage(index);
      setBg(
        typeof c.backgroundColor === "string" ? c.backgroundColor : "#ffffff",
      );
      const id = doc.current.pages[index].id;
      if (!histories.current[id])
        histories.current[id] = { entries: [snapshot()], index: 0 };
      refreshSelection();
      setHistoryTick((n) => n + 1);
    } finally {
      loading.current = false;
    }
  };
  useEffect(() => {
    let cancelled = false;
    const c = new Canvas(canvasEl.current, {
      preserveObjectStacking: true,
      selection: !readOnly,
      backgroundColor: "#eee8dd",
      enableRetinaScaling: true,
    });
    fabric.current = c;
    const init = async () => {
      try {
        await Promise.all([
          document.fonts.load('400 40px "DM Sans"'),
          document.fonts.load('700 40px "Manrope"'),
        ]);
        if (!doc.current) doc.current = await documentFromTemplate(project);
        if (cancelled) return;
        setPages([...doc.current.pages]);
        await loadPage(0);
        if (cancelled) return;
        setReady(true);
        fit();
        if (project.style === "photo" && !readOnly) {
          c.setActiveObject(c.getObjects()[0]);
          refreshSelection();
        }
      } catch (e) {
        feedback("Could not load this design: " + e.message);
      }
    };
    init();
    c.on("object:modified", commit);
    c.on("object:added", commit);
    c.on("object:removed", commit);
    c.on("text:editing:exited", commit);
    c.on("path:created", commit);
    c.on("selection:created", refreshSelection);
    c.on("selection:updated", refreshSelection);
    c.on("selection:cleared", refreshSelection);
    return () => {
      cancelled = true;
      loading.current = true;
      fabric.current = null;
      void c.dispose();
    };
  }, []);
  const fit = () => {
    if (!stage.current || !doc.current) return;
    const r = stage.current.getBoundingClientRect();
    setZoom(
      Math.max(
        0.04,
        Math.min(
          (r.width - 70) / doc.current.width,
          (r.height - 90) / doc.current.height,
          1,
        ),
      ),
    );
  };
  useEffect(() => {
    if (!ready) return;
    const observer = new ResizeObserver(fit);
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, [ready]);
  useEffect(() => {
    if (!ready || !fabric.current) return;
    fabric.current.setDimensions(
      { width: doc.current.width * zoom, height: doc.current.height * zoom },
      { cssOnly: true },
    );
    fabric.current.requestRenderAll();
  }, [zoom, ready]);
  useEffect(() => {
    if (!ready || readOnly || busy || loading.current) return;
    const id = setInterval(() => {
      if (
        change.current !== savedChange.current &&
        !savingRef.current &&
        !loading.current
      )
        saveRef.current?.(true);
    }, 15000);
    return () => clearInterval(id);
  }, [ready, readOnly]);
  useEffect(() => {
    const warn = (e) => {
      if (change.current !== savedChange.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  useEffect(() => {
    if (readOnly) return;
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!busy && !loading.current && ready && !shortcutHelp) {
          const active = fabric.current?.getActiveObject();
          if (active?.isEditing) active.exitEditing();
          saveRef.current?.();
        }
        return;
      }
      if (
        busy ||
        loading.current ||
        !ready ||
        shortcutHelp ||
        isTyping(e.target) ||
        fabric.current?.getActiveObject()?.isEditing
      )
        return;
      const mod = e.ctrlKey || e.metaKey,
        key = e.key.toLowerCase(),
        c = fabric.current;
      const actions = {
        s: () => saveRef.current?.(),
        z: () => undo(e.shiftKey ? 1 : -1),
        y: () => undo(1),
        d: duplicate,
        c: copy,
        x: cut,
        v: paste,
        g: group,
        b: () =>
          update({ fontWeight: selected?.fontWeight === 700 ? "normal" : 700 }),
        i: () =>
          update({
            fontStyle: selected?.fontStyle === "italic" ? "normal" : "italic",
          }),
        u: () => update({ underline: !selected?.underline }),
        l: () =>
          mutate((c) =>
            c.getActiveObjects().forEach((o) =>
              o.set({
                lockMovementX: !o.lockMovementX,
                lockMovementY: !o.lockMovementX,
                lockScalingX: !o.lockMovementX,
                lockScalingY: !o.lockMovementX,
                lockRotation: !o.lockMovementX,
              }),
            ),
          ),
        a: () => {
          c.discardActiveObject();
          const all = c.getObjects().filter((o) => !o.lockMovementX);
          if (all.length)
            c.setActiveObject(new ActiveSelection(all, { canvas: c }));
          c.requestRenderAll();
          refreshSelection();
        },
        "]": () =>
          mutate((c) =>
            c.getActiveObjects().forEach((o) => c.bringObjectForward(o)),
          ),
        "[": () =>
          mutate((c) =>
            c.getActiveObjects().forEach((o) => c.sendObjectBackwards(o)),
          ),
      };
      if (mod) {
        if (key === "v" && !clipboard.current) return;
        if (actions[key]) {
          e.preventDefault();
          Promise.resolve(actions[key]()).catch((e) => feedback(e.message));
        }
        return;
      }
      if (e.altKey) return;
      if (["Delete", "Backspace"].includes(e.key)) {
        e.preventDefault();
        remove();
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        mutate((c) => {
          const o = c.getActiveObject();
          if (o && !o.lockMovementX) {
            o.set({
              left:
                o.left +
                (e.key === "ArrowRight"
                  ? step
                  : e.key === "ArrowLeft"
                    ? -step
                    : 0),
              top:
                o.top +
                (e.key === "ArrowDown"
                  ? step
                  : e.key === "ArrowUp"
                    ? -step
                    : 0),
            });
            o.setCoords();
          }
        });
      } else if (key === "escape") {
        c.discardActiveObject();
        c.isDrawingMode = false;
        setDrawing(false);
        c.requestRenderAll();
        refreshSelection();
      } else if (["t", "r", "o"].includes(key)) {
        e.preventDefault();
        add({ t: "text", r: "rectangle", o: "circle" }[key]);
      } else if (["+", "=", "-", "0"].includes(key)) {
        e.preventDefault();
        if (key === "0") fit();
        else
          setZoom((z) =>
            Math.max(0.04, Math.min(2, z + (key === "-" ? -0.1 : 0.1))),
          );
      } else if (key === "?") setShortcutHelp(true);
    };
    const pasted = (e) => {
      if (
        busy ||
        loading.current ||
        !ready ||
        shortcutHelp ||
        isTyping(e.target) ||
        fabric.current?.getActiveObject()?.isEditing
      )
        return;
      const file = [...(e.clipboardData?.files || [])].find((f) =>
        ["image/png", "image/jpeg", "image/webp"].includes(f.type),
      );
      if (file) {
        e.preventDefault();
        void upload({ target: { files: [file], value: "" } });
      }
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("paste", pasted);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("paste", pasted);
    };
  });
  async function save(automatic = false) {
    if (savingRef.current || loading.current || !ready) return null;
    savingRef.current = true;
    setBusy(true);
    const version = change.current;
    try {
      doc.current.pages[pageRef.current].canvas = snapshot();
      const saved = await onSave({
        ...record.current,
        title: title.trim() || "Untitled design",
        document: structuredClone(doc.current),
        meta: {
          ...(record.current.meta || {
            style: record.current.style || "ideas",
            text: record.current.text || "",
            sub: record.current.sub || "",
            color: record.current.color || "#eee8dd",
            type: record.current.type || "Design",
            detail: record.current.detail || "Design",
          }),
          thumbnail: fabric.current.toDataURL({
            format: "jpeg",
            quality: 0.7,
            multiplier: Math.min(
              360 / doc.current.width,
              240 / doc.current.height,
            ),
          }),
        },
      });
      record.current = saved;
      savedChange.current = version;
      setDirty(change.current !== version);
      feedback(
        automatic
          ? "Automatically saved"
          : IS_STATIC
            ? "Saved on this device"
            : "Saved to your account",
      );
      return saved;
    } catch (e) {
      feedback(e.message);
      return null;
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  }
  saveRef.current = save;
  function mutate(action) {
    if (!ready || readOnly || busy || loading.current) return;
    loading.current = true;
    try {
      action(fabric.current);
    } finally {
      loading.current = false;
      fabric.current.requestRenderAll();
      commit();
    }
  }
  function add(kind) {
    if (!ready || busy || loading.current) return;
    const d = doc.current;
    const common = {
      originX: "left",
      originY: "top",
      left: d.width * 0.2,
      top: d.height * 0.2,
      fill: "#8770b7",
    };
    mutate((c) => {
      let o;
      if (kind === "text")
        o = new Textbox("Your brilliant idea", {
          ...common,
          width: d.width * 0.6,
          fontFamily: "DM Sans",
          fontSize: Math.round(d.width * 0.06),
          fill: "#29352b",
        });
      else if (kind === "circle")
        o = new Circle({ ...common, radius: d.width * 0.12 });
      else if (kind === "triangle")
        o = new Triangle({
          ...common,
          width: d.width * 0.26,
          height: d.height * 0.3,
        });
      else if (kind === "line")
        o = new Line([0, 0, d.width * 0.4, 0], {
          ...common,
          stroke: "#8770b7",
          strokeWidth: 8,
        });
      else
        o = new Rect({
          ...common,
          width: d.width * 0.3,
          height: d.height * 0.3,
          rx: kind === "rounded" ? 30 : 0,
          ry: kind === "rounded" ? 30 : 0,
        });
      c.add(o);
      c.setActiveObject(o);
    });
  }
  function update(props) {
    mutate((c) => {
      const active = c.getActiveObject();
      if (!active || active.lockMovementX) return;
      const geometry = [
        "left",
        "top",
        "scaleX",
        "scaleY",
        "angle",
        "flipX",
        "flipY",
      ];
      const targets = Object.keys(props).some((key) => geometry.includes(key))
        ? [active]
        : c.getActiveObjects();
      targets
        .filter((o) => !o.lockMovementX)
        .forEach((o) => {
          o.set(props);
          o.setCoords();
        });
    });
  }
  function remove() {
    mutate((c) => {
      c.getActiveObjects().forEach((o) => {
        if (!o.lockMovementX) c.remove(o);
      });
      c.discardActiveObject();
    });
  }
  function copy() {
    const o = fabric.current?.getActiveObject();
    if (o) clipboard.current = o.clone();
  }
  function cut() {
    if (!fabric.current?.getActiveObject()) return;
    if (fabric.current?.getActiveObjects().some((o) => o.lockMovementX)) {
      feedback("Unlock selected layers before cutting.");
      return;
    }
    copy();
    remove();
  }
  async function paste() {
    if (!clipboard.current) return;
    const source = await clipboard.current;
    const clone = await source.clone();
    mutate((c) => {
      if (
        c.getObjects().length +
          (clone instanceof ActiveSelection ? clone.size() : 1) >
        300
      ) {
        feedback("A page supports up to 300 objects.");
        return;
      }
      clone.set({ left: clone.left + 25, top: clone.top + 25 });
      c.discardActiveObject();
      if (clone instanceof ActiveSelection) {
        clone.canvas = c;
        clone.forEachObject((o) => c.add(o));
      } else c.add(clone);
      c.setActiveObject(clone);
      clone.setCoords();
    });
    clipboard.current = clone.clone();
  }
  async function duplicate() {
    if (!fabric.current?.getActiveObject()) return;
    copy();
    await paste();
  }
  function alignObject(direction) {
    mutate((c) =>
      c
        .getActiveObjects()
        .filter((o) => !o.lockMovementX)
        .forEach((o) => {
          const b = o.getBoundingRect();
          const dx =
            direction === "left"
              ? -b.left
              : direction === "center"
                ? (doc.current.width - b.width) / 2 - b.left
                : direction === "right"
                  ? doc.current.width - b.left - b.width
                  : 0;
          const dy =
            direction === "top"
              ? -b.top
              : direction === "middle"
                ? (doc.current.height - b.height) / 2 - b.top
                : direction === "bottom"
                  ? doc.current.height - b.top - b.height
                  : 0;
          o.set({ left: o.left + dx, top: o.top + dy });
          o.setCoords();
        }),
    );
  }
  function editImage(key, value) {
    mutate((c) => {
      const o = c.getActiveObject();
      if (!(o instanceof FabricImage) || o.lockMovementX) return;
      if (key === "preset") applyImagePreset(o, value);
      else setImageAdjustment(o, key, value);
    });
  }
  function cropImage(patch) {
    try {
      mutate((c) => {
        const o = c.getActiveObject();
        if (o instanceof FabricImage && !o.lockMovementX)
          setImageCrop(o, patch);
      });
    } catch (e) {
      feedback(e.message);
    }
  }
  function downloadPhoto() {
    const o = fabric.current?.getActiveObject();
    if (!(o instanceof FabricImage)) return;
    try {
      const bounds = o.getBoundingRect();
      const data = o.toDataURL({
        format: "png",
        multiplier: Math.min(1, 4096 / Math.max(bounds.width, bounds.height)),
      });
      const a = document.createElement("a");
      a.href = data;
      a.download =
        (title || "Photo").replace(/[\\/:*?"<>|]/g, "-") + "-edited.png";
      a.click();
      feedback(
        "Edited photo downloaded — crop and filters included, without the page margins.",
      );
    } catch (e) {
      feedback(e.message);
    }
  }
  async function replaceImage(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const o = fabric.current?.getActiveObject();
    if (!file || !(o instanceof FabricImage) || o.lockMovementX || busy) return;
    const old = {
      src: o.getSrc(),
      width: o.width,
      height: o.height,
      cropX: o.cropX,
      cropY: o.cropY,
      scaleX: o.scaleX,
      scaleY: o.scaleY,
    };
    setBusy(true);
    loading.current = true;
    try {
      const asset = await uploadAsset(file);
      await o.setSrc(asset.url);
      if (o.width * o.height > 40000000)
        throw new Error("Image dimensions are too large");
      o.set({
        cropX: 0,
        cropY: 0,
        scaleX: (old.width * old.scaleX) / o.width,
        scaleY: (old.height * old.scaleY) / o.height,
      });
      o.setCoords();
      o.applyFilters();
    } catch (error) {
      await o.setSrc(old.src);
      o.set(old);
      feedback(error.message);
    } finally {
      loading.current = false;
      setBusy(false);
      fabric.current?.requestRenderAll();
      commit();
    }
  }
  async function undo(direction) {
    const p = doc.current?.pages[pageRef.current];
    const h = histories.current[p?.id];
    if (
      !h ||
      h.index + direction < 0 ||
      h.index + direction >= h.entries.length ||
      loading.current
    )
      return;
    h.index += direction;
    loading.current = true;
    try {
      await fabric.current.loadFromJSON(structuredClone(h.entries[h.index]));
      fabric.current.renderAll();
      p.canvas = snapshot();
      change.current++;
      setDirty(true);
      refreshSelection();
      setHistoryTick((n) => n + 1);
    } finally {
      loading.current = false;
    }
  }
  async function switchPage(index) {
    if (loading.current || index === pageRef.current) return;
    doc.current.pages[pageRef.current].canvas = snapshot();
    try {
      await loadPage(index);
    } catch (e) {
      feedback(e.message);
    }
  }
  async function addPage(duplicateCurrent = false) {
    if (!ready || busy || loading.current) return;
    if (doc.current.pages.length >= 50) {
      feedback("This document supports up to 50 pages");
      return;
    }
    doc.current.pages[pageRef.current].canvas = snapshot();
    const p = {
      id: uid(),
      canvas: duplicateCurrent
        ? structuredClone(snapshot())
        : { objects: [], background: "#ffffff" },
    };
    doc.current.pages.push(p);
    setPages([...doc.current.pages]);
    await loadPage(doc.current.pages.length - 1);
    change.current++;
    setDirty(true);
  }
  async function deletePage() {
    if (!ready || busy || loading.current) return;
    if (doc.current.pages.length === 1) return;
    doc.current.pages.splice(pageRef.current, 1);
    setPages([...doc.current.pages]);
    await loadPage(Math.min(pageRef.current, doc.current.pages.length - 1));
    change.current++;
    setDirty(true);
  }
  async function applyTemplate(t) {
    if (!ready || busy || loading.current) return;
    if (
      !window.confirm(
        "Replace the current page with this template? Other pages will stay unchanged.",
      )
    )
      return;
    try {
      const next = await documentFromTemplate({
        ...t,
        width: doc.current.width,
        height: doc.current.height,
      });
      loading.current = true;
      await fabric.current.loadFromJSON(next.pages[0].canvas);
      fabric.current.renderAll();
      loading.current = false;
      commit();
    } catch (error) {
      feedback("Could not load template: " + error.message);
    } finally {
      loading.current = false;
    }
  }
  async function loadAssets() {
    try {
      setAssets((await api("/assets")).assets);
    } catch (e) {
      feedback(e.message);
    }
  }
  async function addImage(asset) {
    try {
      const image = await FabricImage.fromURL(asset.url);
      if (image.width * image.height > 40000000)
        throw new Error("Image dimensions are too large");
      const ratio = Math.min(
        (doc.current.width * 0.7) / image.width,
        (doc.current.height * 0.7) / image.height,
        1,
      );
      mutate((c) => {
        image.set({
          originX: "left",
          originY: "top",
          left: doc.current.width * 0.12,
          top: doc.current.height * 0.12,
          scaleX: ratio,
          scaleY: ratio,
        });
        c.add(image);
        c.setActiveObject(image);
      });
    } catch (e) {
      feedback(e.message);
    }
  }
  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const asset = await uploadAsset(file);
      await loadAssets();
      await addImage(asset);
    } catch (e) {
      feedback(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function group() {
    mutate((c) => {
      const active = c.getActiveObject();
      if (active instanceof ActiveSelection) {
        const items = active.getObjects();
        c.discardActiveObject();
        items.forEach((o) => c.remove(o));
        const g = new Group(items);
        c.add(g);
        c.setActiveObject(g);
      } else if (active instanceof Group) {
        const items = active.removeAll();
        c.remove(active);
        items.forEach((o) => c.add(o));
        c.setActiveObject(new ActiveSelection(items, { canvas: c }));
      }
    });
  }
  const downloadBlob = (blob, name) => {
    const a = document.createElement("a"),
      url = URL.createObjectURL(blob);
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  async function exportDesign() {
    if (!ready) return;
    setBusy(true);
    try {
      await document.fonts.ready;
      doc.current.pages[pageRef.current].canvas = snapshot();
      const name = (title || "My design").replace(/[\\/:*?"<>|]/g, "-");
      const c = fabric.current;
      if (exportFormat === "json") {
        downloadBlob(
          new Blob([JSON.stringify(doc.current, null, 2)], {
            type: "application/json",
          }),
          name + ".studio.json",
        );
      } else if (exportFormat === "pdf") {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({
          orientation:
            doc.current.width > doc.current.height ? "landscape" : "portrait",
          unit: "px",
          format: [doc.current.width, doc.current.height],
          hotfixes: ["px_scaling"],
        });
        loading.current = true;
        try {
          for (let i = 0; i < doc.current.pages.length; i++) {
            await c.loadFromJSON(doc.current.pages[i].canvas);
            c.renderAll();
            if (i)
              pdf.addPage(
                [doc.current.width, doc.current.height],
                doc.current.width > doc.current.height
                  ? "landscape"
                  : "portrait",
              );
            pdf.addImage(
              c.toDataURL({ format: "png", multiplier: 1 }),
              "PNG",
              0,
              0,
              doc.current.width,
              doc.current.height,
            );
          }
          pdf.save(name + ".pdf");
        } finally {
          await c.loadFromJSON(doc.current.pages[pageRef.current].canvas);
          c.renderAll();
          loading.current = false;
          refreshSelection();
        }
      } else if (exportFormat === "svg") {
        let svg = c.toSVG();
        const allImages = (objects) =>
          objects.flatMap((o) =>
            o instanceof FabricImage
              ? [o]
              : o instanceof Group
                ? allImages(o.getObjects())
                : [],
          );
        for (const img of allImages(c.getObjects())) {
          const src = img.getSrc();
          if (src && new URL(src, location.origin).origin === location.origin) {
            const response = await fetch(src);
            if (!response.ok) throw new Error("An image could not be exported");
            const blob = await response.blob();
            const data = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
            svg = svg.split(src.replaceAll("&", "&amp;")).join(data);
          }
        }
        const embeddedFonts = await Promise.all(
          ["DMSans", "Manrope"].map(async (name) => {
            const blob = await (
              await fetch(assetUrl("fonts/" + name + ".ttf"))
            ).blob();
            const data = await new Promise((resolve) => {
              const r = new FileReader();
              r.onload = () => resolve(r.result);
              r.readAsDataURL(blob);
            });
            return `@font-face{font-family:'${name === "DMSans" ? "DM Sans" : "Manrope"}';src:url('${data}');font-weight:100 1000;}`;
          }),
        );
        let arabicCss = await (
          await fetch(assetUrl("fonts/generated/noto.css"))
        ).text();
        for (const [, file] of [
          ...arabicCss.matchAll(/url\(\.\/([^\)]+)\)/g),
        ]) {
          const blob = await (
            await fetch(assetUrl("fonts/generated/" + file))
          ).blob();
          const data = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          arabicCss = arabicCss.replace(
            "url(./" + file + ")",
            "url('" + data + "')",
          );
        }
        embeddedFonts.push(arabicCss);
        svg = svg.replace(
          "<defs>",
          "<defs><style>" + embeddedFonts.join("") + "</style>",
        );
        downloadBlob(new Blob([svg], { type: "image/svg+xml" }), name + ".svg");
      } else {
        const scale = Math.min(
          exportScale,
          4096 / Math.max(doc.current.width, doc.current.height),
        );
        const data = c.toDataURL({
          format: exportFormat === "jpg" ? "jpeg" : "png",
          quality: 1,
          multiplier: scale,
        });
        const [header, encoded] = data.split(",");
        const bytes = Uint8Array.from(atob(encoded), (char) =>
          char.charCodeAt(0),
        );
        const blob = new Blob([bytes], {
          type: header.match(/data:([^;]+)/)[1],
        });
        downloadBlob(blob, name + "." + exportFormat);
      }
      feedback("Export complete — no watermark.");
    } catch (e) {
      feedback("Export failed: " + e.message);
    } finally {
      setBusy(false);
    }
  }
  async function showVersions() {
    setTab("History");
    if (!record.current.revision) {
      setVersions([]);
      return;
    }
    try {
      setVersions(
        (await api("/projects/" + record.current.id + "/versions")).versions,
      );
    } catch (e) {
      feedback(e.message);
    }
  }
  async function replaceDocument(next, nextTitle = title) {
    const previous = doc.current,
      previousPage = pageRef.current,
      previousHistories = histories.current;
    previous.pages[previousPage].canvas = snapshot();
    doc.current = next;
    histories.current = {};
    try {
      await loadPage(0);
      setPages([...next.pages]);
      setTitle(nextTitle);
      fit();
      change.current++;
      setDirty(true);
    } catch (error) {
      doc.current = previous;
      histories.current = previousHistories;
      await loadPage(previousPage);
      setPages([...previous.pages]);
      fit();
      throw error;
    }
  }
  async function restoreVersion(id) {
    if (
      !window.confirm(
        "Load this older version? Save to keep it as a new revision.",
      )
    )
      return;
    try {
      const v = await api(`/projects/${record.current.id}/versions/${id}`);
      await replaceDocument(validateImport(v.document), v.title);
      feedback("Version loaded. Save to keep your changes.");
    } catch (e) {
      feedback(e.message);
    }
  }
  async function shareDesign() {
    try {
      const saved = await save();
      if (!saved) return;
      if (IS_STATIC) {
        downloadBlob(
          new Blob([JSON.stringify(doc.current)], { type: "application/json" }),
          title + ".json",
        );
        feedback(
          "Design file downloaded. Use workspace backup to transfer all projects and media.",
        );
        return;
      }
      const s = await api(`/projects/${record.current.id}/share`, {
        method: "POST",
      });
      setShare(location.origin + "/?share=" + s.token);
    } catch (e) {
      feedback(e.message);
    }
  }
  async function importJson(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      feedback("Choose a design file under 5 MB");
      return;
    }
    try {
      const imported = validateImport(JSON.parse(await file.text()));
      if (!window.confirm("Replace this document with the imported design?"))
        return;
      await replaceDocument(imported);
    } catch (e) {
      feedback(e.message);
    }
  }
  function close() {
    if (
      !readOnly &&
      dirty &&
      !window.confirm("Close without saving your latest changes?")
    )
      return;
    onClose();
  }
  const h = histories.current[doc.current?.pages[page]?.id];
  return (
    <div className={`real-editor ${readOnly ? "is-readonly" : ""}`}>
      <input
        ref={fileRef}
        aria-label="Upload design image"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={upload}
      />
      <input
        ref={jsonRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={importJson}
      />
      <input
        ref={replaceRef}
        aria-label="Replace image file"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={replaceImage}
      />
      {shortcutHelp && (
        <ShortcutHelp
          shortcuts={canvasShortcuts}
          onClose={() => setShortcutHelp(false)}
        />
      )}
      <header className="re-header">
        <button className="re-home" onClick={close} title="Back to workspace">
          <ArrowLeft size={19} />
          <span>Open Studio</span>
        </button>
        <input
          aria-label="Design title"
          value={title}
          disabled={readOnly}
          onChange={(e) => {
            setTitle(e.target.value);
            change.current++;
            setDirty(true);
          }}
          maxLength={150}
        />
        <button
          title="Keyboard shortcuts (?)"
          onClick={() => setShortcutHelp(true)}
        >
          Shortcuts
        </button>
        <span className="re-save-state">
          {busy ? "Working…" : dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        {!readOnly && (
          <>
            <button
              disabled={busy || !ready}
              onClick={() => save()}
              className="re-save"
            >
              <Save size={16} />
              Save
            </button>
            <button disabled={busy || !ready} onClick={shareDesign}>
              <Share2 size={16} />
              <span>{IS_STATIC ? "Design file" : "Share"}</span>
            </button>
          </>
        )}
        <button
          disabled={busy || !ready}
          className="re-primary"
          onClick={() => setTab("Export")}
        >
          <Download size={16} />
          <span>Export</span>
        </button>
      </header>
      <div className="re-body" inert={busy || !ready ? true : undefined}>
        {!readOnly && (
          <nav className="re-rail">
            {[
              { label: "Design", icon: Shapes },
              { label: "Edit", icon: Pencil },
              { label: "Text", icon: Type },
              { label: "Elements", icon: Shapes },
              { label: "Uploads", icon: Image },
              { label: "Layers", icon: Layers },
              { label: "Color", icon: Palette },
              { label: "Draw", icon: Pencil },
              { label: "History", icon: History },
            ].map(({ label, icon: Icon }) => (
              <button
                key={label}
                className={tab === label ? "active" : ""}
                onClick={() => {
                  setTab(label);
                  if (label === "Uploads") loadAssets();
                  if (label === "History") showVersions();
                }}
              >
                <Icon size={21} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        )}
        <aside className="re-panel">
          <div className="re-panel-heading">
            <h2>{tab === "Export" ? "Your design, everywhere." : tab}</h2>
            <span className="free-badge">FREE</span>
          </div>
          {!ready ? (
            <p>Preparing your canvas…</p>
          ) : (
            <>
              {tab === "Design" && !readOnly && (
                <>
                  <p>A starting point, not a limit.</p>
                  <div className="re-template-list">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        style={{ background: t.color }}
                        onClick={() => applyTemplate(t)}
                      >
                        {t.style === "original" ? (
                          <TemplatePreview item={t} />
                        ) : (
                          <span>{t.text}</span>
                        )}
                        <small>{t.title}</small>
                      </button>
                    ))}
                  </div>
                  <button
                    className="re-wide"
                    onClick={() => jsonRef.current.click()}
                  >
                    <FileJson size={16} />
                    Import design JSON
                  </button>
                </>
              )}
              {tab === "Edit" && !readOnly && (
                <SelectionEditor
                  selected={selected}
                  update={update}
                  align={alignObject}
                  imageEdit={editImage}
                  crop={cropImage}
                  replaceImage={() => replaceRef.current.click()}
                  resetImage={() => editImage("preset", "original")}
                  downloadPhoto={downloadPhoto}
                  shadow={(value) =>
                    update({
                      shadow:
                        value === "none"
                          ? null
                          : new Shadow({
                              color: "rgba(0,0,0,0.25)",
                              blur: 18,
                              offsetX: 6,
                              offsetY: 8,
                            }),
                    })
                  }
                  group={group}
                />
              )}
              {tab === "Text" && !readOnly && (
                <>
                  <p>
                    Double-click any text on the canvas to edit it directly.
                  </p>
                  <button className="re-wide" onClick={() => add("text")}>
                    <Plus size={17} />
                    Add a text box
                  </button>
                  {selected?.type?.includes("text") && (
                    <>
                      <label>
                        Font family
                        <select
                          value={selected.fontFamily}
                          onChange={(e) =>
                            update({ fontFamily: e.target.value })
                          }
                        >
                          {fonts.map((f) => (
                            <option key={f}>{f}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Font size
                        <input
                          type="number"
                          min={6}
                          max={1000}
                          value={selected.fontSize}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (n >= 6 && n <= 1000) update({ fontSize: n });
                          }}
                        />
                      </label>
                      <div className="re-button-row">
                        <button
                          title="Bold"
                          className={
                            selected.fontWeight === "bold" ? "active" : ""
                          }
                          onClick={() =>
                            update({
                              fontWeight:
                                selected.fontWeight === "bold"
                                  ? "normal"
                                  : "bold",
                            })
                          }
                        >
                          <Bold size={18} />
                        </button>
                        <button
                          title="Italic"
                          onClick={() =>
                            update({
                              fontStyle:
                                selected.fontStyle === "italic"
                                  ? "normal"
                                  : "italic",
                            })
                          }
                        >
                          <Italic size={18} />
                        </button>
                        {[
                          { value: "left", icon: AlignLeft },
                          { value: "center", icon: AlignCenter },
                          { value: "right", icon: AlignRight },
                        ].map(({ value, icon: Icon }) => (
                          <button
                            key={value}
                            title={`Align ${value}`}
                            onClick={() => update({ textAlign: value })}
                          >
                            <Icon size={18} />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
              {tab === "Elements" && !readOnly && (
                <>
                  <p>
                    Add shapes, then move, resize, and rotate them on your
                    canvas.
                  </p>
                  <div className="re-shapes">
                    {["rectangle", "rounded", "circle", "triangle", "line"].map(
                      (s) => (
                        <button key={s} onClick={() => add(s)}>
                          <span className={"shape-" + s} />
                          <small>{s}</small>
                        </button>
                      ),
                    )}
                  </div>
                  <button
                    className="re-wide"
                    onClick={group}
                    disabled={!selected}
                  >
                    <GroupIcon size={16} />
                    Group / ungroup selection
                  </button>
                </>
              )}
              {tab === "Uploads" && !readOnly && (
                <>
                  <p>
                    PNG, JPEG, WebP · up to 10 MB. Your images are private to
                    {IS_STATIC ? "this browser." : "your account."}
                  </p>
                  <button
                    className="re-wide"
                    disabled={busy}
                    onClick={() => fileRef.current.click()}
                  >
                    <Upload size={16} />
                    Upload an image
                  </button>
                  <div className="re-assets">
                    {assets.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => addImage(a)}
                        title={a.name}
                      >
                        <img src={a.url} alt={a.name} />
                      </button>
                    ))}
                  </div>
                  {selected?.type === "image" && (
                    <button
                      className="re-primary re-wide"
                      onClick={() => setTab("Edit")}
                    >
                      Edit selected photo
                    </button>
                  )}
                </>
              )}
              {tab === "Layers" && !readOnly && (
                <>
                  <p>Top of the list = front of your design.</p>
                  <div className="re-layers">
                    {objects.map(({ object, index, label, locked, active }) => (
                      <div className={active ? "active" : ""} key={index}>
                        <button
                          onClick={() => {
                            fabric.current.setActiveObject(object);
                            fabric.current.requestRenderAll();
                            refreshSelection();
                          }}
                        >
                          {label}
                        </button>
                        <button
                          title={locked ? "Unlock layer" : "Lock layer"}
                          onClick={() =>
                            mutate(() =>
                              object.set({
                                lockMovementX: !locked,
                                lockMovementY: !locked,
                                lockRotation: !locked,
                                lockScalingX: !locked,
                                lockScalingY: !locked,
                              }),
                            )
                          }
                        >
                          {locked ? <Lock size={14} /> : <Unlock size={14} />}
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="re-button-row">
                    <button
                      title="Bring forward"
                      disabled={!selected}
                      onClick={() =>
                        mutate((c) => c.bringObjectForward(c.getActiveObject()))
                      }
                    >
                      <ArrowUp size={17} />
                    </button>
                    <button
                      title="Send backward"
                      disabled={!selected}
                      onClick={() =>
                        mutate((c) =>
                          c.sendObjectBackwards(c.getActiveObject()),
                        )
                      }
                    >
                      <ArrowDown size={17} />
                    </button>
                  </div>
                </>
              )}
              {tab === "Color" && !readOnly && (
                <>
                  <p>
                    Paint the page. Or select an object to change its color.
                  </p>
                  <label>
                    Page background
                    <input
                      aria-label="Page background"
                      type="color"
                      value={/^#[0-9a-f]{6}$/i.test(bg) ? bg : "#ffffff"}
                      onChange={(e) =>
                        mutate((c) => {
                          c.backgroundColor = e.target.value;
                        })
                      }
                    />
                  </label>
                  <div className="re-colors">
                    {[...new Set([...colors, ...(brand?.colors || [])])].map(
                      (color) => (
                        <button
                          key={color}
                          title={`Background ${color}`}
                          style={{ background: color }}
                          onClick={() =>
                            mutate((c) => {
                              c.backgroundColor = color;
                            })
                          }
                        />
                      ),
                    )}
                  </div>
                  {selected && (
                    <>
                      <label>
                        Object color
                        <input
                          aria-label="Object color"
                          type="color"
                          value={
                            /^#[0-9a-f]{6}$/i.test(selected.fill)
                              ? selected.fill
                              : "#29352b"
                          }
                          onChange={(e) => update({ fill: e.target.value })}
                        />
                      </label>
                      <label>
                        Opacity
                        <input
                          aria-label="Object opacity"
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={selected.opacity}
                          onChange={(e) =>
                            update({ opacity: Number(e.target.value) })
                          }
                        />
                      </label>
                      <label>
                        Rotation
                        <input
                          aria-label="Object rotation"
                          type="number"
                          value={Math.round(selected.angle)}
                          min={-360}
                          max={360}
                          onChange={(e) =>
                            update({ angle: Number(e.target.value) })
                          }
                        />
                      </label>
                    </>
                  )}
                </>
              )}
              {tab === "Draw" && !readOnly && (
                <>
                  <p>
                    Draw directly on the canvas with your mouse, pen, or finger.
                  </p>
                  <button
                    className={"re-wide " + (drawing ? "active" : "")}
                    onClick={() => {
                      const c = fabric.current;
                      c.isDrawingMode = !drawing;
                      if (!c.freeDrawingBrush) {
                        c.freeDrawingBrush = new PencilBrush(c);
                        c.freeDrawingBrush.width = 8;
                        c.freeDrawingBrush.color = "#8054ba";
                      }
                      setDrawing(!drawing);
                    }}
                  >
                    <Pencil size={16} />
                    {drawing ? "Stop drawing" : "Start drawing"}
                  </button>
                  <label>
                    Brush color
                    <input
                      aria-label="Brush color"
                      type="color"
                      defaultValue="#8054ba"
                      onChange={(e) => {
                        if (fabric.current.freeDrawingBrush)
                          fabric.current.freeDrawingBrush.color =
                            e.target.value;
                      }}
                    />
                  </label>
                  <label>
                    Brush width
                    <input
                      type="range"
                      min={1}
                      max={100}
                      defaultValue={8}
                      onChange={(e) => {
                        if (fabric.current.freeDrawingBrush)
                          fabric.current.freeDrawingBrush.width = Number(
                            e.target.value,
                          );
                      }}
                    />
                  </label>
                </>
              )}
              {tab === "History" && !readOnly && (
                <>
                  <p>
                    Every save keeps a version. The latest 30 versions are
                    retained.
                  </p>
                  {!versions.length && (
                    <p>
                      Previous versions appear after you save edits to an
                      existing design.
                    </p>
                  )}
                  {versions.map((v) => (
                    <button
                      className="re-version"
                      key={v.id}
                      onClick={() => restoreVersion(v.id)}
                    >
                      <History size={16} />
                      <span>
                        <b>Revision {v.revision}</b>
                        <small>{new Date(v.created).toLocaleString()}</small>
                      </span>
                    </button>
                  ))}
                </>
              )}
              {tab === "Export" && (
                <>
                  <p>
                    No watermarks. No paywalls. PNG/JPG/SVG export the current
                    page. PDF includes every page.
                  </p>
                  <label>
                    File format
                    <select
                      aria-label="Export format"
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value)}
                    >
                      {["png", "jpg", "svg", "pdf", "json"].map((f) => (
                        <option value={f} key={f}>
                          {f.toUpperCase()}
                          {f === "json" ? " (editable design)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  {["png", "jpg"].includes(exportFormat) && (
                    <label>
                      Export size
                      <select
                        value={exportScale}
                        onChange={(e) => setExportScale(Number(e.target.value))}
                      >
                        <option value={1}>1× (original)</option>
                        <option value={2}>2× (up to 4096 px)</option>
                      </select>
                    </label>
                  )}
                  <button
                    className="re-primary re-wide"
                    disabled={busy}
                    onClick={exportDesign}
                  >
                    {busy ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <Download size={17} />
                    )}
                    Download {exportFormat.toUpperCase()}
                  </button>
                  <p>
                    {doc.current.width} × {doc.current.height} px ·{" "}
                    {pages.length} page{pages.length !== 1 ? "s" : ""}
                  </p>
                </>
              )}
            </>
          )}
        </aside>
        <section className="re-workspace">
          <div className="re-toolbar">
            {!readOnly && (
              <>
                <button
                  title="Undo (Ctrl Z)"
                  disabled={!h || h.index <= 0}
                  onClick={() => undo(-1)}
                >
                  <Undo2 size={17} />
                </button>
                <button
                  title="Redo (Ctrl Shift Z)"
                  disabled={!h || h.index >= h.entries.length - 1}
                  onClick={() => undo(1)}
                >
                  <Redo2 size={17} />
                </button>
                <span className="re-separator" />
                <button disabled={!selected} onClick={() => setTab("Edit")}>
                  Edit selection
                </button>
                <button title="Cut (Ctrl X)" disabled={!selected} onClick={cut}>
                  Cut
                </button>
                <button
                  title="Copy (Ctrl C)"
                  disabled={!selected}
                  onClick={copy}
                >
                  Copy
                </button>
                <button
                  title="Paste (Ctrl V)"
                  onClick={() => paste().catch((e) => feedback(e.message))}
                >
                  Paste
                </button>
                <button
                  title="Duplicate (Ctrl D)"
                  disabled={!selected}
                  onClick={duplicate}
                >
                  <Copy size={17} />
                </button>
                <button
                  title="Delete selected object"
                  disabled={!selected}
                  onClick={remove}
                >
                  <Trash2 size={17} />
                </button>
                <button
                  title="Group or ungroup"
                  disabled={!selected}
                  onClick={group}
                >
                  <GroupIcon size={17} />
                </button>
              </>
            )}
            <span className="re-dimensions">
              {doc.current?.width || project.width || 1200} ×{" "}
              {doc.current?.height || project.height || 800} px
            </span>
          </div>
          <div className="re-stage" ref={stage}>
            <div className="re-canvas-holder">
              <canvas ref={canvasEl} />
            </div>
            {!ready && (
              <div className="re-loading">
                <LoaderCircle size={25} className="spin" />
                Preparing your design
              </div>
            )}
          </div>
          <div className="re-pages">
            {pages.map((p, i) => (
              <button
                key={p.id}
                className={page === i ? "active" : ""}
                onClick={() => switchPage(i)}
              >
                Page {i + 1}
              </button>
            ))}
            {!readOnly && (
              <>
                <button title="Add page" onClick={() => addPage()}>
                  <Plus size={16} />
                </button>
                <button title="Duplicate page" onClick={() => addPage(true)}>
                  <Copy size={15} />
                </button>
                <button
                  title="Delete page"
                  disabled={pages.length < 2}
                  onClick={deletePage}
                >
                  <Trash2 size={15} />
                </button>
              </>
            )}
          </div>
          <div className="re-bottom">
            <span>
              {readOnly
                ? "Read-only shared design"
                : status ||
                  "Drag to move · corners to resize · double-click text to edit"}
            </span>
            <div>
              <button
                title="Zoom out"
                onClick={() => setZoom((z) => Math.max(0.04, z - 0.1))}
              >
                <ZoomOut size={16} />
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                title="Zoom in"
                onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
              >
                <ZoomIn size={16} />
              </button>
              <button title="Fit canvas" onClick={fit}>
                <Maximize size={16} />
              </button>
            </div>
          </div>
        </section>
      </div>
      {share && (
        <div className="re-share-overlay">
          <div>
            <button
              className="re-share-close"
              onClick={() => setShare(null)}
              aria-label="Close sharing"
            >
              <X size={20} />
            </button>
            <Share2 size={27} />
            <h2>Your idea is ready to share.</h2>
            <p>
              Anyone with this link can view and export the latest saved design.
              They cannot edit it.
            </p>
            <input
              readOnly
              value={share}
              aria-label="Share link"
              onFocus={(e) => e.target.select()}
            />
            <button
              className="re-primary re-wide"
              onClick={() =>
                navigator.clipboard
                  .writeText(share)
                  .then(() => feedback("Link copied"))
                  .catch(() => feedback("Select the link above and copy it"))
              }
            >
              <Link size={16} />
              Copy link
            </button>
            <button
              className="re-wide"
              onClick={async () => {
                try {
                  await api(`/projects/${record.current.id}/share`, {
                    method: "DELETE",
                  });
                  setShare(null);
                  feedback("Sharing disabled — the old link no longer works.");
                } catch (e) {
                  feedback(e.message);
                }
              }}
            >
              Disable sharing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export function SharedDesign() {
  const [project, setProject] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    const token = new URLSearchParams(location.search).get("share");
    api("/shared/" + encodeURIComponent(token))
      .then((r) => setProject(r.project))
      .catch((e) => setError(e.message));
  }, []);
  if (error)
    return (
      <div className="auth-loading">
        <h2>{error}</h2>
        <a href="/">Back to Open Studio</a>
      </div>
    );
  if (!project)
    return (
      <div className="auth-loading">
        <LoaderCircle className="spin" />
        Loading shared design…
      </div>
    );
  return (
    <CanvasEditor
      project={project}
      readOnly
      onClose={() => location.assign("/")}
      onSave={() => {}}
    />
  );
}
