#!/usr/bin/env python3
"""
Build every web media file the site needs from raw sources.

    python3 -I tools/build_media.py --src <SOURCE_DIR> [--only slug,slug] [--force]

SOURCE_DIR layout (anything missing is skipped, never invented):
    raw/<slug>/source         full original video (mov/mp4), e.g. downloaded from Drive
    thumbs/<slug>.jpg         Drive thumbnail (fallback poster when no raw video)
    grabs/<name>.jpg          single full-res frames grabbed from long films
    photos/<file>             photos (Bosco portrait, troupe, awards)

Outputs go to site/media/ using the Google Cloud Storage folder layout
(weddings/…, corporate/…, brand/…) so the folder can be uploaded to the
bucket as-is:  gcloud storage cp -r site/media/* gs://bdc-media/

Each card video becomes:
    poster.jpg   720×900 (4:5)       – card poster / LCP
    loop.mp4     720×900, 8 s, muted – auto-playing card loop (only if raw video exists)
    film.mp4     720p with audio     – full-screen player (only when PLAN asks for it)
"""
import argparse, json, re, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "site" / "media"

# ---------------------------------------------------------------------------
# What to build. focus = horizontal centre of the 4:5 crop (0..1) for landscape
# sources, vertical centre (0..1) for portrait sources.
# ---------------------------------------------------------------------------
CARDS = {
    # SIWPC Global 2024 (filmed by Snappers) – raw reels available
    "siwpc-bollywood-spectacle": dict(path="corporate/stage-events", raw="siwpc-dance-reel", loop=(7.6, 8), poster_t=11.4, focus=0.5, film=True),
    "siwpc-devotional-spectacle": dict(path="corporate/stage-events", raw="dance-video-reel", loop=(15.0, 8), poster_t=17.4, focus=0.5, film=True),
    "siwpc-classical-opening-act": dict(path="corporate/stage-events", grab="opening-act-0.8", focus=0.5),
    "siwpc-hyderabad-tribute": dict(path="corporate/stage-events", grab="hyderabad-song-0.8", focus=0.56),
    # Wedding entries – poster from Drive thumbnail until the raw file can be downloaded
    "peacock-frame-entry": dict(path="weddings/bridal-entries", raw="peacock-frame-entry", thumb="peacock-frame-entry", loop=(74.0, 8), poster_t=74.5, focus=0.5),
    "modern-classical-varmala": dict(path="weddings/bridal-entries", raw="modern-classical-varmala", thumb="modern-classical-varmala", loop=(8.0, 8), focus=0.5),
    "indian-contemporary-entry": dict(path="weddings/bridal-entries", raw="indian-contemporary-entry", thumb="indian-contemporary-entry", loop=(10.0, 8), focus=0.5),
    "modern-varmala-jaipur": dict(path="weddings/bridal-entries", raw="modern-varmala-jaipur", thumb="modern-varmala-jaipur", loop=(8.0, 8), focus=0.5),
    "reception-entry": dict(path="weddings/reception", raw="reception-entry", thumb="reception-entry", loop=(10.0, 8), focus=0.5),
    "varmala-hdf": dict(path="weddings/bridal-entries", raw="varmala-hdf", thumb="varmala-hdf", loop=(10.0, 8), focus=0.5),
    # Held back until media is available (no clean poster yet):
    "holographic-couple-entry": dict(path="weddings/performances", raw="holographic-couple-entry", loop=(150.0, 8), poster_t=160.0, focus=0.5),
    "udaivilas-entry": dict(path="weddings/bridal-entries", raw="udaivilas-entry", loop=(22.0, 8), poster_t=27.0, focus=0.5),
}

