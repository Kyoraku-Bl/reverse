> The default application is now static. See [README.md](README.md) for the browser edition. This document describes the optional original Node/SQLite backend; new browser-only montage tools are not implemented by that legacy renderer.

# Open Studio — legacy server edition

An independent, self-hosted design application inspired by creative tools such as Canva. **Every implemented tool is free. There are no subscriptions, locked templates, watermarks, or paid export options.** This is not an integration with Canva and does not unlock Canva's own premium services or assets.

The application now has a real server, user accounts, a persistent database, private file storage, and an object-based canvas editor. It is not the previous localStorage-only mockup. It lives in its own directory and leaves the repository's reverse-engineering runtime and existing documentation site unchanged.

## Run locally

Requires Node.js **22.19 or newer** (Node 22 currently labels its built-in SQLite API experimental).

```sh
cd design-studio
npm ci
npm run dev:server
```

- Frontend: port `5173`
- API: port `3001`
- API requests use relative URLs, proxied by Vite. The browser never calls a separate localhost backend.
- Register an account on the first screen. No default account, password, or sample projects are installed.
- The server creates `data/studio.sqlite` and `data/uploads/` automatically. These paths are ignored by Git. Accounts and projects survive application restarts.

No external account, credit card, API key, image CDN, or paid service is needed. The application does not make third-party network requests during normal editing. Hosting, electricity, backups, and disk space remain the operator's responsibility.

## Implemented features

### Accounts and persistence

- Email/password registration, login, and logout
- Scrypt password hashing with per-user random salts
- HttpOnly, SameSite session cookies; server-side logout revocation
- Account-isolated projects, images, favorites, workspace name, and brand kit
- Server-side project creation, rename, duplication, deletion, and search in the workspace
- Optimistic revision checks to prevent silently overwriting another tab's edits
- Saved project thumbnails generated from the real canvas

### Editor

- Object-based editing with Fabric.js, rather than editing a fixed HTML poster
- Move, resize, rotate, and multi-select objects directly on the canvas
- Double-click text editing, font family/size, bold, italic, and text alignment
- Rectangles, rounded rectangles, circles, triangles, and lines
- Fill colors, page background, opacity, rotation
- Layer selection, front/back ordering, lock/unlock
- Group/ungroup, duplicate, copy/paste, select all, delete
- Undo/redo history per page
- Freehand drawing with brush color and width
- Private PNG, JPEG, and WebP uploads; reusable image library
- Grayscale and brightness adjustments
- Multiple pages, page switching, duplication, and deletion
- Custom document dimensions and zoom/fit controls
- Manual server saves and autosave checks every 15 seconds when changes exist
- Latest 30 saved revisions with a restore interface
- Template category filtering and search
- Saved brand colors available in the editor
- Responsive desktop and mobile layouts

### Export and sharing

- PNG and JPG exports at original or 2× scale (output longest side capped at 4096 px)
- Real vector SVG, with images and bundled fonts embedded; no `foreignObject` HTML screenshot
- Multipage PDF (pages rendered as images for visual fidelity)
- Editable design JSON export/import
- Read-only public sharing links for the latest saved design
- Share revocation; old links and their private image access stop working

**No-watermark exports are free in every format.** PNG/JPG/SVG export the current page. PDF and editable JSON include all pages. JSON files reference server-owned image uploads and are not portable image archives: to move to another installation, back up the database and uploads together. Shared users may view/export, not edit.

### Keyboard shortcuts

- Workspace: `Ctrl/Cmd K` focuses template search
- Canvas: `Ctrl/Cmd S` saves, `Ctrl/Cmd Z` undoes, `Ctrl/Cmd Shift Z` / `Ctrl Y` redoes
- `Ctrl/Cmd C` / `V` copy/paste, `Ctrl/Cmd D` duplicates, `Ctrl/Cmd A` selects all
- Delete/Backspace removes unlocked objects; Escape clears selection
- Text editing keeps its normal typing shortcuts

## Video montage

Open **Video studio** in the sidebar (also available from Apps or Create a design). Choose **New video**, upload footage, and add video files from the media library to the timeline. Select a clip to trim its In/Out points, split at the playhead, duplicate/delete it, change playback speed, choose fit/fill, adjust volume, or apply fade-in/out. Drag clips to reorder; arrow buttons provide a mobile/keyboard alternative. Text adds timed captions, and Audio selects one looping background soundtrack.

