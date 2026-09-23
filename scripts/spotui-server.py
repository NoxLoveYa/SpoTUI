#!/usr/bin/env python3
"""spotui-server: localhost companion for SpoTUI animated Pinterest posters.

Pinterest serves story videos as HLS (.m3u8) with no CORS headers, so no
browser — Spotify included — may read the stream directly. This proxy runs
on loopback (no CORS problem server-side), rewrites segment URLs to stay
on-loopback, and re-serves everything with permissive headers:

    GET /health          -> {"ok": true}
    GET /hls?url=<m3u8>  -> manifest with segments rewritten to /seg
    GET /seg?url=<abs>   -> raw segment bytes (or key file)

Stdlib only. Nothing leaves the machine except the video fetch itself.
Run at logon (example): schtasks /Create /TN "SpotUI Video Server" ...
"""

import re
import sys
import json
import urllib.request
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18443
UA = {"User-Agent": "Mozilla/5.0"}


def fetch(url, timeout=20):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout)


def rewrite_manifest(text, base):
    def proxied(ref):
        absu = urllib.parse.urljoin(base, ref)
        return "/seg?url=" + urllib.parse.quote(absu, safe="")

    out = []
    for line in text.splitlines():
        s = line.strip()
        if s and not s.startswith("#"):
            out.append(proxied(s))
        elif s.startswith("#EXT-X-KEY") or s.startswith("#EXT-X-MAP"):
            out.append(re.sub(r'URI="([^"]+)"', lambda m: 'URI="%s"' % proxied(m.group(1)), s))
        else:
            out.append(line)
    return "\n".join(out) + "\n"


class Handler(BaseHTTPRequestHandler):
    def _send(self, body, ctype):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        if u.path == "/health":
            self._send(b'{"ok": true}', "application/json")
            return
        if u.path in ("/hls", "/seg"):
            target = (q.get("url") or [None])[0]
            if not target or not target.startswith(("http://", "https://")):
                self.send_error(400, "missing url")
                return
            try:
                r = fetch(target)
                body = r.read()
                ctype = r.headers.get("Content-Type", "video/MP2T")
                # Rewrite any playlist (master, variant, or media) so every
                # relative reference stays on-loopback; raw segments pass through.
                if u.path == "/hls" or ctype.startswith("application/vnd.apple.mpegurl") or ctype.startswith("application/x-mpegurl") or body.lstrip().startswith(b"#EXTM3U"):
                    body = rewrite_manifest(body.decode("utf-8", "replace"), target).encode()
                    ctype = "application/vnd.apple.mpegurl"
                self._send(body, ctype)
            except Exception as e:
                self.send_error(502, str(e)[:120])
            return
        self.send_error(404)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
