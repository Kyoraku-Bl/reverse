#!/usr/bin/env python3
"""KyorakuReplay — local dev server with live market data.

    python3 server.py            # http://localhost:8000
    PORT=9000 python3 server.py

Serves the static site *and* proxies the two data endpoints the terminal
uses, so the browser gets real candles on localhost exactly like it does on
Vercel:

    /api/yahoo?symbol=ES%3DF&interval=5m&range=1mo
    /api/binance?symbol=BTCUSDT&interval=5m&limit=1000

No dependencies, no API keys. If the upstream is unreachable the endpoint
answers 502 and the terminal falls back to its synthetic engine.
"""
import http.server
import json
import os
import socketserver
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "8000"))
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

YAHOO_BASE = os.environ.get("YAHOO_BASE", "https://query1.finance.yahoo.com")
BINANCE_BASE = os.environ.get("BINANCE_BASE", "https://api.binance.com")

ALLOWED_INTERVALS = {"1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h", "1d", "5d", "1wk", "1mo"}
ALLOWED_RANGES = {"1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "max"}
ALLOWED_BN = {"1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w"}


def http_get(url, timeout=9):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    # ---- helpers ----
    def _send(self, code, payload, ctype="application/json; charset=utf-8", cache="no-store"):
        body = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,OPTIONS")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    # ---- routing ----
    def do_OPTIONS(self):
        self._send(204, b"")

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/yahoo":
            return self.api_yahoo(urllib.parse.parse_qs(parsed.query))
        if parsed.path == "/api/binance":
            return self.api_binance(urllib.parse.parse_qs(parsed.query))
        if parsed.path == "/api/status":
            return self.api_status()
        return super().do_GET()

    def api_status(self):
        out = {"yahoo": False, "binance": False}
        try:
            http_get(YAHOO_BASE + "/v8/finance/chart/ES%3DF?interval=5m&range=1d", timeout=5)
            out["yahoo"] = True
        except Exception:
            pass
        try:
            http_get(BINANCE_BASE + "/api/v3/ping", timeout=5)
            out["binance"] = True
        except Exception:
            pass
        return self._send(200, out)

    def api_yahoo(self, q):
        symbol = (q.get("symbol", [""])[0] or "").strip()
        if not symbol or len(symbol) > 32:
            return self._send(400, {"error": "symbol is required"})
        interval = q.get("interval", ["5m"])[0]
        rng = q.get("range", ["1mo"])[0]
        interval = interval if interval in ALLOWED_INTERVALS else "5m"
        rng = rng if rng in ALLOWED_RANGES else "1mo"

        url = (
            YAHOO_BASE
            + "/v8/finance/chart/"
            + urllib.parse.quote(symbol, safe="")
            + "?interval=" + interval
            + "&range=" + rng
            + "&includePrePost=false&events=div%2Csplit"
        )
        try:
            raw = http_get(url)
        except urllib.error.HTTPError as e:
            return self._send(e.code if e.code == 404 else 502, {"error": "upstream %s" % e.code, "symbol": symbol})
        except Exception as e:
            return self._send(502, {"error": "upstream failed", "detail": str(e), "symbol": symbol})

        try:
            data = json.loads(raw)
        except Exception:
            return self._send(502, {"error": "upstream returned non-JSON", "symbol": symbol})

        result = (data.get("chart") or {}).get("result")
        if not result:
            return self._send(404, {"error": "no data", "symbol": symbol})

        max_age = 30 if interval == "1m" else 300 if interval == "1d" else 60
        return self._send(200, raw, cache="public, max-age=%d" % max_age)

    def api_binance(self, q):
        symbol = (q.get("symbol", [""])[0] or "").upper().strip()
        if not symbol:
            return self._send(400, {"error": "symbol is required"})
        interval = q.get("interval", ["5m"])[0]
        interval = interval if interval in ALLOWED_BN else "5m"
        try:
            limit = max(1, min(int(q.get("limit", ["1000"])[0]), 3000))
        except ValueError:
            limit = 1000

        collected, end_time = [], None
        try:
            while len(collected) < limit:
                want = min(1000, limit - len(collected))
                url = "%s/api/v3/klines?symbol=%s&interval=%s&limit=%d" % (
                    BINANCE_BASE, urllib.parse.quote(symbol), interval, want)
                if end_time:
                    url += "&endTime=%d" % end_time
                page = json.loads(http_get(url))
                if not page:
                    break
                collected = page + collected
                end_time = page[0][0] - 1
                if len(page) < want:
                    break
        except urllib.error.HTTPError as e:
            return self._send(e.code if e.code == 429 else 502, {"error": "upstream %s" % e.code, "symbol": symbol})
        except Exception as e:
            return self._send(502, {"error": "upstream failed", "detail": str(e), "symbol": symbol})

        return self._send(200, collected[-limit:], cache="public, max-age=120")

    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            sys.stderr.write("[api] " + (fmt % args) + "\n")


class ThreadingServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    with ThreadingServer(("0.0.0.0", PORT), Handler) as httpd:
        print(f"KyorakuReplay on http://localhost:{PORT}  (live data proxy enabled)", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nbye")
