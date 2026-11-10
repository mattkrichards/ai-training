(function () {
  var C = window.RS_CONFIG || { quizzes: {}, contacts: {} };
  var RS = window.RS = window.RS || {};
  var R = RS.render;
  var page = document.body.getAttribute("data-page") || "home";

  function load(key) { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return R.esc(s); }

  // ---------- Disclosure link (form preferred, email fallback) ----------
  var discloseMail = "mailto:" + C.contacts.email +
    "?subject=" + encodeURIComponent("AI tool use disclosure") +
    "&body=" + encodeURIComponent(
      "Branch:\nDepartment:\nAI tool used:\nApprox. date first used:\nHow often (once / a few times / regularly / still using):\n" +
      "What I used it for:\nHighest data level that went in (Red / Yellow / Green / not sure):\n" +
      "Uploaded files or connected it to email, OneDrive, Teams, or P21? (yes / no / not sure):\n" +
      "Signed up with my work email or phone? (yes / no / not sure):\n" +
      "Stopped using it? (yes / no):\nWant IT to review it for approval? (yes / no):\nAnything else:\n");
  var discloseHref = C.disclosureForm || discloseMail;
  var discloseAttrs = C.disclosureForm ? ' target="_blank" rel="noopener"' : "";
  var askHref = "mailto:" + C.contacts.email + "?subject=AI%20question";

  var I = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    core: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/>',
    tool: '<path d="M14.5 5.5a4 4 0 0 0 4.9 4.9L13 16.8 7.2 11z"/><path d="M4 20l5-5"/>',
    ref: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>',
    mig: '<path d="M4 8h14l-3.5-3.5"/><path d="M20 16H6l3.5 3.5"/>',
    ask: '<path d="M4 5h16v11H9l-5 4z"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4.5L17 13H5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    play: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5v5l4.5-2.5z"/>'
  };
  function icon(n) { return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[n] + "</svg>"; }

  // ---------- Header: logo, search, help actions ----------
  function buildHeader() {
    var header = document.createElement("header");
    header.className = "site-header";
    header.innerHTML =
      '<div class="header-inner">' +
        (page === "course" ? "" : '<button class="nav-toggle" type="button" aria-label="Menu" aria-expanded="false">' + icon("menu") + "</button>") +
        '<a class="brand" href="index.html" aria-label="AI Training home">' +
          '<img class="brand-logo" src="' + (C.logoUrl || "https://www.richardssupply.com/images/Header/NewLogo.jpg") + '" alt="Richards Supply Company" width="162" height="36">' +
          '<span class="brand-name">AI Training</span></a>' +
        '<div class="search" role="search"><label class="search-box">' + icon("search") +
          '<input type="search" id="site-search" placeholder="Search courses and lessons" autocomplete="off" aria-label="Search courses and lessons"></label>' +
          '<div class="search-results" id="search-results" hidden></div></div>' +
        '<div class="header-actions">' +
          '<a class="hdr-link" href="' + askHref + '">' + icon("ask") + "<span>Ask a question</span></a>" +
          '<a class="btn btn-sm btn-red" href="' + discloseHref + '"' + discloseAttrs + '>Report an AI tool</a></div>' +
      "</div>";
    document.body.insertBefore(header, document.body.firstChild);
    setupSearch(header);
  }

  // ---------- Left navigation (LinkedIn Learning style) ----------
  function buildSidebar() {
    if (page === "course") return;
    document.body.classList.add("has-sidebar");
    var nav = document.createElement("nav");
    nav.className = "sidebar"; nav.setAttribute("aria-label", "Main");
    function link(key, href, label, ic, extra) {
      var on = page === key;
      return '<a href="' + href + '"' + (on ? ' class="active" aria-current="page"' : "") + (extra || "") + ">" + icon(ic) + "<span>" + label + "</span></a>";
    }
    nav.innerHTML =
      link("home", "index.html", "Home", "home") +
      '<div class="side-label">Learn</div>' +
      link("core", "index.html#core", "Core training", "core") +
      link("tool", "index.html#tool", "Tool training", "tool") +
      '<div class="side-label">Resources</div>' +
      link("ref", "reference.html", "Quick reference", "ref") +
      link("mig", "migration.html", "Move to a company account", "mig") +
      link("rx", "../rx/", "RX Training Library", "play") +
      '<div class="side-label">Help</div>' +
      link("ask", askHref, "Ask a question", "ask") +
      link("disclose", discloseHref, "Report an AI tool", "flag", discloseAttrs) +
      '<div class="side-label">Popular topics</div><div class="side-topics" id="side-topics"></div>';
    document.body.insertBefore(nav, document.querySelector("main"));
    var t = document.querySelector(".nav-toggle");
    if (t) t.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      t.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  function fillTopics() {
    var box = document.getElementById("side-topics");
    if (!box) return;
    box.innerHTML = (C.skills || []).slice(0, 5).map(function (s) {
      return '<a href="course.html?id=' + encodeURIComponent(s.course) + "#slide-" + s.lesson + '">' + esc(s.label) + "</a>";
    }).join("");
  }

  function breadcrumb(label, target) {
    var main = target || document.querySelector("main");
    if (!main || page === "home") return;
    var crumb = document.createElement("nav");
    crumb.className = "breadcrumb";
    crumb.setAttribute("aria-label", "Breadcrumb");
    crumb.innerHTML = '<a href="index.html">Home</a><span>›</span>' + esc(label);
    main.insertBefore(crumb, main.firstChild);
  }

  function buildFooter() {
    var foot = document.createElement("footer");
    foot.className = "site";
    foot.innerHTML = "<span>Richards Supply · " + esc(C.policyVersion || "") + "</span>" +
      '<span>Questions: <a href="mailto:' + C.contacts.email + '">' + C.contacts.email + "</a> or the " + esc(C.contacts.helpDesk || "IT Help Desk") +
      ' · Photos from <a href="https://unsplash.com/license" target="_blank" rel="noopener">Unsplash</a> · <a href="admin.html">Admin</a></span>';
    (document.querySelector("main") || document.body).insertAdjacentElement("afterend", foot);
  }

  // ---------- Search ----------
  var CONTENT = null;
  function getContent() {
    if (CONTENT) return Promise.resolve(CONTENT);
    return fetch("content/trainings.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (d) { CONTENT = d; return d; });
  }
  function plain(s) { return String(s || "").replace(/<[^>]+>/g, " ").replace(/[*=\[\]{}]|\((https?:[^)]*)\)/g, " ").replace(/\s+/g, " "); }
  function blockText(b) {
    var parts = [b.html, b.text, b.caption, b.label, b.title];
    (b.items || []).forEach(function (x) { parts.push(typeof x === "string" ? x : x.text); });
    (b.cards || []).forEach(function (c) { parts.push(c.label, c.title, c.text); });
    (b.headers || []).forEach(function (h) { parts.push(h); });
    (b.rows || []).forEach(function (r) { parts.push(r.join(" ")); });
    ["red", "yellow", "green"].forEach(function (k) { if (b[k]) parts.push(b[k].rule, (b[k].items || []).join(" ")); });
    if (b.type === "columns") (b.columns || []).forEach(function (col) { (col.blocks || []).forEach(function (x) { parts.push(blockText(x)); }); });
    return plain(parts.filter(Boolean).join(" "));
  }
  function setupSearch(header) {
    var input = header.querySelector("#site-search"), box = header.querySelector("#search-results");
    var index = null;
    function build(d) {
      index = [];
      (d.courses || []).filter(function (c) { return c.status !== "draft"; }).forEach(function (c) {
        index.push({ kind: "Course", title: c.title, sub: plain(c.summary), href: "course.html?id=" + encodeURIComponent(c.id), text: (c.title + " " + plain(c.summary) + " " + plain(c.intro)).toLowerCase() });
        c.lessons.forEach(function (l, n) {
          index.push({ kind: "Lesson", title: l.title, sub: c.title + " · Lesson " + (n + 1), href: "course.html?id=" + encodeURIComponent(c.id) + "#slide-" + (n + 1),
            text: (l.title + " " + plain(l.heading) + " " + (l.blocks || []).map(blockText).join(" ")).toLowerCase() });
        });
      });
      [["Quick reference", "reference.html", "Ground rules, data levels, approved tools, printable"], ["Move to a company account", "migration.html", "Personal ChatGPT Claude account migration plan"]]
        .forEach(function (r) { index.push({ kind: "Resource", title: r[0], sub: "", href: r[1], text: (r[0] + " " + r[2]).toLowerCase() }); });
    }
    function run() {
      var q = input.value.trim().toLowerCase();
      if (!q || !index) { box.hidden = true; return; }
      var words = q.split(/\s+/);
      var hits = index.map(function (e) {
        var score = 0;
        words.forEach(function (w) { if (e.text.indexOf(w) >= 0) score += 1; if (e.title.toLowerCase().indexOf(w) >= 0) score += 3; });
        return { e: e, s: score };
      }).filter(function (x) { return x.s >= words.length; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 8);
      box.innerHTML = hits.length ? hits.map(function (h) {
        return '<a href="' + h.e.href + '"><span class="k">' + h.e.kind + "</span><b>" + esc(h.e.title) + "</b>" + (h.e.sub ? "<small>" + esc(h.e.sub.slice(0, 90)) + "</small>" : "") + "</a>";
      }).join("") : '<div class="none">No results for “' + esc(input.value.trim()) + "”</div>";
      box.hidden = false;
    }
    input.addEventListener("focus", function () { getContent().then(function (d) { if (!index) build(d); run(); }).catch(function () {}); });
    input.addEventListener("input", run);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { input.value = ""; box.hidden = true; }
      if (e.key === "Enter") { var a = box.querySelector("a"); if (a) location.href = a.href; }
    });
    document.addEventListener("click", function (e) { if (!e.target.closest(".search")) box.hidden = true; });
  }

  // ---------- Wiring for links and interactive blocks ----------
  function wire(root) {
    root = root || document;
    root.querySelectorAll("[data-quiz]").forEach(function (el) {
      var key = el.getAttribute("data-quiz");
      var url = el.getAttribute("data-quiz-url") || (C.quizzes || {})[key];
      if (url) {
        el.href = url; el.target = "_blank"; el.rel = "noopener";
        el.addEventListener("click", function () { save("rs-quiz-" + key, true); });
      } else {
        el.setAttribute("aria-disabled", "true");
        el.textContent = "Quiz link coming soon";
      }
    });
    root.querySelectorAll("[data-disclose]").forEach(function (el) {
      var mode = el.getAttribute("data-disclose");
      if (mode === "form" && C.disclosureForm) { el.href = C.disclosureForm; el.target = "_blank"; el.rel = "noopener"; }
      else if (mode === "form") el.href = discloseMail;
      else { el.href = discloseMail; if (!C.disclosureForm) el.style.display = "none"; }
    });
    root.querySelectorAll(".disclose-note").forEach(function (n) {
      n.innerHTML = "The disclosure form is the preferred way to report it. Email to <a href=\"mailto:" + C.contacts.email + "\">" + C.contacts.email + "</a> is also accepted.";
    });
    root.querySelectorAll(".sort-item").forEach(function (item) {
      if (item.getAttribute("data-wired")) return;
      item.setAttribute("data-wired", "1");
      var answer = item.getAttribute("data-answer"), fb = item.querySelector(".fb");
      item.querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () {
          item.querySelectorAll("button").forEach(function (x) { x.classList.remove("sel"); });
          b.classList.add("sel");
          var ok = b.getAttribute("data-level") === answer;
          item.classList.add("done"); item.classList.toggle("right", ok); item.classList.toggle("wrong", !ok);
          fb.innerHTML = (ok ? "<b>Right.</b> " : "<b>Not quite.</b> ") + esc(fb.getAttribute("data-why"));
        });
      });
    });
  }
  RS.wire = wire;

  // ---------- Progress ----------
  function progress(c) {
    var total = c.lessons.length;
    var seen = load("rs-seen-" + c.id) || [];
    var done = seen.filter(function (k) { return k < total; }).length;
    var quiz = !!load("rs-quiz-" + c.id);
    var state = quiz && done === total ? "done" : done === total && total ? "ready" : done > 0 ? "progress" : "new";
    return { total: total, done: done, pct: total ? Math.round(done / total * 100) : 0, quiz: quiz, state: state };
  }
  function fmtMin(m) { return m >= 60 ? Math.floor(m / 60) + "h " + (m % 60 ? (m % 60) + "m" : "") : m + "m"; }

  // ---------- Course player ----------
  function player(deck) {
    var id = deck.getAttribute("data-course");
    var slides = Array.prototype.slice.call(deck.querySelectorAll(".slide"));
    var lessonCount = slides.filter(function (s) { return s.getAttribute("data-kind") !== "quiz"; }).length;
    var outline = document.getElementById(deck.getAttribute("data-outline"));
    var where = deck.querySelector(".lesson-top .where");
    var durEl = deck.querySelector(".lesson-top .dur");
    var prev = deck.querySelector("[data-prev]");
    var next = deck.querySelector("[data-next]");
    var after = deck.getAttribute("data-after");
    var afterLabel = deck.getAttribute("data-after-label") || "Finish";
    var seen = load("rs-seen-" + id) || [];
    var heroBar = document.querySelector(".course-hero .bar i"), heroTxt = document.querySelector(".course-hero .prog-txt");
    var i = 0;
    function duration(s) { var m = s.getAttribute("data-minutes"); return m ? m + " min" : ""; }

    var list = document.createElement("ol");
    slides.forEach(function (s, n) {
      var isQuiz = s.getAttribute("data-kind") === "quiz";
      var li = document.createElement("li");
      if (isQuiz) li.className = "quiz-step";
      li.innerHTML = '<button type="button"><span class="mark">' + (isQuiz ? "?" : (n + 1)) + '</span><span>' +
        esc(s.getAttribute("data-title") || ("Lesson " + (n + 1))) + '</span><span class="dur">' + (isQuiz ? "" : duration(s)) + '</span></button>';
      li.querySelector("button").addEventListener("click", function () { go(n, true); closeOutline(); });
      list.appendChild(li);
    });
    outline.innerHTML = '<div class="outline-head"><h2>Contents <span class="outline-toggle">Show lessons</span></h2>' +
      '<div class="outline-progress"><span class="txt"></span><div class="bar"><i></i></div></div></div>';
    outline.appendChild(list);
    var items = list.querySelectorAll("li");
    var tgl = outline.querySelector(".outline-toggle");
    outline.querySelector(".outline-head").addEventListener("click", function () {
      var open = outline.classList.toggle("open");
      tgl.textContent = open ? "Hide lessons" : "Show lessons";
    });
    function closeOutline() { outline.classList.remove("open"); tgl.textContent = "Show lessons"; }
    function lessonsSeen() { return seen.filter(function (k) { return k < lessonCount; }).length; }

    function go(n, scroll) {
      i = Math.max(0, Math.min(slides.length - 1, n));
      slides.forEach(function (s, k) { s.classList.toggle("active", k === i); });
      if (seen.indexOf(i) < 0) { seen.push(i); save("rs-seen-" + id, seen); }
      items.forEach(function (li, k) {
        li.classList.toggle("current", k === i);
        li.classList.toggle("seen", seen.indexOf(k) >= 0 && k < lessonCount);
        if (k < lessonCount) li.querySelector(".mark").textContent = (seen.indexOf(k) >= 0 && k !== i) ? "✓" : (k + 1);
      });
      var done = lessonsSeen(), pct = lessonCount ? done / lessonCount * 100 : 0;
      outline.querySelector(".outline-progress .txt").textContent = done + " of " + lessonCount + " lessons viewed";
      outline.querySelector(".outline-progress .bar i").style.width = pct + "%";
      outline.querySelector(".outline-progress").classList.toggle("done", done === lessonCount);
      if (heroBar) { heroBar.style.width = pct + "%"; heroTxt.textContent = Math.round(pct) + "% complete"; }
      var isQuiz = slides[i].getAttribute("data-kind") === "quiz";
      where.innerHTML = isQuiz ? "<b>Final step:</b> Quiz" : "<b>Lesson " + (i + 1) + " of " + lessonCount + "</b>";
      durEl.textContent = isQuiz ? "" : duration(slides[i]);
      prev.setAttribute("aria-disabled", i === 0 ? "true" : "false");
      var last = i === slides.length - 1;
      var beforeQuiz = !last && slides[i + 1].getAttribute("data-kind") === "quiz";
      next.textContent = last ? afterLabel + " →" : beforeQuiz ? "Go to the quiz →" : "Next lesson →";
      next.setAttribute("data-last", last ? "1" : "0");
      if (history.replaceState) history.replaceState(null, "", location.pathname + location.search + "#slide-" + (i + 1));
      if (scroll) deck.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    prev.addEventListener("click", function () { go(i - 1, true); });
    next.addEventListener("click", function () {
      if (next.getAttribute("data-last") === "1") { if (after) location.href = after; }
      else go(i + 1, true);
    });
    document.addEventListener("keydown", function (e) {
      if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowRight" && i < slides.length - 1) go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
    });
    function fromHash() { var n = parseInt((location.hash.match(/slide-(\d+)/) || [])[1], 10); return isNaN(n) ? null : n - 1; }
    var start = fromHash();
    if (start === null) {
      start = 0;
      while (start < lessonCount && seen.indexOf(start) >= 0) start++;
      if (start >= slides.length) start = 0;
    }
    go(start);
    window.addEventListener("hashchange", function () { var n = fromHash(); if (n !== null && n !== i) go(n, true); });
  }

  function published(data) { return (data.courses || []).filter(function (c) { return c.status !== "draft"; }); }
  function typeLabel(c) { return c.type === "tool" ? "Tool training" : "Core training"; }

  // ---------- Course page ----------
  function renderCourse(data) {
    var params = new URLSearchParams(location.search);
    var id = params.get("id");
    var c = (data.courses || []).filter(function (x) { return x.id === id; })[0];
    var main = document.querySelector("main");
    if (!c || (c.status === "draft" && params.get("preview") !== "1")) {
      main.insertAdjacentHTML("beforeend", '<div class="page-head"><h1>Course not found</h1><p class="lede">This course doesn\'t exist or isn\'t published yet. <a href="index.html">Back to Home</a>.</p></div>');
      breadcrumb("Course not found");
      return;
    }
    document.title = c.title + " · AI Training";
    var list = published(data), pos = list.indexOf(c);
    var core = list.filter(function (x) { return x.type !== "tool"; });
    var nextCourse = list[pos + 1];
    var mins = R.totalMinutes(c), q = c.quiz || {}, p = progress(c);
    var eyebrow = typeLabel(c) + (c.type !== "tool" && core.indexOf(c) >= 0 ? " · Course " + (core.indexOf(c) + 1) + " of " + core.length : "") +
      (c.required ? " · Required" : "") + (c.audience ? " · " + esc(c.audience) : "");
    main.insertAdjacentHTML("beforeend",
      (c.status === "draft" ? '<div class="callout"><b>Draft preview.</b> Employees can\'t see this course until it\'s published.</div>' : "") +
      '<section class="course-hero">' + R.thumb(R.photoUrl(c.image, 1600, 500), { icon: c.icon, color: c.color, seed: c.id, wide: true }) +
      '<div class="course-hero-in"><nav class="breadcrumb on-dark"><a href="index.html">Home</a><span>›</span>' + esc(typeLabel(c)) + '</nav><p class="eyebrow">' + eyebrow + "</p><h1>" + esc(c.title) + "</h1>" +
      (c.intro ? '<p class="lede">' + R.rich(c.intro) + "</p>" : "") +
      '<div class="meta-row"><span>' + fmtMin(mins) + "</span><span>" + c.lessons.length + " lesson" + (c.lessons.length === 1 ? "" : "s") + "</span>" +
      (q.url || q.description ? "<span>Quiz at the end</span>" : "") + '<span class="prog"><span class="bar"><i style="width:' + p.pct + '%"></i></span><span class="prog-txt">' + p.pct + "% complete</span></span></div></div></section>" +
      '<div class="course-layout"><aside class="outline" id="outline" aria-label="Course contents"></aside>' +
      '<section class="lesson-panel primer" data-course="' + esc(c.id) + '" data-outline="outline" data-after="' +
        (nextCourse ? "course.html?id=" + encodeURIComponent(nextCourse.id) : "index.html") + '" data-after-label="' +
        esc(nextCourse ? "Next course: " + nextCourse.title : "Finish: back to Home") + '" aria-label="Lesson">' +
      '<div class="lesson-top"><span class="where"></span><span class="dur"></span></div><div class="slides">' +
      c.lessons.map(function (l, n) { return R.lesson(l, {}, n + 1, c); }).join("") +
      (q.url || q.description ? R.quiz(c) : "") +
      '</div><div class="lesson-nav"><button class="btn" type="button" data-prev>← Previous</button>' +
      '<button class="btn btn-red" type="button" data-next>Next lesson →</button></div></section></div>');
    wire(main);
    player(main.querySelector(".primer"));
  }

  // ---------- Home ----------
  function courseCard(c, n) {
    var p = progress(c), mins = R.totalMinutes(c);
    var badge = c.required ? '<span class="badge-on">Required</span>' : c.type === "tool" ? '<span class="badge-on">Tool</span>' : "";
    var status = { done: "Quiz opened", ready: "Ready for quiz", progress: p.pct + "% complete", "new": "" }[p.state];
    var href = "course.html?id=" + encodeURIComponent(c.id) + (p.state === "ready" ? "#slide-" + (p.total + 1) : "");
    return '<a class="ccard" href="' + href + '">' +
      R.thumb(R.photoUrl(c.image, 640, 360), { icon: c.icon, color: c.color, seed: c.id },
        badge + '<span class="dur-badge">' + fmtMin(mins) + "</span>" + (p.done ? '<span class="thumb-bar"><i style="width:' + p.pct + '%"></i></span>' : "")) +
      '<div class="ccard-body"><span class="kind">' + (n ? "Course " + n : "Course") + " · " + c.lessons.length + " lessons</span>" +
      "<h3>" + esc(c.title) + "</h3>" + (c.audience ? '<span class="by">For: ' + esc(c.audience) + "</span>" : "") +
      (status ? '<span class="st st-' + p.state + '">' + status + "</span>" : "") + "</div></a>";
  }
  function renderHome(data) {
    var list = published(data);
    var core = list.filter(function (c) { return c.type !== "tool"; });
    var tool = list.filter(function (c) { return c.type === "tool"; });
    var mins = core.reduce(function (s, c) { return s + R.totalMinutes(c); }, 0);
    var resume = list.filter(function (c) { var s = progress(c).state; return s === "progress" || s === "ready"; })[0];
    var nextUp = resume || core.filter(function (c) { return progress(c).state === "new"; })[0];
    var main = document.querySelector("main");
    var cta = nextUp
      ? '<a class="btn btn-red" href="course.html?id=' + encodeURIComponent(nextUp.id) + '">' + (resume ? "Continue: " : "Start: ") + esc(nextUp.title) + "</a>"
      : '<a class="btn btn-red" href="reference.html">Open the quick reference</a>';
    var skills = (C.skills || []).slice(0, 6);
    main.innerHTML =
      '<section class="hero">' +
        '<div class="hero-text"><p class="eyebrow">Richards Supply · AI Training</p><h1>Put AI to work, the Richards way.</h1>' +
        '<p class="lede">Short courses on using AI well and safely. Start with the core training, in order. ' + core.length + " courses · about " + mins + " minutes.</p>" +
        '<div class="btn-row">' + cta + '<a class="btn" href="#core">Browse courses</a></div></div>' +
        '<div class="hero-img">' + R.thumb(R.photoUrl(C.heroImage, 900, 600), { icon: "sparkles", color: "red", seed: "hero" }) + "</div>" +
      "</section>" +
      (skills.length ? '<section class="panel-sec skills-sec"><h2>Skills you\'ll build</h2><div class="skills">' + skills.map(function (s, k) {
        return '<a class="skill" href="course.html?id=' + encodeURIComponent(s.course) + "#slide-" + s.lesson + '"><span class="n">' + (k + 1) + "</span><b>" + esc(s.label) + '</b><span class="go">Explore →</span></a>';
      }).join("") + "</div></section>" : "") +
      '<section class="panel-sec" id="core"><div class="sec-head"><h2>Core training</h2><span class="muted">Required basics. Take these in order.</span></div>' +
      '<div class="cards">' + core.map(function (c, n) { return courseCard(c, n + 1); }).join("") + "</div></section>" +
      '<section class="panel-sec" id="tool"><div class="sec-head"><h2>Tool training</h2><span class="muted">How to use specific approved tools.</span></div>' +
      (tool.length ? '<div class="cards">' + tool.map(function (c) { return courseCard(c); }).join("") + "</div>"
        : '<div class="empty-card">' + R.art({ icon: "tools", color: "indigo", seed: "tools-empty" }) + '<div><h3>Tool courses are on the way</h3><p>Courses for specific tools, like Claude Enterprise and Pronto, will show up here when they\'re published.</p></div></div>') +
      "</section>" +
      '<section class="panel-sec"><div class="sec-head"><h2>Resources</h2></div><div class="cards">' +
        resCard("reference.html", "Quick reference", "Ground rules, data levels, and approved tools on one printable page.", "book", "blue") +
        resCard("migration.html", "Move to a company account", "Using a personal ChatGPT or Claude account for work? Here's how to move it.", "swap", "purple", R.photoUrl("https://images.unsplash.com/photo-1768839720936-87ce3adf2d08", 640, 360)) +
        resCard(discloseHref, "Report an AI tool", "Tell us about an unapproved tool or a mistake. Good-faith reports carry no discipline.", "flag", "orange") +
        resCard(askHref, "Ask a question", "Not sure if something's allowed? Ask before you guess.", "chat", "teal") +
      "</div></section>";
    if (location.hash) { var t = document.querySelector(location.hash); if (t) t.scrollIntoView(); }
  }
  function resCard(href, title, text, ic, color, photo) {
    return '<a class="ccard res" href="' + href + '"' + (href === discloseHref ? discloseAttrs : "") + ">" + R.thumb(photo || "", { icon: ic, color: color, seed: title }) +
      '<div class="ccard-body"><span class="kind">Resource</span><h3>' + esc(title) + "</h3><p>" + esc(text) + "</p></div></a>";
  }

  // ---------- Static pages: add artwork to the page header ----------
  function decorateStatic() {
    var head = document.querySelector(".page-head[data-art]");
    if (!head) return;
    var a = head.getAttribute("data-art").split(":");
    head.classList.add("with-art");
    head.insertAdjacentHTML("beforeend", '<div class="head-art">' + R.thumb(R.photoUrl(head.getAttribute("data-photo") || "", 800, 450), { icon: a[0], color: a[1], seed: a[0] }) + "</div>");
  }

  function loadError(err) {
    document.querySelector("main").insertAdjacentHTML("beforeend", '<div class="callout"><b>Couldn\'t load the courses.</b> Refresh the page, or email ' + esc(C.contacts.email) + " if it keeps happening.</div>");
    if (window.console) console.error(err);
  }

  // ---------- Boot ----------
  if (page === "admin") return;
  [["t1-primer", "training1", "training-1"], ["t2-primer", "training2", "training-2"]].forEach(function (m) {
    if (load("rs-seen-" + m[0]) && !load("rs-seen-" + m[2])) save("rs-seen-" + m[2], load("rs-seen-" + m[0]));
    if (load("rs-quiz-" + m[1]) && !load("rs-quiz-" + m[2])) save("rs-quiz-" + m[2], true);
  });
  buildHeader();
  buildSidebar();
  fillTopics();
  buildFooter();
  var labels = { ref: "Quick reference", mig: "Move to a company account" };
  if (page === "course") getContent().then(renderCourse).catch(loadError);
  else if (page === "home") getContent().then(renderHome).then(function () { wire(document); }).catch(loadError);
  else { decorateStatic(); breadcrumb(labels[page] || document.title); wire(document); }
})();
