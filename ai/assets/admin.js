/* Training Creator — admin editor for content/trainings.json.
   Signs in with a GitHub fine-grained token (Contents: read & write on this repo only),
   edits courses, lessons, and content blocks, uploads images, and publishes by committing to the repo. */
(function () {
  "use strict";
  var C = window.RS_CONFIG || {};
  var A = C.admin || {};
  var R = window.RS.render;
  var esc = R.esc;
  var API = "https://api.github.com";
  var TOKEN_KEY = "rs-admin-token";
  var DRAFT_KEY = "rs-admin-draft";

  var S = {
    mode: null,          // "github" | "local"
    token: null, user: null,
    data: null, sha: null, published: null,
    dirty: false,
    sel: { c: 0, view: "course", l: 0 },
    openCourses: {},
    preview: true, phone: false,
    pending: {},         // image path -> data URL (shown until the site republishes)
    collapsed: new WeakSet(),
    insertAt: null
  };

  var app = document.getElementById("app");
  function $(s, r) { return (r || document).querySelector(s); }

  // ---------------------------------------------------------------- utilities
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function slug(s) { return String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "course"; }
  function uid(p) { return (p || "x") + Math.random().toString(36).slice(2, 8); }
  function getPath(obj, path) {
    if (!path) return obj;
    return path.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }
  function setPath(obj, path, val) {
    var ks = path.split("."), o = obj;
    for (var i = 0; i < ks.length - 1; i++) {
      if (o[ks[i]] == null) o[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {};
      o = o[ks[i]];
    }
    o[ks[ks.length - 1]] = val;
  }
  function b64enc(str) {
    var bytes = new TextEncoder().encode(str), bin = "";
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64dec(b64) {
    var bin = atob(b64.replace(/\s/g, "")), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function toast(msg, err) {
    var t = $("#toast");
    t.textContent = msg; t.className = "adm-toast" + (err ? " err" : ""); t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, err ? 6000 : 3200);
  }
  function modal(html, onReady) {
    var m = $("#modal"); $("#modal-body").innerHTML = html; m.hidden = false;
    var first = $("#modal-body input, #modal-body textarea, #modal-body button");
    if (first) first.focus();
    if (onReady) onReady($("#modal-body"));
  }
  function closeModal() { $("#modal").hidden = true; $("#modal-body").innerHTML = ""; }
  $("#modal").addEventListener("click", function (e) {
    if (e.target.id === "modal" || e.target.closest("[data-close]")) closeModal();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); });
  function confirmBox(title, text, okLabel, onOk) {
    modal('<h2>' + esc(title) + '</h2><p>' + text + '</p><div class="btn-row"><button class="btn" data-close>Cancel</button><button class="btn btn-red" id="ok">' + esc(okLabel) + "</button></div>",
      function (b) { $("#ok", b).addEventListener("click", function () { closeModal(); onOk(); }); });
  }

  // ---------------------------------------------------------------- GitHub
  function gh(path, opts) {
    opts = opts || {};
    var headers = { Authorization: "Bearer " + S.token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (opts.body) headers["Content-Type"] = "application/json";
    return fetch(API + path, { method: opts.method || "GET", headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: "no-store" })
      .then(function (r) {
        if (r.ok) return r.status === 204 ? null : r.json();
        return r.json().catch(function () { return {}; }).then(function (j) {
          var e = new Error(j.message || r.statusText); e.status = r.status; throw e;
        });
      });
  }
  function repoPath(p) { return "/repos/" + A.owner + "/" + A.repo + p; }
  function contentsUrl(path) { return repoPath("/contents/" + path.split("/").map(encodeURIComponent).join("/")); }
  function fetchContent() {
    return gh(contentsUrl(A.contentPath) + "?ref=" + encodeURIComponent(A.branch) + "&t=" + Date.now())
      .then(function (f) { return { data: JSON.parse(b64dec(f.content)), sha: f.sha }; });
  }

  // ---------------------------------------------------------------- data helpers
  function courses() { return S.data.courses; }
  function cur() { return courses()[S.sel.c]; }
  function curLesson() { var c = cur(); return c && c.lessons[S.sel.l]; }
  function markDirty() {
    S.dirty = true; renderStatus(); saveDraftSoon(); refreshPreviewSoon();
  }
  var saveDraftSoon = debounce(function () {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ baseSha: S.sha, savedAt: Date.now(), data: S.data })); } catch (e) {}
  }, 600);
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }
  window.addEventListener("beforeunload", function (e) { if (S.dirty) { e.preventDefault(); e.returnValue = ""; } });

  function resolveSrc(src) {
    if (!src) return src;
    if (S.pending[src]) return S.pending[src];
    if (/^(https?:|data:|blob:)/i.test(src)) return src;
    if (S.mode === "github") return "https://raw.githubusercontent.com/" + A.owner + "/" + A.repo + "/" + A.branch + "/ai/" + src.replace(/^\.?\//, "");
    return src;
  }

  // ---------------------------------------------------------------- block catalog
  function newCard() { return { label: "", title: "", text: "", boxed: true }; }
  var TYPES = {
    text:     { name: "Paragraph",     ic: "¶",  desc: "Regular text. Bold, italic, and links allowed.", make: function () { return { type: "text", html: "" }; } },
    heading:  { name: "Subheading",    ic: "H",  desc: "A small heading inside the lesson.",          make: function () { return { type: "heading", text: "" }; } },
    list:     { name: "Bullet list",   ic: "•",  desc: "Bulleted or numbered points.",                 make: function () { return { type: "list", style: "bullet", items: [] }; } },
    cards:    { name: "Card grid",     ic: "▦",  desc: "2–4 columns of cards with titles and text.",   make: function () { return { type: "cards", columns: 3, cards: [newCard(), newCard(), newCard()] }; } },
    callout:  { name: "Callout",       ic: "!",  desc: "Highlighted tip, warning, or example.",        make: function () { return { type: "callout", tone: "", html: "" }; } },
    quote:    { name: "Key message",   ic: "❝",  desc: "Dark banner for the main takeaway.",           make: function () { return { type: "quote", html: "" }; } },
    table:    { name: "Table",         ic: "⊞",  desc: "Rows and columns, with colored status labels.", make: function () { return { type: "table", headers: ["Column 1", "Column 2"], rows: [["", ""]] }; } },
    image:    { name: "Image",         ic: "▣",  desc: "Upload a picture or screenshot.",              make: function () { return { type: "image", src: "", alt: "", caption: "", size: "full" }; } },
    video:    { name: "Video",         ic: "▶",  desc: "Loom, YouTube, Vimeo, Stream, or MP4 link.",   make: function () { return { type: "video", url: "", caption: "" }; } },
    levels:   { name: "Data levels",   ic: "◐",  desc: "Red / Yellow / Green side by side.",           make: function () { return { type: "levels", red: { title: "Red", rule: "", items: [] }, yellow: { title: "Yellow", rule: "", items: [] }, green: { title: "Green", rule: "", items: [] } }; } },
    practice: { name: "Practice check", ic: "✓", desc: "Learners sort items into Red, Yellow, or Green.", make: function () { return { type: "practice", items: [{ text: "", answer: "yellow", why: "" }] }; } },
    button:   { name: "Button link",   ic: "→",  desc: "Link to a page, form, file, or site.",         make: function () { return { type: "button", label: "Open", href: "", style: "primary" }; } },
    disclose: { name: "Report buttons", ic: "⚑", desc: "The standard “Disclose an unapproved tool” buttons.", make: function () { return { type: "disclose" }; } },
    divider:  { name: "Divider",       ic: "—",  desc: "A horizontal line between sections.",          make: function () { return { type: "divider" }; } },
    columns:  { name: "Two columns",   ic: "▥",  desc: "Side-by-side columns, each with its own blocks.", make: function () { return { type: "columns", columns: [{ blocks: [{ type: "text", html: "" }] }, { blocks: [{ type: "text", html: "" }] }] }; } },
    html:     { name: "Custom HTML",   ic: "</>", desc: "Advanced: paste raw HTML.",                   make: function () { return { type: "html", html: "" }; } }
  };
  function plain(s) { return String(s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(); }
  function summary(b) {
    var s = "";
    switch (b.type) {
      case "text": case "callout": case "quote": s = plain(b.html); break;
      case "heading": s = plain(b.text); break;
      case "list": s = (b.items || []).length + " items"; break;
      case "cards": s = (b.cards || []).length + " cards · " + (b.columns || 2) + " columns"; break;
      case "table": s = (b.rows || []).length + " rows"; break;
      case "practice": s = (b.items || []).length + " items"; break;
      case "image": s = b.alt || (b.src ? "image" : "no image yet"); break;
      case "video": s = b.url || "no link yet"; break;
      case "button": s = b.label; break;
      case "columns": s = (b.columns || []).length + " columns"; break;
    }
    return s.length > 60 ? s.slice(0, 60) + "…" : s;
  }

  // ---------------------------------------------------------------- field builders
  function v(path) { var x = getPath(cur(), path); return x == null ? "" : x; }
  function fText(label, path, o) {
    o = o || {};
    return '<div class="field"><label>' + label + '</label><input type="' + (o.type || "text") + '" data-b="' + path + '"' + (o.kind ? ' data-k="' + o.kind + '"' : "") +
      ' value="' + esc(v(path)) + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : "") + (o.ro ? " readonly" : "") + ">" +
      (o.hint ? '<div class="hint">' + o.hint + "</div>" : "") + "</div>";
  }
  function fArea(label, path, o) {
    o = o || {};
    var val = o.lines ? (v(path) || []).join("\n") : v(path);
    return '<div class="field">' + (label ? "<label>" + label + "</label>" : "") +
      (o.rich ? '<div class="rt-bar"><button type="button" data-rt="b" title="Bold"><b>B</b></button><button type="button" data-rt="i" title="Italic"><i>I</i></button><button type="button" data-rt="a" title="Link">Link</button></div>' : "") +
      '<textarea data-b="' + path + '"' + (o.lines ? ' data-k="lines"' : "") + ' class="' + (o.tall ? "tall " : "") + (o.code ? "code" : "") + '"' +
      (o.ph ? ' placeholder="' + esc(o.ph) + '"' : "") + ">" + esc(val) + "</textarea>" +
      (o.hint || o.rich ? '<div class="hint">' + (o.hint || RICH_HINT) + "</div>" : "") + "</div>";
  }
  function fSelect(label, path, opts, o) {
    o = o || {};
    var cv = String(v(path));
    return '<div class="field"><label>' + label + '</label><select data-b="' + path + '"' + (o.kind ? ' data-k="' + o.kind + '"' : "") + ">" +
      opts.map(function (p) { return '<option value="' + esc(p[0]) + '"' + (String(p[0]) === cv ? " selected" : "") + ">" + esc(p[1]) + "</option>"; }).join("") +
      "</select>" + (o.hint ? '<div class="hint">' + o.hint + "</div>" : "") + "</div>";
  }
  function fCheck(label, path) {
    return '<div class="field"><label class="check-row"><input type="checkbox" data-b="' + path + '" data-k="bool"' + (v(path) ? " checked" : "") + "> " + label + "</label></div>";
  }
  function fSeg(label, path, opts) {
    var cv = v(path);
    return '<div class="field"><span class="flabel">' + label + '</span><div class="seg">' +
      opts.map(function (p) { return '<button type="button" data-act="set" data-b="' + path + '" data-v="' + esc(p[0]) + '"' + (cv === p[0] ? ' class="on"' : "") + ">" + esc(p[1]) + "</button>"; }).join("") +
      "</div>" + (opts.hint ? '<div class="hint">' + opts.hint + "</div>" : "") + "</div>";
  }
  function fImage(label, path, altPath) {
    var src = v(path);
    return '<div class="field"><label>' + label + '</label><div class="img-field"><div class="img-thumb"' +
      (src ? ' style="background-image:url(&quot;' + esc(resolveSrc(src)) + '&quot;)"' : "") + ">" + (src ? "" : "No image") + "</div><div>" +
      '<div class="btn-row" style="margin:0 0 6px"><button type="button" class="btn btn-sm" data-act="img-pick" data-b="' + path + '">' + (src ? "Replace image" : "Upload image") + "</button>" +
      (src ? '<button type="button" class="btn btn-sm" data-act="set" data-b="' + path + '" data-v="">Remove</button>' : "") + "</div>" +
      '<div class="hint">PNG, JPG, GIF, or SVG. Large photos are resized automatically.</div></div></div></div>' +
      (altPath ? fText("Alt text (describe the image for screen readers)", altPath, { ph: "e.g. Copilot button in the Outlook ribbon" }) : "");
  }
  function subHead(title, listPath, k, n) {
    return '<div class="sub-head"><span>' + title + '</span><span class="tools">' +
      '<button type="button" class="icon-btn" title="Move up" data-act="sub-move" data-b="' + listPath + '" data-i="' + k + '" data-d="-1"' + (k === 0 ? " disabled" : "") + ">↑</button>" +
      '<button type="button" class="icon-btn" title="Move down" data-act="sub-move" data-b="' + listPath + '" data-i="' + k + '" data-d="1"' + (k === n - 1 ? " disabled" : "") + ">↓</button>" +
      '<button type="button" class="icon-btn danger" title="Remove" data-act="sub-del" data-b="' + listPath + '" data-i="' + k + '">✕</button></span></div>';
  }

  // ---------------------------------------------------------------- block editors
  var RICH_HINT = "Select text and click B, I, or Link — or type **bold**, *italic*, [link text](https://…).";
  function blockFields(b, p) {
    switch (b.type) {
      case "text":
        return fArea("", p + ".html", { rich: true, ph: "Type the paragraph…" }) + fCheck("Show as smaller, gray text", p + ".muted");
      case "heading":
        return fText("Subheading text", p + ".text");
      case "list":
        return '<div class="row c2" style="grid-template-columns:200px 1fr">' + fSelect("List style", p + ".style", [["bullet", "Bullets"], ["number", "Numbered"]]) + "<div></div></div>" +
          fArea("Items — one per line", p + ".items", { lines: true, tall: true, ph: "First point\nSecond point", hint: "Each line becomes one bullet. **bold**, *italic*, and [links](https://…) work here too." });
      case "cards":
        var cards = b.cards || [];
        return '<div class="row c2" style="grid-template-columns:200px 1fr">' + fSelect("Columns", p + ".columns", [[2, "2 columns"], [3, "3 columns"], [4, "4 columns"]], { kind: "int" }) + "<div></div></div>" +
          cards.map(function (c, k) {
            var cp = p + ".cards." + k;
            return '<div class="sub">' + subHead("Card " + (k + 1), p + ".cards", k, cards.length) +
              '<div class="row c2">' + fText("Small label (optional)", cp + ".label", { ph: "e.g. Inside sales" }) + fText("Title", cp + ".title") + "</div>" +
              fArea("Text", cp + ".text", { rich: true }) +
              '<div class="row c2">' + fCheck("Show as a bordered card", cp + ".boxed") + "<div></div></div>" +
              fImage("Card image (optional)", cp + ".image", c.image ? cp + ".alt" : null) + "</div>";
          }).join("") + '<button type="button" class="mini-add" data-act="sub-add" data-b="' + p + '.cards" data-t="card">+ Add card</button>';
      case "callout":
        return fSelect("Style", p + ".tone", [["", "Highlight (red)"], ["info", "Information (blue)"], ["success", "Good practice (green)"]]) +
          fArea("Text", p + ".html", { rich: true, hint: "Tip: start with a bold phrase, e.g. **Remember:** …" });
      case "quote":
        return fArea("Key message", p + ".html", { rich: true, hint: "Use **bold** for emphasis. Wrap words in <span>…</span> to color them." });
      case "table":
        var hs = b.headers || [], rows = b.rows || [];
        return '<div class="tbl-ed"><table><thead><tr>' + hs.map(function (h, j) {
            return '<th><input type="text" data-b="' + p + ".headers." + j + '" value="' + esc(h) + '"></th>';
          }).join("") + "<th></th></tr></thead><tbody>" + rows.map(function (r, i) {
            return "<tr>" + hs.map(function (_, j) {
              return '<td><input type="text" data-b="' + p + ".rows." + i + "." + j + '" value="' + esc(r[j] == null ? "" : r[j]) + '"></td>';
            }).join("") + '<td><button type="button" class="icon-btn danger" title="Delete row" data-act="tbl-delrow" data-b="' + p + '" data-i="' + i + '">✕</button></td></tr>';
          }).join("") + "<tr>" + hs.map(function (_, j) {
            return '<td style="text-align:center"><button type="button" class="icon-btn danger" title="Delete column" data-act="tbl-delcol" data-b="' + p + '" data-i="' + j + '">✕</button></td>';
          }).join("") + "<td></td></tr></tbody></table></div>" +
          '<div class="btn-row" style="margin:0 0 8px"><button type="button" class="mini-add" data-act="tbl-addrow" data-b="' + p + '">+ Add row</button><button type="button" class="mini-add" data-act="tbl-addcol" data-b="' + p + '">+ Add column</button></div>' +
          '<div class="hint" style="margin-bottom:12px">Colored labels: start a cell with <code>{ok}</code> green, <code>{warn}</code> yellow, <code>{no}</code> red, or <code>{dark}</code> black — e.g. <code>{ok}Approved</code>.</div>';
      case "image":
        return fImage("Image", p + ".src") + fText("Alt text (describe the image for screen readers)", p + ".alt") +
          '<div class="row c2">' + fText("Caption (optional)", p + ".caption") + fSelect("Width", p + ".size", [["full", "Full width"], ["medium", "Medium"], ["small", "Small"]]) + "</div>";
      case "video":
        return fText("Video link", p + ".url", { type: "url", ph: "https://www.loom.com/share/…", hint: "Paste a Loom, YouTube, or Vimeo share link, a Microsoft Stream/SharePoint embed link, or a direct .mp4 link. Make sure employees have permission to view it." }) +
          fText("Caption (optional)", p + ".caption");
      case "levels":
        return ["red", "yellow", "green"].map(function (k) {
          var lp = p + "." + k;
          return '<div class="sub"><div class="sub-head"><span style="color:var(--lvl-' + k + ')">' + k.toUpperCase() + "</span></div>" +
            '<div class="row c2">' + fText("Title", lp + ".title") + fText("Rule", lp + ".rule", { ph: "e.g. Never, in any AI tool" }) + "</div>" +
            fArea("Examples — one per line", lp + ".items", { lines: true }) + "</div>";
        }).join("");
      case "practice":
        var items = b.items || [];
        return items.map(function (it, k) {
          var ip = p + ".items." + k;
          return '<div class="sub">' + subHead("Item " + (k + 1), p + ".items", k, items.length) +
            fText("What the learner sees", ip + ".text", { ph: "e.g. A customer's order history from P21" }) +
            '<div class="row c2" style="grid-template-columns:180px 1fr">' + fSelect("Correct answer", ip + ".answer", [["red", "Red"], ["yellow", "Yellow"], ["green", "Green"]]) +
            fText("Why (shown after they answer)", ip + ".why") + "</div></div>";
        }).join("") + '<button type="button" class="mini-add" data-act="sub-add" data-b="' + p + '.items" data-t="practice">+ Add item</button>';
      case "button":
        return '<div class="row c2">' + fText("Button text", p + ".label") + fSelect("Style", p + ".style", [["primary", "Red (primary)"], ["secondary", "White (secondary)"]]) + "</div>" +
          fText("Link", p + ".href", { ph: "https://… or reference.html", hint: "Outside links open in a new tab." });
      case "disclose":
        return '<p class="muted" style="margin:0 0 12px">Shows the standard report buttons. They open the disclosure form (or email) set in the site settings.</p>';
      case "divider":
        return '<p class="muted" style="margin:0 0 12px">A horizontal line. Nothing to set.</p>';
      case "columns":
        var cols = b.columns || [];
        return cols.map(function (col, k) {
          var lp = p + ".columns." + k + ".blocks", bl = col.blocks || (col.blocks = []);
          return '<div class="sub">' + subHead("Column " + (k + 1), p + ".columns", k, cols.length) +
            bl.map(function (x, m) { return blockEditor(x, lp, m, bl.length, true); }).join("") +
            '<button type="button" class="mini-add" data-act="add-block" data-list="' + lp + '" data-at="' + bl.length + '" data-nested="1">+ Add block to column ' + (k + 1) + "</button></div>";
        }).join("") + (cols.length < 3 ? '<button type="button" class="mini-add" data-act="sub-add" data-b="' + p + '.columns" data-t="column">+ Add column</button>' : "");
      case "html":
        return fArea("HTML", p + ".html", { code: true, tall: true, hint: "Advanced. Use the site's classes (card, callout, grid grid-2…). Scripts are not supported." });
    }
    return "";
  }

  function blockEditor(b, list, i, n, nested) {
    var t = TYPES[b.type] || { name: b.type, ic: "?" };
    var p = list + "." + i, L = ' data-list="' + list + '"';
    return '<div class="blk' + (nested ? " nested" : "") + (S.collapsed.has(b) ? " collapsed" : "") + '" data-i="' + i + '" data-path="' + p + '">' +
      '<div class="blk-head"><span class="ic">' + esc(t.ic) + '</span><span class="nm">' + esc(t.name) + '<span class="sum">' + esc(summary(b)) + "</span></span>" +
      '<button type="button" class="icon-btn" title="Move up" data-act="blk-move"' + L + ' data-i="' + i + '" data-d="-1"' + (i === 0 ? " disabled" : "") + ">↑</button>" +
      '<button type="button" class="icon-btn" title="Move down" data-act="blk-move"' + L + ' data-i="' + i + '" data-d="1"' + (i === n - 1 ? " disabled" : "") + ">↓</button>" +
      '<button type="button" class="icon-btn" title="Duplicate" data-act="blk-dup"' + L + ' data-i="' + i + '">⧉</button>' +
      '<button type="button" class="icon-btn danger" title="Delete block" data-act="blk-del"' + L + ' data-i="' + i + '">✕</button>' +
      '<button type="button" class="icon-btn" title="Collapse / expand" data-act="blk-toggle"' + L + ' data-i="' + i + '">' + (S.collapsed.has(b) ? "▸" : "▾") + "</button></div>" +
      '<div class="blk-body">' + blockFields(b, p) + "</div></div>" +
      (nested ? "" : '<div class="insert-here"><button type="button" data-act="add-block"' + L + ' data-at="' + (i + 1) + '">+ Insert block here</button></div>');
  }

  // ---------------------------------------------------------------- views
  function renderStatus() {
    var st = $("#status");
    if (!S.data) { st.innerHTML = ""; renderTop(); return; }
    st.innerHTML = '<span><span class="dot' + (S.dirty ? " dirty" : "") + '"></span> ' +
      (S.dirty ? "Unpublished changes <span class=\"muted\">(kept on this device until you publish)</span>" : (S.mode === "github" ? "All changes published" : "No unsaved changes")) + "</span>" +
      '<span class="muted">' + (S.mode === "github" ? "Signed in" + (S.user ? " as " + esc(S.user) : "") + " · " + esc(A.owner + "/" + A.repo) : "Practice mode · not connected to GitHub") + "</span>";
    renderTop();
  }
  function renderTop() {
    var t = $("#top-actions");
    if (!S.data) { t.innerHTML = '<a class="btn btn-sm" href="index.html">Back to site</a>'; return; }
    t.innerHTML =
      '<button class="btn btn-sm" data-act="toggle-preview">' + (S.preview ? "Hide preview" : "Show preview") + "</button>" +
      '<button class="btn btn-sm" data-act="more">More ▾</button>' +
      (S.mode === "github"
        ? '<button class="btn btn-sm btn-red" data-act="publish"' + (S.dirty ? "" : " disabled") + ">Publish changes</button>"
        : '<button class="btn btn-sm btn-red" data-act="export">Download content file</button>');
  }

  function renderSide() {
    var list = courses();
    function item(c, i) {
      var open = S.openCourses[c.id] || S.sel.c === i;
      var h = '<div class="adm-course' + (open ? " open" : "") + '"><button type="button" data-act="sel-course" data-c="' + i + '"><span class="caret">' + (open ? "▾" : "▸") + '</span><span class="t">' +
        esc(c.title || "Untitled course") + "<br>" +
        '<span class="badge ' + (c.status === "draft" ? "draft" : "live") + '">' + (c.status === "draft" ? "Draft" : "Published") + "</span> " +
        (c.type === "tool" ? '<span class="badge tool">Tool</span>' : '<span class="badge">Core</span>') + "</span></button>";
      if (open) {
        h += '<ul class="adm-tree"><li class="' + (S.sel.c === i && S.sel.view === "course" ? "sel" : "") + '"><button type="button" data-act="sel-course" data-c="' + i + '"><span class="n">⚙</span>Course settings</button></li>' +
          c.lessons.map(function (l, j) {
            return '<li class="' + (S.sel.c === i && S.sel.view === "lesson" && S.sel.l === j ? "sel" : "") + '"><button type="button" data-act="sel-lesson" data-c="' + i + '" data-l="' + j + '"><span class="n">' + (j + 1) + "</span>" + esc(l.title || "Untitled lesson") + "</button></li>";
          }).join("") +
          '<li class="' + (S.sel.c === i && S.sel.view === "quiz" ? "sel" : "") + '"><button type="button" data-act="sel-quiz" data-c="' + i + '"><span class="n">?</span>Quiz</button></li>' +
          '<li class="add"><button type="button" data-act="add-lesson" data-c="' + i + '"><span class="n">+</span>Add lesson</button></li></ul>';
      }
      return h + "</div>";
    }
    var core = [], tool = [];
    list.forEach(function (c, i) { (c.type === "tool" ? tool : core).push(item(c, i)); });
    $(".adm-side").innerHTML =
      '<div class="adm-side-head"><h2>Courses</h2><button class="btn btn-sm btn-red" data-act="new-course">+ New course</button></div>' +
      '<div class="adm-group">Core training</div>' + (core.join("") || '<p class="muted" style="padding:0 16px;font-size:13px">None yet</p>') +
      '<div class="adm-group">Tool training</div>' + (tool.join("") || '<p class="muted" style="padding:0 16px;font-size:13px">None yet. Use <b>+ New course</b> and pick “Tool”.</p>');
  }

  function renderEditor() {
    var ed = $(".adm-editor");
    var c = cur();
    if (!c) {
      ed.innerHTML = '<div class="empty-state"><h2>No courses yet</h2><p>Create your first course to get started.</p><button class="btn btn-red" data-act="new-course">+ New course</button></div>';
      return;
    }
    var n = courses().length, i = S.sel.c;
    var head = '<div class="adm-ed-head"><div><div class="crumbs">' + esc(c.type === "tool" ? "Tool training" : "Core training") + " · " + esc(c.status === "draft" ? "Draft" : "Published") + "</div>";
    if (S.sel.view === "course") {
      ed.innerHTML = head + "<h1>" + esc(c.title || "Untitled course") + "</h1></div>" +
        '<div class="tools"><a class="btn btn-sm" target="_blank" rel="noopener" href="course.html?id=' + encodeURIComponent(c.id) + (c.status === "draft" ? "&preview=1" : "") + '">Open live page ↗</a>' +
        '<button class="btn btn-sm" data-act="move-course" data-d="-1"' + (i === 0 ? " disabled" : "") + ">↑ Move up</button>" +
        '<button class="btn btn-sm" data-act="move-course" data-d="1"' + (i === n - 1 ? " disabled" : "") + ">↓ Move down</button>" +
        '<button class="btn btn-sm" data-act="dup-course">Duplicate</button><button class="btn btn-sm" data-act="del-course">Delete</button></div></div>' +
        '<div class="panel"><h3>Basics</h3>' + fText("Course title", "title") +
        '<div class="row c2">' + fSeg("Course type", "type", [["core", "Core training"], ["tool", "Tool training"]]) + fSeg("Status", "status", [["draft", "Draft"], ["published", "Published"]]) + "</div>" +
        '<div class="hint" style="margin:-4px 0 12px">Core courses are the required basics, shown in order. Tool courses teach a specific approved tool (for example Claude or Pronto). Drafts are hidden from employees.</div>' +
        '<div class="row c2">' + fText("Who it's for", "audience", { ph: "e.g. All employees, Inside sales" }) + fCheck("Required training", "required") + "</div>" +
        fText("Course ID (used in the web address)", "id", { ro: c.status !== "draft", hint: c.status !== "draft" ? "Locked because the course is published; changing it would break links and saved progress." : "Lowercase letters, numbers, and dashes. Set it before you publish." }) +
        "</div>" +
        '<div class="panel"><h3>Descriptions</h3>' + fArea("Summary on the My courses page", "summary", { rich: true }) + fArea("Introduction at the top of the course", "intro", { rich: true }) + "</div>" +
        '<div class="panel" id="quiz-panel"><h3>Quiz (final step)</h3>' + fText("Quiz title", "quiz.title", { ph: c.title + " quiz" }) +
        fText("Microsoft Forms link", "quiz.url", { type: "url", ph: "https://forms.office.com/r/…", hint: "In Forms: Collect responses → copy link. Leave it empty to show “Quiz link coming soon”." }) +
        fArea("Instructions", "quiz.description", { rich: true, ph: "e.g. 6 questions. Pass with 5 correct." }) +
        fArea("Message after the quiz (optional)", "quiz.after", { rich: true, ph: "e.g. When you're done, continue to the next course." }) + "</div>" +
        '<div class="panel"><h3>Lessons</h3>' + (c.lessons.length ? '<ol style="margin:0 0 10px;padding-left:20px">' + c.lessons.map(function (l, j) {
          return '<li><a href="#" data-act="sel-lesson" data-c="' + i + '" data-l="' + j + '">' + esc(l.title || "Untitled lesson") + "</a> <span class=\"muted\">· " + (l.minutes || 0) + " min · " + (l.blocks || []).length + " blocks</span></li>";
        }).join("") + "</ol>" : '<p class="muted">No lessons yet.</p>') +
        '<button class="mini-add" data-act="add-lesson" data-c="' + i + '">+ Add lesson</button></div>';
    } else if (S.sel.view === "quiz") {
      S.sel.view = "course"; renderEditor();
      var qp = $("#quiz-panel"); if (qp) qp.scrollIntoView({ block: "start" });
      return;
    } else {
      var l = curLesson(), j = S.sel.l, base = "lessons." + j;
      if (!l) { S.sel.view = "course"; return renderEditor(); }
      var blocks = l.blocks || (l.blocks = []);
      ed.innerHTML = head + "<h1>Lesson " + (j + 1) + ": " + esc(l.title || "Untitled") + "</h1></div>" +
        '<div class="tools"><button class="btn btn-sm" data-act="move-lesson" data-d="-1"' + (j === 0 ? " disabled" : "") + ">↑</button>" +
        '<button class="btn btn-sm" data-act="move-lesson" data-d="1"' + (j === c.lessons.length - 1 ? " disabled" : "") + ">↓</button>" +
        '<button class="btn btn-sm" data-act="dup-lesson">Duplicate</button><button class="btn btn-sm" data-act="del-lesson">Delete</button></div></div>' +
        '<div class="panel"><div class="row" style="grid-template-columns:1fr 130px">' + fText("Lesson name (shown in the outline)", base + ".title") + fText("Minutes", base + ".minutes", { type: "number", kind: "int" }) + "</div>" +
        fText("Page heading", base + ".heading", { ph: "e.g. Less busywork. More time for customers.", hint: "The big headline at the top of the lesson. Leave empty to use the lesson name." }) + "</div>" +
        '<div class="flabel" style="margin:6px 0 8px">Content blocks</div>' +
        (blocks.length ? '<div class="insert-here" style="opacity:.6"><button type="button" data-act="add-block" data-list="' + base + '.blocks" data-at="0">+ Insert block at top</button></div>' : "") +
        blocks.map(function (b, k) { return blockEditor(b, base + ".blocks", k, blocks.length); }).join("") +
        '<button type="button" class="add-blk" data-act="add-block" data-list="' + base + '.blocks" data-at="' + blocks.length + '">+ Add content block</button>';
    }
  }

  var refreshPreviewSoon = debounce(renderPreview, 250);
  function renderPreview() {
    var pv = $(".adm-preview");
    if (!pv || !S.preview) return;
    var c = cur(), html = "";
    if (!c) { pv.innerHTML = ""; return; }
    var opt = { resolve: resolveSrc };
    if (S.sel.view === "lesson" && curLesson()) {
      var l = curLesson();
      html = '<div class="lesson-panel"><div class="lesson-top"><span><b>Lesson ' + (S.sel.l + 1) + " of " + c.lessons.length + "</b></span><span>" + (l.minutes || "") + ' min</span></div><div class="slides">' +
        R.lesson(l, opt) + '</div><div class="lesson-nav"><span class="btn" aria-disabled="true">← Previous</span><span class="btn btn-red" aria-disabled="true">Next lesson →</span></div></div>';
    } else {
      var mins = R.totalMinutes(c);
      html = '<div class="page-head"><p class="eyebrow">' + (c.type === "tool" ? "Tool training" : "Core training") + (c.required ? " · Required" : "") + (c.audience ? " · " + esc(c.audience) : "") +
        "</p><h1>" + esc(c.title) + "</h1>" + (c.intro ? '<p class="lede">' + R.rich(c.intro) + "</p>" : "") +
        '<div class="meta-row"><span><b>About ' + mins + " minutes</b></span><span><b>" + c.lessons.length + " lessons</b></span></div></div>" +
        '<p class="pv-label">On the My courses page:</p><div class="course"><div class="step-no">' + (c.type === "tool" ? '<span class="tool-badge">Tool</span>' : "#") + "</div><div><h3>" + esc(c.title) + "</h3>" +
        (c.summary ? "<p>" + R.rich(c.summary) + "</p>" : "") + '</div><div class="cta"><span class="status">Not started</span><span class="btn btn-red">Start</span></div></div>' +
        '<p class="pv-label">Quiz step:</p><div class="lesson-panel"><div class="slides">' + R.quiz(c) + "</div></div>";
    }
    pv.innerHTML = '<div class="pv-bar"><span>Preview — what employees will see</span><span class="seg"><button type="button" data-act="pv-size" data-v="0"' + (S.phone ? "" : ' class="on"') + '>Desktop</button><button type="button" data-act="pv-size" data-v="1"' + (S.phone ? ' class="on"' : "") + ">Phone</button></span></div>" +
      '<div class="pv-frame' + (S.phone ? " mobile" : "") + '">' + html + "</div>";
    pv.querySelectorAll(".slide").forEach(function (s) { s.classList.add("active"); });
    pv.querySelectorAll("[data-quiz]").forEach(function (a) { a.removeAttribute("data-quiz"); a.href = a.getAttribute("data-quiz-url") || "#"; a.target = "_blank"; });
    if (window.RS.wire) window.RS.wire(pv);
  }

  function renderAll() {
    if (!$(".adm-work")) {
      app.innerHTML = '<div class="adm-work"><aside class="adm-side"></aside><section class="adm-editor"></section><section class="adm-preview"></section></div>';
    }
    var w = $(".adm-work");
    w.classList.toggle("no-preview", !S.preview);
    w.classList.toggle("show-preview", S.preview);
    var c = cur(); if (c) S.openCourses[c.id] = true;
    renderStatus(); renderSide(); renderEditor(); renderPreview();
  }

  // ---------------------------------------------------------------- sign-in
  function renderSignin(msg) {
    S.data = null; renderStatus();
    app.innerHTML = '<div class="adm-signin"><h1>Sign in to the Training Creator</h1>' +
      '<p class="muted">Changes you publish here update the live training site at hub.richardssupply.com/ai within about a minute.</p>' +
      (msg ? '<div class="callout">' + msg + "</div>" : "") +
      '<div class="field"><label for="tok">GitHub access token</label><input type="password" id="tok" autocomplete="off" placeholder="github_pat_…"></div>' +
      '<label class="check-row" style="margin-bottom:14px"><input type="checkbox" id="remember" checked> Keep me signed in on this computer</label>' +
      '<div class="btn-row" style="margin-top:0"><button class="btn btn-red" id="signin">Sign in</button><button class="btn" id="practice">Practice without signing in</button></div>' +
      '<details style="margin-top:22px"><summary><b>How to get a token (one time, about 2 minutes)</b></summary><ol>' +
      '<li>Sign in to GitHub as the owner of <code>' + esc(A.owner + "/" + A.repo) + "</code>.</li>" +
      '<li>Go to <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Settings → Developer settings → Fine-grained tokens → Generate new token</a>.</li>' +
      "<li>Name it “AI Training Creator” and pick an expiration (90 days is a good default).</li>" +
      "<li>Repository access: <b>Only select repositories</b> → <code>" + esc(A.repo) + "</code>.</li>" +
      "<li>Permissions → Repository permissions → <b>Contents: Read and write</b>. Leave everything else as is.</li>" +
      "<li>Generate the token, copy it, and paste it above. Treat it like a password.</li></ol>" +
      '<p class="muted" style="font-size:13.5px">The token is stored only in this browser. Anyone with it can change the training site, so don\'t share it or use it on a shared computer. You can revoke it on GitHub at any time.</p></details>' +
      '<p class="muted" style="font-size:13.5px;margin-top:16px">Practice mode loads the current courses so you can try the editor. Nothing is published; you can download the content file at the end.</p></div>';
    $("#signin").addEventListener("click", function () {
      var t = $("#tok").value.trim();
      if (!t) return toast("Paste your token first.", true);
      S.token = t;
      try { if ($("#remember").checked) localStorage.setItem(TOKEN_KEY, t); else sessionStorage.setItem(TOKEN_KEY, t); } catch (e) {}
      connect();
    });
    $("#tok").addEventListener("keydown", function (e) { if (e.key === "Enter") $("#signin").click(); });
    $("#practice").addEventListener("click", startPractice);
  }

  function signOut() {
    try { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
    S.token = null; S.user = null; S.mode = null;
    renderSignin("You're signed out. Unpublished edits stay on this device and will be offered when you sign in again.");
  }

  function connect() {
    app.innerHTML = '<div class="empty-state">Connecting to GitHub…</div>';
    gh(repoPath(""))
      .then(function (repo) {
        if (repo.permissions && repo.permissions.push === false) throw Object.assign(new Error("This token can read the repo but can't save. Give it Contents: Read and write."), { status: 403 });
        return gh("/user").then(function (u) { S.user = u.login; }, function () {});
      })
      .then(fetchContent)
      .then(function (res) { S.mode = "github"; begin(res.data, res.sha); })
      .catch(function (e) {
        try { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); } catch (x) {}
        renderSignin(e.status === 401 ? "That token wasn't accepted. Check that you copied all of it and that it hasn't expired." :
          e.status === 404 ? "The token can't see <code>" + esc(A.owner + "/" + A.repo) + "</code>. Make sure that repository is selected for the token." :
          esc(e.message || "Couldn't connect to GitHub."));
      });
  }

  function startPractice() {
    fetch("content/trainings.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); })
      .then(function (d) { S.mode = "local"; begin(d, null); })
      .catch(function () { toast("Couldn't load the current courses.", true); });
  }

  function begin(data, sha) {
    if (!data || !Array.isArray(data.courses)) data = { version: 1, courses: [] };
    S.data = data; S.sha = sha; S.published = JSON.stringify(data); S.dirty = false;
    S.sel = { c: 0, view: "course", l: 0 };
    var draft = null;
    try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) {}
    renderAll();
    if (draft && draft.data && JSON.stringify(draft.data) !== S.published) {
      var stale = S.mode === "github" && draft.baseSha && draft.baseSha !== sha;
      modal("<h2>Pick up where you left off?</h2><p>You have unpublished edits on this device from " + esc(new Date(draft.savedAt).toLocaleString()) + ".</p>" +
        (stale ? '<div class="callout"><b>Heads up:</b> the site has been published since then. Restoring your edits and publishing will replace those newer changes.</div>' : "") +
        '<div class="btn-row"><button class="btn" id="discard">Discard them</button><button class="btn btn-red" id="restore">Restore my edits</button></div>',
        function (b) {
          $("#discard", b).addEventListener("click", function () { clearDraft(); closeModal(); });
          $("#restore", b).addEventListener("click", function () { S.data = draft.data; S.dirty = true; closeModal(); renderAll(); });
        });
    }
  }

  // ---------------------------------------------------------------- actions
  function newLesson(n) { return { id: uid("l"), title: "Lesson " + n, minutes: 2, heading: "", blocks: [{ type: "text", html: "" }] }; }

  function openPicker(list, at, nested) {
    S.insertAt = at;
    modal("<h2>Add a content block</h2><div class=\"picker\">" + Object.keys(TYPES).filter(function (k) { return !(nested && k === "columns"); }).map(function (k) {
      var t = TYPES[k];
      return '<button type="button" data-pick="' + k + '"><span class="ic">' + esc(t.ic) + "</span><b>" + esc(t.name) + "</b><span>" + esc(t.desc) + "</span></button>";
    }).join("") + '</div><div class="btn-row"><button class="btn" data-close>Cancel</button></div>', function (b) {
      b.querySelectorAll("[data-pick]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var arr = getPath(cur(), list); if (!arr) { arr = []; setPath(cur(), list, arr); }
          arr.splice(S.insertAt, 0, TYPES[btn.getAttribute("data-pick")].make());
          var ed = $(".adm-editor"), y = ed.scrollTop;
          closeModal(); markDirty(); renderEditor(); ed.scrollTop = y; renderPreview();
          var el = $('.blk[data-path="' + list + "." + S.insertAt + '"]'); if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); el.classList.add("focus"); var f = el.querySelector("textarea, input"); if (f) f.focus(); }
        });
      });
    });
  }

  function newCourseDialog() {
    modal('<h2>New course</h2>' +
      '<div class="field"><label>Course title</label><input type="text" id="nc-title" placeholder="e.g. Using Claude at Richards Supply"></div>' +
      '<div class="field"><span class="flabel">Type</span><div class="seg" id="nc-type"><button type="button" data-v="core" class="on">Core training</button><button type="button" data-v="tool">Tool training</button></div>' +
      '<div class="hint">Tool training teaches one approved tool, like Claude or Pronto.</div></div>' +
      '<div class="field"><span class="flabel">Start from</span><select id="nc-from"><option value="">A blank course</option>' +
      courses().map(function (c, i) { return '<option value="' + i + '">A copy of “' + esc(c.title) + "”</option>"; }).join("") + "</select></div>" +
      '<p class="muted" style="font-size:13.5px">New courses start as drafts, so employees won\'t see them until you publish.</p>' +
      '<div class="btn-row"><button class="btn" data-close>Cancel</button><button class="btn btn-red" id="nc-ok">Create course</button></div>', function (b) {
        var type = "core";
        b.querySelectorAll("#nc-type button").forEach(function (x) {
          x.addEventListener("click", function () { type = x.getAttribute("data-v"); b.querySelectorAll("#nc-type button").forEach(function (y) { y.classList.toggle("on", y === x); }); });
        });
        $("#nc-ok", b).addEventListener("click", function () {
          var title = $("#nc-title", b).value.trim();
          if (!title) return toast("Give the course a title.", true);
          var from = $("#nc-from", b).value;
          var c = from === "" ? {
            title: title, type: type, status: "draft", required: type !== "tool", audience: "", summary: "", intro: "",
            quiz: { title: title + " quiz", url: "", description: "", after: "" }, lessons: [newLesson(1)]
          } : Object.assign(clone(courses()[+from]), { title: title, type: type, status: "draft" });
          c.id = uniqueId(slug(title));
          c.lessons.forEach(function (l) { l.id = uid("l"); });
          var keys = Object.keys(c); var ordered = { id: c.id }; keys.forEach(function (k) { if (k !== "id") ordered[k] = c[k]; });
          courses().push(ordered);
          S.sel = { c: courses().length - 1, view: "course", l: 0 };
          closeModal(); markDirty(); renderAll(); $(".adm-editor").scrollTop = 0;
        });
      });
  }
  function uniqueId(base) {
    var id = base, n = 2;
    while (courses().some(function (c) { return c.id === id; })) id = base + "-" + n++;
    return id;
  }

  function pickImage(path) {
    var input = document.createElement("input");
    input.type = "file"; input.accept = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml";
    input.addEventListener("change", function () {
      var f = input.files[0]; if (!f) return;
      prepareImage(f).then(function (img) {
        if (img.bytes > 4 * 1024 * 1024) throw new Error("That image is over 4 MB even after resizing. Try a smaller file.");
        if (S.mode !== "github") {
          setPath(cur(), path, img.dataUrl); markDirty(); renderEditor(); renderPreview();
          toast("Image added (practice mode keeps it inside the content file).");
          return;
        }
        var name = slug(f.name.replace(/\.[^.]+$/, "")) + "-" + Date.now().toString(36) + "." + img.ext;
        toast("Uploading image…");
        return gh(contentsUrl(A.imageDir + "/" + name), { method: "PUT", body: { message: "Add training image " + name, content: img.b64, branch: A.branch } })
          .then(function () {
            var rel = A.imageDir.replace(/^ai\//, "") + "/" + name;
            S.pending[rel] = img.dataUrl;
            setPath(cur(), path, rel); markDirty(); renderEditor(); renderPreview();
            toast("Image uploaded. It appears on the site after you publish.");
          });
      }).catch(function (e) { toast(e.message || "Couldn't add that image.", true); });
    });
    input.click();
  }
  function prepareImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("Couldn't read that file.")); };
      reader.onload = function () {
        var dataUrl = reader.result;
        var type = file.type;
        var ext = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg" }[type] || "png";
        function done(url, e) { var b64 = url.split(",")[1]; resolve({ dataUrl: url, b64: b64, ext: e || ext, bytes: Math.floor(b64.length * 3 / 4) }); }
        if (type === "image/svg+xml" || type === "image/gif") return done(dataUrl);
        var im = new Image();
        im.onload = function () {
          var max = 1600, w = im.naturalWidth, h = im.naturalHeight;
          if (w <= max && file.size < 900 * 1024) return done(dataUrl);
          var s = Math.min(1, max / w), cv = document.createElement("canvas");
          cv.width = Math.round(w * s); cv.height = Math.round(h * s);
          cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
          var out = type === "image/png" ? cv.toDataURL("image/png") : cv.toDataURL("image/jpeg", 0.85);
          done(out, type === "image/png" ? "png" : "jpg");
        };
        im.onerror = function () { reject(new Error("That file doesn't look like an image.")); };
        im.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  function validate() {
    var errs = [], warns = [], ids = {};
    courses().forEach(function (c) {
      var name = "“" + (c.title || "Untitled") + "”";
      if (!c.title) errs.push("A course is missing its title.");
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id || "")) errs.push(name + ": the course ID must use lowercase letters, numbers, and dashes.");
      if (ids[c.id]) errs.push(name + ": another course already uses the ID “" + c.id + "”.");
      ids[c.id] = true;
      if (c.status !== "draft" && !c.lessons.length) errs.push(name + " is published but has no lessons.");
      var q = c.quiz || {};
      if (q.url && !/^https:\/\//.test(q.url)) warns.push(name + ": the quiz link should start with https://.");
      if (c.status !== "draft" && !q.url) warns.push(name + ": no quiz link yet (employees will see “Quiz link coming soon”).");
      c.lessons.forEach(function (l, j) {
        var ln = name + ", lesson " + (j + 1);
        if (!l.title) errs.push(ln + " is missing a name.");
        if (!(l.blocks || []).length) warns.push(ln + " has no content.");
        var flat = [];
        (l.blocks || []).forEach(function (b) { flat.push(b); (b.type === "columns" ? b.columns || [] : []).forEach(function (col) { (col.blocks || []).forEach(function (x) { flat.push(x); }); }); });
        flat.forEach(function (b) {
          if (b.type === "image" && !b.src) warns.push(ln + ": an image block has no image.");
          if (b.type === "image" && b.src && !b.alt) warns.push(ln + ": an image is missing alt text.");
          if (b.type === "video" && !b.url) warns.push(ln + ": a video block has no link.");
          if (b.type === "button" && !b.href) warns.push(ln + ": a button has no link.");
          if (b.type === "practice" && (b.items || []).some(function (it) { return !it.text; })) warns.push(ln + ": a practice item is empty.");
        });
      });
    });
    return { errs: errs, warns: warns };
  }

  function publish() {
    var r = validate();
    if (r.errs.length) {
      return modal("<h2>Fix these before publishing</h2><ul class=\"issues\">" + r.errs.map(function (e) { return '<li class="err">' + esc(e) + "</li>"; }).join("") +
        r.warns.map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("") + '</ul><div class="btn-row"><button class="btn btn-red" data-close>OK</button></div>');
    }
    var changed = courses().filter(function (c) {
      var old = (JSON.parse(S.published).courses || []).filter(function (o) { return o.id === c.id; })[0];
      return !old || JSON.stringify(old) !== JSON.stringify(c);
    }).map(function (c) { return c.title; });
    modal("<h2>Publish changes</h2>" +
      (r.warns.length ? '<p><b>Check these first</b> (you can still publish):</p><ul class="issues">' + r.warns.map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("") + "</ul>" : "") +
      '<div class="field" style="margin-top:12px"><label>What changed? (saved in the history)</label><input type="text" id="msg" value="' + esc(changed.length ? "Update " + changed.slice(0, 3).join(", ") + (changed.length > 3 ? " and more" : "") : "Update trainings") + '"></div>' +
      '<p class="muted" style="font-size:13.5px">The live site updates in about a minute. Employees may need to refresh.</p>' +
      '<div class="btn-row"><button class="btn" data-close>Cancel</button><button class="btn btn-red" id="go">Publish</button></div>', function (b) {
        $("#go", b).addEventListener("click", function () {
          var msg = $("#msg", b).value.trim() || "Update trainings";
          $("#go", b).disabled = true; $("#go", b).textContent = "Publishing…";
          commit(msg, S.sha).then(function () { closeModal(); toast("Published. The site updates in about a minute."); })
            .catch(function (e) {
              closeModal();
              if (e.status === 409 || e.status === 422) return conflict(msg);
              toast("Publish failed: " + (e.message || "unknown error") + ". Your edits are still here.", true);
            });
        });
      });
  }
  function commit(msg, sha) {
    var body = JSON.stringify(S.data, null, 2) + "\n";
    return gh(contentsUrl(A.contentPath), { method: "PUT", body: { message: msg + " (via Training Creator)", content: b64enc(body), sha: sha, branch: A.branch } })
      .then(function (res) {
        S.sha = res.content.sha; S.published = JSON.stringify(S.data); S.dirty = false; S.pending = S.pending; clearDraft(); renderStatus();
      });
  }
  function conflict(msg) {
    modal("<h2>Someone else published first</h2><p>The training content changed on GitHub after you opened the editor. You can replace it with your version, or download your version and reload to see theirs.</p>" +
      '<div class="btn-row"><button class="btn" id="dl">Download my version</button><button class="btn" id="reload">Discard mine and reload</button><button class="btn btn-red" id="over">Publish mine anyway</button></div>', function (b) {
        $("#dl", b).addEventListener("click", exportJson);
        $("#reload", b).addEventListener("click", function () { clearDraft(); S.dirty = false; location.reload(); });
        $("#over", b).addEventListener("click", function () {
          fetchContent().then(function (res) { return commit(msg, res.sha); })
            .then(function () { closeModal(); toast("Published. The site updates in about a minute."); })
            .catch(function (e) { toast("Publish failed: " + e.message, true); });
        });
      });
  }

  function exportJson() {
    var blob = new Blob([JSON.stringify(S.data, null, 2) + "\n"], { type: "application/json" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "trainings.json"; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    if (S.mode !== "github") toast("Downloaded. Upload it to ai/content/ in the GitHub repo to publish.");
  }
  function importJson() {
    var input = document.createElement("input"); input.type = "file"; input.accept = "application/json,.json";
    input.addEventListener("change", function () {
      var f = input.files[0]; if (!f) return;
      f.text().then(function (t) {
        var d = JSON.parse(t);
        if (!d || !Array.isArray(d.courses)) throw new Error("That file isn't a training content file.");
        confirmBox("Replace all courses?", "This replaces everything in the editor with the " + d.courses.length + " course(s) in “" + esc(f.name) + "”. Nothing is published until you click Publish.", "Replace", function () {
          S.data = d; S.sel = { c: 0, view: "course", l: 0 }; markDirty(); renderAll();
        });
      }).catch(function (e) { toast(e.message || "Couldn't read that file.", true); });
    });
    input.click();
  }
  function moreMenu() {
    modal("<h2>More</h2><div class=\"picker\" style=\"grid-template-columns:1fr 1fr\">" +
      '<button type="button" id="m-export"><span class="ic">⇩</span><b>Download content file</b><span>A backup of every course as trainings.json.</span></button>' +
      '<button type="button" id="m-import"><span class="ic">⇧</span><b>Import content file</b><span>Replace the editor contents from a trainings.json file.</span></button>' +
      '<button type="button" id="m-revert"><span class="ic">↺</span><b>Discard unpublished changes</b><span>Go back to what is live on the site.</span></button>' +
      '<button type="button" id="m-site"><span class="ic">↗</span><b>Open the training site</b><span>See the live employee view in a new tab.</span></button>' +
      (S.mode === "github" ? '<button type="button" id="m-out"><span class="ic">⏻</span><b>Sign out</b><span>Remove the token from this browser.</span></button>' : '<button type="button" id="m-in"><span class="ic">⏻</span><b>Sign in to publish</b><span>Connect with a GitHub token.</span></button>') +
      '</div><div class="btn-row"><button class="btn" data-close>Close</button></div>', function (b) {
        $("#m-export", b).addEventListener("click", function () { closeModal(); exportJson(); });
        $("#m-import", b).addEventListener("click", function () { closeModal(); importJson(); });
        $("#m-site", b).addEventListener("click", function () { closeModal(); window.open("index.html", "_blank"); });
        $("#m-revert", b).addEventListener("click", function () {
          closeModal();
          if (!S.dirty) return toast("There are no unpublished changes.");
          confirmBox("Discard unpublished changes?", "Everything you've changed since the last publish will be lost.", "Discard", function () {
            S.data = JSON.parse(S.published); S.dirty = false; clearDraft(); S.sel = { c: 0, view: "course", l: 0 }; renderAll();
          });
        });
        var o = $("#m-out", b); if (o) o.addEventListener("click", function () { closeModal(); if (S.dirty) saveDraftSoon(); signOut(); });
        var i = $("#m-in", b); if (i) i.addEventListener("click", function () { closeModal(); renderSignin(); });
      });
  }

  // ---------------------------------------------------------------- events
  document.addEventListener("input", function (e) {
    var el = e.target; if (!S.data || !el.matches("[data-b]") || el.closest("#modal")) return;
    if (el.tagName === "BUTTON") return;
    var kind = el.getAttribute("data-k"), path = el.getAttribute("data-b"), val = el.value;
    if (kind === "bool") val = el.checked;
    else if (kind === "int") val = parseInt(val, 10) || 0;
    else if (kind === "lines") val = val.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    setPath(cur(), path, val);
    markDirty();
    if (/^(title|lessons\.\d+\.title)$/.test(path)) renderSide();
    var head = el.closest(".blk"); if (head) { var b = getPath(cur(), head.getAttribute("data-path")); var sm = head.querySelector(".sum"); if (sm && b) sm.textContent = summary(b); }
  });
  document.addEventListener("change", function (e) {
    var el = e.target; if (!S.data || !el.matches("[data-b]") || el.closest("#modal")) return;
    if (el.tagName === "SELECT" || el.type === "checkbox") { renderEditorKeepScroll(); }
  });
  function renderEditorKeepScroll() { var ed = $(".adm-editor"), y = ed.scrollTop; renderEditor(); ed.scrollTop = y; renderPreview(); }

  document.addEventListener("click", function (e) {
    var rt = e.target.closest("[data-rt]");
    if (rt) {
      var ta = rt.closest(".field").querySelector("textarea");
      var s = ta.selectionStart, en = ta.selectionEnd, sel = ta.value.slice(s, en), kind = rt.getAttribute("data-rt"), rep;
      if (kind === "a") {
        var url = window.prompt("Link address (https://… or a page like reference.html)", "https://");
        if (!url) return;
        rep = "[" + (sel || "link text") + "](" + url.trim() + ")";
      } else rep = kind === "b" ? "**" + (sel || "bold text") + "**" : "*" + (sel || "italic text") + "*";
      ta.setRangeText(rep, s, en, "end"); ta.focus(); ta.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    var a = e.target.closest("[data-act]"); if (!a || !S.data) return;
    var act = a.getAttribute("data-act"), c = cur(), i, list, d, path;
    if (a.tagName === "A") e.preventDefault();
    switch (act) {
      case "sel-course":
        i = +a.getAttribute("data-c");
        if (S.sel.c === i && S.sel.view === "course" && a.closest(".adm-course > button")) { S.openCourses[courses()[i].id] = !S.openCourses[courses()[i].id]; }
        S.sel = { c: i, view: "course", l: 0 }; renderAll(); $(".adm-editor").scrollTop = 0; break;
      case "sel-lesson": S.sel = { c: +a.getAttribute("data-c"), view: "lesson", l: +a.getAttribute("data-l") }; renderAll(); $(".adm-editor").scrollTop = 0; break;
      case "sel-quiz": S.sel = { c: +a.getAttribute("data-c"), view: "quiz", l: 0 }; renderAll(); break;
      case "new-course": newCourseDialog(); break;
      case "add-lesson":
        S.sel.c = +a.getAttribute("data-c"); c = cur();
        c.lessons.push(newLesson(c.lessons.length + 1));
        S.sel = { c: S.sel.c, view: "lesson", l: c.lessons.length - 1 }; markDirty(); renderAll(); break;
      case "move-course":
        d = +a.getAttribute("data-d"); i = S.sel.c; list = courses();
        list.splice(i + d, 0, list.splice(i, 1)[0]); S.sel.c = i + d; markDirty(); renderAll(); break;
      case "dup-course":
        var copy = clone(c); copy.title = c.title + " (copy)"; copy.id = uniqueId(c.id + "-copy"); copy.status = "draft";
        courses().splice(S.sel.c + 1, 0, copy); S.sel = { c: S.sel.c + 1, view: "course", l: 0 }; markDirty(); renderAll(); break;
      case "del-course":
        confirmBox("Delete “" + (c.title || "this course") + "”?", "The course and its " + c.lessons.length + " lessons are removed when you publish. Employees' saved progress for it is lost." +
          (c.status !== "draft" ? " <b>It's currently live.</b> Consider setting it to Draft instead." : ""), "Delete course", function () {
            courses().splice(S.sel.c, 1); S.sel = { c: Math.max(0, S.sel.c - 1), view: "course", l: 0 }; markDirty(); renderAll();
          }); break;
      case "move-lesson":
        d = +a.getAttribute("data-d"); i = S.sel.l;
        c.lessons.splice(i + d, 0, c.lessons.splice(i, 1)[0]); S.sel.l = i + d; markDirty(); renderAll(); break;
      case "dup-lesson":
        var lc = clone(curLesson()); lc.id = uid("l"); lc.title += " (copy)";
        c.lessons.splice(S.sel.l + 1, 0, lc); S.sel.l++; markDirty(); renderAll(); break;
      case "del-lesson":
        confirmBox("Delete lesson “" + (curLesson().title || "") + "”?", "This removes the lesson and all of its content blocks.", "Delete lesson", function () {
          c.lessons.splice(S.sel.l, 1);
          S.sel = c.lessons.length ? { c: S.sel.c, view: "lesson", l: Math.max(0, S.sel.l - 1) } : { c: S.sel.c, view: "course", l: 0 };
          markDirty(); renderAll();
        }); break;
      case "add-block": openPicker(a.getAttribute("data-list"), +a.getAttribute("data-at"), a.getAttribute("data-nested") === "1"); break;
      case "blk-move":
        list = getPath(c, a.getAttribute("data-list")); i = +a.getAttribute("data-i"); d = +a.getAttribute("data-d");
        list.splice(i + d, 0, list.splice(i, 1)[0]); markDirty(); renderEditorKeepScroll(); break;
      case "blk-dup":
        list = getPath(c, a.getAttribute("data-list")); i = +a.getAttribute("data-i"); list.splice(i + 1, 0, clone(list[i])); markDirty(); renderEditorKeepScroll(); break;
      case "blk-del":
        list = getPath(c, a.getAttribute("data-list")); i = +a.getAttribute("data-i");
        var t = TYPES[list[i].type];
        confirmBox("Delete this " + (t ? t.name.toLowerCase() : "block") + "?", esc(summary(list[i]) || "This block will be removed."), "Delete", function () {
          list.splice(i, 1); markDirty(); renderEditorKeepScroll();
        }); break;
      case "blk-toggle":
        var blk = getPath(c, a.getAttribute("data-list"))[+a.getAttribute("data-i")];
        if (S.collapsed.has(blk)) S.collapsed.delete(blk); else S.collapsed.add(blk);
        renderEditorKeepScroll(); break;
      case "sub-add":
        path = a.getAttribute("data-b"); list = getPath(c, path) || []; setPath(c, path, list);
        list.push({ card: newCard(), column: { blocks: [{ type: "text", html: "" }] } }[a.getAttribute("data-t")] || { text: "", answer: "yellow", why: "" });
        markDirty(); renderEditorKeepScroll(); break;
      case "sub-del":
        list = getPath(c, a.getAttribute("data-b")); list.splice(+a.getAttribute("data-i"), 1); markDirty(); renderEditorKeepScroll(); break;
      case "sub-move":
        list = getPath(c, a.getAttribute("data-b")); i = +a.getAttribute("data-i"); d = +a.getAttribute("data-d");
        list.splice(i + d, 0, list.splice(i, 1)[0]); markDirty(); renderEditorKeepScroll(); break;
      case "tbl-addrow":
        var tb = getPath(c, a.getAttribute("data-b")); tb.rows.push(tb.headers.map(function () { return ""; })); markDirty(); renderEditorKeepScroll(); break;
      case "tbl-addcol":
        tb = getPath(c, a.getAttribute("data-b")); tb.headers.push("Column " + (tb.headers.length + 1)); tb.rows.forEach(function (r) { r.push(""); }); markDirty(); renderEditorKeepScroll(); break;
      case "tbl-delrow":
        tb = getPath(c, a.getAttribute("data-b")); tb.rows.splice(+a.getAttribute("data-i"), 1); markDirty(); renderEditorKeepScroll(); break;
      case "tbl-delcol":
        tb = getPath(c, a.getAttribute("data-b")); i = +a.getAttribute("data-i");
        if (tb.headers.length <= 1) return toast("A table needs at least one column.", true);
        tb.headers.splice(i, 1); tb.rows.forEach(function (r) { r.splice(i, 1); }); markDirty(); renderEditorKeepScroll(); break;
      case "img-pick": pickImage(a.getAttribute("data-b")); break;
      case "set":
        path = a.getAttribute("data-b");
        if (path === "status" && a.getAttribute("data-v") === "published" && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id || "")) return toast("Fix the course ID before publishing this course.", true);
        setPath(c, path, a.getAttribute("data-v")); markDirty(); renderSide(); renderEditorKeepScroll(); break;
      case "toggle-preview": S.preview = !S.preview; renderAll(); break;
      case "pv-size": S.phone = a.getAttribute("data-v") === "1"; renderPreview(); break;
      case "publish": publish(); break;
      case "export": exportJson(); break;
      case "more": moreMenu(); break;
    }
  });

  // ---------------------------------------------------------------- start
  try { S.token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY); } catch (e) {}
  if (S.token) connect(); else renderSignin();
})();
