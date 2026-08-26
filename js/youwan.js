/* 林川集 · 遊玩區（三國鼎立 · 試煉武將） */
document.addEventListener("DOMContentLoaded", () => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const FACTION_TONE = {
    "蜀": "shu", "魏": "wei", "吳": "wu", "神將": "shen",
    "武田家": "takeda", "今川家": "imagawa", "織田家": "oda", "群雄": "gunki"
  };
  const FACTION_EN = {
    "蜀": "Shu", "魏": "Wei", "吳": "Wu", "神將": "Divine",
    "武田家": "Takeda", "今川家": "Imagawa", "織田家": "Oda", "群雄": "Warlords"
  };
  const ORDER = ["蜀", "魏", "吳", "神將", "武田家", "今川家", "織田家", "群雄"];
  const SEAL = {
    "蜀": "蜀", "魏": "魏", "吳": "吳", "神將": "神",
    "武田家": "武", "今川家": "今", "織田家": "織", "群雄": "雄"
  };

  const grid = $("#ywGrid");
  const toolbar = $("#ywToolbar");
  const countEl = $("#ywCount");
  const overlay = $("#ywOverlay");
  const sheet = $("#ywSheet");
  const trialBox = $("#ywTrial");
  const compareBox = $("#ywCompare");
  const noteEl = $("#ywNote");
  const fixesEl = $("#ywFixes");

  let DATA = { items: [], note: "", fixes: [], count: 0, classes: [] };
  let mode = "atlas";
  let filters = { q: "", camp: "", faction: "", cls: "" };
  let compareIds = [];
  try { compareIds = JSON.parse(sessionStorage.getItem("yw_compare") || "[]"); }
  catch (e) { compareIds = []; }
  const trial = {
    score: 0, total: 0, streak: 0,
    best: Number(localStorage.getItem("yw_best") || 0),
    current: null, locked: false
  };

  const items = () => DATA.items || [];
  const saveCompare = () => sessionStorage.setItem("yw_compare", JSON.stringify(compareIds));
  const tone = g => FACTION_TONE[g.faction] || "gunki";
  const levelText = g => (g.faction === "神將" ? "神" : (g.level != null ? String(g.level) : "—"));
  const skillPairs = g => (g.skills || []).map((n, i) => ({ name: n, desc: (g.descs || [])[i] || "" }));
  const SEAL_COMPOUND = ["諸葛", "司馬", "夏侯", "太史"];
  function sealText(name) {
    name = name || "將";
    for (const s of SEAL_COMPOUND) if (name.startsWith(s)) return s;
    if (name.length <= 2) return name;
    if (name.length === 3) return name.slice(0, 1);
    return name.slice(0, 2);
  }
  function avaHTML(g, cls) {
    const t = sealText(g.name);
    return `<div class="yw-ava ${cls || ""} f-${tone(g)} n${t.length}" aria-hidden="true"><span>${esc(t)}</span></div>`;
  }

  function filtered() {
    const q = filters.q.trim().toLowerCase();
    return items().filter(g => {
      if (filters.camp && g.camp !== filters.camp) return false;
      if (filters.faction && g.faction !== filters.faction) return false;
      if (filters.cls && g.class !== filters.cls) return false;
      if (!q) return true;
      const hay = [
        g.name, g.class, g.faction, g.camp, g.origin, g.weapon, g.wskill, g.wdesc, g.extra, g.extraDesc, g.bio,
        ...(g.skills || []), ...(g.descs || []), ...(g.alias || []), ...(g.missing || [])
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  async function load() {
    try {
      const r = await fetch("js/sanguo-generals.json", { cache: "no-store" });
      if (!r.ok) throw new Error("load fail");
      DATA = await r.json();
    } catch (e) {
      if (grid) grid.innerHTML = `<p class="yw-empty">武將表未能載入。請以本機伺服器或線上版開啟此頁。</p>`;
      return;
    }
    if (noteEl) noteEl.textContent = DATA.note || "";
    if (fixesEl) {
      fixesEl.innerHTML = (DATA.fixes || []).map(x => `<li>${esc(x)}</li>`).join("");
    }
    buildToolbar();
    bindTabs();
    bindOverlay();
    window.addEventListener("hashchange", applyHash);
    applyHash();
  }

  function buildToolbar() {
    if (!toolbar) return;
    const classes = DATA.classes || [];
    const factions = ORDER.filter(f => items().some(g => g.faction === f));
    toolbar.innerHTML = `
      <div class="yw-search-wrap">
        <span>尋</span>
        <input id="ywSearch" type="search" placeholder="將名、技能、專武、兵種…" autocomplete="off">
      </div>
      <div class="yw-chips" data-k="camp">
        <button type="button" class="yw-chip on" data-v="">全域</button>
        <button type="button" class="yw-chip" data-v="三國">三國</button>
        <button type="button" class="yw-chip" data-v="日本">日本</button>
      </div>
      <div class="yw-chips" data-k="faction">
        <button type="button" class="yw-chip on" data-v="">全營</button>
        ${factions.map(f => `<button type="button" class="yw-chip" data-v="${esc(f)}">${esc(f)}</button>`).join("")}
      </div>
      <div class="yw-chips" data-k="cls">
        <button type="button" class="yw-chip on" data-v="">全兵種</button>
        ${classes.map(c => `<button type="button" class="yw-chip" data-v="${esc(c)}">${esc(c)}</button>`).join("")}
      </div>`;
    toolbar.addEventListener("click", ev => {
      const b = ev.target.closest(".yw-chip");
      if (!b) return;
      const row = b.parentElement;
      const k = row.dataset.k;
      filters[k] = b.dataset.v;
      row.querySelectorAll(".yw-chip").forEach(x => x.classList.toggle("on", x === b));
      if (k === "camp" && filters.faction) {
        const g = items().find(x => x.faction === filters.faction);
        if (g && filters.camp && g.camp !== filters.camp) {
          filters.faction = "";
          const fRow = toolbar.querySelector('[data-k="faction"]');
          fRow.querySelectorAll(".yw-chip").forEach(x => x.classList.toggle("on", x.dataset.v === ""));
        }
      }
      render();
    });
    const input = $("#ywSearch", toolbar);
    if (input) input.addEventListener("input", e => { filters.q = e.target.value; render(); });
  }

  function bindTabs() {
    $$(".yw-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        const m = tab.dataset.mode;
        if ((location.hash || "").replace(/^#/, "") !== m) location.hash = m;
        else applyHash();
      });
    });
  }

  function applyHash() {
    const h = decodeURIComponent((location.hash || "#atlas").replace(/^#/, "") || "atlas");
    if (h === "compare" || h === "trial" || h === "atlas") {
      mode = h;
      closeDetail(false);
    } else if (/^g-\d+/.test(h)) {
      mode = "atlas";
      updateTabs();
      render();
      const g = items().find(x => x.id === h);
      if (g) openDetail(g, false);
      return;
    } else {
      mode = "atlas";
    }
    updateTabs();
    render();
  }

  function updateTabs() {
    $$(".yw-tab").forEach(t => {
      const on = t.dataset.mode === mode;
      t.classList.toggle("on", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function render() {
    if (mode === "trial") {
      if (grid) grid.hidden = true;
      if (compareBox) compareBox.hidden = true;
      if (toolbar) toolbar.hidden = true;
      if (trialBox) { trialBox.hidden = false; renderTrial(); }
      if (countEl) countEl.textContent = `連對 ${trial.streak} · 累計 ${trial.score}/${trial.total} · 最佳 ${trial.best}`;
      return;
    }
    if (toolbar) toolbar.hidden = false;
    if (trialBox) trialBox.hidden = true;
    if (mode === "compare") {
      if (grid) grid.hidden = true;
      if (compareBox) { compareBox.hidden = false; renderCompare(); }
      if (countEl) countEl.textContent = `對照 ${compareIds.length} / 3`;
      return;
    }
    if (compareBox) compareBox.hidden = true;
    if (grid) { grid.hidden = false; renderAtlas(); }
  }

  function renderAtlas() {
    const list = filtered();
    if (countEl) {
      countEl.textContent = list.length === items().length
        ? `凡 ${DATA.count} 將`
        : `得 ${list.length} 將 · 凡 ${DATA.count}`;
    }
    if (!grid) return;
    if (!list.length) {
      grid.innerHTML = `<p class="yw-empty">無相符武將。可改營、改兵種，或清搜尋。</p>`;
      return;
    }
    const group = !filters.faction;
    let html = "";
    let last = null;
    list.forEach(g => {
      if (group && g.faction !== last) {
        last = g.faction;
        const n = list.filter(x => x.faction === g.faction).length;
        html += `<div class="era-band yw-band"><span>${esc(g.faction)}</span><span class="en">${esc(FACTION_EN[g.faction] || "")} · ${n}</span></div>`;
      }
      html += cardHTML(g);
    });
    grid.innerHTML = html;
    grid.querySelectorAll(".yw-card").forEach(el => {
      const open = () => { location.hash = el.dataset.id; };
      el.addEventListener("click", ev => {
        if (ev.target.closest("[data-act]")) return;
        open();
      });
      el.addEventListener("keydown", ev => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); open(); }
      });
      const add = el.querySelector("[data-act='cmp']");
      if (add) add.addEventListener("click", ev => {
        ev.stopPropagation();
        toggleCompare(el.dataset.id);
        add.classList.toggle("on", compareIds.includes(el.dataset.id));
      });
    });
  }

  function cardHTML(g) {
    const on = compareIds.includes(g.id) ? " on" : "";
    const miss = g.missing && g.missing.length ? `<span class="yw-miss">未錄</span>` : "";
    const extra = g.extra ? `<span class="yw-extra-dot" title="${esc(g.extraDesc || g.extra)}">招</span>` : "";
    const origin = g.origin ? `<span class="yw-origin">${esc(g.origin)}</span>` : "";
    return `<article class="yw-card f-${tone(g)}" data-id="${esc(g.id)}" tabindex="0">
      <button type="button" class="yw-cmp${on}" data-act="cmp" title="加入對照" aria-label="加入對照">對</button>
      ${avaHTML(g)}
      <div class="yw-card-meta"><span>Lv.${esc(levelText(g))}</span><span class="dot"></span><span>${esc(g.class)}</span>${origin}${miss}${extra}</div>
      <h3>${esc(g.name)}</h3>
      <p class="yw-card-sk">${esc((g.skills || []).slice(0, 4).join(" · ") || "主動技未錄")}</p>
      <div class="stamp">${esc(SEAL[g.faction] || g.faction.slice(0, 1))}</div>
    </article>`;
  }

  function toggleCompare(id) {
    const i = compareIds.indexOf(id);
    if (i >= 0) compareIds.splice(i, 1);
    else {
      if (compareIds.length >= 3) compareIds.shift();
      compareIds.push(id);
    }
    saveCompare();
    if (mode === "compare") render();
    else if (countEl && mode === "compare") countEl.textContent = `對照 ${compareIds.length} / 3`;
  }

  function bindOverlay() {
    if (!overlay) return;
    overlay.addEventListener("click", e => { if (e.target === overlay) closeDetail(true); });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && overlay.classList.contains("open")) closeDetail(true);
    });
  }

  function openDetail(g, writeHash = true) {
    if (!overlay || !sheet) return;
    if (writeHash && (location.hash || "").replace(/^#/, "") !== g.id) {
      history.replaceState(null, "", "#" + g.id);
    }
    const pairs = skillPairs(g);
    const skills = pairs.length
      ? pairs.map(p => `<div class="yw-skill"><span class="yw-pill"${p.desc ? ` title="${esc(p.desc)}"` : ""}>${esc(p.name)}</span>${p.desc ? `<p>${esc(p.desc)}</p>` : `<p class="dim">說明未錄</p>`}</div>`).join("")
      : `<span class="yw-pill dim">主動技未錄</span>`;
    const miss = (g.missing || []).map(m => `<span class="yw-tag">${esc(m)}</span>`).join("");
    const alias = (g.alias || []).length
      ? `<div class="yw-dl"><dt>原表</dt><dd>${g.alias.map(esc).join("、")}</dd></div>` : "";
    const extra = g.extra ? `<div class="yw-dl"><dt>表外招</dt><dd>${esc(g.extra)}${g.extraDesc ? `<div class="yw-mini">${esc(g.extraDesc)}</div>` : ""}</dd></div>` : "";
    const origin = g.origin ? `<div class="yw-dl"><dt>本籍</dt><dd>${esc(g.origin)}</dd></div>` : "";
    const wline = `${esc(g.wskill || "未錄")}${g.wdesc ? `<div class="yw-mini">${esc(g.wdesc)}</div>` : ""}`;
    sheet.innerHTML = `
      <button class="close" type="button" aria-label="關閉">×</button>
      <div class="s-meta">
        <span>${esc(g.camp)}</span><span>·</span><span>${esc(g.faction)}</span>
        <span>·</span><span>${esc(g.class)}</span>
        <span>·</span><span>Lv.${esc(levelText(g))}</span>
      </div>
      <div class="yw-detail-head">
        ${avaHTML(g, "lg")}
        <div>
          <h2>${esc(g.name)}</h2>
        </div>
      </div>
      ${g.bio ? `<p class="yw-bio">${esc(g.bio)}</p>` : ""}
      <div class="yw-skill-list">${skills}</div>
      <dl class="yw-kv">
        <div class="yw-dl"><dt>專武</dt><dd>${esc(g.weapon || "未錄")}</dd></div>
        <div class="yw-dl"><dt>武技</dt><dd>${wline}</dd></div>
        ${origin}${extra}${alias}
      </dl>
      ${miss ? `<div class="yw-missing">${miss}</div>` : ""}
      <div class="btn-row">
        <button type="button" class="btn" data-act="cmp">${compareIds.includes(g.id) ? "移出對照" : "加入對照"}</button>
        <a class="btn" href="#compare">前往對照</a>
      </div>`;
    sheet.querySelector(".close").addEventListener("click", () => closeDetail(true));
    const cmp = sheet.querySelector("[data-act='cmp']");
    cmp.addEventListener("click", () => {
      toggleCompare(g.id);
      cmp.textContent = compareIds.includes(g.id) ? "移出對照" : "加入對照";
      const cardBtn = grid && grid.querySelector(`.yw-card[data-id="${g.id}"] [data-act='cmp']`);
      if (cardBtn) cardBtn.classList.toggle("on", compareIds.includes(g.id));
    });
    overlay.classList.add("open");
    document.body.classList.add("sheet-open");
  }

  function closeDetail(resetHash) {
    if (!overlay) return;
    overlay.classList.remove("open");
    document.body.classList.remove("sheet-open");
    if (resetHash) {
      const h = (location.hash || "").replace(/^#/, "");
      if (/^g-/.test(h)) history.replaceState(null, "", "#atlas");
    }
  }

  function renderCompare() {
    if (!compareBox) return;
    const gens = compareIds.map(id => items().find(x => x.id === id)).filter(Boolean);
    if (!gens.length) {
      compareBox.innerHTML = `<p class="yw-empty">於圖鑑點卡片右上「對」，最多可選三將並觀。技能缺者仍照實標「未錄」。</p>
        <p class="yw-hint"><a href="#atlas">返回圖鑑</a></p>`;
      return;
    }
    const skHTML = g => {
      const pairs = skillPairs(g);
      if (!pairs.length) return "未錄";
      return pairs.map(p => `<div class="yw-sk"><b>${esc(p.name)}</b>${p.desc ? `<span>${esc(p.desc)}</span>` : ""}</div>`).join("");
    };
    const rows = [
      ["陣營", g => esc(g.camp)],
      ["隸屬", g => esc(g.faction + (g.origin ? `（${g.origin}）` : ""))],
      ["兵種", g => esc(g.class)],
      ["等級", g => esc(levelText(g))],
      ["技能", skHTML],
      ["專武", g => esc(g.weapon || "未錄")],
      ["武技", g => g.wskill ? `<div class="yw-sk"><b>${esc(g.wskill)}</b>${g.wdesc ? `<span>${esc(g.wdesc)}</span>` : ""}</div>` : "未錄"],
      ["小傳", g => g.bio ? `<div class="yw-sk"><span>${esc(g.bio)}</span></div>` : "—"],
      ["表外招", g => g.extra ? `<div class="yw-sk"><b>${esc(g.extra)}</b>${g.extraDesc ? `<span>${esc(g.extraDesc)}</span>` : ""}</div>` : "—"],
      ["缺欄", g => esc((g.missing || []).join("、") || "無")]
    ];
    const head = `<tr><th></th>${gens.map(g =>
      `<th><button type="button" class="yw-unlink" data-id="${esc(g.id)}" title="移出">×</button>${avaHTML(g, "sm")}<a href="#${esc(g.id)}">${esc(g.name)}</a></th>`
    ).join("")}</tr>`;
    const body = rows.map(([lab, fn]) =>
      `<tr><th>${esc(lab)}</th>${gens.map(g => `<td>${fn(g)}</td>`).join("")}</tr>`
    ).join("");
    compareBox.innerHTML = `
      <div class="yw-table-wrap"><table class="yw-table">${head}${body}</table></div>
      <p class="yw-hint">再點圖鑑「對」可換將。 <a href="#atlas">返回圖鑑</a></p>`;
    compareBox.querySelectorAll(".yw-unlink").forEach(b => {
      b.addEventListener("click", () => { toggleCompare(b.dataset.id); renderCompare(); });
    });
  }

  const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function renderTrial() {
    if (!trialBox) return;
    if (!trial.current) trial.current = makeQuestion();
    const q = trial.current;
    if (!q) {
      trialBox.innerHTML = `<p class="yw-empty">題庫不足。</p>`;
      return;
    }
    const choices = q.choices.map((c, i) =>
      `<button type="button" class="yw-choice" data-i="${i}" ${trial.locked ? "disabled" : ""}>${esc(c.label)}</button>`
    ).join("");
    trialBox.innerHTML = `
      <div class="yw-trial-meta">
        <span class="yw-kind">${esc(q.kindLabel)}</span>
        <span>連對 ${trial.streak}</span>
        <span>累計 ${trial.score}／${trial.total}</span>
        <span>最佳 ${trial.best}</span>
      </div>
      <p class="yw-q">${q.prompt}</p>
      <div class="yw-choices">${choices}</div>
      <div class="yw-trial-fb" id="ywFb"></div>
      <div class="btn-row">
        <button type="button" class="btn primary" id="ywNext"${trial.locked ? "" : " disabled"}>下一題</button>
        <a class="btn" id="ywPeek" href="#${esc(q.answer.id)}" ${trial.locked ? "" : "hidden"}>查看此將</a>
      </div>`;
    trialBox.querySelectorAll(".yw-choice").forEach(b => {
      b.addEventListener("click", () => answerTrial(+b.dataset.i));
    });
    const next = $("#ywNext", trialBox);
    if (next) next.addEventListener("click", () => {
      trial.current = makeQuestion();
      trial.locked = false;
      renderTrial();
    });
  }

  function wrapNameQ(kindLabel, prompt, g, pool) {
    const names = [...new Set(pool.map(x => x.name).filter(n => n !== g.name))];
    const wrong = shuffle(names).slice(0, 3);
    const choices = shuffle([g.name, ...wrong]).map(n => ({ label: n, ok: n === g.name }));
    return { kindLabel, prompt, answer: g, choices };
  }

  function makeQuestion() {
    const all = items();
    const poolSkill = all.filter(g => (g.skills || []).length >= 2);
    const poolWep = all.filter(g => g.weapon);
    const types = [];
    if (poolSkill.length >= 4) types.push("skill");
    if (poolWep.length >= 4) types.push("weapon");
    if (all.length >= 4) types.push("faction", "class");
    if (!types.length) return null;
    const type = rnd(types);
    if (type === "skill") {
      const g = rnd(poolSkill);
      const prompt = `下列技能同屬一將，此人是誰？<br><strong>${g.skills.map(esc).join(" · ")}</strong>`;
      return wrapNameQ("聞技識將", prompt, g, poolSkill);
    }
    if (type === "weapon") {
      const g = rnd(poolWep);
      const ws = g.wskill ? `（武技：${esc(g.wskill)}）` : "";
      const prompt = `持專武「${esc(g.weapon)}」${ws}者是誰？`;
      return wrapNameQ("望器知人", prompt, g, poolWep);
    }
    if (type === "class") {
      const g = rnd(all.filter(x => x.class));
      const facs = [...new Set(all.map(x => x.class).filter(Boolean))];
      const wrong = shuffle(facs.filter(f => f !== g.class)).slice(0, 3);
      const choices = shuffle([g.class, ...wrong]).map(f => ({ label: f, ok: f === g.class }));
      return { kindLabel: "辨兵", prompt: `「${esc(g.name)}」是何兵種？`, answer: g, choices };
    }
    const g = rnd(all);
    const facs = [...new Set(all.map(x => x.faction))];
    const wrong = shuffle(facs.filter(f => f !== g.faction)).slice(0, 3);
    const choices = shuffle([g.faction, ...wrong]).map(f => ({ label: f, ok: f === g.faction }));
    return { kindLabel: "歸營", prompt: `「${esc(g.name)}」隸屬何營？`, answer: g, choices };
  }

  function answerTrial(i) {
    if (trial.locked) return;
    trial.locked = true;
    trial.total += 1;
    const q = trial.current;
    const ok = q.choices[i].ok;
    if (ok) {
      trial.score += 1;
      trial.streak += 1;
      if (trial.streak > trial.best) {
        trial.best = trial.streak;
        localStorage.setItem("yw_best", String(trial.best));
      }
    } else trial.streak = 0;
    $$(".yw-choice", trialBox).forEach((b, idx) => {
      b.disabled = true;
      if (q.choices[idx].ok) b.classList.add("ok");
      else if (idx === i) b.classList.add("bad");
    });
    const fb = $("#ywFb", trialBox);
    const right = q.choices.find(c => c.ok).label;
    const ans = q.answer;
    const sk = skillPairs(ans).map(p => esc(p.name) + (p.desc ? `（${esc(p.desc)}）` : "")).join("；");
    if (fb) fb.innerHTML = (ok
      ? `正。${esc(ans.name)} · ${esc(ans.faction)}${ans.class ? " · " + esc(ans.class) : ""}`
      : `誤。正解為「${esc(right)}」。`)
      + (ans.bio ? `<div class="yw-mini">${esc(ans.bio)}</div>` : "")
      + (sk ? `<div class="yw-mini">${sk}</div>` : "");
    const next = $("#ywNext", trialBox);
    if (next) next.disabled = false;
    const peek = $("#ywPeek", trialBox);
    if (peek) peek.hidden = false;
    if (countEl) countEl.textContent = `連對 ${trial.streak} · 累計 ${trial.score}/${trial.total} · 最佳 ${trial.best}`;
  }

  load();
});
