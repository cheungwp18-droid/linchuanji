#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Compile corpus/*.txt into data/essays.js with pinyin + jyutping."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CORPUS = ROOT / "corpus"
OUT = ROOT / "data" / "essays.js"

sys.path.insert(0, str(ROOT.parent / ".venv" / "lib" / "python3.9" / "site-packages"))

from pypinyin import Style, pinyin as to_pinyin  # noqa: E402
import ToJyutping  # noqa: E402

HAN = re.compile(r"[\u3400-\u9fff\uF900-\uFAFF]")
INLINE = re.compile(r"([\u3400-\u9fff\uF900-\uFAFF])\{([^\{\}]+)\}")

XUCI = {
    "之": "結構助詞／代詞／動詞",
    "乎": "語氣助詞／介詞（相當於「於」）",
    "者": "助詞，標示停頓或「……的人／事物」",
    "也": "語氣助詞，常表判斷或陳述",
    "矣": "語氣助詞，表已然或感歎",
    "焉": "語氣助詞／兼詞（於之）",
    "哉": "語氣助詞，表感歎或反問",
    "歟": "語氣助詞，表感歎或疑問",
    "耶": "語氣助詞，表疑問",
    "耳": "語氣助詞，相當於「罷了」",
    "爾": "代詞／語氣助詞",
    "而": "連詞：並列、順承、轉折、修飾",
    "則": "連詞：就、那麼",
    "乃": "副詞／連詞：於是、才、是",
    "其": "代詞／語氣副詞",
    "以": "介詞／連詞：用、因、來",
    "於": "介詞：在、對、比、被",
    "于": "介詞（同「於」）",
    "與": "連詞／介詞／動詞",
    "且": "連詞：並且、尚且",
    "故": "連詞：所以",
    "蓋": "發語詞／副詞：大概",
    "夫": "發語詞／指示代詞／名詞",
    "所": "助詞，與動詞組成所字結構",
    "為": "動詞／介詞／語氣助詞",
    "因": "介詞／連詞：於是、憑藉",
    "遂": "副詞：於是",
    "既": "副詞：已經",
    "已": "副詞：已經",
    "亦": "副詞：也",
    "猶": "副詞：還、如同",
    "方": "副詞：正、才",
    "將": "副詞：將要",
    "欲": "動詞／副詞：想要",
    "何": "疑問代詞",
    "安": "疑問代詞／副詞",
    "孰": "疑問代詞：誰、哪個",
    "胡": "疑問代詞：為什麼",
    "曷": "疑問代詞",
    "奚": "疑問代詞",
    "雖": "連詞：即使、雖然",
    "若": "連詞／動詞：如果、像",
    "如": "連詞／動詞：如果、像",
    "然": "代詞／連詞／形容詞：這樣、卻",
    "是": "指示代詞／動詞（表判斷）",
    "此": "指示代詞",
    "彼": "指示代詞",
    "斯": "指示代詞",
    "或": "不定代詞：有人、有的",
    "莫": "否定代詞：沒有人",
    "弗": "否定副詞：不",
    "勿": "否定副詞：不要",
    "毋": "否定副詞：不要",
    "非": "否定副詞：不是",
    "微": "如果沒有／不是",
    "奈": "奈何",
    "庶": "副詞：希望、差不多",
    "殆": "副詞：大概、危險",
    "曾": "副詞：竟然、曾經",
    "徒": "副詞：只、白白地",
    "特": "副詞：只",
    "但": "副詞：只",
    "第": "副詞：只",
    "直": "副詞：只、一直",
    "乃": "於是／才／是",
}

