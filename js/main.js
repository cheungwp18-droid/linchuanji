const STATIC_DEPLOY = true;
// 林川集 · 交互脚本（含在線編輯）
document.addEventListener("DOMContentLoaded", () => {

  /* ---------- 工具 ---------- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- 配圖輔助 ---------- */
  const readFileAsDataURL = file => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(new Error("圖片讀取失敗"));
    fr.readAsDataURL(file);
  });

  /* 判斷某行是否為圖片網址（用於正文內嵌圖） */
  function isImageLine(s) {
    s = (s || "").trim();
    if (!s) return false;
    if (/^(\/?images\/|https?:\/\/|data:image\/)/.test(s)) return true;
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(s) && !/\s/.test(s);
  }

  /* GitHub Pages 在 /linchuanji/ 下，根路徑 /images/ 會指到網站根而 404 */
  function mediaSrc(s) {
    s = String(s == null ? "" : s).trim();
    if (s.startsWith("/images/")) return s.slice(1);
    return s;
  }

  /* 文章正文：圖文交錯渲染（圖片行 -> <img>，其餘 -> <p>） */
  function renderBody(lines) {
    return (lines || []).map(l => isImageLine(l)
      ? `<img class="s-inline-img" src="${esc(mediaSrc(l.trim()))}" alt="" loading="lazy" decoding="async">`
      : `<p>${esc(l)}</p>`).join("");
  }

  /* 瀏覽統計：呼叫 /api/hit 計數，回傳後以 cb 處理 */
  function recordHit(id, cb) {
    const q = id ? ("?id=" + encodeURIComponent(id)) : "";
    fetch("/api/hit" + q, { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (cb) cb(d.views || 0, d); })
      .catch(() => {});
  }

  /* 全站統計條（瀏覽人次 / 訪客數 / 文章篇數 / 總字數） */
  let SITE_HIT = { total: 100, visitors: 3 };
  /* 是否為靜態部署（無後端）：線上版 STATIC_DEPLOY=true，本地編輯副本未定義 */
  function isStaticDeploy() { return (typeof STATIC_DEPLOY !== "undefined" && STATIC_DEPLOY); }
  function renderSiteStats() {
    const footer = document.querySelector(".footer");
    let el = document.getElementById("siteStats");
    if (!el) {
      el = document.createElement("section");
      el.id = "siteStats";
      el.className = "site-stats wrap";
      if (footer && footer.parentNode) footer.parentNode.insertBefore(el, footer);
      else document.body.appendChild(el);
    }
    const arr = [].concat(state.essays || [], state.poems || [], state.wencui || [], state.zawen || [], state.chuangzuo || []);
    let words = 0;
    arr.forEach(x => {
      (x.body || []).forEach(b => { if (typeof b === "string") words += b.replace(/\s/g, "").length; });
      if (x.lines) words += (x.lines.join("")).replace(/\s/g, "").length;
      if (x.book && x.book.words) words += Number(x.book.words) || 0;
    });
    /* 靜態部署時 SITE_HIT 由 build_static.py 注入為本地伺服器(8123)的統計值，故讀者頁與管理頁一致 */
    const totalNum = SITE_HIT.total.toLocaleString();
    const visNum   = SITE_HIT.visitors.toLocaleString();
    el.innerHTML = `
      <div class="ss-item"><span class="ss-num">${totalNum}</span><span class="ss-label">瀏覽人次</span></div>
      <div class="ss-item"><span class="ss-num">${visNum}</span><span class="ss-label">訪客數</span></div>
      <div class="ss-item"><span class="ss-num">${arr.length}</span><span class="ss-label">文章篇數</span></div>
      <div class="ss-item"><span class="ss-num">${(words / 10000).toFixed(1)}萬</span><span class="ss-label">總字數</span></div>`;
  }

  /* 詩詞/自述用：獨立「配圖」欄位（圖集中在文末） */
  function imgField(val) {
    return `
      <div class="form-field">
        <label>配圖（可選：本地上傳或貼網址，每行一張）</label>
        <div class="img-previews" data-imgs></div>
        <div class="img-actions">
          <label class="btn file-btn">＋ 選擇本地圖片<input type="file" accept="image/*" multiple hidden data-file></label>
          <span class="img-tip">或於下方貼圖片網址</span>
        </div>
        <textarea data-f="images" rows="2" placeholder="https://... 或 images/xxx.jpg">${esc(val)}</textarea>
      </div>`;
  }

  /* 私密勾選框（編輯表單用） */
  function privField(checked) {
    return `
      <div class="form-field checkbox-field">
        <label class="check"><input type="checkbox" id="f_private" ${checked ? "checked" : ""}> 設為私密（僅作者登入後可見）</label>
      </div>`;
  }

  /* 文集用：圖直接插入「正文」欄位，圖文交錯，位置自訂 */
  function imgHelperHTML() {
    return `
      <div class="form-field">
        <label>配圖：選本地圖片會插到「正文」游標所在行之後；也可直接在正文貼圖片網址（該行即視為圖）</label>
        <div class="img-previews" data-imgs></div>
        <div class="img-actions">
          <label class="btn file-btn">＋ 選擇本地圖片<input type="file" accept="image/*" multiple hidden data-file></label>
          <span class="img-tip">預覽裡點 ✕ 可移除該圖</span>
        </div>
      </div>`;
  }

  function wireImageField(targetSel) {
    const ta = sheet.querySelector(targetSel);
    if (!ta) return;
    const box = sheet.querySelector('[data-imgs]');
    const file = sheet.querySelector('input[data-file]');
    const imgLineIdxs = () => {
      const lines = ta.value.split("\n");
      const idx = [];
      lines.forEach((l, i) => { if (isImageLine(l)) idx.push(i); });
      return idx;
    };
    const render = () => {
      const idxs = imgLineIdxs();
      const urls = idxs.map(i => ta.value.split("\n")[i].trim());
      box.innerHTML = urls.map((u, k) =>
        `<button type="button" class="img-thumb" data-i="${k}" title="點擊移除該圖"><img src="${esc(mediaSrc(u))}" alt=""><span>✕</span></button>`
      ).join("");
    };
    ta.addEventListener("input", render);
    if (box) box.addEventListener("click", ev => {
      const b = ev.target.closest(".img-thumb");
      if (!b) return;
      const real = imgLineIdxs()[+b.dataset.i];
      const lines = ta.value.split("\n");
      lines.splice(real, 1);
      ta.value = lines.join("\n");
      render();
    });
    if (file) file.addEventListener("change", async () => {
      for (const f of file.files) {
        try {
          const dataUrl = await readFileAsDataURL(f);
          const r = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataUrl, name: f.name })
          });
          const j = await r.json();
          if (!j.ok) throw new Error(j.error || "上傳失敗");
          if (!ta.value.trim()) {
            ta.value = j.url;
          } else {
            const lines = ta.value.split("\n");
            let pos = lines.length - 1;
            try {
              if (typeof ta.selectionStart === "number") {
                const before = ta.value.slice(0, ta.selectionStart);
                pos = before.split("\n").length - 1; // 游標所在行（0-based）
              }
            } catch (e) {}
            lines.splice(pos + 1, 0, j.url); // 插在該行之後
            ta.value = lines.join("\n");
          }
          render();
          toast("已插入圖 ✓");
        } catch (e) {
          toast("上傳失敗：" + (e.message || e), true);
        }
      }
      file.value = "";
    });
    render();
  }

  function parseImages() {
    return (sheet.querySelector('textarea[data-f="images"]').value || "")
      .split("\n").map(s => s.trim()).filter(Boolean);
  }

  /* ---------- 狀態 ---------- */
  let state = { essays: [], poems: [], wencui: [], zawen: [], chuangzuo: [], motto: {}, about: {} };
  let editing = false;
  let authorMode = (sessionStorage.getItem("lc_author") === "1");

  /* 作者後台密碼（僅本機個人使用，非加密儲存；請改成你自己的密碼） */
  const AUTH_PASS = "linchuan";

  /* ---------- Giscus 留言設定（靜態站/讀者版面共用，免後端） ---------- */
  /* 請到 https://giscus.app 依指示取得 repo / repoId / category / categoryId，
     並確保該 GitHub 倉庫為公開、已啟用 Discussions、已安裝 Giscus App。 */
  const GISCUS = {
    repo: "OWNER/REPO",          // 例如 "wayne/linchuan"
    repoId: "RID",               // 於 giscus.app 取得（數字串）
    category: "Announcements",   // 討論分類名稱
    categoryId: "CID",           // 於 giscus.app 取得（數字串）
    lang: "zh-TW",
    theme: "light"
  };
  const GISCUS_READY = GISCUS.repoId && GISCUS.repoId !== "RID" &&
                      GISCUS.categoryId && GISCUS.categoryId !== "CID";

  /* ---------- 導航高亮 ---------- */
  const here = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav a.link").forEach(a => {
    if (a.getAttribute("href") === here) a.classList.add("active");
  });

  /* ---------- 讀取內容（本機 API，否則 js/data.json） ---------- */
  async function load() {
    try {
      const r = await fetch("/api/content");
      if (!r.ok) throw new Error("no api");
      state = await r.json();
    } catch (e) {
      try {
        const r = await fetch("js/data.json", { cache: "no-store" });
        if (!r.ok) throw new Error("no json");
        state = await r.json();
      } catch (e2) {
        state = {
          essays: (typeof ESSAYS !== "undefined" ? ESSAYS : []),
          poems:  (typeof POEMS  !== "undefined" ? POEMS  : []),
          wencui: (typeof WENCUI !== "undefined" ? WENCUI : []),
          zawen:  (typeof ZAWEN  !== "undefined" ? ZAWEN  : []),
          chuangzuo: (typeof CHUANGZUO !== "undefined" ? CHUANGZUO : []),
          motto:  (typeof MOTTO  !== "undefined" ? MOTTO  : {}),
          about:  (typeof ABOUT  !== "undefined" ? ABOUT  : {})
        };
        if (typeof STATIC_DEPLOY === "undefined" || !STATIC_DEPLOY) showServerHint();
      }
    }
    if (!state.essays) state.essays = [];
    if (!state.poems)  state.poems  = [];
    if (!state.wencui) state.wencui = [];
    if (!state.zawen) state.zawen = [];
    if (!state.chuangzuo) state.chuangzuo = [];
    renderAll();
    renderSiteStats();
  }

  /* ---------- 渲染：文集 ---------- */
  function renderEssays() {
    const grid = document.getElementById("essayGrid");
    if (!grid) return;
    grid.innerHTML = "";
    state.essays.filter(e => !e.private || authorMode).forEach(e => {
      const card = document.createElement("article");
      card.className = "card reveal in";
      card.tabIndex = 0;
      card.innerHTML = `
        <div class="actions">
          <button data-act="edit" title="修改">✎</button>
          <button data-act="del" title="刪除">✕</button>
        </div>
        ${(e.body || []).some(isImageLine) ? `<div class="card-img"><img src="${esc(mediaSrc((e.body || []).find(isImageLine)))}" alt="" loading="lazy" decoding="async"></div>` : ""}
        <div class="meta"><span>${esc(e.author)}</span><span class="dot"></span><span>${esc(e.season || "")}</span>${e.issue ? `<span class="dot"></span><span class="issue-badge">第${e.issue}期</span>` : ""}${e.private ? `<span class="dot"></span><span class="private-badge">私</span>` : ""}</div>
        <h3>${esc(e.title)}</h3>
        <p class="excerpt">${esc(e.excerpt || "")}</p>
        <div class="stamp">${esc(e.seal || "")}</div>`;
      card.addEventListener("click", ev => {
        const act = ev.target.closest("[data-act]");
        if (act) {
          ev.stopPropagation();
          if (act.dataset.act === "edit") openForm("essay", e);
          else if (act.dataset.act === "del") removeItem("essay", e.id);
          return;
        }
        openEssay(e.id);
      });
      card.addEventListener("keydown", ev => { if (ev.key === "Enter") openEssay(e.id); });
      grid.appendChild(card);
    });
    if (authorMode && !isStaticDeploy()) grid.appendChild(addTile("essay"));
  }

  /* ---------- 渲染：詩詞（豎排） ---------- */
  function renderPoems() {
    const grid = document.getElementById("poemGrid");
    if (!grid) return;
    grid.innerHTML = "";
    state.poems.filter(p => !p.private || authorMode).forEach(p => {
      const el = document.createElement("div");
      el.className = "poem reveal in";
      el.tabIndex = 0;
      const vlines = `<div class="title">${esc(p.title)}</div>` + p.lines.map(l => `<div>${esc(l)}</div>`).join("");
      el.innerHTML = `
        <div class="actions">
          <button data-act="edit" title="修改">✎</button>
          <button data-act="del" title="刪除">✕</button>
        </div>
        <div class="vtext">${vlines}</div>
        <div class="form">${esc(p.form || "")}</div>${p.private ? `<div class="private-badge poem-priv">私</div>` : ""}`;
      el.addEventListener("click", ev => {
        const act = ev.target.closest("[data-act]");
        if (act) {
          ev.stopPropagation();
          if (act.dataset.act === "edit") openForm("poem", p);
          else if (act.dataset.act === "del") removeItem("poem", p.id);
          return;
        }
        openPoem(p.id);
      });
      el.addEventListener("keydown", ev => { if (ev.key === "Enter") openPoem(p.id); });
      grid.appendChild(el);
    });
    if (authorMode && !isStaticDeploy()) grid.appendChild(addTile("poem"));
  }

  const ERA_EN = {
    "先秦": "Pre-Qin", "漢": "Han", "晉": "Jin", "南朝": "Southern Dynasties",
    "唐": "Tang", "五代": "Five Dynasties", "宋": "Song", "元": "Yuan",
    "元末明初": "Yuan–Ming", "明": "Ming", "清": "Qing"
  };

  function eraBand(label) {
    const el = document.createElement("div");
    el.className = "era-band";
    const en = ERA_EN[label] || "";
    el.innerHTML = `<span>${esc(label)}</span>${en ? `<span class="en">${esc(en)}</span>` : ""}`;
    return el;
  }

  function renderWencui() {
    const grid = document.getElementById("wencuiGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const novelGrid = document.getElementById("novelGrid");
    if (novelGrid) novelGrid.innerHTML = "";
    let lastClassicEra = null;
    let lastNovelEra = null;
    state.wencui.filter(e => !e.private || authorMode).forEach(e => {
      const isNovel = e.book && e.book.novel;
      const target = isNovel && novelGrid ? novelGrid : grid;
      if (e.season) {
        if (isNovel && novelGrid) {
          if (e.season !== lastNovelEra) {
            novelGrid.appendChild(eraBand(e.season));
            lastNovelEra = e.season;
          }
        } else if (e.season !== lastClassicEra) {
          grid.appendChild(eraBand(e.season));
          lastClassicEra = e.season;
        }
      }
      const card = document.createElement("article");
      const tone = e.book && /^[a-z-]+$/.test(e.book.tone || "") ? e.book.tone : "ink";
      const unit = e.book && e.book.unit ? e.book.unit : "篇";
      card.className = "card reveal in" + (e.book ? " book-card" : "");
      card.tabIndex = 0;
      card.innerHTML = `
        <div class="actions">
          <button data-act="edit" title="修改">✎</button>
          <button data-act="del" title="刪除">✕</button>
        </div>
        ${e.book ? `<div class="book-cover tone-${tone}" aria-hidden="true">
          <div class="book-cover-rule"></div>
          <span class="book-cover-kicker">林川集 · 文學經典</span>
          <strong>${esc(e.title)}</strong>
          <span class="book-cover-author">${esc(e.author)}</span>
          <span class="book-cover-count">${Number(e.book.count) || 0} ${esc(unit)}</span>
        </div>` : ((e.body || []).some(isImageLine) ? `<div class="card-img"><img src="${esc(mediaSrc((e.body || []).find(isImageLine)))}" alt="" loading="lazy" decoding="async"></div>` : "")}
        <div class="meta"><span>${esc(e.author)}</span><span class="dot"></span><span>${esc(e.season || "")}</span>${e.issue ? `<span class="dot"></span><span class="issue-badge">第${e.issue}期</span>` : ""}${e.private ? `<span class="dot"></span><span class="private-badge">私</span>` : ""}</div>
        <h3>${esc(e.title)}</h3>
        <p class="excerpt">${esc(e.excerpt || "")}</p>
        <div class="stamp">${esc(e.seal || "")}</div>`;
      card.addEventListener("click", ev => {
        const act = ev.target.closest("[data-act]");
        if (act) {
          ev.stopPropagation();
          if (act.dataset.act === "edit") openForm("wencui", e);
          else if (act.dataset.act === "del") removeItem("wencui", e.id);
          return;
        }
        openWencui(e.id);
      });
      card.addEventListener("keydown", ev => { if (ev.key === "Enter") openWencui(e.id); });
      target.appendChild(card);
    });
    if (authorMode && !isStaticDeploy()) grid.appendChild(addTile("wencui"));
  }

  function addTile(kind) {
    const t = document.createElement("div");
    t.className = "add-tile";
    t.innerHTML = `<span>＋</span><em>${kind === "essay" ? "新增文集" : kind === "wencui" ? "新增文學經典" : kind === "zawen" ? "新增雜文" : kind === "chuangzuo" ? "新增創作" : "新增詩詞"}</em>`;
    t.addEventListener("click", () => openForm(kind, null));
    return t;
  }

  function renderAll() {
    renderEssays();
    renderPoems();
    renderWencui();
    renderZawen();
    renderChuangzuo();
    applyMotto();
    renderAbout();
  }

  function renderZawen() {
    const grid = document.getElementById("zawenGrid");
    if (!grid) return;
    grid.innerHTML = "";
    state.zawen.filter(e => !e.private || authorMode).forEach(e => {
      const card = document.createElement("article");
      card.className = "card reveal in";
      card.tabIndex = 0;
      card.innerHTML = `
        <div class="actions">
          <button data-act="edit" title="修改">✎</button>
          <button data-act="del" title="刪除">✕</button>
        </div>
        ${(e.body || []).some(isImageLine) ? `<div class="card-img"><img src="${esc(mediaSrc((e.body || []).find(isImageLine)))}" alt="" loading="lazy" decoding="async"></div>` : ""}
        <div class="meta"><span>${esc(e.author)}</span><span class="dot"></span><span>${esc(e.season || "")}</span>${e.issue ? `<span class="dot"></span><span class="issue-badge">第${e.issue}期</span>` : ""}${e.private ? `<span class="dot"></span><span class="private-badge">私</span>` : ""}</div>
        <h3>${esc(e.title)}</h3>
        <p class="excerpt">${esc(e.excerpt || "")}</p>
        <div class="stamp">${esc(e.seal || "")}</div>`;
      card.addEventListener("click", ev => {
        const act = ev.target.closest("[data-act]");
        if (act) {
          ev.stopPropagation();
          if (act.dataset.act === "edit") openForm("zawen", e);
          else if (act.dataset.act === "del") removeItem("zawen", e.id);
          return;
        }
        openZawen(e.id);
      });
      card.addEventListener("keydown", ev => { if (ev.key === "Enter") openZawen(e.id); });
      grid.appendChild(card);
    });
    if (authorMode && !isStaticDeploy()) grid.appendChild(addTile("zawen"));
  }

  function renderChuangzuo() {
    const grid = document.getElementById("chuangzuoGrid");
    if (!grid) return;
    grid.innerHTML = "";
    state.chuangzuo.filter(e => !e.private || authorMode).forEach(e => {
      const card = document.createElement("article");
      card.className = "card reveal in";
      card.tabIndex = 0;
      card.innerHTML = `
        <div class="actions">
          <button data-act="edit" title="修改">✎</button>
          <button data-act="del" title="刪除">✕</button>
        </div>
        ${(e.body || []).some(isImageLine) ? `<div class="card-img"><img src="${esc(mediaSrc((e.body || []).find(isImageLine)))}" alt="" loading="lazy" decoding="async"></div>` : ""}
        <div class="meta"><span>${esc(e.author)}</span><span class="dot"></span><span>${esc(e.season || "")}</span>${e.issue ? `<span class="dot"></span><span class="issue-badge">第${e.issue}期</span>` : ""}${e.private ? `<span class="dot"></span><span class="private-badge">私</span>` : ""}</div>
        <h3>${esc(e.title)}</h3>
        <p class="excerpt">${esc(e.excerpt || "")}</p>
        <div class="stamp">${esc(e.seal || "")}</div>`;
      card.addEventListener("click", ev => {
        const act = ev.target.closest("[data-act]");
        if (act) {
          ev.stopPropagation();
          if (act.dataset.act === "edit") openForm("chuangzuo", e);
          else if (act.dataset.act === "del") removeItem("chuangzuo", e.id);
          return;
        }
        openChuangzuo(e.id);
      });
      card.addEventListener("keydown", ev => { if (ev.key === "Enter") openChuangzuo(e.id); });
      grid.appendChild(card);
    });
    if (authorMode && !isStaticDeploy()) grid.appendChild(addTile("chuangzuo"));
  }

  function renderAbout() {
    const box = document.getElementById("aboutText");
    if (!box) return;
    const a = state.about || {};
    const paras = (a.paragraphs || []).map(p => `<p>${esc(p)}</p>`).join("");
    const imgs = (a.images || []).map(u => `<img src="${esc(mediaSrc(u))}" alt="" loading="lazy" decoding="async">`).join("");
    box.innerHTML =
      `<p class="lead">${esc(a.lead || "")}</p>` + paras +
      (a.sig ? `<p class="sig">${esc(a.sig)}</p>` : "") +
      (imgs ? `<div class="about-imgs">${imgs}</div>` : "");
    const por = document.getElementById("aboutPortrait");
    if (por) por.textContent = a.portrait || "";
  }

  function showServerHint() {
    if (document.getElementById("serverHint")) return;
    const b = document.createElement("div");
    b.id = "serverHint";
    b.className = "server-hint";
    b.innerHTML = "提示：目前非本機編輯服務器，內容僅能瀏覽、無法保存。請開 <b>http://127.0.0.1:8123/</b> 編輯。";
    document.body.appendChild(b);
  }

  /* ---------- 題辭 ---------- */
  function applyMotto() {
    const m = state.motto || {};
    const set = (id, v) => { const el = document.getElementById(id); if (el && v) el.textContent = v; };
    set("coupletLeft", m.coupletLeft);
    set("coupletRight", m.coupletRight);
    set("heroTitle", m.hero);
    set("heroSub", m.sub);
  }

  /* ---------- 詳情彈層 ---------- */
  const overlay = document.getElementById("overlay");
  const sheet = document.getElementById("sheet");
  function closeSheet() {
    overlay.classList.remove("open");
    document.body.classList.remove("sheet-open");
    sheet.classList.remove("book-sheet");
    sheet.innerHTML = "";
  }
  function openOverlay() {
    overlay.classList.add("open");
    document.body.classList.add("sheet-open");
  }
  function prepareSheet(isBook) {
    sheet.classList.toggle("book-sheet", !!isBook);
  }
  if (overlay) {
    overlay.addEventListener("click", e => { if (e.target === overlay) closeSheet(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });
  }

  function openEssay(id) {
    const e = state.essays.find(x => x.id === id);
    if (!e || (e.private && !authorMode)) return;
    recordHit(id, v => { const el = document.getElementById("sViews"); if (el) el.textContent = "瀏覽 " + v + " 次"; });
    prepareSheet(false);
    sheet.innerHTML = `
      <button class="close" aria-label="關閉">×</button>
      <div class="s-meta"><span>${esc(e.author)}</span><span>·</span><span>${esc(e.season || "")}</span>${e.issue ? `<span>·</span><span class="issue-badge">第${e.issue}期</span>` : ""}<span>·</span><span>散文</span></div>
      <h2>${esc(e.title)}</h2>
      <div class="s-views" id="sViews"></div>
      <div class="s-body">${renderBody(e.body)}</div>
      <div class="s-stamp">${esc(e.seal || "")}</div>
      ${commentSectionHTML("essay:" + e.id)}`;
    sheet.querySelector(".close").addEventListener("click", closeSheet);
    openOverlay();
    wireComments(e.id);
  }

  function openPoem(id) {
    const p = state.poems.find(x => x.id === id);
    if (!p || (p.private && !authorMode)) return;
    recordHit(id, v => { const el = document.getElementById("sViews"); if (el) el.textContent = "瀏覽 " + v + " 次"; });
    prepareSheet(false);
    const vlines = p.lines.join("<br>");
    sheet.innerHTML = `
      <button class="close" aria-label="關閉">×</button>
      <div class="s-meta"><span>${esc(p.author)}</span><span>·</span><span>${esc(p.form || "")}</span></div>
      <h2>${esc(p.title)}</h2>
      <div class="s-views" id="sViews"></div>
      <div class="s-body" style="text-align:center">
        <p style="text-indent:0;font-family:var(--kai);font-size:1.5rem;line-height:2.2;color:var(--ink);letter-spacing:.12em">${vlines}</p>
        ${p.note ? `<div class="s-note" style="text-align:left;border-left-color:var(--dai)">${esc(p.note)}</div>` : ""}
      </div>
      ${(p.images && p.images.length) ? `<div class="s-imgs">${p.images.map(u => `<img src="${esc(mediaSrc(u))}" alt="" loading="lazy" decoding="async">`).join("")}</div>` : ""}
      <div class="s-stamp">${esc(p.author)}</div>
      ${commentSectionHTML("poem:" + p.id)}`;
    sheet.querySelector(".close").addEventListener("click", closeSheet);
    openOverlay();
    wireComments(p.id);
  }

  /* ---------- 留言區（Giscus，免後端，讀者版面可直接使用） ---------- */
  function commentSectionHTML(target) {
    return `
      <div class="comments" data-term="${esc(target)}">
        <div class="comments-head">留言</div>
        <div class="giscus-mount"></div>
      </div>`;
  }

  function wireComments(target) {
    const box = sheet.querySelector(".comments");
    if (!box) return;
    const mount = box.querySelector(".giscus-mount");
    if (mount) loadGiscus(mount, target);
  }

  function loadGiscus(mount, term) {
    if (!GISCUS_READY) {
      mount.innerHTML = `<div class="c-empty">留言功能尚未啟用（請於後台設定 Giscus 倉庫）。</div>`;
      return;
    }
    mount.innerHTML = "";
    const s = document.createElement("script");
    s.src = "https://giscus.app/client.js";
    s.setAttribute("data-repo", GISCUS.repo);
    s.setAttribute("data-repo-id", GISCUS.repoId);
    s.setAttribute("data-category", GISCUS.category);
    s.setAttribute("data-category-id", GISCUS.categoryId);
    s.setAttribute("data-mapping", "specific-term");
    s.setAttribute("data-term", term);
    s.setAttribute("data-reactions-enabled", "0");
    s.setAttribute("data-emit-metadata", "0");
    s.setAttribute("data-input-position", "bottom");
    s.setAttribute("data-theme", GISCUS.theme);
    s.setAttribute("data-lang", GISCUS.lang);
    s.setAttribute("data-loading", "lazy");
    s.crossOrigin = "anonymous";
    s.async = true;
    mount.appendChild(s);
  }

  const bookCache = new Map();

  async function fetchBook(entry) {
    if (bookCache.has(entry.id)) return bookCache.get(entry.id);
    const r = await fetch(entry.book.file);
    if (!r.ok) throw new Error("典籍資料載入失敗");
    const book = await r.json();
    bookCache.set(entry.id, book);
    return book;
  }

  async function openBook(entry) {
    const unit = entry.book.unit || "篇";
    prepareSheet(true);
    sheet.innerHTML = `
      <button class="close" aria-label="關閉">×</button>
      <div class="s-meta"><span>${esc(entry.author)}</span><span>·</span><span>${esc(entry.season || "")}</span><span>·</span><span>${entry.book.novel ? "章回小說" : "文學經典"}</span></div>
      <div class="book-heading">
        <div><h2>${esc(entry.title)}</h2><p>${esc(entry.excerpt || "")}</p></div>
        <span class="book-total">${Number(entry.book.count) || 0} ${esc(unit)}</span>
      </div>
      <div class="book-loading"><span></span>展卷中……</div>`;
    sheet.querySelector(".close").addEventListener("click", closeSheet);
    openOverlay();

    try {
      const book = await fetchBook(entry);
      if (!overlay.classList.contains("open")) return;
      const sourceUrl = /^https:\/\//.test(book.sourceUrl || "") ? book.sourceUrl : "#";
      sheet.innerHTML = `
        <button class="close" aria-label="關閉">×</button>
        <div class="s-meta"><span>${esc(entry.author)}</span><span>·</span><span>${esc(entry.season || "")}</span><span>·</span><span>${entry.book.novel ? "章回小說" : "文學經典"}</span></div>
        <div class="book-heading">
          <div><h2>${esc(book.title || entry.title)}</h2><p>${esc(entry.excerpt || "")}</p></div>
          <span class="book-total">${book.count || book.items.length} ${esc(unit)}</span>
        </div>
        <div class="book-reader">
          <aside class="book-toc-panel" aria-label="篇章目錄">
            <label class="book-search-label" for="bookSearch">冊內搜尋</label>
            <div class="book-search-wrap">
              <span aria-hidden="true">⌕</span>
              <input id="bookSearch" class="book-search" type="search" placeholder="題名、作者或正文" autocomplete="off">
            </div>
            <div class="book-result-count" id="bookResultCount"></div>
            <div class="book-toc-list" id="bookToc"></div>
          </aside>
          <article class="book-page" id="bookPage" aria-live="polite"></article>
        </div>
        <div class="book-source">
          <p>${esc(book.note || "")}</p>
          <a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">查看底本：${esc(book.sourceLabel || "原文來源")}</a>
        </div>`;
      sheet.querySelector(".close").addEventListener("click", closeSheet);

      const search = sheet.querySelector("#bookSearch");
      const toc = sheet.querySelector("#bookToc");
      const count = sheet.querySelector("#bookResultCount");
      const page = sheet.querySelector("#bookPage");
      const items = Array.isArray(book.items) ? book.items : [];
      let currentIndex = 0;
      let visibleIndexes = items.map((_, index) => index);

      function renderPage(index, shouldScroll) {
        const item = items[index];
        if (!item) return;
        currentIndex = index;
        const lines = (item.lines || []).map(line => `<p>${esc(line)}</p>`).join("") || `<p>此篇正文暫缺</p>`;
        const pos = visibleIndexes.indexOf(index);
        page.innerHTML = `
          <div class="book-page-body">
            <div class="book-page-meta">${esc(item.section || entry.season || "文學經典")} · 第 ${index + 1}／${items.length} ${esc(unit)}</div>
            <h3>${esc(item.title || "無題")}</h3>
            <div class="book-page-author">${esc(item.author || "佚名")}</div>
            <div class="book-text${["wc-daodejing", "wc-hanfu300", "wc-lunyu", "wc-mengzi", "wc-zhuangzi", "wc-guwenguanzhi", "wc-wenxuan"].includes(entry.id) || entry.book.novel || entry.book.prose ? " book-prose" : ""}">${lines}</div>
          </div>
          <nav class="book-page-nav" aria-label="篇章切換">
            <button type="button" data-book-nav="prev" ${pos <= 0 ? "disabled" : ""}>← 上一${esc(unit)}</button>
            <button type="button" data-book-nav="next" ${pos < 0 || pos >= visibleIndexes.length - 1 ? "disabled" : ""}>下一${esc(unit)} →</button>
          </nav>`;
        page.querySelectorAll("[data-book-nav]").forEach(button => {
          const goingPrev = button.dataset.bookNav === "prev";
          const atEdge = goingPrev ? pos <= 0 : pos < 0 || pos >= visibleIndexes.length - 1;
          if (atEdge) button.disabled = true;
          button.addEventListener("click", () => {
            const from = visibleIndexes.indexOf(currentIndex);
            const nextPos = goingPrev ? from - 1 : from + 1;
            if (nextPos < 0 || nextPos >= visibleIndexes.length) return;
            renderPage(visibleIndexes[nextPos], false);
            highlightCurrent();
            const bodyEl = page.querySelector(".book-page-body");
            if (bodyEl) bodyEl.scrollTop = 0;
          });
        });
        if (shouldScroll && window.innerWidth <= 720) page.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      function highlightCurrent() {
        let active = null;
        toc.querySelectorAll(".book-toc-item").forEach(button => {
          const on = Number(button.dataset.index) === currentIndex;
          button.classList.toggle("active", on);
          if (on) active = button;
        });
        if (active) active.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
      }

      function renderToc() {
        count.textContent = visibleIndexes.length === items.length ? `全書 ${items.length} ${unit}` : `尋得 ${visibleIndexes.length} ${unit}`;
        if (!visibleIndexes.length) {
          toc.innerHTML = `<div class="book-no-result">未覓得相符篇章</div>`;
          return;
        }
        toc.innerHTML = visibleIndexes.map(index => {
          const item = items[index];
          return `<button type="button" class="book-toc-item" data-index="${index}">
            <span class="book-toc-no">${String(index + 1).padStart(3, "0")}</span>
            <span class="book-toc-copy"><strong>${esc(item.title || "無題")}</strong><small>${esc(item.author || item.section || "佚名")}</small></span>
          </button>`;
        }).join("");
        toc.querySelectorAll(".book-toc-item").forEach(button => {
          button.addEventListener("click", () => {
            renderPage(Number(button.dataset.index), true);
            highlightCurrent();
          });
        });
        highlightCurrent();
      }

      search.addEventListener("input", () => {
        const query = search.value.trim().toLowerCase();
        visibleIndexes = items.map((_, index) => index).filter(index => {
          if (!query) return true;
          const item = items[index];
          return [item.title, item.author, item.section, (item.lines || []).join(" ")]
            .join(" ").toLowerCase().includes(query);
        });
        renderToc();
        if (visibleIndexes.includes(currentIndex)) renderPage(currentIndex, false);
      });

      renderToc();
      renderPage(0, false);
    } catch (error) {
      sheet.innerHTML = `
        <button class="close" aria-label="關閉">×</button>
        <div class="book-error"><strong>未能展卷</strong><p>${esc(error.message || error)}</p></div>`;
      sheet.querySelector(".close").addEventListener("click", closeSheet);
    }
  }

  function openWencui(id) {
    const e = state.wencui.find(x => x.id === id);
    if (!e || (e.private && !authorMode)) return;
    recordHit(id, v => { const el = document.getElementById("sViews"); if (el) el.textContent = "瀏覽 " + v + " 次"; });
    if (e.book) {
      openBook(e);
      return;
    }
    prepareSheet(false);
    sheet.innerHTML = `
      <button class="close" aria-label="關閉">×</button>
      <div class="s-meta"><span>${esc(e.author)}</span><span>·</span><span>${esc(e.season || "")}</span><span>·</span><span>文學經典</span></div>
      <h2>${esc(e.title)}</h2>
      <div class="s-views" id="sViews"></div>
      <div class="s-body">${renderBody(e.body)}</div>
      <div class="s-stamp">${esc(e.seal || "")}</div>
      ${commentSectionHTML("wencui:" + e.id)}`;
    sheet.querySelector(".close").addEventListener("click", closeSheet);
    openOverlay();
    wireComments(e.id);
  }

  function openZawen(id) {
    const e = state.zawen.find(x => x.id === id);
    if (!e || (e.private && !authorMode)) return;
    recordHit(id, v => { const el = document.getElementById("sViews"); if (el) el.textContent = "瀏覽 " + v + " 次"; });
    prepareSheet(false);
    sheet.innerHTML = `
      <button class="close" aria-label="關閉">×</button>
      <div class="s-meta"><span>${esc(e.author)}</span><span>·</span><span>${esc(e.season || "")}</span><span>·</span><span>雜文</span></div>
      <h2>${esc(e.title)}</h2>
      <div class="s-views" id="sViews"></div>
      <div class="s-body">${renderBody(e.body)}</div>
      <div class="s-stamp">${esc(e.seal || "")}</div>
      ${commentSectionHTML("zawen:" + e.id)}`;
    sheet.querySelector(".close").addEventListener("click", closeSheet);
    openOverlay();
    wireComments(e.id);
  }

  function openChuangzuo(id) {
    const e = state.chuangzuo.find(x => x.id === id);
    if (!e || (e.private && !authorMode)) return;
    recordHit(id, v => { const el = document.getElementById("sViews"); if (el) el.textContent = "瀏覽 " + v + " 次"; });
    prepareSheet(false);
    sheet.innerHTML = `
      <button class="close" aria-label="關閉">×</button>
      <div class="s-meta"><span>${esc(e.author)}</span><span>·</span><span>${esc(e.season || "")}</span><span>·</span><span>創作</span></div>
      <h2>${esc(e.title)}</h2>
      <div class="s-views" id="sViews"></div>
      <div class="s-body">${renderBody(e.body)}</div>
      <div class="s-stamp">${esc(e.seal || "")}</div>
      ${commentSectionHTML("chuangzuo:" + e.id)}`;
    sheet.querySelector(".close").addEventListener("click", closeSheet);
    openOverlay();
    wireComments(e.id);
  }

  /* ---------- 編輯表單 ---------- */
  function openForm(kind, item) {
    prepareSheet(false);
    const isProse = (kind === "essay" || kind === "wencui" || kind === "zawen");
    const v = item || {};
    const f = (name, label, val, ta) => `
      <div class="form-field">
        <label>${label}</label>
        ${ta
          ? `<textarea data-f="${name}" rows="${ta}">${esc(val)}</textarea>`
          : `<input data-f="${name}" value="${esc(val)}">`}
      </div>`;
    if (kind === "about") {
      const a = item || {};
      sheet.innerHTML = `
        <button class="close" aria-label="關閉">×</button>
        <h2 style="margin-bottom:1.4rem">修改·自述</h2>
        <form id="editForm">
          ${f("lead", "起首（一句）", a.lead, 2)}
          ${f("portrait", "肖像題字", a.portrait, 0)}
          ${f("paragraphs", "正文（每段一行）", (a.paragraphs || []).join("\n"), 8)}
          ${f("sig", "落款（可留空）", a.sig, 1)}
          ${imgField(a.images ? a.images.join("\n") : "")}
          <div class="btn-row">
            <button type="button" class="btn" data-cancel>取消</button>
            <button type="submit" class="btn primary">保存修改</button>
          </div>
        </form>`;
      sheet.querySelector(".close").addEventListener("click", closeSheet);
      sheet.querySelector("[data-cancel]").addEventListener("click", closeSheet);
      wireImageField('textarea[data-f="images"]');
      sheet.querySelector("#editForm").addEventListener("submit", ev => {
        ev.preventDefault();
        const g = n => sheet.querySelector(`[data-f="${n}"]`).value.trim();
        state.about = {
          lead: g("lead"),
          portrait: g("portrait"),
          paragraphs: g("paragraphs").split("\n").map(s => s.trim()).filter(Boolean),
          sig: g("sig"),
          images: parseImages()
        };
        closeSheet();
        renderAbout();
        save();
      });
      openOverlay();
      return;
    }

    const body = isProse ? `
      ${f("title", "篇名", v.title, 0)}
      ${f("author", "作者", v.author, 0)}
      ${f("season", "時令（如：仲夏）", v.season, 0)}
      ${f("seal", "印（二至四字）", v.seal, 0)}
      ${f("issue", "文路期數（如：12，留空不標）", v.issue != null ? v.issue : "", 0)}
      ${f("excerpt", "提要（一句）", v.excerpt, 2)}
      ${f("body", "正文（每段一行；欲配圖，於此貼圖片網址，或下方選圖會插到該行之後", (v.body || []).join("\n"), 10)}
      ${imgHelperHTML()}
      ${privField(v.private)}
    ` : `
      ${f("title", "題", v.title, 0)}
      ${f("author", "作者", v.author, 0)}
      ${f("form", "體式（如：七言絕句）", v.form, 0)}
      ${f("lines", "句（每句一行）", (v.lines || []).join("\n"), 8)}
      ${f("note", "注（可留空）", v.note, 3)}
      ${imgField((v.images || []).join("\n"))}
      ${privField(v.private)}
    `;
    sheet.innerHTML = `
      <button class="close" aria-label="關閉">×</button>
      <h2 style="margin-bottom:1.4rem">${item ? "修改" : "新增"}·${kind === "essay" ? "文集" : kind === "wencui" ? "文學經典" : kind === "zawen" ? "雜文" : kind === "chuangzuo" ? "創作" : "詩詞"}</h2>
      <form id="editForm">${body}
        <div class="btn-row">
          <button type="button" class="btn" data-cancel>取消</button>
          <button type="submit" class="btn primary">${item ? "保存修改" : "新增"}</button>
        </div>
      </form>`;
    sheet.querySelector(".close").addEventListener("click", closeSheet);
    sheet.querySelector("[data-cancel]").addEventListener("click", closeSheet);
    wireImageField(isProse ? 'textarea[data-f="body"]' : 'textarea[data-f="images"]');
    sheet.querySelector("#editForm").addEventListener("submit", ev => {
      ev.preventDefault();
      const g = n => sheet.querySelector(`[data-f="${n}"]`).value.trim();
      const arr = kind === "zawen" ? "zawen" : (kind === "wencui" ? "wencui" : (kind === "chuangzuo" ? "chuangzuo" : (kind === "essay" ? "essays" : "poems")));
      let obj;
      if (isProse) {
        obj = {
          id: v.id || ((kind === "wencui" ? "w" : kind === "zawen" ? "z" : kind === "chuangzuo" ? "c" : "e") + Date.now()),
          title: g("title"), author: g("author"), season: g("season"), seal: g("seal"),
          issue: (g("issue") ? Number(g("issue")) : null),
          excerpt: g("excerpt"),
          body: g("body").split("\n").map(s => s.trim()).filter(Boolean),
          private: !!(sheet.querySelector("#f_private") && sheet.querySelector("#f_private").checked)
        };
      } else {
        obj = {
          id: v.id || ("p" + Date.now()),
          title: g("title"), author: g("author"), form: g("form"),
          lines: g("lines").split("\n").map(s => s.trim()).filter(Boolean),
          note: g("note"),
          images: parseImages(),
          private: !!(sheet.querySelector("#f_private") && sheet.querySelector("#f_private").checked)
        };
      }
      if (!obj.title) { toast("篇名/題不能為空", true); return; }
      const idx = state[arr].findIndex(x => x.id === obj.id);
      if (idx >= 0) state[arr][idx] = obj; else state[arr].unshift(obj);
      closeSheet();
      renderAll();
      save();
    });
    openOverlay();
  }

  function removeItem(kind, id) {
    const arr = kind === "zawen" ? "zawen" : (kind === "wencui" ? "wencui" : (kind === "chuangzuo" ? "chuangzuo" : (kind === "essay" ? "essays" : "poems")));
    const item = state[arr].find(x => x.id === id);
    if (!item) return;
    if (!confirm(`確定刪除《${item.title}》？`)) return;
    state[arr] = state[arr].filter(x => x.id !== id);
    renderAll();
    save();
  }

  /* ---------- 保存 ---------- */
  async function save() {
    try {
      const r = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ essays: state.essays, poems: state.poems, wencui: state.wencui, zawen: state.zawen, chuangzuo: state.chuangzuo, motto: state.motto || {}, about: state.about || {} })
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "保存失敗");
      toast("已保存 ✓");
    } catch (e) {
      toast("保存失敗：" + (e.message || e) + "（本頁仍顯示變更）", true);
    }
  }

  /* ---------- 作者後台：登入 / 私人模式 ---------- */
  function applyAuthorMode() {
    document.body.classList.toggle("author", authorMode);
    document.body.classList.toggle("editing", authorMode && editing);
    buildAuthorBar();
    renderAll();
  }
  function doLogin() {
    const pw = prompt("請輸入作者密碼：");
    if (pw === null) return;
    if (pw === AUTH_PASS) {
      authorMode = true;
      editing = false;
      sessionStorage.setItem("lc_author", "1");
      toast("已登入作者後台 ✓");
      applyAuthorMode();
    } else {
      toast("密碼錯誤", true);
    }
  }
  function doLogout() {
    authorMode = false; editing = false;
    sessionStorage.removeItem("lc_author");
    toast("已登出作者後台");
    applyAuthorMode();
  }
  function buildAuthorBar() {
    const old = document.getElementById("authorBar");
    if (old) old.remove();
    const bar = document.createElement("div");
    bar.id = "authorBar";
    bar.className = "author-bar";
    const staticDeploy = isStaticDeploy();
    if (!authorMode) {
      bar.innerHTML = `<button class="author-toggle" id="authorToggle">🔒 作者登入</button>`;
      document.body.appendChild(bar);
      document.getElementById("authorToggle").addEventListener("click", doLogin);
    } else {
      /* 靜態部署無後端，隱藏「編輯/新增」（無法存檔）；僅保留登入檢視與私密文章可見 */
      const editBtn = staticDeploy ? "" : `<button class="edit-toggle" id="editToggle">✎ 編輯</button>`;
      bar.innerHTML = `
        <button class="author-toggle logout" id="authorLogout">作者登出</button>
        ${editBtn}`;
      document.body.appendChild(bar);
      document.getElementById("authorLogout").addEventListener("click", doLogout);
      if (!staticDeploy) {
        const b = document.getElementById("editToggle");
        b.textContent = editing ? "✓ 完成" : "✎ 編輯";
        b.classList.toggle("on", editing);
        b.addEventListener("click", () => {
          editing = !editing;
          document.body.classList.toggle("editing", editing);
          b.textContent = editing ? "✓ 完成" : "✎ 編輯";
          b.classList.toggle("on", editing);
          if (editing) toast("編輯模式：點卡片右上角可改/刪，方格可新增");
        });
      }
    }
    const aEdit = document.getElementById("aboutEdit");
    if (aEdit && !isStaticDeploy()) aEdit.addEventListener("click", () => openForm("about", state.about || {}));
  }

  /* ---------- 提示 ---------- */
  function toast(msg, bad) {
    let t = document.getElementById("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast"; t.className = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.toggle("bad", !!bad);
    t.classList.add("show");
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove("show"), 2600);
  }

  /* ---------- 遊玩區索引（全站搜尋用，延後載入） ---------- */
  let YOUWAN_ITEMS = [];
  fetch("js/sanguo-generals.json").then(r => r.ok ? r.json() : { items: [] }).then(d => {
    YOUWAN_ITEMS = d.items || [];
  }).catch(() => {});

  const WENYAN_ITEMS = [
    {id:"zuiwengtingji", title:"醉翁亭記", author:"歐陽修", tag:"記"},
    {id:"shishuo", title:"師說", author:"韓愈", tag:"說"},
    {id:"afanggongfu", title:"阿房宮賦", author:"杜牧", tag:"賦"},
    {id:"chibifu", title:"赤壁賦", author:"蘇軾", tag:"賦"},
    {id:"taohuayuanji", title:"桃花源記", author:"陶淵明", tag:"記"},
    {id:"yueyanglouji", title:"岳陽樓記", author:"范仲淹", tag:"記"},
    {id:"loushiming", title:"陋室銘", author:"劉禹錫", tag:"銘"},
    {id:"chushibiao", title:"出師表", author:"諸葛亮", tag:"表"},
    {id:"guoqinlun", title:"過秦論", author:"賈誼", tag:"論"},
    {id:"caoguilunzhan", title:"曹劌論戰", author:"左丘明", tag:"記"},
    {id:"zoujifengqiwang", title:"鄒忌諷齊王納諫", author:"戰國策", tag:"記"},
    {id:"tangju", title:"唐雎不辱使命", author:"戰國策", tag:"記"},
    {id:"zhengboke", title:"鄭伯克段於鄢", author:"左丘明", tag:"記"},
    {id:"pengdanglun", title:"朋黨論", author:"歐陽修", tag:"論"},
    {id:"jianzhukeshu", title:"諫逐客書", author:"李斯", tag:"書"},
    {id:"ziyu", title:"子魚論戰", author:"左丘明", tag:"記"},
    {id:"bushezheshuo", title:"捕蛇者說", author:"柳宗元", tag:"說"},
    {id:"tengwanggexu", title:"滕王閣序", author:"王勃", tag:"序"},
    {id:"zhuzhiwu", title:"燭之武退秦師", author:"左丘明", tag:"記"},
    {id:"liuguolun", title:"六國論", author:"蘇洵", tag:"論"},
    {id:"wuliuxiansheng", title:"五柳先生傳", author:"陶淵明", tag:"傳"},
    {id:"lantingjixu", title:"蘭亭集序", author:"王羲之", tag:"序"},
    {id:"youbaochanshanji", title:"遊褒禪山記", author:"王安石", tag:"記"},
    {id:"chenqingbiao", title:"陳情表", author:"李密", tag:"表"},
    {id:"baorenanshu", title:"報任安書", author:"司馬遷", tag:"書"},
    {id:"yuxishixu", title:"愚溪詩序", author:"柳宗元", tag:"序"},
    {id:"canglangtingji", title:"滄浪亭記", author:"蘇舜欽", tag:"記"},
    {id:"zunjinggeji", title:"尊經閣記", author:"王守仁", tag:"記"}
  ];

  /* ---------- 全站搜尋 ---------- */
  function wireSearch() {
    const btn = document.getElementById("navSearch");
    const ov  = document.getElementById("searchOverlay");
    if (!btn || !ov) return;
    const input   = document.getElementById("searchInput");
    const results = document.getElementById("searchResults");
    const meta    = document.getElementById("searchMeta");
    const closeBtn = document.getElementById("searchClose");

    function openSearch() {
      ov.classList.add("open");
      input.value = "";
      meta.textContent = "";
      results.innerHTML = `<div class="search-empty">輸入關鍵字，於文集、詩詞、文學經典、文言文精讀教學、遊玩區間遍搜。</div>`;
      setTimeout(() => input.focus(), 30);
    }
    function closeSearch() { ov.classList.remove("open"); }

    btn.addEventListener("click", openSearch);
    if (closeBtn) closeBtn.addEventListener("click", closeSearch);
    ov.addEventListener("click", e => { if (e.target === ov) closeSearch(); });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && ov.classList.contains("open")) { e.stopPropagation(); closeSearch(); }
    });

    function snippet(text, q) {
      text = (text || "").replace(/\s+/g, " ");
      const i = text.toLowerCase().indexOf(q.toLowerCase());
      if (i < 0) return text.slice(0, 46);
      const s = Math.max(0, i - 16);
      const e = Math.min(text.length, i + q.length + 28);
      return (s > 0 ? "…" : "") + text.slice(s, e) + (e < text.length ? "…" : "");
    }

    function run() {
      const q = input.value.trim();
      if (!q) {
        meta.textContent = "";
        results.innerHTML = `<div class="search-empty">輸入關鍵字，於文集、詩詞、文學經典、雜文、文言文精讀教學、遊玩區間遍搜。</div>`;
        return;
      }
      const ql = q.toLowerCase();
      const out = [];
      (state.essays || []).forEach(x => {
        if (x.private && !authorMode) return;
        if ([x.title, x.excerpt, x.author, x.season, x.seal, (x.body || []).join(" ")].join(" ").toLowerCase().includes(ql))
          out.push({ kind: "essay",  id: x.id, title: x.title, text: (x.body || []).join(" "), tag: x.season || "散文" });
      });
      (state.poems || []).forEach(x => {
        if (x.private && !authorMode) return;
        if ([x.title, x.author, (x.lines || []).join(" "), x.note, x.form].join(" ").toLowerCase().includes(ql))
          out.push({ kind: "poem",   id: x.id, title: x.title, text: (x.lines || []).join(" "), tag: x.form || "詩" });
      });
      (state.wencui || []).forEach(x => {
        if (x.private && !authorMode) return;
        if ([x.title, x.excerpt, x.author, x.season, x.seal, (x.body || []).join(" ")].join(" ").toLowerCase().includes(ql))
          out.push({ kind: "wencui", id: x.id, title: x.title, text: (x.body || []).join(" "), tag: x.season || "文學經典" });
      });
      (state.zawen || []).forEach(x => {
        if (x.private && !authorMode) return;
        if ([x.title, x.excerpt, x.author, x.season, x.seal, (x.body || []).join(" ")].join(" ").toLowerCase().includes(ql))
          out.push({ kind: "zawen", id: x.id, title: x.title, text: (x.body || []).join(" "), tag: x.season || "雜文" });
      });
      (state.chuangzuo || []).forEach(x => {
        if (x.private && !authorMode) return;
        if ([x.title, x.excerpt, x.author, x.season, x.seal, (x.body || []).join(" ")].join(" ").toLowerCase().includes(ql))
          out.push({ kind: "chuangzuo", id: x.id, title: x.title, text: (x.body || []).join(" "), tag: x.season || "創作" });
      });
      (WENYAN_ITEMS || []).forEach(x => {
        const text = [x.title, x.author, x.tag].join(" ");
        if (text.toLowerCase().includes(ql) || text.includes(q))
          out.push({ kind: "wenyan", id: x.id, title: x.title, text: x.author + " · " + x.title, tag: "文言文精讀教學 · " + x.tag });
      });
      (YOUWAN_ITEMS || []).forEach(x => {
        const text = [x.name, x.class, x.faction, x.camp, x.origin, x.weapon, x.wskill, x.wdesc, x.extra, x.extraDesc, x.bio,
          ...(x.skills || []), ...(x.descs || []), ...(x.alias || [])].filter(Boolean).join(" ");
        if (text.toLowerCase().includes(ql))
          out.push({ kind: "youwan", id: x.id, title: x.name, text: text, tag: (x.faction || "遊玩") + (x.class ? " · " + x.class : "") });
      });

      meta.textContent = out.length ? `得 ${out.length} 條` : "無相符者";
      if (!out.length) {
        results.innerHTML = `<div class="search-empty">未覓得「${esc(q)}」，換一字試試。</div>`;
        return;
      }
      results.innerHTML = out.map(r => {
        const label = r.kind === "essay" ? "文集" : r.kind === "poem" ? "詩詞" : r.kind === "wencui" ? "文學經典" : r.kind === "chuangzuo" ? "創作" : r.kind === "youwan" ? "遊玩" : r.kind === "wenyan" ? "文言文精讀教學" : "雜文";
        return `<button class="search-result" data-kind="${r.kind}" data-id="${esc(r.id)}">
          <span class="sr-kind">${label}</span>
          <span class="sr-title">${esc(r.title)}</span>
          <span class="sr-snip">${esc(snippet(r.text, q))}</span>
          <span class="sr-tag">${esc(r.tag)}</span>
        </button>`;
      }).join("");
      results.querySelectorAll(".search-result").forEach(b => {
        b.addEventListener("click", () => {
          const kind = b.dataset.kind, id = b.dataset.id;
          closeSearch();
          if (kind === "essay") openEssay(id);
          else if (kind === "poem") openPoem(id);
          else if (kind === "zawen") openZawen(id);
          else if (kind === "chuangzuo") openChuangzuo(id);
          else if (kind === "wenyan") {
            location.href = "wenyan.html#read/" + id;
          }
          else if (kind === "youwan") {
            const here = location.pathname.split("/").pop() || "index.html";
            if (here === "youwan.html") location.hash = id;
            else location.href = "youwan.html#" + id;
          }
          else openWencui(id);
        });
      });
    }

    input.addEventListener("input", run);
  }

  /* ---------- 啟動 ---------- */
  document.body.classList.toggle("author", authorMode);
  buildAuthorBar();
  wireSearch();
  load();
  // 記錄一次全站瀏覽（頁面開啟即算一次），並刷新統計條
  recordHit(null, (v, d) => { SITE_HIT = { total: d.total, visitors: d.visitors }; renderSiteStats(); });
});
