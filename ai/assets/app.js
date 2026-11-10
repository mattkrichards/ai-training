(function () {
  var C = window.RS_CONFIG || { quizzes: {}, contacts: {} };
  var page = document.body.getAttribute("data-page") || "home";

  function load(key) { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

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

  // ---------- Header with plain text navigation ----------
  var links = [
    ["home", "index.html", "Home"],
    ["t1", "training-1.html", "Training 1"],
    ["t2", "training-2.html", "Training 2"],
    ["ref", "reference.html", "Quick reference"],
    ["mig", "migration.html", "Move to a company account"]
  ];
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
          return '<a href="' + l[1] + '"' + (page === l[0] ? ' class="active" aria-current="page"' : "") + '>' + l[2] + '</a>';
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

  // ---------- Breadcrumb ----------
  var main = document.querySelector("main");
  if (page !== "home" && main) {
    var here = links.filter(function (l) { return l[0] === page; })[0];
    var crumb = document.createElement("nav");
    crumb.className = "breadcrumb";
    crumb.setAttribute("aria-label", "Breadcrumb");
    crumb.innerHTML = '<a href="index.html">Home</a><span>›</span>' + esc(here ? here[2] : document.title);
    main.insertBefore(crumb, main.firstChild);
  }

  // ---------- Footer ----------
  var foot = document.createElement("footer");
  foot.className = "site";
  foot.innerHTML = "<span>Richards Supply · " + esc(C.policyVersion || "") + "</span>" +
    '<span>Questions: <a href="mailto:' + C.contacts.email + '">' + C.contacts.email + "</a> or the " + esc(C.contacts.helpDesk || "IT Help Desk") + "</span>";
  document.body.appendChild(foot);

  // ---------- Quiz links ----------
  document.querySelectorAll("[data-quiz]").forEach(function (el) {
    var key = el.getAttribute("data-quiz");
    var url = (C.quizzes || {})[key];
    if (url) {
      el.href = url; el.target = "_blank"; el.rel = "noopener";
      el.addEventListener("click", function () { save("rs-quiz-" + key, true); });
    } else {
      el.setAttribute("aria-disabled", "true");
      el.textContent = "Quiz link coming soon";
    }
  });

  // ---------- Disclosure buttons in page content ----------
  document.querySelectorAll("[data-disclose]").forEach(function (el) {
    var mode = el.getAttribute("data-disclose");
    if (mode === "form" && C.disclosureForm) {
      el.href = C.disclosureForm; el.target = "_blank"; el.rel = "noopener";
    } else if (mode === "form") {
      el.href = discloseMail;
    } else {
      el.href = discloseMail;
      if (!C.disclosureForm) el.style.display = "none"; // the main button already emails
    }
  });

  // ---------- Course player: outline + one lesson at a time ----------
  document.querySelectorAll(".primer").forEach(function (deck) {
    var id = deck.id || "deck";
    var slides = Array.prototype.slice.call(deck.querySelectorAll(".slide"));
    var lessonCount = slides.filter(function (s) { return s.getAttribute("data-kind") !== "quiz"; }).length;
    var outline = document.getElementById(deck.getAttribute("data-outline"));
    var where = deck.querySelector(".lesson-top .where");
    var durEl = deck.querySelector(".lesson-top .dur");
    var prev = deck.querySelector("[data-prev]");
    var next = deck.querySelector("[data-next]");
    var after = deck.getAttribute("data-after");       // URL for "finish" button
    var afterLabel = deck.getAttribute("data-after-label") || "Finish";
    var seen = load("rs-seen-" + id) || [];
    var i = 0;

    function duration(s) {
      var t = (s.querySelector(".tag") || {}).textContent || "";
      var m = t.match(/(\d+)\s*min/);
      return m ? m[1] + " min" : "";
    }

    // Build the outline
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
    var head = outline.querySelector(".outline-head");
    var tgl = outline.querySelector(".outline-toggle");
    head.addEventListener("click", function () {
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
        var mark = li.querySelector(".mark");
        if (k < lessonCount) mark.textContent = (seen.indexOf(k) >= 0 && k !== i) ? "✓" : (k + 1);
      });
      var done = lessonsSeen();
      outline.querySelector(".outline-progress .txt").textContent = done + " of " + lessonCount + " lessons viewed";
      outline.querySelector(".outline-progress .bar i").style.width = (done / lessonCount * 100) + "%";
      outline.querySelector(".outline-progress").classList.toggle("done", done === lessonCount);

      var isQuiz = slides[i].getAttribute("data-kind") === "quiz";
      where.innerHTML = isQuiz ? "<b>Final step:</b> Quiz" : "<b>Lesson " + (i + 1) + " of " + lessonCount + "</b>";
      durEl.textContent = isQuiz ? "" : duration(slides[i]);

      prev.setAttribute("aria-disabled", i === 0 ? "true" : "false");
      var last = i === slides.length - 1;
      var beforeQuiz = !last && slides[i + 1].getAttribute("data-kind") === "quiz";
      next.textContent = last ? afterLabel + " →" : beforeQuiz ? "Go to the quiz →" : "Next lesson →";
      next.setAttribute("data-last", last ? "1" : "0");
      if (history.replaceState) history.replaceState(null, "", "#slide-" + (i + 1));
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
      // Resume at the first lesson not yet viewed
      start = 0;
      while (start < lessonCount && seen.indexOf(start) >= 0) start++;
      if (start >= slides.length) start = 0;
    }
    go(start);
    window.addEventListener("hashchange", function () {
      var n = fromHash();
      if (n !== null && n !== i) go(n, true);
    });
  });

  // ---------- Home: course status ----------
  document.querySelectorAll(".course[data-deck]").forEach(function (c) {
    var seen = load("rs-seen-" + c.getAttribute("data-deck")) || [];
    var total = parseInt(c.getAttribute("data-lessons"), 10);
    var done = seen.filter(function (k) { return k < total; }).length;
    var quiz = load("rs-quiz-" + c.getAttribute("data-quiz-key"));
    var status = c.querySelector(".status");
    var btn = c.querySelector(".cta .btn");
    c.querySelector(".bar i").style.width = (done / total * 100) + "%";
    c.querySelector(".count").textContent = done + " of " + total + " lessons";
    if (quiz && done === total) {
      status.textContent = "Quiz opened"; status.className = "status done"; c.classList.add("complete");
      btn.textContent = "Review"; btn.classList.remove("btn-red");
    } else if (done === total) {
      status.textContent = "Ready for quiz"; status.className = "status progress";
      btn.textContent = "Take the quiz"; btn.href = btn.getAttribute("href").split("#")[0] + "#slide-" + (total + 1);
    } else if (done > 0) {
      status.textContent = "In progress"; status.className = "status progress";
      btn.textContent = "Continue";
    }
  });

  // ---------- Data sorter (Training 2) ----------
  document.querySelectorAll(".sort-item").forEach(function (item) {
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
        fb.innerHTML = (ok ? "<b>Right.</b> " : "<b>Not quite.</b> ") + fb.getAttribute("data-why");
      });
    });
  });
})();