# Cantonese literary readings commonly used when reciting 文言文.
WEN_DUK = {
    "青": "cing1", "清": "cing1", "情": "cing4", "晴": "cing4",
    "生": "sang1", "牲": "sang1", "甥": "sang1",
    "正": "zing3", "政": "zing3", "證": "zing3",
    "聲": "sing1", "城": "sing4", "成": "sing4", "盛": "sing6",
    "名": "ming4", "明": "ming4", "鳴": "ming4",
    "行": "hang4", "衡": "hang4",
    "寧": "ning4", "靜": "zing6", "爭": "zang1", "耕": "gang1",
    "學": "hok6", "覺": "gok3", "嶽": "ngok6",
    "白": "baak6", "百": "baak3", "柏": "baak3",
    "石": "sek6", "赤": "cik3", "客": "haak3",
    "惜": "sik1", "席": "zik6", "夕": "zik6",
    "亦": "jik6", "易": "jik6", "役": "jik6",
    "不": "bat1", "沒": "mut6",
    "見": "gin3", "現": "jin6",
    "間": "gaan1", "閒": "haan4",
    "說": "syut3", "閱": "jyut6",
    "樂": "lok6",
    "長": "coeng4", "平": "ping4",
    "大": "daai6", "夫": "fu1",
    "為": "wai4", "謂": "wai6",
    "與": "jyu5", "予": "jyu4", "余": "jyu4",
    "於": "jyu1", "于": "jyu1",
    "其": "kei4", "豈": "hei2",
    "所": "so2", "以": "ji5", "已": "ji5", "矣": "ji5",
    "者": "ze2", "也": "jaa5", "乎": "fu4", "哉": "zoi1",
    "焉": "jin4", "兮": "hai4", "耳": "ji5", "爾": "ji5",
    "而": "ji4", "則": "zik1", "乃": "naai5", "遂": "seoi6",
    "故": "gu3", "因": "jan1", "蓋": "koi3",
    "何": "ho4", "安": "on1", "孰": "suk6",
    "此": "ci2", "是": "si6", "彼": "bei2", "斯": "si1",
    "無": "mou4", "毋": "mou4", "勿": "mat6", "弗": "fat1", "非": "fei1",
    "可": "ho2", "能": "nang4", "欲": "juk6", "將": "zoeng1",
    "若": "joek6", "如": "jyu4", "然": "jin4",
    "雖": "seoi1", "即": "zik1", "既": "gei3",
    "或": "waak6", "莫": "mok6",
    "曰": "joek6", "云": "wan4", "言": "jin4",
    "之": "zi1", "知": "zi1", "師": "si1",
    "人": "jan4", "民": "man4", "君": "gwan1",
    "天": "tin1", "地": "dei6", "山": "saan1", "水": "seoi2",
    "日": "jat6", "月": "jyut6", "年": "nin4",
    "國": "gwok3", "家": "gaa1", "心": "sam1",
    "文": "man4", "書": "syu1", "詩": "si1",
    "春": "ceon1", "秋": "cau1",
    "東": "dung1", "南": "naam4", "西": "sai1", "北": "bak1",
    "中": "zung1", "上": "soeng6", "下": "haa6",
    "古": "gu2", "今": "gam1",
    "聖": "sing3", "賢": "jin4", "愚": "jyu4",
    "憂": "jau1", "喜": "hei2", "悲": "bei1",
    "醉": "zeoi3", "酒": "zau2",
    "亭": "ting4", "樓": "lau4", "閣": "gok3",
    "記": "gei3", "銘": "ming5", "賦": "fu3", "序": "zeoi6", "表": "biu2",
    "論": "leon6", "說": "syut3", "傳": "cyun4", "書": "syu1",
}

# (pattern on clean han+punct string, han-index of target, py, jp)
# Applied after auto romanization. Inline {} always wins later.

def _han_indices(s: str) -> list[int]:
    return [i for i, ch in enumerate(s) if HAN.match(ch)]


