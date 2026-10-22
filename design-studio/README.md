# Open Studio — static browser edition

A real design and video workspace that can be published as **static files**. The default build needs **no Node/Express server, database service, payment card, online account, API key, upload endpoint, or rendering service**. All implemented editing tools and exports are free and have no watermark.

This is an independent application, not Canva or CapCut, and it does **not** claim complete feature parity with either product or unlock their paid services. The existing reverse-engineering project and publishing workflows remain intact.

## Run

Node **22.19+** is needed on the developer/build machine, not on the visitor's computer.

```sh
cd design-studio
npm ci
npm run dev
```

Open the Vite address (normally port 5173). It opens a local workspace immediately—there is no login screen.

```sh
npm run build
npm start
```

The build copies the single-thread FFmpeg JavaScript worker and WASM into `dist/engine/`. Serve **all of `dist/`**, including `engine/`, using an ordinary HTTP(S) static host. Opening `index.html` using `file://` will not work. `npm start` is a local preview, not a required production server. There are no required hosting environment variables.

For a site under a path, set `STUDIO_BASE` **at build time**, for example:

```sh
STUDIO_BASE=/reverse/ npm run build
STUDIO_BASE=/reverse/ npm start
```

Vite rewrites fonts, photos, chunks, and worker paths. Changing the hosting origin or base path opens a separate workspace; transfer your work using a ZIP backup first.

## What's implemented

### Design editor

- Fabric object-based canvas: text, shapes, drawing, images, layers, grouping, locking, transforms, undo/redo, alignment and multiple pages.
- **29 new original editable templates** across 12 categories inspired by the supplied category/editor references: CV, presentation, letter, poster, flyer, logo, document/report/certificate, Instagram, Facebook, story, website mockup, business card/menu. These are not copied Canva assets. The six earlier templates remain available. Text, color blocks and illustrations are real selectable objects, not flattened images. Portrait circles are editable placeholders, not supplied headshots. Website templates are canvas mockups, not published functional websites.
- Category browser, image library, favorites, workspace naming and brand kits.
- **Edit selection** inspector for position, size, rotation, opacity, alignment, flip, border, shadow and shape corners. Text content, letter spacing, line height, underline and strike-through are editable; use Text for fonts/bold/italic. Ungroup layouts to edit individual group members.
- **Photo editor**: choose Photo editor on the home page or Create menu, upload a raster image and choose Edit photo. The canvas starts with just your photo at its native aspect ratio (maximum side 4096 px), not stock text over it. The same controls work on any selected project image through Edit selection.
- Reversible crop margins, replace source while preserving displayed size, 12 photo presets, composable brightness/contrast/saturation/hue/blur/pixelation, grayscale/sepia/invert toggles and sharpen preset. Native Fabric filters/crops round-trip through saves, JSON and backups. Presets replace adjustments; individual sliders preserve the other adjustments. Original library sources remain unchanged.
- **Download edited photo PNG** exports the selected photo with its crop/filters/transforms without page margins. Normal Export still exports the entire design page. Raster photos are not decomposed into their original text/objects; there is no OCR, AI segmentation or background removal.
- Local save and 15-second autosave; atomic revision checks against stale saves from other tabs; latest 30 design revisions with restore.
- PNG, JPG, embedded-font/image vector SVG, multipage PDF and editable JSON downloads.
- Local image uploads are embedded as raster data URLs in designs, so they survive reloads and design JSON transfers. No arbitrary remote image URLs or SVG uploads.
- Bundled DM Sans, Manrope and Noto Sans Arabic (including licenses); choose Noto Sans Arabic for Arabic design text. Caption rendering includes the Arabic fallback font and browser text shaping.
- "Design file" downloads editable JSON rather than creating a misleading public sharing link. The static edition has **no server-hosted project sharing**.

### Video montage

Open **Video studio → New video**. Import files in **Media**, then add clips with the plus buttons.