- Playback/scrubbing previews the sequence, its speed changes, captions, and soundtrack in the browser.
- Video projects have their own server-persisted library, revision checks, manual save, and 15-second autosave. They are separate from graphic design projects.
- Export saves a snapshot and starts a real **FFmpeg render**: H.264 + AAC MP4, no watermark. Landscape, portrait, and square presets support up to 1080p at 24/30 fps. Progress, cancellation, re-download, and export status on reopening a project are included.
- Rendering runs on the server, so the editor can close while the job continues. Edits made during a render do not change its saved snapshot. Download the finished export from the Export panel.
- Silent source clips receive a silent audio track, avoiding broken concatenations; music is mixed with the original audio. Fades dip to black/silence; they are **not overlapping crossfade transitions**.
- Remove clips/soundtracks and save before deleting an unused media original from the library. References from another saved project or active render prevent deletion.

The preview depends on browser codec support; H.264 MP4 and VP8/VP9 WebM are recommended. The server may be able to render MOV/MKV or other supported media that a browser cannot preview. Audio gain above 100% can be clamped in browser preview but is applied during export. Changing speed changes video timing; no pitch-shifting effect is provided. Captions use bundled DM Sans and explicit line breaks; advanced subtitle layout and universal script shaping are not claimed.

### Media tools and deployment

The server resolves `FFMPEG_PATH` / `FFPROBE_PATH` if set, otherwise uses the platform-specific npm installer binaries, falling back to `ffmpeg` / `ffprobe` on PATH if those packages are omitted. No shell command or uploaded filename is interpolated into process arguments. Probe/encode inputs are restricted to local file protocols and an allowlist of media demuxers.

**Use maintained, patched FFmpeg/FFprobe binaries for a public deployment.** The npm installer fallback includes an older FFmpeg build; a clean npm vulnerability audit does not audit native codecs. The Docker recipe instead installs the distribution FFmpeg package and explicitly selects `/usr/bin/ffmpeg` and `/usr/bin/ffprobe`. Container deployment has not been executed here. For untrusted public uploads, isolate rendering in a non-root container with memory/CPU/disk limits and blocked network egress, and keep its codecs patched. FFmpeg/libx264 redistribution licensing applies separately.

One server process owns a `DATA_DIR`. Do not run a cluster or multiple servers against the same video directory: an exclusive `data/video/server.lock` marker prevents that. Graceful shutdown cancels and awaits media processes before releasing the marker or closing SQLite. After a hard crash, first **verify the previous server and its media children are stopped**, then remove the stale marker before restarting. The server deliberately does not infer safety from a PID alone. Recovery marks interrupted jobs failed and cleans incomplete work; it does not silently resume partial output. Keep backups of `data/video/` together with SQLite and image uploads.

Video safety limits (not paid tiers): 100 MB per source, 30-minute maximum source duration, source dimensions up to 4096 px, 1 GB stored media per account, up to 30 clips / 20 captions / 10-minute output, one active job per account, one renderer globally, and at most 10 queued jobs. Each render has a 10-minute wall-clock budget. Upload/probe concurrency is bounded. The latest 5 completed MP4 exports per account are retained; the sixth removes the oldest export, not its editable project or originals. Allow several GB of temporary disk and adequate CPU/RAM for long 1080p projects. These limits may need tuning before large-scale hosting.

## Scope: what is NOT implemented

This is a substantial first full-stack release, **not feature parity with Canva**. Static video-cover designs and website mockups remain separate from the new video timeline. Video studio now renders real MP4 files; website publication is still not implemented.

Still to build:

- Multitrack video compositing, keyframes, overlapping crossfade transitions, recording, and GIF export
- AI image/text generation, background removal, and generative editing
- Real-time collaborative editing, invitations, team roles, and comments
- Website publishing, domains, forms, and analytics
- Presentation playback, presenter view, and slide animations
- Social scheduling, third-party app integrations, and print ordering
- Large licensed stock libraries and an expanded original template library
- Advanced image cropping/masking, editable charts, advanced typography, and accessibility checking
- Password recovery/email verification, account deletion, administrator tools, and operational observability

These require additional implementation and, in some cases, infrastructure or model hosting. Adding them does not require introducing a paid feature tier, but externally hosted services cannot be assumed to be cost-free. No fake AI buttons or payment forms have been added.

## Resource and safety limits

The current limits are technical bounds, not paid tiers:

- Document: 64–4096 px per side, up to 50 pages
- Up to 300 top-level objects per page / 1,000 objects across a document including groups
- Project request body up to 5 MB; editable JSON imports up to 5 MB
- Image upload: PNG/JPEG/WebP only, 10 MB, at most 40 megapixels and 16,000 px per side
- Most recent 30 server revisions; up to 60 undo states per edited page
- Authentication attempts limited per IP

The server validates documents and file signatures/metadata, checks asset ownership, rejects external image URLs and unsupported object classes, uses parameterized SQL, and rejects cross-origin mutations. These measures are tested but are not a substitute for an independent security review before a public deployment. Public hosting also needs abuse protection, disk quotas, monitoring, and a backup policy; these operator controls are not currently built into the application.

