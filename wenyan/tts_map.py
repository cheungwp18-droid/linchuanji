# 朗讀用字：依中大《粵語審音配詞字庫》、何文匯《粵音正讀》、
# 《普通話異讀詞審音表》（文讀）把系統口語音換成文言讀書音。
# 只改 TTS 輸入，畫面原文不變。

# 粵語：Sinji 常讀白讀（-eng/-aang 等）。換成同音常用字逼出文讀。
# 依據：中大粵音庫（黃錫凌《粵音韻彙》、何文匯《粵音正讀字彙》）；
# 文言朗誦慣例見教育局「指定文言經典學習材料」粵語台詞誦。
HK_BY_JP = {
    "hang4": "衡",  # 行：文 hang4，白 haang4
    "jyut6": "月",  # 曰：文 jyut6，白 joek6（羊羊粵語／中大）
    "cing1": "清",  # 青：文 cing1，白 ceng1
    "zing3": "政",  # 正：文 zing3，白 zeng3
    "sang1": "牲",  # 生：文言讀書音 sang1
    "sing1": "升",  # 聲
    "ping4": "評",  # 平：文 ping4，白 peng4
    "ging1": "京",  # 驚：文 ging1，白 geng1
    "ting1": "汀",  # 聽：文 ting1，白 teng1
    "ting3": "聖",  # 聽（去）ting3
    "ming4": "明",  # 名
    "bing6": "並",  # 病：文 bing6，白 beng6
    "sik1": "息",  # 惜／色
    "sek6": "碩",  # 石
    "baak6": "帛",  # 白
    "geoi1": "居",  # 車：文言兵車
    "kei4": "其",  # 騎
    "gin3": "建",  # 見
    "lok6": "洛",  # 樂（快樂）
    "ngok6": "岳",  # 樂（禮樂）
    "ngaau6": "樂",  # 樂山樂水 yào
    "syut3": "雪",  # 說
    "duk6": "獨",  # 讀
    "dau6": "豆",  # 句讀
    "wai4": "圍",  # 為（平）
    "wai6": "位",  # 為（去）
    "jyu5": "雨",  # 與
    "jyu4": "余",
    "fu4": "扶",  # 夫（發語）
    "fu1": "膚",  # 夫（丈夫）
    "hou3": "耗",  # 好（去）愛好
    "ok3": "握",  # 惡（不善）
    "wu3": "誤",  # 惡（厭惡）
    "zung6": "仲",  # 重（去）
    "cung4": "叢",  # 從／重（平）
    "cung5": "仲",
    "coeng4": "腸",  # 長
    "zoeng2": "掌",
    "sou3": "素",  # 數
    "sok3": "朔",
    "siu3": "笑",  # 少（去）
    "dou6": "杜",
    "dok6": "鐸",  # 度（入）
    "koi3": "丐",  # 蓋
    "hyut3": "血",
    "bok6": "博",  # 薄 文讀
    "gaan1": "艱",
    "gaan3": "澗",
    "gang1": "耕",
    "gang3": "更",
    "ce1": "車",
    "zing6": "靜",
}

# 無 token 時的單字後備（只用於原文）
HK_BY_CH = {
    "行": "衡", "曰": "月", "青": "清", "正": "政", "生": "牲",
    "聲": "升", "平": "評", "驚": "京", "聽": "汀", "名": "明",
    "病": "並", "惜": "息", "石": "碩", "白": "帛", "車": "居",
    "騎": "其", "見": "建",
}

# 國語：審音表「文」讀。Meijia 多數已準，只改易讀白讀者。
TW_BY_PY = {
    "xuè": "謔",  # 血 文 xuè（審音表）
    "jū": "居",  # 兵車
    "dòu": "豆",  # 句讀
    "yào": "要",  # 智者樂山
}

TW_BY_CH = {
    "血": "謔",
}


def with_pauses(text: str) -> str:
    s = str(text)
    for a, b in (
        ("，", "，[[slnc 360]]"),
        ("、", "、[[slnc 240]]"),
        ("；", "；[[slnc 480]]"),
        ("：", "：[[slnc 300]]"),
        ("。", "。[[slnc 640]]"),
        ("！", "！[[slnc 640]]"),
        ("？", "？[[slnc 640]]"),
    ):
        s = s.replace(a, b)
    return s


def speak_original(lang: str, text: str, tokens=None) -> str:
    """原文朗誦：文讀。"""
    chars = []
    if tokens:
        for t in tokens:
            ch = t.get("ch") or ""
            if not t.get("han"):
                chars.append(ch)
                continue
            if lang == "zh-HK":
                jp = t.get("jp") or ""
                chars.append(HK_BY_JP.get(jp) or HK_BY_CH.get(ch) or ch)
            else:
                py = t.get("py") or ""
                chars.append(TW_BY_PY.get(py) or TW_BY_CH.get(ch) or ch)
        body = "".join(chars)
    else:
        if lang == "zh-HK":
            body = "".join(HK_BY_CH.get(c, c) for c in text)
        else:
            body = "".join(TW_BY_CH.get(c, c) for c in text)
    return with_pauses(body)


def speak_plain(text: str) -> str:
    """今譯、解說：口語節奏，只加句讀停頓。"""
    return with_pauses(text)