| Area         | Working tools                                                                                                                                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timeline     | Video and still-image clips, scrubbing/playback, trim, split, reorder/drag, duplicate/delete, fit/fill, zoomable timeline, document undo/redo                                                                                           |
| Speed        | 0.25×, 0.5×, 0.75×, 1×, 1.25×, 1.5×, 2×, 3×, 4×; chained audio tempo filters                                                                                                                                                            |
| Effects      | 20 look choices (including Original) + 10 extra effects: vignette, sharpen, grain, negative, neon edges, emboss, soft focus, pixel mosaic, scan lines, RGB split; brightness, contrast, saturation, hue, blur, rotation/flips and reset |
| Crop/motion  | 1–2× start/end zoom and two-point X/Y pan, interpolated over each clip; use identical endpoints for a fixed crop                                                                                                                        |
| Clip tools   | Volume/mute, fade in/out to black/silence; source frame PNG; freeze-frame copy appended as an editable still; source audio extraction to WAV; reversed video copy                                                                       |
| Text         | Timed multiline captions, color/size/top/center/bottom placement, import/export plain-text SRT, browser-rasterized captions with Arabic fallback                                                                                        |
| Image layers | Up to 10 timed logos/stickers/photos from your own PNG/JPEG/WebP files, position, width and opacity                                                                                                                                     |
| Audio        | Original clip audio, looping background music/offset/volume, up to 5 timed voiceover/SFX layers with trim, placement, volume and fades                                                                                                  |
| Recording    | Real microphone recording using MediaRecorder (permission required); recorded sources and timed voiceover layers save locally                                                                                                           |
| Layer lanes  | Separate caption/image/audio rows; click to edit, drag to reposition, Left/Right to nudge 0.1s, Shift+Left/Right to nudge 1s                                                                                                            |
| Export       | Real H.264 + AAC MP4 from FFmpeg.wasm, landscape/portrait/square presets, 24/25/30/60fps, draft/balanced/high quality, progress/cancel/download                                                                                         |

Reverse creates a separate, correctly playable media file rather than pretending native video supports negative playback rates. Reverse copies are restricted to **10 seconds and 640 px** to bound the reverse filter's frame buffer. Freeze frames and reversed copies are appended to the timeline; drag to reposition. Source-frame downloads and freeze captures intentionally omit montage effects and captions. Audio extraction exports the selected source range before its timeline speed/effects, capped at 2 minutes per WAV file.

Microphone recording requires HTTPS (or localhost) and browser permission. Stay in the Audio tab while recording; leaving it stops/discards an unfinished recording. Recording stops after 2 minutes or 25 MB. Recordings with missing WebM duration headers are measured from FFprobe packet timestamps.

Appearance preview is approximate; export uses FFmpeg filters. Vignette, grain, pixel mosaic, scan lines and RGB split do not have a faithful live CSS preview; judge those effects in the MP4 export. This is a finite independent preset library, not the entire proprietary CapCut effect catalogue. One look and one extra effect can be combined with the sliders per clip. Preview clamps gains above 100%. Audio mixes use equal-input averaging, not mastering/loudness normalization. Fades are **not overlapping crossfade transitions**. Captions on the same position/time can overlap: adjust their timing or position. Caption text is plain text, not HTML. Advanced typography/shaping beyond the installed/bundled fonts is not guaranteed.

### Keyboard shortcuts

Click **Shortcuts** in either editor for the complete reference (Ctrl on Windows/Linux, ⌘ on Mac). Native typing/cut/copy/paste stays intact in inputs, textareas, selects and in-canvas text editing.

- Both editors: **Ctrl/⌘ X/C/V** cut/copy/paste selected objects or clips, **D** duplicate, **S** save, **Z** undo, **Shift Z / Ctrl Y** redo, Delete/Backspace remove.
- Canvas: **Ctrl/⌘ A** select unlocked objects, **G** group/ungroup, **L** lock/unlock, **B/I/U** text styling, **[ / ]** stack backward/forward. Arrows move 1 px, Shift+Arrows 10 px. T/R/O add text/rectangle/circle, Escape deselects/stops drawing, +/−/0 zoom/fit.
- Video: Space plays/pauses, **S** splits inside the selected clip, Left/Right seek one frame (Shift: one second), Home/End seek start/end. Clip paste inserts after the selected clip, or at the end if none is selected; it preserves source/effects with a fresh ID, and respects 30 clips / 10 minutes.
- Object/clip clipboards are **internal to the open editor**, not cross-tab or cross-app design exchange. When no object has been copied yet, browser paste can import a PNG/JPEG/WebP clipboard image. Use editable JSON or workspace ZIP for portability. Locked objects cannot be cut, moved, deleted or inspector-edited until unlocked in Layers.