## Production build

```sh
npm ci
npm run build:server
PORT=3001 npm run start:server
```

The Node server serves both the built frontend and `/api` on the same origin. It binds to `0.0.0.0`. No development server is required for production.

Configuration:

| Variable        | Default                  | Purpose                                                                     |
| --------------- | ------------------------ | --------------------------------------------------------------------------- |
| `PORT`          | `3001`                   | HTTP listening port                                                         |
| `DATA_DIR`      | `./data`                 | Persistent SQLite and uploaded image directory                              |
| `COOKIE_SECURE` | `false`                  | Set `true` for an HTTPS deployment                                          |
| `TRUST_PROXY`   | `false`                  | Set `true` only behind one trusted reverse proxy                            |
| `FFMPEG_PATH`   | Installer binary or PATH | Override the FFmpeg executable (use a patched build in production)          |
| `FFPROBE_PATH`  | Installer binary or PATH | Override the FFprobe executable                                             |
| `ARENA_PREVIEW` | `false`                  | Opt-in HTTPS Arena iframe embedding and secure partitioned preview sessions |
| `PUBLIC_ORIGIN` | Empty                    | Exact external origin when a trusted proxy rewrites the Host header         |

For public deployments, terminate HTTPS at a reverse proxy, set `COOKIE_SECURE=true`, forward the original `Host` header, and restrict direct access to the Node service. Do not enable `TRUST_PROXY` if untrusted clients can reach the service directly. Back up the entire data directory with the server stopped, or use a proper SQLite online backup procedure plus matching upload backups. Do not copy just the SQLite main file while WAL writes are active.

A Dockerfile and Compose recipe are included for convenience. They were not executed in this sandbox. The Node production build and browser tests were executed directly.

```sh
docker compose up --build -d
# Local HTTP: http://localhost:3001
```

The Compose volume persists account and design data. Configure an HTTPS reverse proxy before exposing it publicly.

## Validation

```sh
npm test             # real HTTP/API and SQLite persistence/security tests
npm run build:server
npm run test:browser:server # graphic + video browser suites, with temporary production servers
npm run test:video   # real FFmpeg integration/security/cancellation tests
npm audit --omit=dev
```

Browser tests use npm-packaged Chromium and Linux libraries; no external browser download is required. They exercise registration, search, drag, undo/redo, direct text editing, private uploads, grouping, server saves, reload persistence, multi-page documents, each export format, revision listing, sharing/revocation, brand storage, custom dimensions, and mobile layout. Backend tests check authorization isolation, malformed documents, conflicting revisions, private image access, public share access/revocation, logout, and persistence after closing/reopening SQLite. Screenshots and temporary test data are ignored or cleaned up. Test servers are stopped when the tests complete; no preview server is started automatically.

Version restoration, JSON import recovery, drawing, individual typography controls, and image filters are implemented but do not yet have exhaustive browser regression coverage. Video backend tests encode actual red/blue footage plus silent clips, timed text, speed changes, and background music, then probe the output duration/dimensions/audio and decode frames to verify clip order. They also test owner-only media/export access, range streaming, stale revisions, render cancellation/shutdown cleanup, persistence, and exclusive storage ownership. The video browser suite tests actual upload, playback, trim/split/reordering, captions, soundtrack, saves/reload, MP4 download, and mobile layout. Long/4K sources, advanced character shaping, timeout escalation under a hung codec, browser compatibility beyond Chromium, container deployment, load tests, and multi-user real-time collaboration have not been verified.

## Credits

- Video encoding/probing: FFmpeg and FFprobe (separate tool licensing; libx264 builds may be GPL)
- Canvas engine: Fabric.js (MIT)
- PDF export: jsPDF (MIT)
- Icons: Lucide (ISC)
- DM Sans and Manrope: Google Fonts (SIL Open Font License); notices in `public/fonts/`
- Ocean photograph: Start Bootstrap Landing Page's Unsplash-sourced `bg-masthead.jpg`, bundled locally
- Canva is a trademark of its owner. Open Studio is independent and is not affiliated with Canva.

### Arena access

For an Arena HTTPS preview, start with `ARENA_PREVIEW=true` and set `PUBLIC_ORIGIN` to the exact HTTPS preview URL. This allows framing only by Arena and E2B preview origins, removes the conflicting X-Frame-Options header, and uses Secure/SameSite=None/Partitioned cookies. Defaults remain same-origin framing and SameSite=Strict for normal deployments. If a browser blocks third-party storage, open the website in a new tab; a partitioned session in the embedded panel and a top-level session may require separate sign-ins.
