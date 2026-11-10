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

  function lesson(l, opt) {
    return '<article class="slide" data-title="' + esc(l.title) + '" data-minutes="' + esc(l.minutes || "") + '">' +
      "<h3>" + rich(l.heading || l.title) + "</h3>" +
      (l.blocks || []).map(function (b) { return block(b, opt); }).join("") +
      "</article>";
  }

  function quiz(c) {
    var q = c.quiz || {};
    return '<article class="slide" data-title="Quiz" data-kind="quiz"><h3>' + esc(q.title || "Quiz") + "</h3>" +
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

  RS.render = { rich: rich, block: block, lesson: lesson, quiz: quiz, esc: esc, totalMinutes: totalMinutes, videoEmbed: videoEmbed };
})();
