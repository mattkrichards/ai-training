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

  // ---------- Header ----------
  var links = [
    ["home", "index.html", "My courses"],
    ["ref", "reference.html", "Quick reference"],
    ["mig", "migration.html", "Move to a company account"]
  ];
  function buildHeader() {
    if (page === "admin") return;
    var header = document.createElement("header");
    header.className = "site-header";
    header.innerHTML =
      '<div class="header-inner">' +
        '<a class="brand" href="index.html" aria-label="AI Training home">' +
          '<img class="brand-logo" src="' + (C.logoUrl || "https://www.richardssupply.com/images/Header/NewLogo.jpg") + '" alt="Richards Supply Company" width="162" height="36">' +
          '<span class="brand-name">AI Training</span>' +
        '</a>' +
        '<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav">Menu</button>' +
        '<nav class="main-nav" id="main-nav" aria-label="Main">' +
          links.map(function (l) {
            var on = page === l[0] || (l[0] === "home" && page === "course");
            return '<a href="' + l[1] + '"' + (on ? ' class="active" aria-current="page"' : "") + '>' + l[2] + '</a>';
          }).join("") +
          '<a class="mobile-only" href="' + askHref + '">Ask a question</a>' +
          '<a class="mobile-only" href="' + discloseHref + '"' + discloseAttrs + '>Report an AI tool</a>' +
        '</nav>' +
        '<div class="header-actions">' +
          '<a class="btn btn-sm" href="' + askHref + '">Ask a question</a>' +
          '<a class="btn btn-sm btn-red" href="' + discloseHref + '"' + discloseAttrs + '>Report an AI tool</a>' +
        '</div>' +
      '</div>';
    document.body.insertBefore(header, document.body.firstChild);
    var toggle = header.querySelector(".menu-toggle");
    var nav = header.querySelector(".main-nav");
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  function breadcrumb(label) {
    var main = document.querySelector("main");
    if (!main || page === "home" || page === "admin") return;
    var crumb = document.createElement("nav");
    crumb.className = "breadcrumb";
    crumb.setAttribute("aria-label", "Breadcrumb");
    crumb.innerHTML = '<a href="index.html">My courses</a><span>›</span>' + esc(label);
    main.insertBefore(crumb, main.firstChild);
  }

  function buildFooter() {
    if (page === "admin") return;
    var foot = document.createElement("footer");
    foot.className = "site";
    foot.innerHTML = "<span>Richards Supply · " + esc(C.policyVersion || "") + "</span>" +
      '<span>Questions: <a href="mailto:' + C.contacts.email + '">' + C.contacts.email + "</a> or the " + esc(C.contacts.helpDesk || "IT Help Desk") +
      ' · <a href="admin.html">Admin</a></span>';
    document.body.appendChild(foot);
  }

  // ---------- Wiring for links and interactive blocks inside rendered content ----------
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
      if (mode === "form" && C.disclosureForm) {
        el.href = C.disclosureForm; el.target = "_blank"; el.rel = "noopener";
      } else if (mode === "form") {
        el.href = discloseMail;
      } else {
        el.href = discloseMail;
        if (!C.disclosureForm) el.style.display = "none";
      }
    });
    root.querySelectorAll(".disclose-note").forEach(function (n) {
      n.innerHTML = "The disclosure form is the preferred way to report it. Email to <a href=\"mailto:" + C.contacts.email + "\">" + C.contacts.email + "</a> is also accepted.";
    });
    root.querySelectorAll(".sort-item").forEach(function (item) {
      if (item.getAttribute("data-wired")) return;
      item.setAttribute("data-wired", "1");
      var answer = item.getAttribute("data-answer");
      var fb = item.querySelector(".fb");
      item.querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () {
          item.querySelectorAll("button").forEach(function (x) { x.classList.remove("sel"); });
          b.classList.add("sel");
          var ok = b.getAttribute("data-level") === answer;
          item.classList.add("done");
          item.classList.toggle("right", ok);
          item.classList.toggle("wrong", !ok);
          fb.innerHTML = (ok ? "<b>Right.</b> " : "<b>Not quite.</b> ") + esc(fb.getAttribute("data-why"));
        });
      });
    });
  }
  RS.wire = wire;

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
    outline.innerHTML =
      '<div class="outline-head"><h2>Course outline <span class="outline-toggle">Show lessons</span></h2>' +
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
      var done = lessonsSeen();
      outline.querySelector(".outline-progress .txt").textContent = done + " of " + lessonCount + " lessons viewed";
      outline.querySelector(".outline-progress .bar i").style.width = (lessonCount ? done / lessonCount * 100 : 0) + "%";
      outline.querySelector(".outline-progress").classList.toggle("done", done === lessonCount);

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
    function fromHash() {
      var n = parseInt((location.hash.match(/slide-(\d+)/) || [])[1], 10);
      return isNaN(n) ? null : n - 1;
    }
    var start = fromHash();
    if (start === null) {
      start = 0;
      while (start < lessonCount && seen.indexOf(start) >= 0) start++;
      if (start >= slides.length) start = 0;
    }
    go(start);
    window.addEventListener("hashchange", function () {
      var n = fromHash();
      if (n !== null && n !== i) go(n, true);
    });
  }

  // ---------- Content loading ----------
  function getContent() {
    return fetch("content/trainings.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }
  function published(data) {
    return (data.courses || []).filter(function (c) { return c.status !== "draft"; });
  }
  function typeLabel(c) { return c.type === "tool" ? "Tool training" : "Core training"; }

  function renderCourse(data) {
    var params = new URLSearchParams(location.search);
    var id = params.get("id");
    var all = data.courses || [];
    var c = all.filter(function (x) { return x.id === id; })[0];
    var main = document.querySelector("main");
    if (!c || (c.status === "draft" && params.get("preview") !== "1")) {
      breadcrumb("Course not found");
      main.insertAdjacentHTML("beforeend", '<div class="page-head"><h1>Course not found</h1><p class="lede">This course doesn\'t exist or isn\'t published yet. <a href="index.html">Back to My courses</a>.</p></div>');
      return;
    }
    document.title = c.title + " · AI Training";
    var list = published(data);
    var pos = list.indexOf(c);
    var core = list.filter(function (x) { return x.type !== "tool"; });
    var nextCourse = list[pos + 1];
    var mins = R.totalMinutes(c);
    var q = c.quiz || {};
    var eyebrow = typeLabel(c) + (c.type !== "tool" && core.indexOf(c) >= 0 ? " · Course " + (core.indexOf(c) + 1) + " of " + core.length : "") +
      (c.required ? " · Required" : "") + (c.audience ? " · " + esc(c.audience) : "");
    main.insertAdjacentHTML("beforeend",
      (c.status === "draft" ? '<div class="callout"><b>Draft preview.</b> Employees can\'t see this course until it\'s published.</div>' : "") +
      '<div class="page-head"><p class="eyebrow">' + eyebrow + '</p><h1>' + esc(c.title) + '</h1>' +
      (c.intro ? '<p class="lede">' + R.rich(c.intro) + "</p>" : "") +
      '<div class="meta-row"><span><b>About ' + mins + ' minutes</b></span><span><b>' + c.lessons.length + " lesson" + (c.lessons.length === 1 ? "" : "s") + "</b></span>" +
      (q.url || q.description ? "<span><b>Quiz</b> at the end</span>" : "") + "</div></div>" +
      '<div class="course-layout"><aside class="outline" id="outline" aria-label="Course outline"></aside>' +
      '<section class="lesson-panel primer" data-course="' + esc(c.id) + '" data-outline="outline" data-after="' +
        (nextCourse ? "course.html?id=" + encodeURIComponent(nextCourse.id) : "index.html") + '" data-after-label="' +
        esc(nextCourse ? "Next course: " + nextCourse.title : "Finish: back to My courses") + '" aria-label="Lesson">' +
      '<div class="lesson-top"><span class="where"></span><span class="dur"></span></div><div class="slides">' +
      c.lessons.map(function (l) { return R.lesson(l); }).join("") +
      (q.url || q.description ? R.quiz(c) : "") +
      '</div><div class="lesson-nav"><button class="btn" type="button" data-prev>← Previous</button>' +
      '<button class="btn btn-red" type="button" data-next>Next lesson →</button></div></section></div>');
    breadcrumb(c.title);
    wire(main);
    player(main.querySelector(".primer"));
  }

  function courseCard(c, n) {
    var count = c.lessons.length;
    return '<div class="course" data-course="' + esc(c.id) + '" data-lessons="' + count + '">' +
      '<div class="step-no">' + (c.type === "tool" ? '<span class="tool-badge">Tool</span>' : n) + "</div>" +
      '<div><h3><a href="course.html?id=' + encodeURIComponent(c.id) + '" style="color:inherit;text-decoration:none">' + esc(c.title) + "</a></h3>" +
      (c.summary ? "<p>" + R.rich(c.summary) + "</p>" : "") +
      '<div class="meta-row">' + (c.audience ? "<span>" + esc(c.audience) + "</span>" : "") + "<span>About " + R.totalMinutes(c) + " min</span><span>" +
      count + " lesson" + (count === 1 ? "" : "s") + ((c.quiz || {}).url ? " + quiz" : "") + "</span>" + (c.required ? '<span class="req">Required</span>' : "") + "</div></div>" +
      '<div class="cta"><span class="status">Not started</span><div class="bar"><i></i></div>' +
      '<span class="count muted" style="font-size:13px"></span><a class="btn btn-red" href="course.html?id=' + encodeURIComponent(c.id) + '">Start</a></div></div>';
  }

  function renderHome(data) {
    var list = published(data);
    var core = list.filter(function (c) { return c.type !== "tool"; });
    var tool = list.filter(function (c) { return c.type === "tool"; });
    var mins = core.reduce(function (s, c) { return s + R.totalMinutes(c); }, 0);
    var slot = document.getElementById("course-sections");
    var meta = document.getElementById("home-meta");
    if (meta) meta.innerHTML = "<span><b>" + core.length + " core course" + (core.length === 1 ? "" : "s") + "</b></span><span><b>About " + mins + " minutes</b></span><span>Your progress is saved on this device</span>";
    slot.innerHTML =
      '<section class="section"><h2>Core training</h2><p class="muted" style="margin:0">Required for everyone it applies to. Take these in order.</p>' +
      '<div class="course-list">' + core.map(function (c, n) { return courseCard(c, n + 1); }).join("") + "</div></section>" +
      '<section class="section"><h2>Tool training</h2><p class="muted" style="margin:0">How to use specific approved tools. Take the ones for the tools you use.</p>' +
      (tool.length ? '<div class="course-list">' + tool.map(function (c) { return courseCard(c); }).join("") + "</div>"
        : '<div class="card" style="margin-top:14px"><p>Tool courses (for example Claude or Pronto) will appear here when they\'re published.</p></div>') +
      "</section>";
    slot.querySelectorAll(".course[data-course]").forEach(function (el) {
      var cid = el.getAttribute("data-course");
      var seen = load("rs-seen-" + cid) || [];
      var total = parseInt(el.getAttribute("data-lessons"), 10) || 0;
      var done = seen.filter(function (k) { return k < total; }).length;
      var quiz = load("rs-quiz-" + cid);
      var status = el.querySelector(".status");
      var btn = el.querySelector(".cta .btn");
      el.querySelector(".bar i").style.width = (total ? done / total * 100 : 0) + "%";
      el.querySelector(".count").textContent = done + " of " + total + " lessons";
      if (quiz && done === total) {
        status.textContent = "Quiz opened"; status.className = "status done"; el.classList.add("complete");
        btn.textContent = "Review"; btn.classList.remove("btn-red");
      } else if (done === total && total) {
        status.textContent = "Ready for quiz"; status.className = "status progress";
        btn.textContent = "Take the quiz"; btn.href += "#slide-" + (total + 1);
      } else if (done > 0) {
        status.textContent = "In progress"; status.className = "status progress";
        btn.textContent = "Continue";
      }
    });
  }

  function loadError(err) {
    var main = document.querySelector("main");
    main.insertAdjacentHTML("beforeend", '<div class="callout"><b>Couldn\'t load the courses.</b> Refresh the page, or email ' + esc(C.contacts.email) + " if it keeps happening.</div>");
    if (window.console) console.error(err);
  }

  // ---------- Boot ----------
  // Carry over progress saved before courses moved to course.html
  [["t1-primer", "training1", "training-1"], ["t2-primer", "training2", "training-2"]].forEach(function (m) {
    if (load("rs-seen-" + m[0]) && !load("rs-seen-" + m[2])) save("rs-seen-" + m[2], load("rs-seen-" + m[0]));
    if (load("rs-quiz-" + m[1]) && !load("rs-quiz-" + m[2])) save("rs-quiz-" + m[2], true);
  });
  buildHeader();
  buildFooter();
  var labels = { ref: "Quick reference", mig: "Move to a company account" };
  if (page === "course") {
    getContent().then(renderCourse).catch(loadError);
  } else if (page === "home") {
    getContent().then(renderHome).catch(loadError);
    wire(document);
  } else if (page !== "admin") {
    breadcrumb(labels[page] || document.title);
    wire(document);
  }
})();