# Stills cut from raw reels for process steps and services.
STILLS = {
    "brand/process/design.jpg": dict(raw="dance-video-reel", t=3.0, size=(1080, 1350), focus=0.5),
    "brand/process/showday.jpg": dict(raw="siwpc-dance-reel", t=10.2, size=(1080, 1350), focus=0.5),
    "brand/services/production.jpg": dict(raw="dance-video-reel", t=3.0, size=(900, 1100), focus=0.5),
    "brand/services/corporate.jpg": dict(raw="siwpc-dance-reel", t=6.8, size=(900, 1100), focus=0.5),
}

PHOTOS = {
    # out path: (source file, ffmpeg crop expr or None, scale)
    "brand/founder/bosco-david.jpg": ("IMG_3799-4VZw3e1r.JPG", "crop=3024:3780:0:0", "1000:1250"),
    "brand/awards/tcei-2024.jpg": ("dancer-11-ByHTSDMa.jpeg", "crop=3024:2268:0:600", "1000:750"),
}
TROUPE = ["dancers-1-COWndNnL.jpg", "dancer-2-Dell8_m0.jpg", "dancer-5-Dg-Vh6Ez.jpeg", "dancer-4-DKlWClXk.jpg",
          "dancer-6-9nD6YA59.jpeg", "dancers-3-m-rbdLQG.jpg", "dancer-7-DIrEXE0w.jpeg", "dancer-9-8z27H4sF.jpeg",
          "dancer-8-1uL4NvPK.jpeg", "dancer-10-D0Gf0TIZ.jpeg"]


def x264(crf, maxrate):
    """H.264 settings with a bitrate ceiling, so bright stage footage can't balloon."""
    return ["-c:v", "libx264", "-crf", str(crf), "-maxrate", maxrate, "-bufsize", f"{int(float(maxrate[:-1]) * 2)}M",
            "-preset", "slow", "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]


def run(args):
    r = subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", *args], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr.strip()[-600:])


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=width,height:stream_side_data=rotation:format=duration", "-of", "json", str(path)],
                       capture_output=True, text=True)
    j = json.loads(r.stdout or "{}")
    s = (j.get("streams") or [{}])[0]
    w, h = s.get("width", 0), s.get("height", 0)
    rot = next((abs(int(sd.get("rotation", 0))) for sd in s.get("side_data_list", []) if "rotation" in sd), 0)
    if rot in (90, 270):
        w, h = h, w
    return w, h, float(j.get("format", {}).get("duration", 0) or 0)


def crop_filter(w, h, tw, th, focus):
    """Scale-to-cover then crop to tw×th, sliding the crop window to `focus`."""
    if w / h > tw / th:  # wider than target → crop sides
        return f"scale=-2:{th},crop={tw}:{th}:'max(0,min(iw-{tw},iw*{focus}-{tw}/2))':0"
    return f"scale={tw}:-2,crop={tw}:{th}:0:'max(0,min(ih-{th},ih*{focus}-{th}/2))'"


def find_raw(src, name):
    p = src / "raw" / name / "source"
    return p if p.exists() and p.stat().st_size > 1_000_000 else None


