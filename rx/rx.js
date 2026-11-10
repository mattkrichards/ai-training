// RX Training Library: loads videos.json, renders course groups, live search, course filter, video player.
(function () {
  var DATA = null, filter = "all", query = "";
  var $ = function (id) { return document.getElementById(id); };
  var WATCHED_KEY = "rx-watched";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function load() { try { return JSON.parse(localStorage.getItem(WATCHED_KEY) || "{}") || {}; } catch (e) { return {}; } }
  function markWatched(id) { var w = load(); w[id] = true; try { localStorage.setItem(WATCHED_KEY, JSON.stringify(w)); } catch (e) {} }

  function course(id) { return DATA.courses.filter(function (c) { return c.id === id; })[0] || { name: id, tool: id }; }
  function watchUrl(v) { return "https://www.youtube.com/watch?v=" + encodeURIComponent(v.id); }
  function embedUrl(v) { return "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(v.id) + "?autoplay=1&modestbranding=1&rel=0"; }
  function thumbUrl(v) { return "https://i.ytimg.com/vi/" + encodeURIComponent(v.id) + "/hqdefault.jpg"; }
  function label(v) { return course(v.course).tool + " " + v.order; }

  // Search: every word must match title, description, keywords, or course.
  function words() { return query.toLowerCase().split(/\s+/).filter(Boolean); }
  function haystack(v) {
    var c = course(v.course);
    return [v.title, v.description, (v.keywords || []).join(" "), c.name, c.tool, label(v)].join(" ").toLowerCase();
  }
  function score(v, ws) {
    var h = haystack(v), t = v.title.toLowerCase(), k = (v.keywords || []).join(" ").toLowerCase(), s = 0;
    for (var i = 0; i < ws.length; i++) {
      if (h.indexOf(ws[i]) < 0) return -1;
      s += 1 + (t.indexOf(ws[i]) >= 0 ? 3 : 0) + (k.indexOf(ws[i]) >= 0 ? 2 : 0);
    }
    return s;
  }
  function highlight(text, ws) {
    var out = esc(text);
    ws.forEach(function (w) {
      var re = new RegExp("(" + esc(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
      out = out.replace(re, "<mark>$1</mark>");
    });
    return out;
  }

  var PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';

  function card(v, ws, watched) {
    return '<article class="rx-card" tabindex="0" role="button" data-play="' + esc(v.id) + '" aria-label="Play ' + esc(label(v) + ": " + v.title) + '">' +
      '<div class="rx-thumb">' +
        '<img src="' + thumbUrl(v) + '" alt="" loading="lazy" onerror="this.remove()">' +
        '<span class="rx-badge">' + esc(label(v)) + "</span>" +
        (watched[v.id] ? '<span class="rx-watched">✓ Watched</span>' : "") +
        '<span class="rx-play">' + PLAY + "</span>" +
      "</div>" +
      '<div class="rx-body">' +
        "<h4>" + highlight(v.title, ws) + "</h4>" +
        "<p>" + highlight(v.description, ws) + "</p>" +
        '<div class="btn-row">' +
          '<button class="btn btn-sm btn-red" type="button" data-play="' + esc(v.id) + '">▶ Play</button>' +
          '<a class="btn btn-sm" href="' + watchUrl(v) + '" target="_blank" rel="noopener" data-ext="' + esc(v.id) + '">YouTube ↗</a>' +
        "</div>" +
      "</div>" +
    "</article>";
  }

  function render() {
    var ws = words(), watched = load(), shown = 0, html = "";
    DATA.courses.forEach(function (c) {
      if (filter !== "all" && filter !== c.id) return;
      var all = DATA.videos.filter(function (v) { return v.course === c.id; });
      var list = all.map(function (v) { return { v: v, s: ws.length ? score(v, ws) : 0 }; })
        .filter(function (x) { return x.s >= 0; })
        .sort(function (a, b) { return ws.length ? (b.s - a.s) || (a.v.order - b.v.order) : a.v.order - b.v.order; })
        .map(function (x) { return x.v; });
      if (!list.length) return;
      shown += list.length;
      var done = all.filter(function (v) { return watched[v.id]; }).length;
      html += '<section class="rx-course" id="' + esc(c.id) + '">' +
        '<div class="rx-course-head"><div><h2>' + esc(c.name) + "</h2><p>" + esc(c.summary || "") + "</p></div>" +
        '<div class="rx-course-meta"><span class="rx-progress">' + done + " of " + all.length + " watched</span></div></div>" +
        '<div class="rx-grid">' + list.map(function (v) { return card(v, ws, watched); }).join("") + "</div></section>";
    });
    if (!shown) {
      html = '<div class="rx-empty">No videos match “' + esc(query) + '”. Try a different word, or <a href="#" data-clear>clear the search</a>.</div>';
    }
    $("rx-library").innerHTML = html;
    var total = DATA.videos.length;
    $("rx-count").textContent = (ws.length || filter !== "all") ? shown + " of " + total + " videos" : total + " videos";
  }

  function renderChips() {
    var chips = [{ id: "all", name: "All courses" }].concat(DATA.courses);
    $("rx-chips").innerHTML = chips.map(function (c) {
      return '<button class="rx-chip" type="button" data-filter="' + esc(c.id) + '" aria-pressed="' + (filter === c.id) + '">' + esc(c.name) + "</button>";
    }).join("");
  }

  // URL state: ?q=search&course=rx-builder#v=VIDEOID
  function readUrl() {
    var p = new URLSearchParams(location.search);
    query = p.get("q") || "";
    var c = p.get("course");
    filter = c && DATA.courses.some(function (x) { return x.id === c; }) ? c : "all";
    $("rx-search").value = query;
  }
  function writeUrl() {
    var p = new URLSearchParams();
    if (query) p.set("q", query);
    if (filter !== "all") p.set("course", filter);
    var s = p.toString();
    history.replaceState(null, "", location.pathname + (s ? "?" + s : "") + location.hash);
  }

  // Player
  var lastFocus = null;
  function openVideo(id) {
    var v = DATA.videos.filter(function (x) { return x.id === id; })[0];
    if (!v) return;
    var c = course(v.course);
    lastFocus = document.activeElement;
    $("rx-modal-course").textContent = c.name + " · Module " + v.order;
    $("rx-modal-title").textContent = v.title;
    $("rx-modal-desc").textContent = v.description;
    $("rx-player").innerHTML = '<iframe src="' + embedUrl(v) + '" title="' + esc(v.title) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
    var siblings = DATA.videos.filter(function (x) { return x.course === v.course; }).sort(function (a, b) { return a.order - b.order; });
    var idx = siblings.indexOf(v), next = siblings[idx + 1];
    $("rx-modal-actions").innerHTML =
      (next ? '<button class="btn btn-red" type="button" data-play="' + esc(next.id) + '">Next: ' + esc(next.title) + " →</button>" : "") +
      '<a class="btn" href="' + watchUrl(v) + '" target="_blank" rel="noopener">Open on YouTube ↗</a>';
    $("rx-modal").hidden = false;
    document.body.classList.add("rx-lock");
    history.replaceState(null, "", location.pathname + location.search + "#v=" + v.id);
    markWatched(v.id);
    render();
    $("rx-modal").querySelector(".rx-close").focus();
  }
  function closeVideo() {
    if ($("rx-modal").hidden) return;
    $("rx-modal").hidden = true;
    $("rx-player").innerHTML = "";
    document.body.classList.remove("rx-lock");
    history.replaceState(null, "", location.pathname + location.search);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  function wire() {
    var t;
    $("rx-search").addEventListener("input", function () {
      clearTimeout(t);
      t = setTimeout(function () { query = $("rx-search").value.trim(); writeUrl(); render(); }, 120);
    });
    document.addEventListener("click", function (e) {
      var el;
      if ((el = e.target.closest("[data-close]"))) { closeVideo(); return; }
      if ((el = e.target.closest("[data-clear]"))) { e.preventDefault(); query = ""; $("rx-search").value = ""; writeUrl(); render(); $("rx-search").focus(); return; }
      if ((el = e.target.closest("[data-filter]"))) { filter = el.getAttribute("data-filter"); renderChips(); writeUrl(); render(); return; }
      if ((el = e.target.closest("[data-ext]"))) { markWatched(el.getAttribute("data-ext")); setTimeout(render, 0); return; }
      if (e.target.closest("a")) return;
      if ((el = e.target.closest("[data-play]"))) openVideo(el.getAttribute("data-play"));
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeVideo();
      if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("rx-card")) {
        e.preventDefault(); openVideo(e.target.getAttribute("data-play"));
      }
      if (e.key === "/" && document.activeElement !== $("rx-search") && $("rx-modal").hidden) {
        e.preventDefault(); $("rx-search").focus();
      }
    });
  }

  fetch("videos.json?t=" + Date.now(), { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (d) {
      DATA = d;
      if (d.title) { $("rx-title").textContent = d.title; }
      $("rx-subtitle").textContent = d.subtitle || "";
      readUrl(); renderChips(); render(); wire();
      var m = location.hash.match(/^#v=([\w-]+)/);
      if (m) openVideo(m[1]);
    })
    .catch(function (e) {
      $("rx-library").innerHTML = '<div class="rx-empty">The video list didn’t load (' + esc(e.message) + "). Refresh the page to try again.</div>";
    });
})();
