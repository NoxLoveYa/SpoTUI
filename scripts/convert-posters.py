import json, os, re, subprocess, sys, urllib.parse, urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
OUTDIR = sys.argv[1] if len(sys.argv) > 1 else "assets/posters"
BOARDS = [l.strip() for l in open(sys.argv[2]).read().splitlines()] if len(sys.argv) > 2 else []
BOARDS += [l.strip() for l in (os.environ.get("BOARDS", "").splitlines() if os.environ.get("BOARDS") else []) if l.strip()]
os.makedirs(OUTDIR, exist_ok=True)


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30)


def board_pins(user, slug):
    u = "https://widgets.pinterest.com/v3/pidgets/boards/%s/%s/pins/" % (
        urllib.parse.quote(user), urllib.parse.quote(slug))
    return json.load(get(u))["data"]["pins"]


def pins_info(ids):
    u = "https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=" + ",".join(
        urllib.parse.quote(i) for i in ids)
    d = json.load(get(u))["data"]
    return d if isinstance(d, list) else d.get("pins", [])


def video_url(pin):
    for pg in ((pin.get("story_pin_data") or {}).get("pages") or []):
        vl = ((pg.get("video") or {}).get("video_list") or {})
        for v in vl.values():
            if re.search(r"\.mp4($|[?#])", v.get("url") or "", re.I):
                return v["url"]
        for v in vl.values():
            if re.search(r"\.m3u8($|[?#])", v.get("url") or "", re.I):
                return v["url"]
    return None


done, skipped, failed = 0, 0, []
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
for b in BOARDS:
    m = re.search(r"pinterest\.[a-z.]+/([^/?#]+)/([^/?#]+)", b, re.I)
    if not m:
        print("skip (not a board URL):", b, flush=True)
        continue
    pins = board_pins(m.group(1), m.group(2))
    print("board %s/%s: %d pin(s)" % (m.group(1), m.group(2), len(pins)), flush=True)
    cands = [str(p["id"]) for p in pins
             if p.get("id") is not None and (p.get("is_video") or (p.get("story_pin_data") or {}).get("id"))]
    for i in range(0, len(cands), 50):
        for pin in pins_info(cands[i:i + 50]):
            pid = str(pin.get("id"))
            dest = os.path.join(OUTDIR, "spotui-%s.webm" % pid)
            if os.path.exists(dest):
                skipped += 1
                continue
            src = video_url(pin)
            if not src:
                continue
            print("converting pin", pid, flush=True)
            r = subprocess.run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error",
                                "-i", src, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30",
                                "-row-mt", "1", "-an", dest])
            if r.returncode == 0:
                done += 1
            else:
                failed.append(pid)
print("converted: %d, cached: %d, failed: %s" % (done, skipped, failed))