def build_cards(src, only, force, report):
    for slug, c in CARDS.items():
        if only and slug not in only:
            continue
        out = OUT / c["path"] / slug
        out.mkdir(parents=True, exist_ok=True)
        raw = find_raw(src, c.get("raw", "")) if c.get("raw") else None
        entry = {"slug": slug, "path": f'{c["path"]}/{slug}/', "poster": False, "loop": False, "film": False}
        if raw:
            w, h, dur = probe(raw)
            vf = crop_filter(w, h, 720, 900, c.get("focus", .5))
            start, length = c.get("loop", (min(5, dur / 3), 8))
            start = min(start, max(0, dur - length - .5))
            if force or not (out / "poster.jpg").exists():
                run(["-ss", str(c.get("poster_t", start + 1)), "-i", str(raw), "-frames:v", "1", "-vf", vf, "-q:v", "4", str(out / "poster.jpg")])
            if force or not (out / "loop.mp4").exists():
                run(["-ss", str(start), "-t", str(length), "-i", str(raw), "-an", "-vf", f"{vf},fps=24,fade=t=in:st=0:d=0.4,fade=t=out:st={length - .4}:d=0.4",
                     *x264(30, "1.5M"), str(out / "loop.mp4")])
            entry["loop"] = True
            if c.get("film") and (force or not (out / "film.mp4").exists()):
                portrait = h > w
                scale = "scale=720:-2" if portrait else "scale=-2:720"
                run(["-i", str(raw), "-vf", f"{scale},fps=24", *x264(27, "2.4M"),
                     "-c:a", "aac", "-b:a", "128k", "-ac", "2", str(out / "film.mp4")])
            entry["film"] = bool(c.get("film"))
            entry["poster"] = True
        else:
            img = None
            if c.get("grab") and (src / "grabs" / f'{c["grab"]}.jpg').exists():
                img = src / "grabs" / f'{c["grab"]}.jpg'
            elif c.get("thumb") and (src / "thumbs" / f'{c["thumb"]}.jpg').exists():
                img = src / "thumbs" / f'{c["thumb"]}.jpg'
            if img:
                w, h, _ = probe(img)
                run(["-i", str(img), "-frames:v", "1", "-vf", crop_filter(w, h, 720, 900, c.get("focus", .5)), "-q:v", "4", str(out / "poster.jpg")])
                entry["poster"] = True
        if not entry["poster"]:
            shutil.rmtree(out, ignore_errors=True)
        report.append(entry)


def build_stills(src):
    for rel, s in STILLS.items():
        raw = find_raw(src, s["raw"])
        if not raw:
            continue
        w, h, _ = probe(raw)
        dst = OUT / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        run(["-ss", str(s["t"]), "-i", str(raw), "-frames:v", "1", "-vf", crop_filter(w, h, *s["size"], s["focus"]), "-q:v", "4", str(dst)])


def build_photos(src):
    ph = src / "photos"
    for rel, (name, crop, scale) in PHOTOS.items():
        if not (ph / name).exists():
            continue
        dst = OUT / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        vf = ",".join(x for x in [crop, f"scale={scale}"] if x)
        run(["-i", str(ph / name), "-frames:v", "1", "-vf", vf, "-q:v", "4", str(dst)])
    tdir = OUT / "brand" / "team"
    tdir.mkdir(parents=True, exist_ok=True)
    troupe = []
    for i, name in enumerate(TROUPE):
        if not (ph / name).exists():
            continue
        w, h, _ = probe(ph / name)
        dst = tdir / f"troupe-{i + 1:02d}.jpg"
        run(["-i", str(ph / name), "-frames:v", "1", "-vf", "scale=-2:520", "-q:v", "5", str(dst)])
        troupe.append({"src": f"brand/team/{dst.name}", "ar": round(w / h, 3)})
    return troupe


def build_showreel(src):
    """Three vertical panels side by side (desktop) + a single 4:5 clip (mobile) + CTA backdrop."""
    a, b = find_raw(src, "siwpc-dance-reel"), find_raw(src, "dance-video-reel")
    if not (a and b):
        return False
    d = OUT / "brand" / "showreel"
    d.mkdir(parents=True, exist_ok=True)
    L = 16
    panels = [(a, 6.0), (b, 1.0), (b, 9.5)]
    inputs, chains = [], []
    for i, (f, t) in enumerate(panels):
        inputs += ["-ss", str(t), "-t", str(L), "-i", str(f)]
        chains.append(f"[{i}:v]scale=640:-2,crop=640:1080:0:'(ih-1080)/2',fps=24,setsar=1[p{i}]")
    fade = f"fade=t=in:st=0:d=0.5,fade=t=out:st={L - .5}:d=0.5"
    run([*inputs, "-filter_complex", ";".join(chains) + f";[p0][p1][p2]hstack=inputs=3,{fade}[v]", "-map", "[v]", "-an",
         *x264(31, "2.3M"), str(d / "showreel-wide.mp4")])
    run(["-ss", "2", "-i", str(d / "showreel-wide.mp4"), "-frames:v", "1", "-q:v", "4", str(d / "poster.jpg")])
    run(["-ss", "6", "-t", str(L), "-i", str(a), "-an", "-vf", f"{crop_filter(2160, 3840, 720, 900, .5)},fps=24,{fade}",
         *x264(30, "1.15M"), str(d / "showreel-tall.mp4")])
    run(["-ss", "16.4", "-t", "8", "-i", str(a), "-an", "-vf", "scale=960:-2,crop=960:540:0:'(ih-540)*.42',fps=24,eq=saturation=1.1",
         *x264(32, "0.7M"), str(d / "cta.mp4")])
    run(["-i", str(d / "cta.mp4"), "-frames:v", "1", "-q:v", "5", str(d / "cta.jpg")])
    return True


