#!/usr/bin/env python3
"""Tiny static server for the KyorakuReplay download page.

Serves ./ with the correct Content-Type and forces a download prompt for the
archive files (so clicking a link saves the file instead of opening it).
"""
import http.server
import os
import socketserver

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "8100"))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        path = self.path.split("?")[0].split("#")[0]
        if path.endswith(".zip"):
            self.send_header(
                "Content-Disposition", 'attachment; filename="kyorakureplay-site.zip"'
            )
        elif path.endswith(".tar.gz"):
            self.send_header(
                "Content-Disposition",
                'attachment; filename="kyorakureplay-site.tar.gz"',
            )
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def log_message(self, fmt, *args):  # keep the console quiet
        pass


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"download page on http://0.0.0.0:{PORT}", flush=True)
    httpd.serve_forever()
