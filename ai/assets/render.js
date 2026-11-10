/* Richards Supply AI Training — content renderer.
   Turns the course data in content/trainings.json into page HTML.
   Used by the employee pages (course.html, index.html) and by the admin preview. */
(function () {
  var RS = window.RS = window.RS || {};

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  // Text fields support **bold**, *italic*, and [link text](https://…), plus simple HTML for advanced use.
  function rich(s, br) {
    if (s == null) return "";
    s = String(s)
      .replace(/\*\*([^*\n]+?)\*\*/g, "<b>$1</b>")
      .replace(/(^|[^*\w])\*([^*\n]+?)\*(?![*\w])/g, "$1<i>$2</i>")
      .replace(/==([^=\n]+?)==/g, '<span class="hl">$1</span>')
      .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, function (m, t, u) {
        var ext = /^https?:/i.test(u);
        return '<a href="' + u.replace(/"/g, "%22") + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" + t + "</a>";
      });
    return br ? s.replace(/\n/g, "<br>") : s;
  }

  // Table cells: "{ok}Approved" renders as a green label. Also {no} red, {warn} yellow, {dark} black.
  // A cell can hold several labels: "{warn}Yellow {no}SSN = Red".
  function cell(s) {
    s = String(s == null ? "" : s);
    if (!/\{(ok|no|warn|dark)\}/.test(s)) return rich(s);
    var lead = s.split(/\{(?:ok|no|warn|dark)\}/)[0];
    var out = rich(lead), re = /\{(ok|no|warn|dark)\}([^{]*)/g, m;
    while ((m = re.exec(s))) out += '<span class="pill ' + m[1] + '">' + rich(m[2].trim()) + "</span> ";
    return out.trim();
  }

  function videoEmbed(url) {
    url = String(url || "").trim();
    var m;
    if ((m = /loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/.exec(url))) return "https://www.loom.com/embed/" + m[1];
    if ((m = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/.exec(url))) return "https://www.youtube.com/embed/" + m[1];
    if ((m = /vimeo\.com\/(\d+)/.exec(url))) return "https://player.vimeo.com/video/" + m[1];
    return url; // Microsoft Stream / SharePoint embed links and others are used as given
  }

  var DISCLOSE = '<div class="disclose"><div class="btn-row"><a class="btn btn-red" data-disclose="form" href="#">Disclose an unapproved tool →</a>' +
    '<a class="btn" data-disclose="email" href="#">Email instead</a></div>' +
    '<p class="disclose-note">The disclosure form is the preferred way to report it. Email is also accepted.</p></div>';

  var LEVEL_NAMES = { red: "Red", yellow: "Yellow", green: "Green" };

  function block(b, opt) {
    opt = opt || {};
    var src = opt.resolve || function (x) { return x; };
    switch (b.type) {
      case "heading":
        return "<h4 class=\"block-heading\">" + rich(b.text) + "</h4>";
      case "text":
        return "<p" + (b.muted ? ' class="muted"' : "") + ">" + rich(b.html, true) + "</p>";
      case "list":
        var tag = b.style === "number" ? "ol" : "ul";
        return "<" + tag + ">" + (b.items || []).map(function (i) { return "<li>" + rich(i) + "</li>"; }).join("") + "</" + tag + ">";
      case "cards":
        return '<div class="grid grid-' + (b.columns || 2) + '">' + (b.cards || []).map(function (c) {
          var inner = (c.image ? '<img class="card-img" src="' + esc(src(c.image)) + '" alt="' + esc(c.alt || "") + '">' : "") +
            (c.label ? '<span class="num">' + esc(c.label) + "</span>" : "") +
            (c.title ? "<h4>" + rich(c.title) + "</h4>" : "") +
            (c.text ? (/^\s*<(p|ul|ol|div)\b/i.test(c.text) ? rich(c.text) : "<p>" + rich(c.text, true) + "</p>") : "");
          return '<div class="' + (c.boxed === false ? "card-plain" : "card") + '">' + inner + "</div>";
        }).join("") + "</div>";
      case "callout":
        return '<div class="callout' + (b.tone ? " " + esc(b.tone) : "") + '">' + rich(b.html, true) + "</div>";
      case "quote":
        return '<div class="mantra">' + rich(b.html) + "</div>";
      case "table":
        return '<div class="table-wrap"><table><thead><tr>' + (b.headers || []).map(function (h) { return "<th>" + rich(h) + "</th>"; }).join("") +
          "</tr></thead><tbody>" + (b.rows || []).map(function (r) {
            return "<tr>" + r.map(function (c) { return "<td>" + cell(c) + "</td>"; }).join("") + "</tr>";
          }).join("") + "</tbody></table></div>";
      case "levels":
        return '<div class="levels">' + ["red", "yellow", "green"].map(function (k) {
          var l = b[k] || {};
          return '<div class="level ' + k + '"><h4>' + esc(l.title || LEVEL_NAMES[k]) + '</h4><div class="rule">' + rich(l.rule) + "</div><ul>" +
            (l.items || []).map(function (i) { return "<li>" + rich(i) + "</li>"; }).join("") + "</ul></div>";
        }).join("") + "</div>";
      case "practice":
        return '<div class="sorter">' + (b.items || []).map(function (it) {
          return '<div class="sort-item" data-answer="' + esc(it.answer) + '"><div>' + rich(it.text) + '</div><div class="choices">' +
            '<button type="button" class="pick-red" data-level="red">Red</button><button type="button" class="pick-yellow" data-level="yellow">Yellow</button><button type="button" class="pick-green" data-level="green">Green</button></div>' +
            '<div class="fb" data-why="' + esc(it.why) + '"></div></div>';
        }).join("") + "</div>";
      case "image":
        if (!b.src) return '<div class="figure-empty">Image not set</div>';
        return '<figure class="figure size-' + esc(b.size || "full") + '"><img src="' + esc(src(b.src)) + '" alt="' + esc(b.alt || "") + '">' +
          (b.caption ? "<figcaption>" + rich(b.caption) + "</figcaption>" : "") + "</figure>";
      case "video":
        if (!b.url) return '<div class="figure-empty">Video not set</div>';
        var v = /\.(mp4|webm)(\?|$)/i.test(b.url)
          ? '<video controls preload="metadata" src="' + esc(src(b.url)) + '"></video>'
          : '<iframe src="' + esc(videoEmbed(b.url)) + '" title="' + esc(b.caption || "Video") + '" allow="fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>';
        return '<figure class="figure video"><div class="video-wrap">' + v + "</div>" + (b.caption ? "<figcaption>" + rich(b.caption) + "</figcaption>" : "") + "</figure>";
      case "button":
        return '<div class="btn-row"><a class="btn ' + (b.style === "secondary" ? "" : "btn-red") + '" href="' + esc(b.href || "#") + '"' +
          (/^https?:/i.test(b.href || "") ? ' target="_blank" rel="noopener"' : "") + ">" + esc(b.label || "Open") + "</a></div>";
      case "disclose":
        return DISCLOSE;
      case "columns":
        var cols = b.columns || [];
        return '<div class="grid grid-' + Math.max(1, Math.min(3, cols.length)) + ' cols-block">' + cols.map(function (col) {
          return '<div class="col">' + (col.blocks || []).map(function (x) { return block(x, opt); }).join("") + "</div>";
        }).join("") + "</div>";
      case "divider":
        return '<hr class="divider">';
      case "html":
        return b.html || "";
      default:
        return "";
    }
  }

  function lesson(l, opt, n, c) {
    opt = opt || {};
    var banner = opt.banner === false ? "" : '<div class="lesson-art">' + art({ icon: l.icon, color: l.color, seed: l.title + (c ? c.id : ""), wide: true }) +
      '<div class="lesson-art-text"><span>' + (n ? "Lesson " + n : "Lesson") + (l.minutes ? " · " + esc(l.minutes) + " min" : "") + "</span><b>" + esc(l.title) + "</b></div></div>";
    return '<article class="slide" data-title="' + esc(l.title) + '" data-minutes="' + esc(l.minutes || "") + '">' + banner +
      "<h3>" + rich(l.heading || l.title) + "</h3>" +
      (l.blocks || []).map(function (b) { return block(b, opt); }).join("") +
      "</article>";
  }

  function quiz(c) {
    var q = c.quiz || {};
    return '<article class="slide" data-title="Quiz" data-kind="quiz"><div class="lesson-art">' + art({ icon: "cap", color: c.color || "red", seed: "quiz" + c.id, wide: true }) +
      '<div class="lesson-art-text"><span>Final step</span><b>' + esc(q.title || "Quiz") + "</b></div></div><h3>" + esc(q.title || "Quiz") + "</h3>" +
      (q.description ? "<p>" + rich(q.description) + "</p>" : "") +
      '<div class="quiz-box"><b>Before you start</b><ul><li>The quiz opens in Microsoft Forms in a new tab.</li>' +
      "<li>Sign in with your @richardssupply.com account so your score is recorded.</li>" +
      "<li>You can come back to any lesson using the outline.</li></ul>" +
      '<div class="btn-row"><a class="btn btn-red" data-quiz="' + esc(c.id) + '" data-quiz-url="' + esc(q.url || "") + '" href="#">Start the quiz</a></div></div>' +
      (q.after ? '<p style="margin-top:20px">' + rich(q.after) + "</p>" : "") + "</article>";
  }

  function totalMinutes(c) {
    return (c.lessons || []).reduce(function (s, l) { return s + (parseInt(l.minutes, 10) || 0); }, 0);
  }


  // ---------------------------------------------------------------- artwork
  // Landscape thumbnails: a colored gradient with one large icon. Used for course covers (when no
  // photo is set or a photo fails to load), lesson banners, and resource cards.
  var PALETTES = {
    red:    ["#b31b1b", "#e0573f"],
    blue:   ["#1d4ed8", "#3b82f6"],
    teal:   ["#0f766e", "#14b8a6"],
    purple: ["#6d28d9", "#a855f7"],
    orange: ["#c2410c", "#f59e0b"],
    green:  ["#15803d", "#4ade80"],
    indigo: ["#3730a3", "#6366f1"],
    slate:  ["#334155", "#64748b"],
    pink:   ["#be185d", "#f472b6"]
  };
  var ICONS = {
    sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z"/>',
    shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><path d="M12 15v2"/>',
    database: '<ellipse cx="12" cy="5.5" rx="7" ry="2.5"/><path d="M5 5.5v6.5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V5.5"/><path d="M5 12v6.5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V12"/>',
    checklist: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2c3 .2 5.5 2.6 5.5 5.8"/>',
    lightbulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    tools: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 8-8z" transform="translate(-2 -2)"/><path d="M4 20l6-6"/><path d="M14 4a4 4 0 0 1 5.5 5.5"/>',
    warning: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5v.5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/><circle cx="12" cy="12" r="7"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4.5L17 13H5"/>',
    swap: '<path d="M4 8h14l-3.5-3.5"/><path d="M20 16H6l3.5 3.5"/>',
    book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    chart: '<path d="M4 20h16"/><rect x="6" y="11" width="3" height="7"/><rect x="11" y="6" width="3" height="12"/><rect x="16" y="13" width="3" height="5"/>',
    cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/><path d="M22 9v5"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5.5 3.5-5.5 3.5z"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M8.5 11h7M8.5 14.5h7M8.5 18h4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    box: '<path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9"/>'
  };
  var ICON_NAMES = Object.keys(ICONS);
  var PALETTE_NAMES = Object.keys(PALETTES);
  function hash(s) { var h = 0; s = String(s || ""); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  var GUESS = [
    [/data|level|system|p21/i, "database"], [/rule|check|habit|practice|quiz/i, "checklist"], [/tool|approved/i, "tools"],
    [/wrong|incident|report|risk/i, "warning"], [/setting|training setting|model/i, "gear"], [/why|idea|use it/i, "lightbulb"],
    [/wrap|finish|summary/i, "flag"], [/secur|privacy|protect|password/i, "lock"], [/what ai|ai is|ai at/i, "sparkles"],
    [/team|people|customer/i, "people"], [/move|migrat|account/i, "swap"], [/reference|guide/i, "book"], [/claude|chat|copilot/i, "chat"]
  ];
  function guessIcon(text) {
    for (var i = 0; i < GUESS.length; i++) if (GUESS[i][0].test(text || "")) return GUESS[i][1];
    return ICON_NAMES[hash(text) % ICON_NAMES.length];
  }
  var artN = 0;
  // opts: { icon, color, seed, label }
  function art(opts) {
    opts = opts || {};
    var seed = opts.seed || opts.icon || "x";
    var icon = ICONS[opts.icon] ? opts.icon : guessIcon(seed);
    var pal = PALETTES[opts.color] || PALETTES[PALETTE_NAMES[hash(seed) % PALETTE_NAMES.length]];
    var id = "rsg" + (artN++), h = hash(seed);
    var W = opts.wide ? 960 : 320, H = 180;
    var ix = opts.wide ? W - 170 : W / 2, sc = opts.wide ? 3 : 2.6;
    var c1x = 40 + h % 80, c2x = W - 90 + (h >> 3) % 70, c2y = 120 + (h >> 5) % 40;
    return '<svg class="art" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="' + (opts.wide ? "xMaxYMid" : "xMidYMid") + ' slice" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + pal[0] + '"/><stop offset="1" stop-color="' + pal[1] + '"/></linearGradient></defs>' +
      '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + ')"/>' +
      '<circle cx="' + c1x + '" cy="20" r="70" fill="#fff" opacity=".08"/><circle cx="' + c2x + '" cy="' + c2y + '" r="90" fill="#fff" opacity=".07"/>' +
      (opts.wide ? '<circle cx="' + (W * .45 + h % 120) + '" cy="170" r="60" fill="#fff" opacity=".06"/>' : "") +
      '<circle cx="' + ix + '" cy="90" r="' + (opts.wide ? 58 : 48) + '" fill="#fff" opacity=".14"/>' +
      '<g transform="translate(' + ix + ' 90) scale(' + sc + ') translate(-12 -12)" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + ICONS[icon] + "</g></svg>";
  }
  // Photo over artwork: if the photo fails to load, the artwork shows.
  function thumb(photo, opts, extra) {
    return '<div class="thumb">' + art(opts) + (photo ? '<img src="' + esc(photo) + '" alt="" loading="lazy" onerror="this.remove()">' : "") + (extra || "") + "</div>";
  }
  function photoUrl(src, w, h) {
    if (!src) return "";
    if (/images\.unsplash\.com/.test(src) && !/[?&]w=/.test(src)) return src + (src.indexOf("?") < 0 ? "?" : "&") + "auto=format&fit=crop&crop=faces,edges&q=70&w=" + (w || 800) + (h ? "&h=" + h : "");
    return src;
  }
  // Free photos (Unsplash License) offered in the Training Creator's cover gallery.
  var GALLERY = [
    { url: "https://images.unsplash.com/photo-1758873268745-dd2cf0d677b5", label: "Team at a computer", credit: "Vitaly Gariev / Unsplash" },
    { url: "https://images.unsplash.com/photo-1702047094974-a3475a6e37f5", label: "Group around a laptop", credit: "Creatopy / Unsplash" },
    { url: "https://images.unsplash.com/photo-1764795850513-fa8a469a4600", label: "Inventory on a tablet", credit: "Cova Software / Unsplash" },
    { url: "https://images.unsplash.com/photo-1768839720936-87ce3adf2d08", label: "Padlock on a keyboard", credit: "Sasun Bughdaryan / Unsplash" }
  ];

  RS.render = { art: art, thumb: thumb, photoUrl: photoUrl, guessIcon: guessIcon, ICON_NAMES: ICON_NAMES, PALETTE_NAMES: PALETTE_NAMES, PALETTES: PALETTES, GALLERY: GALLERY, rich: rich, block: block, lesson: lesson, quiz: quiz, esc: esc, totalMinutes: totalMinutes, videoEmbed: videoEmbed };
})();
