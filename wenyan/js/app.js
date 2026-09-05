/* 文言四十講 */
(function () {
  const ASSET = (document.currentScript && document.currentScript.src)
    ? document.currentScript.src.replace(/js\/app\.js(\?.*)?$/, "")
    : "wenyan/";
  const asset = (p) => ASSET + String(p || "").replace(/^\//, "");
  const DATA = window.WENYAN;
  const STAGES = {
    1: { name: "文言初識", hint: "記賦銘說，先立語感" },
    2: { name: "文言築基", hint: "表論左傳，學會敘議" },
    3: { name: "文言深化", hint: "書序史論，見章法骨力" },
    4: { name: "文言貫通", hint: "情理心性，讀到文章背後" },
  };
  const XUCI = "之乎者也矣焉哉歟耶耳爾而則乃其以於于與且故蓋夫所為因遂既已亦猶方將欲何安孰胡曷奚雖若如然是此彼斯或莫弗勿毋非微奈庶殆曾徒特但第直";

  const state = {
    mode: localStorage.getItem("wy-mode") || "both",
    trans: localStorage.getItem("wy-trans") !== "0",
    notes: localStorage.getItem("wy-notes") !== "0",
    xuci: localStorage.getItem("wy-xuci") === "1",
    voice: localStorage.getItem("wy-voice") || "zh-TW",
  };

  const lesson = {
    on: false,
    essay: null,
    beats: [],
    i: 0,
    auto: false,
    abort: false,
    playing: false,
    scoreOk: 0,
    scoreN: 0,
    quizDone: false,
  };

  const app = document.getElementById("app");
  const pop = document.getElementById("pop");

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function byId(id) {
    return DATA.essays.find((e) => e.id === id);
  }

  function applyBody() {
    document.body.classList.remove("mode-both", "mode-py", "mode-jp", "mode-off", "hide-trans", "hide-notes", "teaching");
    document.body.classList.add("mode-" + (state.mode === "both" ? "both" : state.mode));
    if (!state.trans) document.body.classList.add("hide-trans");
    if (!state.notes) document.body.classList.add("hide-notes");
    if (lesson.on) document.body.classList.add("teaching");
    else document.body.classList.remove("beat-sent");
  }

  function save() {
    localStorage.setItem("wy-mode", state.mode);
    localStorage.setItem("wy-trans", state.trans ? "1" : "0");
    localStorage.setItem("wy-notes", state.notes ? "1" : "0");
    localStorage.setItem("wy-xuci", state.xuci ? "1" : "0");
    localStorage.setItem("wy-voice", state.voice);
  }

  function route() {
    hidePop();
    stopRecite(true);
    stopLesson(true);
    const h = location.hash.replace(/^#/, "");
    if (h.startsWith("read/")) {
      const id = decodeURIComponent(h.slice(5).split("?")[0]);
      const essay = byId(id);
      if (essay) return renderReader(essay);
    }
    renderHome();
  }

  function renderHome() {
    document.body.classList.remove("wy-reading", "beat-sent");
    document.title = "文言四十講 · 精讀";
    const groups = [1, 2, 3, 4].map((st) => {
      const items = DATA.essays
        .filter((e) => e.stage === st)
        .map(
          (e) => `<a class="card" href="#read/${esc(e.id)}">
            <div class="n">第${toZh(e.n)}篇</div>
            <h3>《${esc(e.title)}》</h3>
            <div class="by">${esc(e.dynasty)} · ${esc(e.author)}</div>
            <div class="meta">${esc(e.genre)}${e.excerpt ? " · 節錄" : ""} · ${e.chars}字</div>
          </a>`
        )
        .join("");
      return `<section class="stage">
        <div class="stage-art"><img src="${asset("img/stage" + st + ".jpg")}" alt=""></div>
        <div class="stage-head">
          <span class="clock">⏱</span>
          <h2>階段${toZh(st)}　${STAGES[st].name}</h2>
          <span>${STAGES[st].hint}</span>
        </div>
        <div class="grid">${items}</div>
      </section>`;
    });

    app.innerHTML = `<div class="hero-art"><img src="${asset("img/hero.jpg")}" alt=""></div>
      <div class="wrap">
      <header class="mast">
        <div>
          <p class="kicker">精讀 · 國語／粵語朗誦 · 卡通課堂</p>
          <h1>挑戰四十講<br>搞定<em>文言文</em></h1>
          <p class="tagline">國語、粵語可分開朗誦　亦可雙語連誦</p>
        </div>
        <div class="seal">卡通<br>雙語<br>講課</div>
      </header>
      <div class="teaser">
        <img src="${asset("img/anim-idle.gif")}" alt="知知老師">
        <div>
          <h3>知知老師 · 卡通文言課堂</h3>
          <p>點進一篇可選「國語朗誦」或「粵語朗誦」，亦可雙語連誦。本機若已設專業語音，朗誦會較有情感與句讀。按「講課」則卡通老師帶讀。</p>
        </div>
      </div>
      <p class="intro">依課表二十八篇編成可點讀的精讀本。原文繁體；每個漢字可看<strong>國語拼音</strong>與<strong>粵拼</strong>。粵音取文言誦讀常用的文讀。朗誦採較慢文讀節奏，國語、粵語可分開選。</p>
      ${groups.join("")}
      <footer class="site">共 ${DATA.count} 篇　${DATA.essays.reduce((n, e) => n + e.chars, 0)} 字　語料據通行課本整理。</footer>
    </div>`;
  }

  function renderReader(e) {
    document.body.classList.add("wy-reading");
    document.title = `${e.title} · 文言四十講`;
    applyBody();
    const paras = e.paragraphs
      .map((p, pi) => {
        const sents = p.sentences.map((s, si) => sentenceHTML(s, pi, si)).join("");
        return `<h2 class="para-title">${esc(p.title || "正文")}</h2>${sents}`;
      })
      .join("");

    app.innerHTML = `
      <div class="reader-bar"><div class="inner">
        <button class="back" type="button" id="go-home">← 課表</button>
        <div class="r-title">《${esc(e.title)}》<small>${esc(e.dynasty)}　${esc(e.author)}</small></div>
        <div class="seg" data-k="mode">
          <button type="button" data-v="py">國語</button>
          <button type="button" data-v="jp">粵音</button>
          <button type="button" data-v="both">雙語</button>
          <button type="button" data-v="off">關</button>
        </div>
        <button class="tog ${state.trans ? "on" : ""}" data-k="trans" type="button">今譯</button>
        <button class="tog ${state.notes ? "on" : ""}" data-k="notes" type="button">註釋</button>
        <button class="tog ${state.xuci ? "on" : ""}" data-k="xuci" type="button">虛詞</button>
        <button class="tog" id="btn-teach" type="button">${esc(ui().teach)}</button>
        <div class="seg reciter-seg" id="reciter-btns">
          <button type="button" data-recite="zh-TW">國語朗誦</button>
          <button type="button" data-recite="zh-HK">粵語朗誦</button>
          <button type="button" data-recite="both">雙語朗誦</button>
        </div>
      </div></div>
      <div class="lesson-stage">
      <div class="reader">
        <section class="lead">
          <div class="lead-art"><img src="${asset("img/recite.jpg")}" alt=""></div>
          <div class="who">${esc(e.dynasty)}　${esc(e.author)}${e.years ? "　" + esc(e.years) : ""}</div>
          <h1>${esc(e.title)}</h1>
          <div class="chips">
            <span class="chip">第${toZh(e.n)}篇</span>
            <span class="chip">${esc(e.genre)}</span>
            ${e.excerpt ? '<span class="chip">節錄</span>' : '<span class="chip">全文</span>'}
            <span class="chip">${e.chars}字</span>
          </div>
          ${e.background ? `<p><b>背景</b>　${esc(e.background)}</p>` : ""}
          ${e.theme ? `<p><b>題旨</b>　${esc(e.theme)}</p>` : ""}
          ${e.focus ? `<p><b>精讀</b>　${esc(e.focus)}</p>` : ""}
        </section>
        ${paras}
        ${pager(e)}
      </div>
      <aside class="teacher-col">
        <div class="teacher" id="teacher" hidden></div>
      </aside>
      </div>`;

    markSeg();
    document.getElementById("go-home").onclick = () => {
      location.hash = "";
    };
    app.querySelectorAll(".seg button").forEach((b) => {
      b.onclick = () => {
        state.mode = b.dataset.v;
        save();
        applyBody();
        markSeg();
      };
    });
    app.querySelectorAll(".tog[data-k]").forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.k;
        state[k] = !state[k];
        save();
        applyBody();
        b.classList.toggle("on", state[k]);
        if (k === "xuci") refreshXuci();
      };
    });
    document.getElementById("btn-teach").onclick = () => toggleLesson(e);
    document.querySelectorAll("#reciter-btns button").forEach((b) => {
      b.onclick = () => toggleRecite(e, b.dataset.recite);
    });
    app.querySelectorAll(".sent").forEach((el) => {
      el.addEventListener("click", (ev) => {
        if (!lesson.on) return;
        if (ev.target.closest(".speak")) return;
        if (currentQuiz() && currentQuiz().type === "click" && ev.target.closest(".tok")) return;
        const pi = +el.dataset.pi;
        const si = +el.dataset.si;
        const idx = lesson.beats.findIndex((b) => b.kind === "sent" && b.pi === pi && b.si === si);
        if (idx < 0) return;
        lesson.auto = true;
        go(idx);
      });
    });
    refreshXuci();
    bindTokens(e);
    fitTeacher();
  }

  function pager(e) {
    const i = DATA.essays.findIndex((x) => x.id === e.id);
    const prev = DATA.essays[i - 1];
    const next = DATA.essays[i + 1];
    return `<nav class="pager">${
      prev
        ? `<a href="#read/${esc(prev.id)}">← 第${toZh(prev.n)}篇　${esc(prev.title)}</a>`
        : "<span></span>"
    }${
      next
        ? `<a href="#read/${esc(next.id)}">第${toZh(next.n)}篇　${esc(next.title)} →</a>`
        : "<span></span>"
    }</nav>`;
  }

  function markSeg() {
    app.querySelectorAll(".seg button").forEach((b) => {
      b.classList.toggle("on", b.dataset.v === state.mode);
    });
  }

  function sentenceHTML(s, pi, si) {
    const toks = s.tokens
      .map((t, ti) => {
        if (!t.han) {
          return `<span class="tok punct"><span class="ch">${esc(t.ch)}</span></span>`;
        }
        return `<span class="tok han" tabindex="0" data-pi="${pi}" data-si="${si}" data-ti="${ti}">
          <span class="py">${esc(t.py)}</span>
          <span class="ch">${esc(t.ch)}</span>
          <span class="jp">${esc(t.jp)}</span>
        </span>`;
      })
      .join("");
    const notes = (s.notes || [])
      .filter((n) => !n.auto)
      .map(
        (n) =>
          `<span class="note"><b>${esc(n.w)}</b>${esc(n.g)}${
            n.pos ? `<span class="pos">${esc(n.pos)}</span>` : ""
          }</span>`
      )
      .join("");
    return `<article class="sent" id="s-${pi}-${si}" data-pi="${pi}" data-si="${si}">
      <div class="orig">${toks}</div>
      ${s.trans ? `<div class="trans">${esc(s.trans)}</div>` : ""}
      ${notes ? `<div class="notes">${notes}</div>` : ""}
      ${s.grammar ? `<div class="grammar">${esc(s.grammar)}</div>` : ""}
      <div class="sent-tools">
        <button class="speak" type="button" data-lang="zh-TW" data-pi="${pi}" data-si="${si}">▶ 國語</button>
        <button class="speak" type="button" data-lang="zh-HK" data-pi="${pi}" data-si="${si}">▶ 粵語</button>
        <button class="speak bilingual" type="button" data-lang="both" data-pi="${pi}" data-si="${si}">▶ 雙語</button>
      </div>
    </article>`;
  }

  function refreshXuci() {
    app.querySelectorAll(".tok.han").forEach((el) => {
      const ch = el.querySelector(".ch").textContent;
      el.classList.toggle("xuci", state.xuci && XUCI.includes(ch));
    });
  }

  function bindTokens(essay) {
    app.querySelectorAll(".tok.han").forEach((el) => {
      const show = () => {
        if (lesson.on && currentQuiz() && currentQuiz().type === "click" && !lesson.quizDone) return;
        const pi = +el.dataset.pi,
          si = +el.dataset.si,
          ti = +el.dataset.ti;
        const sent = essay.paragraphs[pi].sentences[si];
        const tok = sent.tokens[ti];
        const note = (sent.notes || []).find((n) => n.w.includes(tok.ch) || tok.ch === n.w);
        pop.innerHTML = `<div class="big">${esc(tok.ch)}</div>
          <div class="row py-c">國語　${esc(tok.py || "—")}</div>
          <div class="row jp-c">粵拼　${esc(tok.jp || "—")}</div>
          ${note ? `<div class="mean">${esc(note.w)}　${esc(note.g)}${note.pos ? "　〔" + esc(note.pos) + "〕" : ""}</div>` : ""}`;
        pop.hidden = false;
        const r = el.getBoundingClientRect();
        let x = r.left + r.width / 2 - 100;
        let y = r.bottom + 8;
        if (x < 8) x = 8;
        if (x + 220 > innerWidth) x = innerWidth - 228;
        if (y + 140 > innerHeight) y = r.top - 8 - pop.offsetHeight;
        pop.style.left = x + "px";
        pop.style.top = Math.max(8, y) + "px";
      };
      el.addEventListener("mouseenter", show);
      el.addEventListener("focus", show);
      el.addEventListener("mouseleave", hidePop);
      el.addEventListener("blur", hidePop);
      el.addEventListener("click", () => {
        if (lesson.on) onClickChar(el);
      });
    });
    app.querySelectorAll(".speak").forEach((b) => {
      b.onclick = () => {
        const pi = +b.dataset.pi,
          si = +b.dataset.si;
        const sent = essay.paragraphs[pi].sentences[si];
        const el = document.getElementById("s-" + pi + "-" + si);
        reciter.playing = false;
        reciter.mode = "";
        markReciteBtn();
        cancelSpeech();
        reciter.abort = false;
        if (b.dataset.lang === "both") recitePassage(sent.text, el, "both");
        else speak(sent.text, b.dataset.lang, "recite");
      };
    });
  }

  function hidePop() {
    pop.hidden = true;
  }

  function voiceScore(v, lang, kind) {
    const n = (v.name + " " + v.lang).toLowerCase();
    let s = 0;
    const female =
      /female|女|girl|ting|mei|meijia|mei-jia|sinji|sin-ji|hanhan|xiaoxiao|xiaoyi|xiaomo|yaoyao|heami|yuna|samantha|karen|moira|tessa|fiona|veena|siri|tingting|ting-ting/.test(
        n
      );
    const male = /male|男|david|daniel|yunjian|kangkang|yunyang|\blee\b|chang/.test(n) && !/female/.test(n);
    if (female) s += 12;
    if (male) s -= 20;
    if (kind === "recite") {
      if (/enhanced|premium|neural|compact|siri/.test(n)) s += 10;
      if (/girl|child|kid|junior|princess/.test(n)) s -= 3;
    } else {
      if (/girl|child|kid|junior|princess|hana|xiao|ting/.test(n)) s += 6;
      if (/enhanced|premium|neural|compact/.test(n)) s += 2;
    }
    if (lang === "zh-HK") {
      if (/hk|yue|cantonese|sinji|sin-ji/.test(n)) s += 16;
    } else {
      if (/tw|meijia|mei-jia|hanhan/.test(n)) s += 16;
      if (/cn|tingting|ting-ting|xiaoxiao/.test(n)) s += 10;
    }
    if (/zh/.test(n)) s += 4;
    return s;
  }

  function pickVoice(lang, kind) {
    const voices = speechSynthesis.getVoices() || [];
    if (!voices.length) return null;
    const ranked = voices
      .map((v) => ({ v, s: voiceScore(v, lang, kind) }))
      .sort((a, b) => b.s - a.s);
    return ranked[0] && ranked[0].s > 0 ? ranked[0].v : voices[0];
  }

  const HCLIPS = {
    start: [1, 19, 23, 15],
    teach: [19, 15, 22, 16, 6, 23],
    quiz: [14, 13, 18, 21],
    yes: [2, 7, 5, 3],
    no: [8, 10, 4, 11],
    close: [22, 17, 5],
  };
  let hAudio = null;

  function clipUrl(n) {
    return asset("audio/hermione/clip_" + String(n).padStart(2, "0") + ".m4a");
  }

  function playClip(role) {
    const list = HCLIPS[role];
    if (!list || !list.length) return Promise.resolve();
    const n = list[Math.floor(Math.random() * list.length)];
    return new Promise((resolve) => {
      try {
        if (hAudio) {
          hAudio.pause();
          hAudio = null;
        }
        const a = new Audio(clipUrl(n));
        a.playbackRate = 0.9;
        hAudio = a;
        const done = () => {
          if (hAudio === a) hAudio = null;
          resolve();
        };
        a.onended = done;
        a.onerror = done;
        a.play().catch(done);
      } catch (e) {
        resolve();
      }
    });
  }

  let flapTimer = 0;

  function setMood(mood) {
    const face = document.querySelector(".teacher .face");
    if (!face) return;
    face.className = "face " + (mood || "idle");
    const src = asset({
      talk: "img/anim-talk.gif",
      quiz: "img/anim-quiz.gif",
      yes: "img/anim-yes.gif",
      no: "img/anim-no.gif",
      idle: "img/anim-idle.gif",
    }[mood] || "img/anim-idle.gif");
    if (face.getAttribute("data-src") !== src) {
      face.setAttribute("data-src", src);
      face.src = src;
    }
  }

  function startFlap() {
    stopFlap();
    setMood("talk");
  }

  function stopFlap() {
    if (flapTimer) clearInterval(flapTimer);
    flapTimer = 0;
  }

  function showBurst(ok) {
    const el = document.getElementById("burst");
    if (!el) return;
    el.textContent = ok ? "答對！" : "再試！";
    el.className = "burst show" + (ok ? "" : " bad");
    setTimeout(() => el.classList.remove("show"), 900);
  }

  const reciter = { abort: false, playing: false, gen: 0, mode: "", audio: null };
  let grokTts = false;
  fetch("/api/tts/status")
    .then((r) => (r.ok ? r.json() : { ok: false }))
    .then((d) => {
      grokTts = !!d.ok;
    })
    .catch(() => {});

  function cancelSpeech() {
    reciter.gen += 1;
    reciter.abort = true;
    if (window.speechSynthesis) speechSynthesis.cancel();
    if (reciter.audio) {
      try {
        reciter.audio.pause();
        reciter.audio.src = "";
      } catch (e) {}
      reciter.audio = null;
    }
  }

  function kickSpeech() {
    try {
      speechSynthesis.resume();
    } catch (e) {}
  }

  function speakBrowser(text, lang, kind, gen) {
    return new Promise((resolve) => {
      if (!window.speechSynthesis || !text) return resolve();
      const bits = kind === "recite" ? clauses(text) : [String(text)];
      let i = 0;
      let timer = 0;
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (timer) clearTimeout(timer);
        resolve();
      };
      const next = () => {
        if (timer) {
          clearTimeout(timer);
          timer = 0;
        }
        if (finished) return;
        if (gen !== reciter.gen || (lesson.on && lesson.abort)) return finish();
        if (i >= bits.length) return finish();
        const piece = bits[i++];
        const u = new SpeechSynthesisUtterance(piece);
        u.lang = lang;
        let settled = false;
        const proceed = (delay) => {
          if (settled || finished) return;
          settled = true;
          if (timer) {
            clearTimeout(timer);
            timer = 0;
          }
          if (delay) setTimeout(next, delay);
          else next();
        };
        if (kind === "recite") {
          const heavy = /[。！？]$/.test(piece);
          u.pitch = heavy ? 0.9 : 0.98;
          u.rate = lang === "zh-HK" ? 0.6 : 0.62;
          u.onend = () => proceed(heavy ? 520 : 280);
        } else {
          u.pitch = 1.18;
          u.rate = 0.92;
          u.onend = () => proceed(0);
        }
        const v = pickVoice(lang, kind);
        if (v) u.voice = v;
        u.onerror = () => proceed(0);
        timer = setTimeout(() => {
          try {
            speechSynthesis.cancel();
          } catch (e) {}
          proceed(0);
        }, Math.min(18000, 900 + piece.length * 420));
        kickSpeech();
        try {
          speechSynthesis.speak(u);
        } catch (e) {
          proceed(0);
          return;
        }
        kickSpeech();
      };
      next();
    });
  }

  function speakGrok(text, lang, gen) {
    return fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("tts");
        return r.arrayBuffer();
      })
      .then(
        (buf) =>
          new Promise((resolve) => {
            if (gen !== reciter.gen) return resolve();
            const url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
            const a = new Audio(url);
            reciter.audio = a;
            const done = () => {
              URL.revokeObjectURL(url);
              if (reciter.audio === a) reciter.audio = null;
              resolve();
            };
            a.onended = done;
            a.onerror = done;
            a.play().catch(done);
          })
      );
  }

  function speak(text, lang, kind) {
    const gen = reciter.gen;
    if (kind === "recite" && grokTts) {
      return speakGrok(text, lang, gen).catch(() => speakBrowser(text, lang, kind, gen));
    }
    return speakBrowser(text, lang, kind, gen);
  }

  async function recitePassage(text, el, mode) {
    const gen = reciter.gen;
    reciter.abort = false;
    if (el) el.classList.add("reciting");
    const langs = mode === "both" ? ["zh-TW", "zh-HK"] : [mode];
    for (let i = 0; i < langs.length; i++) {
      if (gen !== reciter.gen) break;
      if (i) await wait(360);
      if (gen !== reciter.gen) break;
      await speak(text, langs[i], "recite");
    }
    if (el) el.classList.remove("reciting");
  }

  function markReciteBtn() {
    document.querySelectorAll("#reciter-btns button").forEach((b) => {
      const on = reciter.playing && reciter.mode === b.dataset.recite;
      b.classList.toggle("on", on);
      if (b.dataset.recite === "zh-TW") b.textContent = on ? "停止國語" : "國語朗誦";
      if (b.dataset.recite === "zh-HK") b.textContent = on ? "停止粵語" : "粵語朗誦";
      if (b.dataset.recite === "both") b.textContent = on ? "停止雙語" : "雙語朗誦";
    });
  }

  function stopRecite(fromRoute) {
    cancelSpeech();
    reciter.playing = false;
    reciter.mode = "";
    app.querySelectorAll(".sent.reciting,.sent.current").forEach((el) => {
      if (!lesson.on) el.classList.remove("current");
      el.classList.remove("reciting");
    });
    if (!fromRoute) markReciteBtn();
  }

  async function toggleRecite(essay, mode) {
    if (reciter.playing && reciter.mode === mode) {
      stopRecite(false);
      return;
    }
    if (lesson.on) stopLesson(false);
    cancelSpeech();
    reciter.playing = true;
    reciter.mode = mode;
    reciter.abort = false;
    const gen = reciter.gen;
    markReciteBtn();
    for (let pi = 0; pi < essay.paragraphs.length; pi++) {
      const p = essay.paragraphs[pi];
      for (let si = 0; si < p.sentences.length; si++) {
        if (gen !== reciter.gen) break;
        const el = document.getElementById("s-" + pi + "-" + si);
        if (el) {
          app.querySelectorAll(".sent.current").forEach((x) => x.classList.remove("current"));
          el.classList.add("current");
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        await recitePassage(p.sentences[si].text, el, mode);
      }
      if (gen !== reciter.gen) break;
    }
    if (gen === reciter.gen) {
      reciter.playing = false;
      reciter.mode = "";
      markReciteBtn();
    }
  }

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function clauses(text) {
    return String(text)
      .split(/(?<=[，。；：、！？])/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (window.speechSynthesis) {
    speechSynthesis.getVoices();
    speechSynthesis.addEventListener("voiceschanged", () => speechSynthesis.getVoices());
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const UI = {
    "zh-TW": {
      teach: "講課",
      name: "知知老師",
      room: "卡通課堂",
      voiceHint: "音高仿音檔 · 課文中文唸",
      play: "講這拍",
      stop: "停一下",
      auto: "自動連講",
      pause: "暫停連講",
      prev: "上一拍",
      next: "下一拍",
      end: "下課",
      explain: "解說",
      lecture: "講課",
      clickHint: "點上面原文的字",
      ok: "對。很好。",
      bad: "還不是。再看一眼原文。",
      correctIs: "正確是：",
      reciting: "先讀原文。",
      meaning: "意思是：",
      look: "我們看這一句。",
      ask: "來，考一考。",
      point: (n) => {
        const bit = n.pos ? `這是${n.pos}。` : "";
        return `注意「${n.w}」，${n.g}。${bit}`;
      },
      pyIs: "讀音是",
      thisIs: "這是",
      themeIs: "這篇文章的題旨是：",
      focusIs: "精讀時請特別留意：",
      open: (e) => `這一講，我們讀${e.dynasty}${e.author}的《${e.title}》。`,
      openBg: (e) => e.background || "",
      openTheme: (e) => (e.theme ? `題旨是：${e.theme}` : ""),
      openFocus: (e) => (e.focus ? `讀的時候，請留意：${e.focus}` : ""),
      para: (title) => `下一段，「${title}」。`,
      close: (e) => `《${e.title}》先讀到這裏。題旨記住：${e.theme || "見篇首。"}`,
      scored: (a, b) => `這一講你答對 ${a} 題，一共 ${b} 題。`,
      clickWord: (ch) => `請在原文裏點出「${ch}」`,
      clickXuci: (ch) => `請點出這句裏的虛詞「${ch}」`,
      meaningQ: (w) => `「${w}」在這句裏是什麼意思？`,
      score: (a, b) => `星星 ${a} / ${b}`,
    },
    "zh-HK": {
      teach: "講課",
      name: "知知老師",
      room: "卡通課堂",
      voiceHint: "音高仿音檔 · 課文中文唸",
      play: "講呢一拍",
      stop: "停一停",
      auto: "自動連講",
      pause: "暫停連講",
      prev: "上一拍",
      next: "下一拍",
      end: "落堂",
      explain: "解說",
      lecture: "講課",
      clickHint: "撳上面原文嗰個字",
      ok: "啱。好。",
      bad: "未係。再睇原文一眼。",
      correctIs: "正確係：",
      reciting: "我哋先讀原文。",
      meaning: "意思係：",
      look: "我哋睇呢一句。",
      ask: "嚟，考一考。",
      point: (n) => {
        const bit = n.pos ? `呢個係${n.pos}。` : "";
        return `留意「${n.w}」，${n.g}。${bit}`;
      },
      pyIs: "讀音係",
      thisIs: "呢個係",
      themeIs: "呢篇文章嘅題旨係：",
      focusIs: "精讀嘅時候特別留心：",
      open: (e) => `呢一講，我哋讀${e.dynasty}${e.author}嘅《${e.title}》。`,
      openBg: (e) => e.background || "",
      openTheme: (e) => (e.theme ? `題旨係：${e.theme}` : ""),
      openFocus: (e) => (e.focus ? `讀嘅時候，請留心：${e.focus}` : ""),
      para: (title) => `下一段，「${title}」。`,
      close: (e) => `《${e.title}》今日先讀到呢度。題旨記住：${e.theme || "見篇首。"}`,
      scored: (a, b) => `呢一講你答啱 ${a} 題，一共 ${b} 題。`,
      clickWord: (ch) => `請喺原文度撳出「${ch}」`,
      clickXuci: (ch) => `請撳出呢句入面嘅虛詞「${ch}」`,
      meaningQ: (w) => `「${w}」喺呢句入面係咩意思？`,
      score: (a, b) => `星星 ${a} / ${b}`,
    },
  };

  function ui() {
    return UI[state.voice] || UI["zh-TW"];
  }

  function lessonScript(b) {
    const L = ui();
    const e = lesson.essay;
    const steps = [];
    if (!b || !e) return steps;
    const add = (say, kind, pause, mood) => {
      if (say) steps.push({ say, kind: kind || "explain", pause: pause || 500, mood: mood || "talk" });
      else if (pause) steps.push({ pause });
    };
    if (b.kind === "open") {
      add(L.open(e), "explain", 800);
      add(L.openBg(e), "explain", 900);
      add(L.openTheme(e), "explain", 800);
      add(L.openFocus(e), "explain", 1000);
      return steps;
    }
    if (b.kind === "para") {
      add(L.para(b.title), "explain", 800);
      return steps;
    }
    if (b.kind === "close") {
      add(L.close(e), "explain", 700);
      if (lesson.scoreN) add(L.scored(lesson.scoreOk, lesson.scoreN), "explain", 800);
      return steps;
    }
    if (b.kind === "sent") {
      const s = e.paragraphs[b.pi].sentences[b.si];
      add(L.look, "explain", 550);
      add(L.reciting, "explain", 400);
      const bits = clauses(s.text);
      bits.forEach((c, i) => {
        const last = i === bits.length - 1;
        const heavy = /[。！？]$/.test(c);
        add(c, "recite", last ? 900 : heavy ? 700 : 420);
      });
      if (s.trans) add(L.meaning + s.trans, "explain", 800);
      const notes = (s.notes || []).filter((n) => !n.auto);
      if (notes[0]) add(L.point(notes[0]), "explain", 750);
      else if (s.grammar) add(s.grammar, "explain", 750);
      if (b.quiz) add(L.ask, "explain", 400, "quiz");
    }
    return steps;
  }

  function quizPrompt(quiz) {
    const L = ui();
    if (!quiz) return "";
    if (quiz.type === "click") {
      return quiz.xuci ? L.clickXuci(quiz.answer) : L.clickWord(quiz.answer);
    }
    return L.meaningQ(quiz.word);
  }

  function poseSrc() {
    if (lesson.quizDone) {
      return asset(lesson._lastOk ? "img/anim-yes.gif" : "img/anim-no.gif");
    }
    if (currentQuiz()) return asset("img/anim-quiz.gif");
    const b = currentBeat();
    if (lesson.playing && b && b.kind === "sent") return asset("img/anim-talk.gif");
    return asset("img/anim-idle.gif");
  }

  function makeQuiz(essay, s) {
    const notes = (s.notes || []).filter((n) => !n.auto && n.w && n.g);
    const hans = s.tokens.filter((t) => t.han).map((t) => t.ch);
    const hanStr = hans.join("");
    if (notes.length) {
      const n = notes[Math.floor(Math.random() * Math.min(notes.length, 3))];
      const ch = [...n.w].find((c) => hanStr.includes(c));
      const useClick = ch && (notes.length === 1 || Math.random() < 0.4);
      if (useClick) {
        return { type: "click", answer: ch, hint: n.g };
      }
      const pool = [];
      for (const p of essay.paragraphs) {
        for (const x of p.sentences) {
          for (const m of x.notes || []) {
            if (!m.auto && m.g && m.g !== n.g && !pool.includes(m.g)) pool.push(m.g);
          }
        }
      }
      const dist = shuffle(pool).slice(0, 2);
      if (dist.length >= 2) {
        return {
          type: "choice",
          word: n.w,
          options: shuffle([n.g, dist[0], dist[1]]),
          answer: n.g,
        };
      }
      if (ch) return { type: "click", answer: ch, hint: n.g };
    }
    const xu = hans.find((c) => XUCI.includes(c));
    if (xu) return { type: "click", answer: xu, hint: "虛詞", xuci: true };
    return null;
  }

  function buildBeats(essay) {
    const beats = [{ kind: "open" }];
    let quizzes = 0;
    essay.paragraphs.forEach((p, pi) => {
      if (p.title) beats.push({ kind: "para", pi, title: p.title });
      let used = false;
      p.sentences.forEach((s, si) => {
        let quiz = null;
        if (!used && quizzes < 3) {
          quiz = makeQuiz(essay, s);
          if (quiz) {
            used = true;
            quizzes += 1;
          }
        }
        beats.push({
          kind: "sent",
          pi,
          si,
          recitation: s.text,
          quiz,
        });
      });
    });
    beats.push({ kind: "close" });
    return beats;
  }

  function currentBeat() {
    return lesson.beats[lesson.i] || null;
  }
  function currentQuiz() {
    const b = currentBeat();
    return b && b.quiz && !lesson.quizDone ? b.quiz : null;
  }

  function toggleLesson(essay) {
    if (lesson.on) {
      stopLesson(false);
      return;
    }
    stopRecite(false);
    lesson.on = true;
    lesson.essay = essay;
    lesson.scoreOk = 0;
    lesson.scoreN = 0;
    lesson.beats = buildBeats(essay);
    lesson.i = 0;
    lesson.auto = true;
    lesson.quizDone = false;
    applyBody();
    document.getElementById("btn-teach").classList.add("on");
    document.getElementById("teacher").hidden = false;
    fitTeacher();
    go(0);
  }

  function stopLesson(fromRoute) {
    lesson.abort = true;
    lesson.auto = false;
    lesson.playing = false;
    lesson.playId = (lesson.playId || 0) + 1;
    stopFlap();
    cancelSpeech();
    reciter.abort = false;
    if (hAudio) {
      hAudio.pause();
      hAudio = null;
    }
    if (lesson.on && !fromRoute) {
      lesson.on = false;
      applyBody();
      const btn = document.getElementById("btn-teach");
      if (btn) btn.classList.remove("on");
      const dock = document.getElementById("teacher");
      if (dock) dock.hidden = true;
      document.body.classList.remove("beat-sent");
      app.querySelectorAll(".sent.current").forEach((el) => el.classList.remove("current"));
      app.querySelectorAll(".tok.quiz-ok,.tok.quiz-bad").forEach((el) => {
        el.classList.remove("quiz-ok", "quiz-bad");
      });
    }
    lesson.on = false;
  }

  let barWatch = null;
  function fitTeacher() {
    const nav = document.querySelector("nav.nav");
    const bar = document.querySelector(".reader-bar");
    document.documentElement.style.setProperty("--nav-h", (nav ? nav.offsetHeight : 56) + "px");
    document.documentElement.style.setProperty("--bar-h", (bar ? bar.offsetHeight : 52) + "px");
    if (typeof ResizeObserver === "undefined") return;
    if (barWatch && barWatch.bar !== bar) {
      barWatch.ro.disconnect();
      barWatch = null;
    }
    if (bar && !barWatch) {
      const ro = new ResizeObserver(() => {
        const n = document.querySelector("nav.nav");
        const b = document.querySelector(".reader-bar");
        document.documentElement.style.setProperty("--nav-h", (n ? n.offsetHeight : 56) + "px");
        document.documentElement.style.setProperty("--bar-h", (b ? b.offsetHeight : 52) + "px");
      });
      ro.observe(bar);
      if (nav) ro.observe(nav);
      barWatch = { bar, ro };
    }
  }

  function scrollToCurrent(el) {
    if (!el) return;
    const dock = document.getElementById("teacher");
    const bar = document.querySelector(".reader-bar");
    const nav = document.querySelector("nav.nav");
    const split = document.body.classList.contains("teaching") && window.matchMedia("(min-width: 901px)").matches;
    const navH = nav ? nav.offsetHeight : 0;
    const barH = bar ? bar.offsetHeight : 0;
    const dockH = !split && dock && !dock.hidden ? dock.offsetHeight : 0;
    const topReserve = navH + barH + dockH;
    const vis = Math.max(120, window.innerHeight - topReserve);
    const y = el.getBoundingClientRect().top + (window.scrollY || 0) - topReserve - vis * 0.16;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }

  function markSpeakingTokens(sentEl, clause) {
    if (!sentEl) return;
    sentEl.querySelectorAll(".tok.speaking").forEach((el) => el.classList.remove("speaking"));
    const raw = String(clause || "").replace(/\s+/g, "");
    if (!raw) return;
    const nodes = [...sentEl.querySelectorAll(".tok .ch")];
    const hay = nodes.map((n) => n.textContent).join("");
    let i = hay.indexOf(raw);
    if (i < 0) {
      const stripped = raw.replace(/[，。；：、！？]/g, "");
      i = hay.indexOf(stripped);
      if (i < 0) return;
      for (let k = 0; k < stripped.length; k++) {
        const tok = nodes[i + k] && nodes[i + k].closest(".tok");
        if (tok) tok.classList.add("speaking");
      }
      return;
    }
    for (let k = 0; k < raw.length; k++) {
      const tok = nodes[i + k] && nodes[i + k].closest(".tok");
      if (tok) tok.classList.add("speaking");
    }
  }

  function highlight() {
    app.querySelectorAll(".sent.current").forEach((el) => el.classList.remove("current"));
    app.querySelectorAll(".tok.speaking").forEach((el) => el.classList.remove("speaking"));
    const b = currentBeat();
    document.body.classList.toggle("beat-sent", !!(b && b.kind === "sent"));
    if (b && b.kind === "sent") {
      const el = document.getElementById("s-" + b.pi + "-" + b.si);
      if (el) {
        el.classList.add("current");
        scrollToCurrent(el);
      }
    } else if (b && b.kind === "para") {
      const el = document.getElementById("s-" + b.pi + "-0") || app.querySelector(".lead");
      if (el) scrollToCurrent(el);
    } else if (b && b.kind === "open") {
      const el = app.querySelector(".lead") || app.querySelector(".sent");
      if (el) scrollToCurrent(el);
    }
    app.querySelectorAll(".tok.quiz-ok,.tok.quiz-bad").forEach((el) => {
      el.classList.remove("quiz-ok", "quiz-bad");
    });
  }

  function renderDock() {
    const dock = document.getElementById("teacher");
    if (!dock || !lesson.on) return;
    const L = ui();
    const b = currentBeat();
    const quiz = currentQuiz();
    const n = lesson.beats.length;
    const firstSay = (lessonScript(b).find((s) => s.say) || {}).say || "";
    const tag = b && b.kind === "sent" ? L.explain : L.lecture;
    const bubble = `<span class="tag">${esc(tag)}</span>${esc(firstSay)}`;
    let quizHtml = "";
    if (quiz && quiz.type === "choice") {
      quizHtml = `<div class="quiz"><div class="q">${esc(quizPrompt(quiz))}</div>
        <div class="opts">${quiz.options
          .map((o) => `<button type="button" class="q-opt" data-a="${esc(o)}">${esc(o)}</button>`)
          .join("")}</div>
        <div class="q-fb" id="q-fb">${lesson.auto ? "答對後會自動往下講。" : ""}</div></div>`;
    } else if (quiz && quiz.type === "click") {
      quizHtml = `<div class="quiz"><div class="q">${esc(quizPrompt(quiz))}　<span style="color:var(--cinnabar)">${esc(L.clickHint)}</span></div>
        <div class="q-fb" id="q-fb">${lesson.auto ? "答對後會自動往下講。" : ""}</div></div>`;
    } else if (b && b.quiz && lesson.quizDone) {
      quizHtml = `<div class="quiz"><div class="q-fb" id="q-fb"></div></div>`;
    }

    dock.innerHTML = `<div class="inner">
      <div class="face-wrap"><img class="face" src="${poseSrc()}" data-src="${poseSrc()}" alt="${esc(L.name)}"><div class="burst" id="burst"></div></div>
      <div>
        <div class="lang-switch" id="t-voice">
          <button type="button" data-v="zh-TW" class="${state.voice === "zh-TW" ? "on" : ""}">國語</button>
          <button type="button" data-v="zh-HK" class="${state.voice === "zh-HK" ? "on" : ""}">粵語</button>
        </div>
        <div class="who">${esc(L.name)}<small>${esc(L.voiceHint)}　${lesson.i + 1} / ${n}</small></div>
        <div class="bubble">${bubble}</div>
      </div>
      ${quizHtml}
      <div class="t-ctrl">
        <button class="tog" type="button" id="t-prev">${esc(L.prev)}</button>
        <button class="tog ${lesson.playing ? "on" : ""}" type="button" id="t-play">${esc(lesson.playing ? L.stop : L.play)}</button>
        <button class="tog ${lesson.auto ? "on" : ""}" type="button" id="t-auto">${esc(lesson.auto ? L.pause : L.auto)}</button>
        <button class="tog" type="button" id="t-next">${esc(L.next)}</button>
        <button class="tog" type="button" id="t-end">${esc(L.end)}</button>
        <span class="grow">${esc(L.score(lesson.scoreOk, lesson.scoreN))}</span>
      </div>
    </div>`;

    document.getElementById("t-prev").onclick = () => go(lesson.i - 1);
    document.getElementById("t-next").onclick = () => go(lesson.i + 1);
    document.getElementById("t-play").onclick = () => {
      if (lesson.playing) {
        lesson.abort = true;
        lesson.auto = false;
        lesson.playId = (lesson.playId || 0) + 1;
        cancelSpeech();
        reciter.abort = false;
        if (hAudio) {
          hAudio.pause();
          hAudio = null;
        }
        lesson.playing = false;
        renderDock();
      } else {
        playBeat();
      }
    };
    document.getElementById("t-auto").onclick = () => {
      lesson.auto = !lesson.auto;
      if (lesson.auto) playBeat();
      else {
        lesson.abort = true;
        lesson.playId = (lesson.playId || 0) + 1;
        cancelSpeech();
        reciter.abort = false;
        if (hAudio) {
          hAudio.pause();
          hAudio = null;
        }
        lesson.playing = false;
        renderDock();
      }
    };
    document.getElementById("t-end").onclick = () => stopLesson(false);
    dock.querySelectorAll("#t-voice button").forEach((btn) => {
      btn.onclick = () => {
        state.voice = btn.dataset.v;
        save();
        renderDock();
        const teachBtn = document.getElementById("btn-teach");
        if (teachBtn) teachBtn.textContent = ui().teach;
      };
    });
    dock.querySelectorAll(".q-opt").forEach((btn) => {
      btn.onclick = () => answerChoice(btn.dataset.a, btn);
    });
    fitTeacher();
  }

  function go(i) {
    if (i < 0 || i >= lesson.beats.length) return;
    lesson.abort = true;
    lesson.playId = (lesson.playId || 0) + 1;
    stopFlap();
    cancelSpeech();
    reciter.abort = false;
    if (hAudio) {
      hAudio.pause();
      hAudio = null;
    }
    lesson.playing = false;
    lesson.i = i;
    lesson.quizDone = false;
    lesson._lastOk = null;
    highlight();
    renderDock();
    const token = (lesson.nav = (lesson.nav || 0) + 1);
    lesson.abort = false;
    if (lesson.auto) {
      wait(160).then(() => {
        if (lesson.nav === token && lesson.on && lesson.auto && !lesson.abort) playBeat();
      });
    }
  }

  async function playBeat() {
    const b = currentBeat();
    if (!b) return;
    const playId = ++lesson.playId;
    lesson.abort = false;
    lesson.playing = true;
    highlight();
    renderDock();
    const lang = state.voice;
    const sentEl = b.kind === "sent" ? document.getElementById("s-" + b.pi + "-" + b.si) : null;
    if (sentEl) scrollToCurrent(sentEl);
    const steps = lessonScript(b);
    for (const step of steps) {
      if (lesson.abort || lesson.playId !== playId) {
        stopFlap();
        if (sentEl) sentEl.classList.remove("reciting");
        markSpeakingTokens(sentEl, "");
        return;
      }
      if (step.say) {
        if (step.mood === "quiz") setMood("quiz");
        else setMood("talk");
        if (step.kind === "recite" && sentEl) {
          sentEl.classList.add("reciting");
          markSpeakingTokens(sentEl, step.say);
          scrollToCurrent(sentEl);
        } else if (sentEl) {
          sentEl.classList.remove("reciting");
          markSpeakingTokens(sentEl, "");
        }
        const bubble = document.querySelector(".teacher .bubble");
        if (bubble) {
          const tag = step.kind === "recite" ? "誦讀" : step.mood === "quiz" ? "提問" : ui().explain;
          bubble.innerHTML = `<span class="tag">${tag}</span>${esc(step.say)}`;
        }
        if (step.mood !== "quiz") startFlap();
        await speak(step.say, lang, step.kind || "explain");
        if (lesson.playId !== playId) return;
        stopFlap();
        setMood(step.mood === "quiz" ? "quiz" : "idle");
      }
      if (step.pause) await wait(step.pause);
      if (lesson.playId !== playId) return;
    }
    if (lesson.playId !== playId) return;
    if (sentEl) sentEl.classList.remove("reciting");
    markSpeakingTokens(sentEl, "");
    stopFlap();
    lesson.playing = false;
    renderDock();
    if (currentQuiz()) {
      setMood("quiz");
      return;
    }
    if (lesson.auto && lesson.i < lesson.beats.length - 1) {
      await wait(1200);
      if (!lesson.abort && lesson.auto && lesson.playId === playId) go(lesson.i + 1);
    } else {
      lesson.auto = false;
      renderDock();
    }
  }

  function markAnswer(ok, detail) {
    lesson.scoreN += 1;
    if (ok) lesson.scoreOk += 1;
    lesson.quizDone = true;
    lesson._lastOk = ok;
    const L = ui();
    const fb = document.getElementById("q-fb");
    if (fb) fb.textContent = (ok ? L.ok : L.bad) + (detail || "");
    setMood(ok ? "yes" : "no");
    showBurst(ok);
    const grow = document.querySelector(".t-ctrl .grow");
    if (grow) grow.textContent = L.score(lesson.scoreOk, lesson.scoreN);
    playClip(ok ? "yes" : "no");
    if (ok && lesson.auto) {
      const playId = lesson.playId;
      setTimeout(() => {
        if (lesson.auto && !lesson.abort && lesson.playId === playId) go(lesson.i + 1);
      }, 1800);
    }
  }

  function answerChoice(val, btn) {
    if (lesson.quizDone) return;
    const quiz = currentQuiz();
    if (!quiz) return;
    const ok = val === quiz.answer;
    btn.classList.add(ok ? "right" : "wrong");
    if (!ok) {
      document.querySelectorAll(".q-opt").forEach((b) => {
        if (b.dataset.a === quiz.answer) b.classList.add("right");
      });
    }
    markAnswer(ok, ok ? "" : ui().correctIs + quiz.answer);
  }

  function onClickChar(el) {
    const quiz = currentQuiz();
    if (!quiz || quiz.type !== "click") return;
    hidePop();
    const ch = el.querySelector(".ch").textContent;
    const ok = ch === quiz.answer;
    el.classList.add(ok ? "quiz-ok" : "quiz-bad");
    if (ok) {
      markAnswer(true, quiz.hint ? `　「${ch}」${quiz.hint}` : "");
    } else {
      lesson.scoreN += 1;
      const fb = document.getElementById("q-fb");
      lesson._lastOk = false;
      const face = document.querySelector(".teacher .face");
      if (face) {
        face.src = asset("img/anim-no.gif");
        face.setAttribute("data-src", asset("img/anim-no.gif"));
      }
      if (fb) fb.textContent = ui().bad;
      const grow = document.querySelector(".t-ctrl .grow");
      if (grow) grow.textContent = ui().score(lesson.scoreOk, lesson.scoreN);
      playClip("no");
    }
  }

  function toZh(n) {
    const d = "零一二三四五六七八九";
    if (n <= 10) return ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][n];
    if (n < 20) return "十" + (n % 10 ? d[n % 10] : "");
    if (n < 100) {
      const t = Math.floor(n / 10);
      const o = n % 10;
      return d[t] + "十" + (o ? d[o] : "");
    }
    return String(n);
  }

  document.addEventListener("keydown", (ev) => {
    if (!lesson.on) return;
    if (ev.target && /input|textarea/i.test(ev.target.tagName)) return;
    if (ev.key === "ArrowRight") {
      ev.preventDefault();
      go(lesson.i + 1);
    }
    if (ev.key === "ArrowLeft") {
      ev.preventDefault();
      go(lesson.i - 1);
    }
    if (ev.key === " ") {
      ev.preventDefault();
      if (lesson.playing) {
        lesson.abort = true;
        lesson.auto = false;
        lesson.playId = (lesson.playId || 0) + 1;
        cancelSpeech();
        reciter.abort = false;
        lesson.playing = false;
        renderDock();
      } else playBeat();
    }
  });

  window.addEventListener("hashchange", route);
  applyBody();
  if (!DATA || !DATA.essays) {
    app.innerHTML = '<div class="wrap"><p>尚未建置語料。請在本目錄執行 <code>python3 build.py</code>。</p></div>';
    return;
  }
  route();
})();