def apply_literary(clean: str, pys: list[str], jps: list[str]) -> None:
    """Fix common 文言文 readings. Indices are over HAN characters only."""
    hans = [ch for ch in clean if HAN.match(ch)]
    n = len(hans)
    if n != len(pys):
        return

    def set_i(i: int, py: str, jp: str) -> None:
        if 0 <= i < n:
            pys[i] = py
            jps[i] = jp

    def find(sub: str) -> list[int]:
        out = []
        start = 0
        joined = "".join(hans)
        while True:
            k = joined.find(sub, start)
            if k < 0:
                break
            out.append(k)
            start = k + 1
        return out

    # sentence-initial 夫 / 蓋 / 若夫
    if hans and hans[0] == "夫":
        set_i(0, "fú", "fu4")
    if n >= 2 and hans[0] == "若" and hans[1] == "夫":
        set_i(1, "fú", "fu4")
    if hans and hans[0] == "蓋":
        set_i(0, "gài", "koi3")

    for i, ch in enumerate(hans):
        # 不 always literary
        if ch == "不":
            set_i(i, "bù", "bat1")
        if ch == "一":
            set_i(i, "yī", "jat1")

    joined = "".join(hans)
    # 長 default cháng; zhǎng only in 年長／消長／官長 etc.
    for i, ch in enumerate(hans):
        if ch == "長":
            set_i(i, "cháng", "coeng4")
    for idx in find("無長無少"):
        set_i(idx + 1, "zhǎng", "zoeng2")
    for sub, off in (("長史", 0), ("長者", 0), ("長幼", 0), ("官長", 1), ("縣長", 1), ("消長", 1), ("增長", 1)):
        for idx in find(sub):
            set_i(idx + off, "zhǎng", "zoeng2")
    for m in re.finditer(r"少長|長少", joined):
        set_i(m.start() + m.group().find("長"), "zhǎng", "zoeng2")

    # 樂山 / 樂水 / 樂其樂 / 智者樂  → yào (喜愛)
    for m in re.finditer(r"樂(?=[山水])", joined):
        set_i(m.start(), "yào", "ngaau6")
    for idx in find("樂其樂"):
        set_i(idx, "yào", "ngaau6")
    for idx in find("智者樂"):
        set_i(idx + 2, "yào", "ngaau6")
    for idx in find("仁者樂"):
        set_i(idx + 2, "yào", "ngaau6")
    # 禮樂 / 樂師 / 鼓樂 / 樂毅 / 樂經 → yuè
    for m in re.finditer(r"(?:禮樂|樂師|鼓樂|樂毅|雅樂|音樂|之樂也者|謂之樂|尊樂|異國之樂|色樂珠玉)", joined):
        chunk = m.group()
        off = chunk.find("樂")
        set_i(m.start() + off, "yuè", "ngok6")
    for idx in find("樂也者"):
        set_i(idx, "yuè", "ngok6")
    # 不亦說乎 說 = yuè
    for m in re.finditer(r"說乎", joined):
        set_i(m.start(), "yuè", "jyut6")
    # 遊說 / 說秦 / 說客
    for m in re.finditer(r"說(?=[秦客]|齊王)|遊說", joined):
        set_i(m.start() if joined[m.start()] == "說" else m.start() + 1, "shuì", "seoi3")
    for idx in find("遊說"):
        set_i(idx + 1, "shuì", "seoi3")
    # 句讀
    for idx in find("句讀"):
        set_i(idx + 1, "dòu", "dau6")
    # 或不焉 不 = fǒu
    for idx in find("或不焉"):
        set_i(idx + 1, "fǒu", "fau2")
    # 好古文 / 好學 / 好士 / 好文 / 好遊 / 所好
    for m in re.finditer(r"好(?=[古學士文賢遊讀])", joined):
        set_i(m.start(), "hào", "hou3")
    for idx in find("所好"):
        set_i(idx + 1, "hào", "hou3")
    # 無長無少
    for idx in find("無長無少"):
        set_i(idx + 1, "zhǎng", "zoeng2")
        set_i(idx + 3, "shào", "siu3")
    # 少時 / 少年 / 少聰 / 少長
    for m in re.finditer(r"少(?=[時年聰小長])", joined):
        set_i(m.start(), "shào", "siu3")
    for idx in find("玩好"):
        set_i(idx + 1, "hào", "hou3")
    # 馮虛 / 馮恃
    for idx in find("馮虛"):
        set_i(idx, "píng", "pang4")
    # 朝暮 / 朝而 / 朝暉 / 朝菌 / 朝歌 / 朝服 / 朝濟 / 朝不慮夕 / 一朝一夕
    for m in re.finditer(r"朝(?=[暮而暉菌夕往發歌服濟不])", joined):
        set_i(m.start(), "zhāo", "ziu1")
    for idx in find("一朝一夕"):
        set_i(idx + 1, "zhāo", "ziu1")
    for idx in find("會稽"):
        set_i(idx, "kuài", "kui2")
    for idx in find("吳會"):
        set_i(idx + 1, "kuài", "kui2")
    # 數呂 / 數有 / 數請 屢次
    for m in re.finditer(r"數(?=[呂有請遷月])", joined):
        set_i(m.start(), "shuò", "sok3")
    # 見於 / 見殺 表被動 often xiàn?  literally 見 as 被 is jiàn still in many textbooks
    # 王此 / 王天下 verb
    for m in re.finditer(r"王(?=[此天漢之])", joined):
        # only if used as verb — conservative: 王天下 王此
        if joined[m.start():m.start()+2] in ("王天", "王此") or (
            m.start() + 1 < n and joined[m.start() + 1] == "之"
        ):
            set_i(m.start(), "wàng", "wong6")
    for idx in find("王天下"):
        set_i(idx, "wàng", "wong6")
    # 傳記 / 經傳 / 列傳 / 自傳 / 《…傳》
    for m in re.finditer(r"(?:經傳|列傳|本傳|內傳|外傳)", joined):
        set_i(m.start() + 1, "zhuàn", "zyun6")
    for m in re.finditer(r"傳$", joined):
        if n >= 2:
            set_i(n - 1, "zhuàn", "zyun6")
    # 騎 as classifier of cavalry 千騎 萬騎
    for m in re.finditer(r"[千萬數]騎", joined):
        set_i(m.start() + 1, "jì", "ke3")
    # 度 as 估量
    for m in re.finditer(r"度(?=[其己德])", joined):
        set_i(m.start(), "duó", "dok6")
    # 屬 as 囑
    for m in re.finditer(r"屬(?=[予予之酒客])", joined):
        set_i(m.start(), "zhǔ", "zuk1")
    for idx in find("屬予"):
        set_i(idx, "zhǔ", "zuk1")
    # 勝 as 禁得起 不勝
    for idx in find("不勝"):
        set_i(idx + 1, "shēng", "sing1")
    # 間 as 參與 / 離間
    for m in re.finditer(r"間(?=[道隙])", joined):
        set_i(m.start(), "jiàn", "gaan3")
    # 食 as 給吃 sì
    for m in re.finditer(r"食(?=[之我])", joined):
        set_i(m.start(), "sì", "zi6")
    # 從橫 合從
    for idx in find("合從"):
        set_i(idx + 1, "zòng", "zung3")
    for idx in find("從衡"):
        set_i(idx, "zòng", "zung3")
    # 亡 as 無
    for m in re.finditer(r"亡(?=[以何疑])", joined):
        set_i(m.start(), "wú", "mou4")
    # 邪 as 耶
    for i, ch in enumerate(hans):
        if ch == "邪" and i == n - 1:
            set_i(i, "yé", "je4")
    # 與 as 歟 at end
    for i, ch in enumerate(hans):
        if ch == "與" and i == n - 1:
            set_i(i, "yú", "jyu4")
    # 長煙 / 長安 keep cháng; 長官 / 為長 zhǎng
    for idx in find("為長"):
        set_i(idx + 1, "zhǎng", "zoeng2")
    # 中 as hit
    for m in re.finditer(r"(射者中|中人|中於)", joined):
        pos = m.group().find("中")
        set_i(m.start() + pos, "zhòng", "zung3")
    # 遺 as 贈 wèi
    for m in re.finditer(r"遺(?=[之先王])", joined):
        set_i(m.start(), "wèi", "wai6")
    # 讀 as 句讀 already; 讀書 dú default
    # 幾 as 幾乎 / 幾許
    for m in re.finditer(r"幾(?=[乎許何])", joined):
        set_i(m.start(), "jī", "gei1")
    # 期年
    for idx in find("期年"):
        set_i(idx, "jī", "gei1")
    # 奇 as 餘 jī 一奇
    # 降 投降
    for idx in find("投降"):
        set_i(idx + 1, "xiáng", "hong4")
    for idx in find("降之"):
        set_i(idx, "xiáng", "hong4")
    # 燕國 yān
    for idx in find("燕趙"):
        set_i(idx, "yān", "jin1")
    for idx in find("燕國"):
        set_i(idx, "yān", "jin1")
    for idx in find("燕王"):
        set_i(idx, "yān", "jin1")
    # 大宛 / 汗 as hán already
    # 騎從
    # 丞相
    # 省 as xǐng 反省
    for idx in find("自省"):
        set_i(idx + 1, "xǐng", "sing2")
    for idx in find("不省"):
        set_i(idx + 1, "xǐng", "sing2")
    # 數口之家 shù
    # 王侯
    # 於是
    # 為 in 以為 wéi, 為之 often wèi when "for"
    for idx in find("以為"):
        set_i(idx + 1, "wéi", "wai4")
    # 弟子供
    # 罷 as pí fatigued 罷夫
    for idx in find("罷夫"):
        set_i(idx, "pí", "pei4")
    # 特 as 三尺之特? skip
    # 論 in 論語 lún
    for idx in find("論語"):
        set_i(idx, "lún", "leon4")
    # 重 as chóng 重複; 傷 重傷 zhòng
    for idx in find("重傷"):
        set_i(idx, "chóng", "cung4")
    # 子魚論戰 「不重傷」= 不再傷害傷者 chóng
    for idx in find("不重傷"):
        set_i(idx + 1, "chóng", "cung4")
    # 禽 通 擒
    # 陳 通 陣 既陳
    for idx in find("既陳"):
        set_i(idx + 1, "zhèn", "zan6")
    # 濟 渡河
    # 鼓 擊鼓進攻
    # 乘 shèng 車乘
    for m in re.finditer(r"[車兵]乘|[0-9一二三四五六七八九十百千]乘", joined):
        set_i(m.end() - 1, "shèng", "sing6")
    # 度 already
    # 殷 紅 yān
    for m in re.finditer(r"殷(?=[紅血])", joined):
        set_i(m.start(), "yān", "jan1")
    # 騎
    # 汗南 河南
    # 說 師說 shuō — default, good
    # 惡 wù 憎惡
    for m in re.finditer(r"惡(?=[之乎其])", joined):
        set_i(m.start(), "wù", "wu3")
    # 將軍
    # 騎都尉 skip
    # 當 as dàng 適當
    # 更 gēng 更改 / 更更
    for m in re.finditer(r"更(?=[為之改號])", joined):
        set_i(m.start(), "gēng", "gang1")
    # 數 shǔ 計數
    for m in re.finditer(r"數(?=[之呂])", joined):
        set_i(m.start(), "shǔ", "sou2")
    # 涼 風
    # 騎
    # 艾
    # 宿 xiù 星宿 vs sù
    # 通用 通「同」
    # 被 pī 披
    for m in re.finditer(r"被(?=[髮衣甲])", joined):
        set_i(m.start(), "pī", "pei1")
    # 暴 pù 暴露 / 暴霜露
    for idx in find("暴霜"):
        set_i(idx, "pù", "buk6")
    for idx in find("暴露"):
        set_i(idx, "pù", "buk6")
    # 勝 不勝枚舉 already
    # 騎
    # 於 同 烏 歎詞? skip
    # 邪
    # 相 xiàng 宰相
    for idx in find("丞相"):
        set_i(idx + 1, "xiàng", "soeng3")
    for idx in find("宰相"):
        set_i(idx + 1, "xiàng", "soeng3")
    for idx in find("相如"):  # 藺相如
        set_i(idx, "xiāng", "soeng1")
    # 降
    # 讀
    # 父 fǔ 參軍? 甫
    #  nom
    # 樂 remaining stay lè / lok6 which is default for 快樂
    # 王守仁 name wáng — default good

    # Apply 文讀 overlay for jyutping when still default-ish
    for i, ch in enumerate(hans):
        if ch in WEN_DUK:
            # don't overwrite jyutping if we already set a special one
            # Only fill when ToJyutping produced a 白讀 that we want to replace
            preferred = WEN_DUK[ch]
            # Always prefer 文讀 for these scholarly recitation chars
            # but skip if we already set a non-default special reading in this function
            # Simplest: if current jp is empty, set; for 白讀 pairs, overwrite
            bai_to_wen = {
                "saang1": "sang1",  # 生
                "ceng1": "cing1",  # 青
                "zeng3": "zing3",  # 正
                "meng2": "ming4",  # 名 sometimes
                "seng4": "sing4",
                "ceng4": "cing4",
            }
            if jps[i] in bai_to_wen:
                jps[i] = bai_to_wen[jps[i]]
            if ch in ("不",):
                jps[i] = "bat1"


