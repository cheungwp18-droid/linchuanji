# 旁述引擎常把「行」讀成行列。朗讀用同音字逼出正確音節，畫面仍顯示原文。
# 行走 xíng／hang4；行列 háng／hong4；品行 xìng／hang6。


def mark_original(lang: str, text: str, tokens) -> str:
    if not tokens:
        return text
    parts = []
    for t in tokens:
        ch = t.get("ch") or ""
        if ch != "行" or not t.get("han"):
            parts.append(ch)
            continue
        py, jp = t.get("py") or "", t.get("jp") or ""
        if lang == "zh-TW":
            if py == "xíng":
                parts.append("形")  # xíng 行走
            elif py == "háng":
                parts.append("航")  # háng 行列
            elif py == "xìng":
                parts.append("興")  # xìng 品行
            else:
                parts.append(ch)
        else:
            if jp in ("hang4", "haang4"):
                parts.append("恆")  # hang4 行走
            elif jp == "hong4":
                parts.append("航")  # hong4 行列
            elif jp == "hang6":
                parts.append("幸")  # hang6 品行
            else:
                parts.append(ch)
    return "".join(parts)


def install_ssml_hooks():
    return