def build_share_image():
    """1200×630 link preview (WhatsApp, iMessage, Facebook, LinkedIn, X): Bosco's portrait fading into
    black on the left, the full gold logo with a soft glow on the right, one caption line. ~110 KB."""
    co = OUT / "brand" / "company"
    portrait, logo = OUT / "brand" / "founder" / "bosco-david.jpg", co / "logo-full.webp"
    if not (portrait.exists() and logo.exists()):
        return False
    glow = "exp(-((X-870)*(X-870)+(Y-300)*(Y-300))/90000)"
    run(["-f", "lavfi", "-i", "color=c=0x0C0B0A:s=1200x630", "-i", str(portrait), "-i", str(logo), "-filter_complex",
         f"[0]format=rgb24,geq=r='12+70*{glow}':g='11+48*{glow}':b='10+18*{glow}'[bg];"
         "[1]crop=1000:1000:0:60,scale=630:630,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(gt(X,W-230),255*pow((W-X)/230,1.6),255)'[p];"
         "[2]scale=560:-1[l];[bg][p]overlay=-60:0[a];[a][l]overlay=622:(H-h)/2-24[b];"
         "[b]drawtext=fontfile='/System/Library/Fonts/Avenir Next.ttc':text='BOSCO DAVID  ·  HYDERABAD  ·  SINCE 2006':"
         "fontsize=21:fontcolor=0xD9AE55:x=622+(560-tw)/2:y=548",
         "-frames:v", "1", "-q:v", "3", str(co / "og-image.jpg")])
    return True


BOSCO_CLIP = "boscocheorgraphyHilglitht-Bh5-VNJR.mp4"  # Bosco directing rehearsals (silent, 480×630), kept in raw/


def find_bosco_clip(src):
    for p in (ROOT / "raw" / BOSCO_CLIP, src / "photos" / BOSCO_CLIP):
        if p.exists():
            return p
    return None


def build_bosco(src):
    """0–11.8 s: Bosco directing (B&W) → 'Bosco at work' card.  12.9–20.6 s: stage rehearsal → process step 03."""
    clip = find_bosco_clip(src)
    if not clip:
        return
    w, h, _ = probe(clip)
    vf = crop_filter(w, h, 480, 600, .5)
    f = OUT / "brand" / "founder"
    f.mkdir(parents=True, exist_ok=True)
    run(["-ss", "0", "-t", "11.8", "-i", str(clip), "-an", "-vf", f"{vf},fps=30,fade=t=in:st=0:d=0.3,fade=t=out:st=11.4:d=0.4",
         *x264(27, "0.9M"), str(f / "bosco-at-work-loop.mp4")])
    run(["-ss", "1.0", "-i", str(clip), "-frames:v", "1", "-vf", vf, "-q:v", "3", str(f / "bosco-at-work.jpg")])
    run(["-i", str(clip), "-an", "-vf", "fps=30", *x264(24, "1.4M"), str(f / "bosco-at-work-film.mp4")])
    d = OUT / "brand" / "process"
    d.mkdir(parents=True, exist_ok=True)
    run(["-ss", "12.9", "-t", "7.7", "-i", str(clip), "-an", "-vf", f"{vf},fps=30", *x264(27, "0.9M"), str(d / "rehearse.mp4")])
    run(["-ss", "17.3", "-i", str(clip), "-frames:v", "1", "-vf", vf, "-q:v", "4", str(d / "rehearse.jpg")])