### Explicit non-features

This is **not all of CapCut**. There is no AI video generation, automatic speech transcription/captions, background removal, motion tracking, stabilization, beauty/face retouching, optical-flow interpolation, arbitrary keyframe curves, speed ramps, general overlapping video/PiP tracks, licensed stock/template marketplace, live collaboration, online accounts/cloud sync, project hosting or direct social publishing. The image/audio layers and two-point motion above are real; they are not substitutes mislabeled as those unimplemented tools. No buttons claim to run these unavailable services.

## Data, privacy and backup

Click **On this device → Backup** (bottom-right on the workspace).

- Designs, history, preferences, brand kit and source media live in **IndexedDB** in this browser profile/origin/base path. No `/api` calls are required in the static edition.
- There is no account boundary on a shared browser profile, and data is not encrypted at rest. Another visitor on another computer does not receive your projects. Same-origin website JavaScript shares the browser's origin-level security boundary.
- Storage can be cleared/evicted or unavailable in private browsing. The app reports storage errors instead of silently pretending it saved. The persistent-storage request is best-effort, not a guarantee.
- ZIP export includes source files, all saved designs/video projects, design history, preferences and brand kit. Original media can also be downloaded individually from Media. It reads one consistent database snapshot. **128 MB uncompressed backup safety limit**; do not treat browser storage as your only archive.
- ZIP import is a **replacement**, not a merge. Export your current workspace first. Only restore trusted backups. Size/count/path/schema/reference/checksum validation happens before a single atomic replacement transaction; failure preserves the existing workspace.
- A design JSON file includes its design images but is not a complete video/source-library backup. Use the ZIP backup to move video projects to another browser/device/address.
- MP4 jobs/finished exports are **tab-session only**. Keep the tab open while exporting and download completed videos. Up to 5 finished exports, with a 128 MB aggregate retention budget, are kept in memory. A single large latest export can exceed that aggregate budget.
- Existing accounts/uploads in the old Node server are **not migrated automatically**. Keep the old database/uploads intact; export designs and download the originals before switching. The legacy server remains available separately.

## Browser safety limits

- Import: **100 MB/file**, 1 GB local-library safety cap (actual browser quota can be lower), sources up to 30 minutes and 4096 px/side.
- Editing: up to 30 sequential clips / 10 minutes, 20 captions, 10 image overlays and 5 extra audio layers.
- Browser MP4 export: **2 minutes maximum**, **150 MB unique source data**, up to 1080p; outputs above 720p are capped at **30 seconds**. Projects can be longer for editing but must be split for export. The renderer fails with an actionable message rather than promising an unsupported export.
- One WASM operation at a time per tab, one active video job per tab, 10-minute export wall-clock budget. Worker termination releases encoder memory on cancellation/failure/completion. Avoid simultaneous heavy tabs, especially on phones.
- FFmpeg's single-thread core loads approximately 31 MB on first use, from the same static host. No CDN or SharedArrayBuffer/COOP/COEP headers are required. Initial loading still needs an internet connection; this is not an installed offline PWA.
- Chrome/Chromium desktop is tested. Mobile layout is tested at 390×844, but actual phone memory, Safari/Firefox codecs, long/large video export and all effects on every browser are **not** universally verified. A supported device still needs enough RAM/CPU for encoding.

## Publish on GitHub Pages

The repository owner explicitly approved publishing Open Studio in place of the existing Pages site. GitHub supports one Pages site per repository. This changes what is served, **not** the old website's source files. Other publishing workflows remain unchanged.

The new `.github/workflows/studio-static.yml` tests/builds this application on pushes to **`arena/2af71eea-reverse`**, generates the correct `/<repository>/` asset prefix, uploads a Pages artifact, then publishes through the **github-pages** environment. No hosting environment variables, card, database or API keys are required.

The GitHub connection used by this agent cannot change repository Pages settings or deployment policies (the settings API returns HTTP 403). The repository owner must enable these two settings in GitHub:

