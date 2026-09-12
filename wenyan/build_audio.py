#!/usr/bin/env python3
"""Pre-render 講課／朗誦 mp3 with Microsoft neural TTS (edge-tts).

發音源：
  國語  zh-CN-XiaoxiaoNeural  標準普通話（對應《普通話異讀詞審音表》）
  粵語  zh-HK-HiuMaanNeural   香港粵語神經語音
原文直讀，不加同音替換，以免「月／衡／並」等聽成別字。
"""
import asyncio
import json
import re
import sys
import time
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent
ESSAYS = ROOT / "data" / "essays.js"
OUT = ROOT / "audio" / "say"
VOICES = {
    "zh-TW": "zh-CN-YunyangNeural",  # 新聞／紀錄片旁述
    "zh-HK": "zh-HK-WanLungNeural",  # 香港電視男聲旁述
}
RATE = "-18%"
PITCH = "-6Hz"

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
    items = []

    def add(lang, text):
        text = str(text or "").strip()
        if text:
            items.append((lang, text))

    for lang, phrases in UI.items():
        for p in phrases:
            add(lang, p)
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
                    add("zh-TW", s["text"])
                    add("zh-HK", s["text"])
                if s.get("trans"):
                    add("zh-TW", "意思是：" + s["trans"])
                    add("zh-HK", "意思係：" + s["trans"])
    uniq = {}
    for lang, text in items:
        uniq[(lang, text)] = clip_hash(lang, text)
    return uniq


async def render_one(sem, lang, text, dest: Path, fresh_after: float) -> str:
    async with sem:
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.exists() and dest.stat().st_mtime >= fresh_after and dest.stat().st_size > 400:
            return "skip"
        tmp = dest.with_suffix(".tmp.mp3")
        last = "fail"
        for _ in range(3):
            try:
                comm = edge_tts.Communicate(text, VOICES[lang], rate=RATE, pitch=PITCH)
                await asyncio.wait_for(comm.save(str(tmp)), timeout=45)
                if tmp.exists() and tmp.stat().st_size >= 400:
                    tmp.replace(dest)
                    return "ok"
                last = "fail-empty"
            except Exception as e:
                last = "fail"
            try:
                if tmp.exists():
                    tmp.unlink()
            except OSError:
                pass
            await asyncio.sleep(0.6)
        return last


async def main_async():
    uniq = collect()
    jobs = []
    for (lang, text), hid in uniq.items():
        dest = OUT / lang / f"{hid}.mp3"
        jobs.append((lang, text, dest, hid))
    print(f"clips {len(jobs)} voices={VOICES} rate={RATE}", flush=True)
    fresh_after = time.time() - 50 * 60
    sem = asyncio.Semaphore(3)
    ok = fail = skip = 0
    index = {"zh-TW": [], "zh-HK": []}
    async def tagged(lang, hid, dest, text):
        st = await render_one(sem, lang, text, dest, fresh_after)
        return lang, hid, st

    tasks = [tagged(lang, hid, dest, text) for lang, text, dest, hid in jobs]
    n = 0
    for fut in asyncio.as_completed(tasks):
        lang, hid, st = await fut
        n += 1
        if st == "ok":
            ok += 1
            index[lang].append(hid)
        elif st == "skip":
            skip += 1
            index[lang].append(hid)
        else:
            fail += 1
            print("fail", lang, hid, st, flush=True)
        if n % 50 == 0 or n == len(jobs):
            print(f"... {n}/{len(jobs)} ok={ok} skip={skip} fail={fail}", flush=True)
    ping_src = OUT / "zh-TW" / f"{clip_hash('zh-TW', '講')}.mp3"
    ping_dst = OUT / "ping.mp3"
    if ping_src.exists():
        ping_dst.write_bytes(ping_src.read_bytes())
    (OUT / "index.js").write_text(
        "window.WENYAN_SAY = " + json.dumps(index, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    print(f"done ok={ok} skip={skip} fail={fail} -> {OUT}", flush=True)
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main_async()))