# "How it works" step videos: short 4:5 loops with soft fades so the loop point never shows a hard cut.
# (name: raw source, start s, length s, poster offset s)
PROCESS = {
    "design": ("dance-video-reel", 2.3, 3.0, 2.5),     # step 2 · Ganesha LED stage, classical dancers, Ganesha + troupe
    "rehearse": (BOSCO_CLIP, 12.9, 7.6, 4.4),          # step 3 · troupe rehearsing on stage
    "showday": ("siwpc-dance-reel", 6.2, 6.0, 3.8),    # step 4 · stage, dancers, pyro
}


def build_process(src):
    d = OUT / "brand" / "process"
    d.mkdir(parents=True, exist_ok=True)
    for name, (raw_name, start, length, poster_at) in PROCESS.items():
        raw = find_bosco_clip(src) if raw_name == BOSCO_CLIP else find_raw(src, raw_name)
        if not raw:
            print(f"process: {name} skipped (no source)")
            continue
        w, h, _ = probe(raw)
        vf = crop_filter(w, h, 720, 900, .5) if min(w, h) >= 720 else crop_filter(w, h, 480, 600, .5)
        fade = f"fade=t=in:st=0:d=0.45,fade=t=out:st={length - 0.45:.2f}:d=0.45"
        run(["-ss", str(start), "-t", str(length), "-i", str(raw), "-an", "-vf", f"{vf},fps=24,{fade}",
             *x264(28, "1.2M"), str(d / f"{name}.mp4")])
        run(["-ss", str(start + poster_at), "-i", str(raw), "-frames:v", "1", "-vf", vf, "-q:v", "3", str(d / f"{name}.jpg")])
        print(f"process: {name}.mp4 {round((d / f'{name}.mp4').stat().st_size / 1e6, 2)} MB")


def webp(png, dst, q=88):
    r = subprocess.run(["cwebp", "-quiet", "-q", str(q), "-alpha_q", "95", "-m", "6", str(png), "-o", str(dst)], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr)


def build_logo():
    """Logo.png (1774×887, transparent) → full / compact / mark cuts, favicons, share image."""
    logo = ROOT / "Logo.png"
    if not logo.exists():
        return False
    co = OUT / "brand" / "company"
    co.mkdir(parents=True, exist_ok=True)
    tmp = co / "_tmp.png"
    cuts = {  # name: (crop w:h:x:y in source px, output width, webp quality)
        "logo-full": ("1154:850:310:6", 1000, 80),       # wings, crown, BOSCO, Dance Company, tagline (hero)
        "logo-compact": ("1154:818:310:6", 560, 82),     # without the tagline line (footer)
        "logo-compact-sm": ("1154:818:310:6", 240, 85),  # nav + mobile menu
        "logo-mark": ("894:540:440:6", 400, 82),         # wings + crown + B (CTA, chat avatar)
        "logo-mark-sm": ("894:540:440:6", 200, 85),      # video watermark
    }
    for name, (crop, width, q) in cuts.items():
        run(["-i", str(logo), "-frames:v", "1", "-vf", f"crop={crop},scale={width}:-2:flags=lanczos", str(tmp)])
        webp(tmp, co / f"{name}.webp", q)
        if name == "logo-full":
            shutil.copy(tmp, co / "logo-full.png")
    # favicons: mark centred on a square
    mark_sq = "crop=894:540:440:6,pad=894:894:0:(oh-ih)/2:color=0x00000000"
    run(["-i", str(logo), "-frames:v", "1", "-vf", f"{mark_sq},scale=32:32:flags=lanczos", str(OUT.parent / "favicon-32.png")])
    run(["-i", str(logo), "-frames:v", "1", "-vf", f"{mark_sq},scale=192:192:flags=lanczos", str(OUT.parent / "favicon-192.png")])
    run(["-f", "lavfi", "-i", "color=c=0x16130F:s=180x180", "-i", str(logo), "-filter_complex",
         "[1]crop=894:540:440:6,scale=150:-2:flags=lanczos[m];[0][m]overlay=(W-w)/2:(H-h)/2", "-frames:v", "1", str(OUT.parent / "apple-touch-icon.png")])
    build_share_image()
    tmp.unlink(missing_ok=True)
    (co / "logo-full.png").unlink(missing_ok=True)  # only needed to compose the share image
    return True


