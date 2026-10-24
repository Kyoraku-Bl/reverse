#!/usr/bin/env python3
"""KyorakuReplay — preview server.

`python3 -m http.server` is enough to open the site, but it caches aggressively
and 404s on extension-less paths. This one is the same static server with three
things a preview needs:

  * `Cache-Control: no-store`, so a reload after a deploy never serves stale JS
  * extension-less routes (`/terminal` -> `terminal.html`, `/` -> `index.html`)
  * permissive CORS on the snapshot files, so `data/*.json` can be read by a
    page served from a different preview host

Usage:  python3 serve.py [port]      (default 8010, bound to 0.0.0.0)
"""

import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".json": "application/json",
        ".mjs": "text/javascript",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".webmanifest": "application/manifest+json",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def translate_path(self, path):
        resolved = super().translate_path(path)
        # `/terminal?x=1` and `/terminal/` both mean terminal.html
        base, tail = os.path.split(path.split("?", 1)[0].split("#", 1)[0])
        if tail and "." not in tail:
            candidate = os.path.join(
                super().translate_path(base), tail + ".html"
            )
            if os.path.isfile(candidate):
                return candidate
        if path.split("?", 1)[0] == "/":
            index = os.path.join(ROOT, "index.html")
            if os.path.isfile(index):
                return index
        return resolved

    def log_message(self, fmt, *args):
        sys.stdout.write("%s - %s\n" % (self.address_string(), fmt % args))
        sys.stdout.flush()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8010
    server = ThreadingHTTPServer(("0.0.0.0", port), partial(Handler, directory=ROOT))
    server.daemon_threads = True
    print(f"KyorakuReplay preview → http://0.0.0.0:{port}/  (root: {ROOT})", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == "__main__":
    main()