def parse_inline(raw: str) -> tuple[str, dict[int, tuple[str, str | None]]]:
    """Return display text and {han_index: (py, jp?)} from 樂{yào,ngaau6} markup."""
    overrides: dict[int, tuple[str, str | None]] = {}
    out = []
    han_i = 0
    i = 0
    while i < len(raw):
        m = INLINE.match(raw, i)
        if m:
            ch, spec = m.group(1), m.group(2)
            out.append(ch)
            parts = [p.strip() for p in spec.split(",")]
            py = parts[0] if parts else ""
            jp = parts[1] if len(parts) > 1 else None
            overrides[han_i] = (py, jp)
            han_i += 1
            i = m.end()
            continue
        ch = raw[i]
        out.append(ch)
        if HAN.match(ch):
            han_i += 1
        i += 1
    return "".join(out), overrides


def romanize(display: str, overrides: dict[int, tuple[str, str | None]]) -> list[dict]:
    hans = [ch for ch in display if HAN.match(ch)]
    if not hans:
        tokens = []
        buf = ""
        for ch in display:
            buf += ch
        if display:
            tokens.append({"ch": display, "han": False, "py": "", "jp": ""})
        return tokenize_mixed(display, [], [])

    py_list = [x[0] for x in to_pinyin("".join(hans), style=Style.TONE, errors=lambda c: c)]
    jp_pairs = ToJyutping.get_jyutping_list("".join(hans))
    jp_list = []
    for ch, jp in jp_pairs:
        if HAN.match(ch):
            jp_list.append(jp or "")
    # ToJyutping may drop some chars; fall back per-char
    if len(jp_list) != len(hans):
        jp_list = []
        for ch in hans:
            pair = ToJyutping.get_jyutping_list(ch)
            jp_list.append(pair[0][1] if pair and pair[0][1] else "")

    if len(py_list) != len(hans):
        py_list = [x[0] for x in to_pinyin("".join(hans), style=Style.TONE, errors="default")]
        if len(py_list) != len(hans):
            py_list = []
            for ch in hans:
                py_list.append(to_pinyin(ch, style=Style.TONE)[0][0])

    apply_literary(display, py_list, jp_list)

    for i, (py, jp) in overrides.items():
        if 0 <= i < len(py_list) and py:
            py_list[i] = py
        if 0 <= i < len(jp_list) and jp:
            jp_list[i] = jp

    return tokenize_mixed(display, py_list, jp_list)