VISION_START = 360  # 6:00 in the full YouTube video; a file shorter than ~6:20 is treated as already cut
VISION_POSTER = 156  # 2:36 into the clip: trishul, open dome, pyro (tuned for the Shiva entry; falls back to 40%)


def build_vision():
    """Video file dropped in raw/bosco-vision/ → web loop for the "Bosco's vision" section:
       · vision-av1.mp4  AV1 + AAC  (smaller; Chrome, Edge, Firefox, newer Safari)
       · vision.mp4      H.264 + AAC (fallback for everything else)
       · poster.jpg
    Never upscales; short fades at both ends so the loop point isn't a hard cut.
    D.vision in site/js/data.js already points at these paths."""
    folder = ROOT / "raw" / "bosco-vision"
    files = sorted(p for p in folder.glob("*") if p.suffix.lower() in {".mp4", ".mov", ".m4v", ".mkv", ".webm"}) if folder.exists() else []
    if not files:
        print(f"vision: no video in {folder.relative_to(ROOT)}/ yet")
        return False
    src = files[0]
    w, h, dur = probe(src)
    start = VISION_START if dur > VISION_START + 20 else 0
    length = dur - start
    out = OUT / "weddings" / "bridal-entries" / "bosco-vision"
    out.mkdir(parents=True, exist_ok=True)
    short = min(h if w >= h else w, 720)  # cap at 720p, never upscale
    scale = f"scale=-2:{short}:flags=lanczos" if w >= h else f"scale={short}:-2:flags=lanczos"
    vf = f"{scale},fade=t=in:st=0:d=0.8,fade=t=out:st={max(0, length - 0.9):.2f}:d=0.9"
    af = f"afade=t=in:st=0:d=0.8,afade=t=out:st={max(0, length - 0.9):.2f}:d=0.9"
    common = ["-ss", str(start), "-i", str(src), "-vf", vf, "-af", af, "-c:a", "aac", "-b:a", "64k", "-ac", "2", "-movflags", "+faststart"]
    run([*common, "-c:v", "libx264", "-preset", "veryslow", "-tune", "film", "-crf", "30", "-maxrate", "460k", "-bufsize", "920k",
         "-profile:v", "high", "-pix_fmt", "yuv420p", str(out / "vision.mp4")])
    run([*common, "-c:v", "libsvtav1", "-preset", "5", "-crf", "48", "-g", "250", "-pix_fmt", "yuv420p",
         str(out / "vision-av1.mp4")])  # CRF 48 ≈ H.264 CRF 30 quality (SSIM ~0.96) at ~25% fewer bits on this footage
    pt = VISION_POSTER if length > VISION_POSTER + 5 else length * 0.4
    run(["-ss", str(start + pt), "-i", str(src), "-frames:v", "1", "-vf", scale, "-q:v", "3", str(out / "poster.jpg")])
    mb = lambda f: round((out / f).stat().st_size / 1e6, 1)
    print(f"vision: {src.name} ({w}x{h}, {dur:.0f}s) → from {start}s · H.264 {mb('vision.mp4')} MB · AV1 {mb('vision-av1.mp4')} MB")
    return True


