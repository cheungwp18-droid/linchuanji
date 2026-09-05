#!/usr/bin/env python3
"""Pre-render 講課／朗誦 m4a with macOS say (Meijia / Sinji)."""
import json
import os
import re
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from tts_map import speak_original, speak_plain

ROOT = Path(__file__).resolve().parent
ESSAYS = ROOT / "data" / "essays.js"
OUT = ROOT / "audio" / "say"
# 朗誦宜慢：say 預設約 175 wpm；文言台詞誦再放慢。
VOICES = {"zh-TW": ("Meijia", 118), "zh-HK": ("Sinji", 102)}

UI = {
    "zh-TW": [
        "我們看這一句。",
        "先讀原文。",
        "意思是：",
        "來，考一考。",
        "對。很好。",
        "還不是。再看一眼原文。",
        "講",
    ],
    "zh-HK": [
        "我哋睇呢一句。",
        "我哋先讀原文。",
        "意思係：",
        "嚟，考一考。",
        "啱。好。",
        "未係。再睇原文一眼。",
        "講",
    ],
}


def clip_hash(lang: str, text: str) -> str:
    h = 5381
    s = lang + "\n" + text
    for ch in s:
        h = ((h << 5) + h + ord(ch)) & 0xFFFFFFFF
    return format(h, "x")


def load_essays():
    raw = ESSAYS.read_text(encoding="utf-8")
    raw = re.sub(r"^window\.WENYAN\s*=\s*", "", raw.strip())
    raw = raw.rstrip(";")
    return json.loads(raw)


def collect():
    data = load_essays()
    items = []  # (lang, original, spoken)

    def add(lang, original, spoken=None, literary=False, tokens=None):
        original = str(original or "").strip()
        if not original:
            return
        if spoken is None:
            spoken = speak_original(lang, original, tokens) if literary else speak_plain(original)
        items.append((lang, original, spoken))

    for lang, phrases in UI.items():
        for p in phrases:
            add(lang, p, literary=False)
    for e in data["essays"]:
        add("zh-TW", f"這一講，我們讀{e.get('dynasty','')}{e.get('author','')}的《{e.get('title','')}》。")
        add("zh-HK", f"呢一講，我哋讀{e.get('dynasty','')}{e.get('author','')}嘅《{e.get('title','')}》。")
        if e.get("theme"):
            add("zh-TW", "這篇文章的題旨是：" + e["theme"])
            add("zh-HK", "呢篇文章嘅題旨係：" + e["theme"])
        if e.get("focus"):
            add("zh-TW", "讀的時候，請留意：" + e["focus"])
            add("zh-HK", "讀嘅時候，請留心：" + e["focus"])
        if e.get("background"):
            add("zh-TW", e["background"])
            add("zh-HK", e["background"])
        add("zh-TW", f"《{e.get('title','')}》先讀到這裏。題旨記住：{e.get('theme') or '見篇首。'}")
        add("zh-HK", f"《{e.get('title','')}》今日先讀到呢度。題旨記住：{e.get('theme') or '見篇首。'}")
        for p in e.get("paragraphs") or []:
            if p.get("title"):
                add("zh-TW", f"下一段，「{p['title']}」。")
                add("zh-HK", f"下一段，「{p['title']}」。")
            for s in p.get("sentences") or []:
                if s.get("text"):
                    toks = s.get("tokens")
                    add("zh-TW", s["text"], literary=True, tokens=toks)
                    add("zh-HK", s["text"], literary=True, tokens=toks)
                if s.get("trans"):
                    add("zh-TW", "意思是：" + s["trans"])
                    add("zh-HK", "意思係：" + s["trans"])
    uniq = {}
    for lang, original, spoken in items:
        uniq[(lang, original)] = (clip_hash(lang, original), spoken)
    return uniq


def render_one(lang: str, text: str, dest: Path) -> str:
    voice, rate = VOICES[lang]
    dest.parent.mkdir(parents=True, exist_ok=True)
    fd, aiff = tempfile.mkstemp(suffix=".aiff")
    os.close(fd)
    try:
        r = subprocess.run(
            ["say", "-v", voice, "-r", str(rate), "-o", aiff, text],
            capture_output=True,
            timeout=60,
        )
        if r.returncode != 0 or not os.path.exists(aiff) or os.path.getsize(aiff) < 100:
            return "fail-say"
        tmp_m4a = str(dest) + ".tmp.m4a"
        r2 = subprocess.run(
            ["afconvert", "-f", "m4af", "-d", "aac", "-s", "3", "-b", "48000", aiff, tmp_m4a],
            capture_output=True,
            timeout=30,
        )
        if r2.returncode != 0 or not os.path.exists(tmp_m4a):
            return "fail-af"
        os.replace(tmp_m4a, dest)
        return "ok"
    finally:
        try:
            os.remove(aiff)
        except OSError:
            pass
        try:
            os.remove(str(dest) + ".tmp.m4a")
        except OSError:
            pass


def main():
    uniq = collect()
    jobs = []
    for (lang, original), (hid, spoken) in uniq.items():
        dest = OUT / lang / f"{hid}.m4a"
        jobs.append((lang, spoken, dest, hid))
    print(f"clips {len(jobs)}", flush=True)
    ok = skip = fail = 0
    index = {"zh-TW": [], "zh-HK": []}
    with ThreadPoolExecutor(max_workers=5) as ex:
        futs = {ex.submit(render_one, lang, text, dest): (lang, hid) for lang, text, dest, hid in jobs}
        for i, fut in enumerate(as_completed(futs), 1):
            lang, hid = futs[fut]
            try:
                st = fut.result()
            except Exception:
                st = "fail"
            if st == "ok":
                ok += 1
            elif st == "skip":
                skip += 1
            else:
                fail += 1
            if st in ("ok", "skip"):
                index[lang].append(hid)
            if i % 50 == 0 or i == len(jobs):
                print(f"... {i}/{len(jobs)} ok={ok} skip={skip} fail={fail}", flush=True)
    ping_src = OUT / "zh-TW" / f"{clip_hash('zh-TW', '講')}.m4a"
    ping_dst = OUT / "ping.m4a"
    if ping_src.exists():
        ping_dst.write_bytes(ping_src.read_bytes())
    idx_path = OUT / "index.js"
    idx_path.write_text(
        "window.WENYAN_SAY = " + json.dumps(index, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    print(f"done ok={ok} skip={skip} fail={fail} -> {OUT}", flush=True)
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