1. **Settings → Pages → Build and deployment → Source → GitHub Actions**.
2. **Settings → Environments → github-pages → Deployment branches and tags**: add a **Branch** rule named exactly `arena/2af71eea-reverse`. Keep existing rules; no other branch needs to be renamed, switched or removed.
3. Open **Actions → Open Studio static build**, select the latest run on this branch, and **Re-run all jobs** if the initial publish attempt was blocked. Both build and publish must succeed.
4. Use the URL returned by the successful **publish** job / Settings → Pages. A build artifact alone is not a deployed public website.

After those owner-controlled settings are enabled, future changes pushed to this session branch deploy automatically. If you do not want this site published, disable the new workflow before changing those settings.

Do not run the old `Publish REA website` workflow expecting it to deploy Open Studio; it publishes the unrelated original website.

### Other static hosts

Set project root to `design-studio`, install with `npm ci`, build with `npm run build`, publish directory `dist`. Use `/` as the build base unless publishing below a path. Do **not** select the Dockerfile or configure a database, persistent disk, backend start command, or `COOKIE_SECURE`/`PUBLIC_ORIGIN` variables for this edition. Hosting-provider signup/verification policies are outside this application's control.

## Tests

```sh
npm test                 # server regression + shared validation/effect/SRT tests
npm run test:browser     # production static UI + local transaction tests + actual WASM media + creative-tool tests
npm run test:static      # production static UI only
npm run test:creative    # category/CV/photo/shortcuts and full WASM preset catalogue
```

The production test serves `dist/` below `/reverse/` with an ordinary static HTTP server, with **no backend**. It exercises canvas editing/exports/history, local image persistence, brand kit, montage upload/playback/editing, effects/motion/layers, actual microphone recording with a synthetic test device, SRT, genuine WASM MP4/download, save/reload, another visitor's empty storage, ZIP backup/restore into that clean browser and a second genuine export from restored sources, plus malformed ZIP rejection. It checks no `/api` or external-host requests and no cross-origin isolation requirement.

Additional tests cover revision races, source reference protection, cancellation, archive size limits, import validation, and transaction rollback on real cloning errors and simulated asynchronous aborts. Actual full-disk/quota exhaustion behavior is browser-dependent, not universally verified. Media tests verify real output dimensions/audio/duration and pixels, motion/stills/overlays, reverse output order, WAV extraction and cancellation followed by worker recovery. The creative-tool suite additionally exercises editable CV text, cut/paste/nudge/redo and native input isolation, photo filter/crop/shadow persistence, every original template and photo preset through real Fabric export/import, video clip clipboard shortcuts and a real WASM H.264 render containing every look/effect. The optional original server tests remain in place.

## Optional original server

The default is now static; it no longer launches Express. To use the previous online-account/SQLite edition, see [SERVER.md](SERVER.md). Its renderer implements the previous, smaller montage feature set, not the new browser-only tools.

## Assets and redistribution

- Ocean photograph: bundled from Start Bootstrap's landing-page sample (Unsplash credit); see the original server documentation for its source.
- DM Sans, Manrope and Noto Sans Arabic: Google Fonts repository, each bundled with its SIL Open Font License.
- `@ffmpeg/ffmpeg` 0.12.15 wrapper: MIT. `@ffmpeg/core` 0.12.10: GPL-2.0-or-later (including libx264); license texts, notices and release-source/build-recipe links are copied to `dist/engine/` during preparation. Package versions are locked.
- Core source/build recipes: https://github.com/ffmpegwasm/ffmpeg.wasm/tree/71aa99d37c02a7b4c435275ca9ef50e612f6efa1
- Wrapper source: https://github.com/ffmpegwasm/ffmpeg.wasm/tree/f78aed147c4185484da8eba1d97c51354a5e3352
- The upstream core uses FFmpeg n5.1.4. A clean npm audit is **not** a native/WASM codec security audit; keep the core maintained and review upstream security updates. WASM runs in a dedicated worker, not as a host OS executable, but malformed media can still exhaust memory or crash the tab.
- Before redistributing codec binaries publicly, comply with their license/corresponding-source distribution requirements (including enabled codec dependencies); notices alone are not a blanket license clearance or patent grant. No stock assets, subscriptions or services from Canva/CapCut are included.

Large generated workers/WASM, dependencies, test outputs, uploads and database files are ignored by Git. CI/build regenerates the browser engine from the lockfile.