# "Some of our best work" carousel, in slide order (must match D.showcase in site/js/data.js).
# file: name in raw/showcase/ · rotate: "left" = 90° counter-clockwise (these reels were saved sideways)
SHOWCASE = [
    dict(slug="og-grand-sangeet", file="bearVideo.mp4", rotate="left", poster_t=20),
    dict(slug="royal-performance", file="video2.mp4", rotate="left", poster_t=60),
    dict(slug="royal-couple-entry", file="video3.mp4", rotate="left", poster_t=30),
]
VIDEO_EXT = {".mp4", ".mov", ".m4v", ".mkv", ".webm"}
ROTATE = {"left": "transpose=2", "right": "transpose=1", "flip": "hflip,vflip"}


def write_media_js(key, value):
    """Update one key in site/js/media.js, keeping the others."""
    js = ROOT / "site" / "js" / "media.js"
    data = {}
    if js.exists():
        m = re.search(r"window\.BDC_MEDIA = (\{.*\});", js.read_text(), re.S)
        if m:
            try:
                data = json.loads(m.group(1))
            except ValueError:
                data = {}
    data[key] = value
    js.write_text("/* Generated by tools/build_media.py: web versions of files dropped in raw/. Do not edit by hand. */\n"
                  f"window.BDC_MEDIA = {json.dumps(data, indent=2)};\n")


def has_audio(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", str(path)],
                       capture_output=True, text=True)
    return bool(r.stdout.strip())


def build_showcase():
    """Original files (from Bosco or Social Lens, never downloaded from Instagram) in raw/showcase/ →
    960×540 web loops: AV1 (smallest) + H.264 fallback, rotated as configured, short fades at the loop
    point, poster; then writes site/js/media.js so the carousel picks them up."""
    folder = ROOT / "raw" / "showcase"
    media = {}
    for i, item in enumerate(SHOWCASE):
        src = folder / item["file"]
        if not src.exists():  # also accept 1.mp4 / 2.mp4 / 3.mp4
            src = next((p for p in folder.glob(f"{i + 1}.*") if p.suffix.lower() in VIDEO_EXT), None) if folder.exists() else None
        if not src:
            print(f"showcase: {item['file']} not found in {folder.relative_to(ROOT)}/")
            continue
        w, h, dur = probe(src)
        rot = ROTATE.get(item.get("rotate", ""), "")
        if rot.startswith("transpose"):
            w, h = h, w
        out = OUT / "weddings" / "showcase" / item["slug"]
        out.mkdir(parents=True, exist_ok=True)
        # 960×540 for landscape (matches the slide's on-screen size), 540 wide for portrait; never upscale
        scale = f"scale=-2:{min(h, 540)}:flags=lanczos" if w >= h else f"scale={min(w, 540)}:-2:flags=lanczos"
        chain = ",".join(x for x in [rot, scale] if x)
        vf = f"{chain},fade=t=in:st=0:d=0.5,fade=t=out:st={max(0, dur - 0.6):.2f}:d=0.6"
        audio = has_audio(src)
        a_args = ["-af", f"afade=t=in:st=0:d=0.5,afade=t=out:st={max(0, dur - 0.6):.2f}:d=0.6", "-c:a", "aac", "-b:a", "64k", "-ac", "2"] if audio else ["-an"]
        common = ["-i", str(src), "-vf", vf, *a_args, "-movflags", "+faststart"]
        run([*common, "-c:v", "libx264", "-preset", "veryslow", "-tune", "film", "-crf", "29", "-maxrate", "1.6M", "-bufsize", "3.2M",
             "-profile:v", "high", "-pix_fmt", "yuv420p", str(out / "video.mp4")])
        run([*common, "-c:v", "libsvtav1", "-preset", "5", "-crf", "48", "-g", "240", "-pix_fmt", "yuv420p",
             "-svtav1-params", "mbr=1300", str(out / "video-av1.mp4")])
        pt = min(item.get("poster_t", dur * 0.3), max(0, dur - 1))
        run(["-ss", f"{pt:.2f}", "-i", str(src), "-frames:v", "1", "-vf", chain, "-q:v", "3", str(out / "poster.jpg")])
        base = f"weddings/showcase/{item['slug']}/"
        media[item["slug"]] = {"src": base + "video.mp4", "av1": base + "video-av1.mp4", "poster": base + "poster.jpg", "audio": audio}
        mb = lambda f: round((out / f).stat().st_size / 1e6, 1)
        print(f"showcase: {src.name} → {item['slug']} ({w}x{h}, {dur:.0f}s, audio={audio}) · H.264 {mb('video.mp4')} MB · AV1 {mb('video-av1.mp4')} MB")
    write_media_js("showcase", media)
    print(f"showcase: site/js/media.js updated ({len(media)} of {len(SHOWCASE)})")
    return bool(media)