def tokenize_mixed(display: str, pys: list[str], jps: list[str]) -> list[dict]:
    tokens = []
    hi = 0
    buf = ""
    def flush_non():
        nonlocal buf
        if buf:
            tokens.append({"ch": buf, "han": False, "py": "", "jp": ""})
            buf = ""
    for ch in display:
        if HAN.match(ch):
            flush_non()
            tokens.append({
                "ch": ch,
                "han": True,
                "py": pys[hi] if hi < len(pys) else "",
                "jp": jps[hi] if hi < len(jps) else "",
            })
            hi += 1
        else:
            buf += ch
    flush_non()
    return tokens


def parse_file(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    chunks = re.split(r"^=====\s*$", text, flags=re.M)
    essays = []
    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk or chunk.startswith("#"):
            continue
        essays.append(parse_essay(chunk, source=path.name))
    return essays


def parse_essay(chunk: str, source: str = "") -> dict:
    lines = chunk.splitlines()
    meta: dict[str, str] = {}
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            if meta:
                break
            continue
        if ":" in line and not line.startswith((">", "-", "#", "　")):
            key, _, val = line.partition(":")
            key = key.strip()
            if re.match(r"^[A-Za-z_]+$", key):
                meta[key] = val.strip()
                i += 1
                continue
        break

    paragraphs = []
    cur_title = ""
    cur_sents: list[dict] = []

    def flush_para():
        nonlocal cur_title, cur_sents
        if cur_sents:
            paragraphs.append({"title": cur_title, "sentences": cur_sents})
            cur_sents = []

    raw_orig = []
    trans = None
    notes = []
    grammar = ""

    def flush_sent():
        nonlocal raw_orig, trans, notes, grammar
        if not raw_orig:
            return
        raw = "".join(raw_orig).strip()
        display, ov = parse_inline(raw)
        tokens = romanize(display, ov)
        note_objs = []
        for n in notes:
            note_objs.append(n)
        # auto 虛詞 notes if not already covered
        covered = {n["w"] for n in note_objs}
        seen = set()
        for tok in tokens:
            if not tok["han"]:
                continue
            ch = tok["ch"]
            if ch in XUCI and ch not in covered and ch not in seen:
                note_objs.append({"w": ch, "g": XUCI[ch], "pos": "虛詞", "auto": True})
                seen.add(ch)
        cur_sents.append({
            "text": display,
            "trans": (trans or "").strip(),
            "notes": note_objs,
            "grammar": grammar.strip(),
            "tokens": tokens,
        })
        raw_orig, trans, notes, grammar = [], None, [], ""

    while i < len(lines):
        line = lines[i]
        if line.startswith("##"):
            flush_sent()
            flush_para()
            cur_title = line.lstrip("#").strip()
            i += 1
            continue
        if not line.strip():
            flush_sent()
            i += 1
            continue
        if line.startswith(">"):
            trans = (trans or "") + line[1:].strip()
            i += 1
            continue
        if line.startswith("- "):
            parts = [p.strip() for p in line[2:].split("｜")]
            w = parts[0] if parts else ""
            g = parts[1] if len(parts) > 1 else ""
            pos = parts[2] if len(parts) > 2 else ""
            notes.append({"w": w, "g": g, "pos": pos, "auto": False})
            i += 1
            continue
        if line.startswith("# "):
            grammar = line[2:].strip()
            i += 1
            continue
        # original text
        if trans is not None or notes or grammar:
            # new sentence started without blank line
            flush_sent()
        raw_orig.append(line.strip())
        i += 1
    flush_sent()
    flush_para()

    chars = sum(
        1
        for p in paragraphs
        for s in p["sentences"]
        for t in s["tokens"]
        if t["han"]
    )
    return {
        "id": meta.get("id") or path_stem(source),
        "n": int(meta.get("n") or 0),
        "stage": int(meta.get("stage") or 1),
        "title": meta.get("title", ""),
        "author": meta.get("author", ""),
        "dynasty": meta.get("dynasty", ""),
        "years": meta.get("years", ""),
        "genre": meta.get("genre", ""),
        "excerpt": meta.get("excerpt", "false").lower() == "true",
        "background": meta.get("background", ""),
        "theme": meta.get("theme", ""),
        "focus": meta.get("focus", ""),
        "paragraphs": paragraphs,
        "chars": chars,
    }


def path_stem(name: str) -> str:
    return Path(name).stem


def main() -> None:
    essays: list[dict] = []
    files = sorted(CORPUS.glob("*.txt"))
    if not files:
        sys.exit("no corpus/*.txt")
    for f in files:
        essays.extend(parse_file(f))
    essays.sort(key=lambda e: (e["stage"], e["n"]))
    # sanity
    missing = [e["id"] for e in essays if not e["paragraphs"]]
    if missing:
        sys.exit(f"empty essays: {missing}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "site": "文言四十講",
        "tagline": "國語拼音 · 粵音粵拼 · 逐句今譯",
        "count": len(essays),
        "essays": essays,
    }
    OUT.write_text(
        "window.WENYAN = " + json.dumps(payload, ensure_ascii=False, indent=None) + ";\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT}  ({len(essays)} essays, {sum(e['chars'] for e in essays)} chars)")
    for e in essays:
        ns = sum(len(p["sentences"]) for p in e["paragraphs"])
        print(f"  {e['n']:02d} {e['title']}  {e['chars']}字 / {ns}句")


if __name__ == "__main__":
    main()