# "Award nights" photo row in the Recognition section, newest first (order matches site/index.html).
# file: name in raw/awards/ · crop: ffmpeg crop to drop phone-screenshot bars and carousel arrows (None = keep all)
AWARD_PHOTOS = [
    ("eema-spotlight-2025", "eema-spotlight-2025.jpeg", "crop=591:739:0:190"),  # phone screenshot: drop black bars
    ("tcei-2025-stage", "tcei-2025-stage.jpeg", None),
    ("tcei-2025-team", "tcei-2025-team.jpeg", None),
    ("siwpc-2024", "siwpc-2024.jpeg", "crop=870:672:50:28"),  # drop the page band and carousel arrows
    ("siwpc-2024-close", "siwpc-2024-close.jpeg", "crop=876:616:70:0"),  # drop carousel arrows
    ("tcei-2024-bosco", "tcei-2024-bosco.jpeg", None),
    ("tcei-2023", "tcei-2023.jpeg", None),
    ("taa-virtuoso-2022-23", "taa-virtuoso-2022-23.jpeg", None),
]


def build_awards():
    """raw/awards/*.jpeg → site/media/brand/awards/<slug>.webp, 680 px tall (2× the on-screen height), never upscaled."""
    folder, out = ROOT / "raw" / "awards", OUT / "brand" / "awards"
    out.mkdir(parents=True, exist_ok=True)
    for slug, name, crop in AWARD_PHOTOS:
        src = folder / name
        if not src.exists():
            print(f"awards: {name} not found in {folder.relative_to(ROOT)}/")
            continue
        tmp = out / f"_{slug}.png"
        vf = ",".join(x for x in [crop, "scale=-2:'min(680,ih)':flags=lanczos"] if x)
        run(["-i", str(src), "-frames:v", "1", "-vf", vf, str(tmp)])
        webp(tmp, out / f"{slug}.webp", 80)
        tmp.unlink(missing_ok=True)
        w, h, _ = probe(out / f"{slug}.webp")
        print(f"awards: {slug}.webp {w}×{h} · {round((out / f'{slug}.webp').stat().st_size / 1e3)} KB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, type=Path)
    ap.add_argument("--only", default="", help="comma-separated card slugs, or 'logo' / 'bosco' / 'vision' / 'showcase' / 'process' / 'awards'")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    only = set(filter(None, a.only.split(",")))
    if only & {"logo", "bosco", "vision", "showcase", "process", "awards"}:
        if "awards" in only:
            build_awards()
        if "logo" in only:
            print("logo:", build_logo())
        if "bosco" in only:
            build_bosco(a.src); print("bosco clip: done")
        if "vision" in only:
            build_vision()
        if "showcase" in only:
            build_showcase()
        if "process" in only:
            build_process(a.src)
        return
    report = []
    build_cards(a.src, only, a.force, report)
    if not only:
        build_stills(a.src)
        build_photos(a.src)
        build_showreel(a.src)
        build_bosco(a.src)
        build_logo()
    for e in report:
        print(f'{e["slug"]:32s} poster={e["poster"]!s:5s} loop={e["loop"]!s:5s} film={e["film"]}')


if __name__ == "__main__":
    sys.exit(main())
