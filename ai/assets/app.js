(function () {
  var C = window.RS_CONFIG || { quizzes: {}, contacts: {} };
  var page = document.body.getAttribute("data-page") || "home";

  var icons = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></svg>',
    t1: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0-3.5 10.9V17h7v-3.1A6 6 0 0 0 12 3Z"/><path d="M9.5 21h5"/></svg>',
    t2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v6.5c0 1.6 3.4 2.8 7.5 2.8s7.5-1.2 7.5-2.8V5.5"/><path d="M4.5 12v6.5c0 1.6 3.4 2.8 7.5 2.8s7.5-1.2 7.5-2.8V12"/></svg>',
    ref: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v17H5.5A1.5 1.5 0 0 1 4 18.5Z"/><path d="M20 4.5A1.5 1.5 0 0 0 18.5 3H13v17h5.5a1.5 1.5 0 0 0 1.5-1.5Z"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4.5 6v6c0 4.5 3.2 7.7 7.5 9 4.3-1.3 7.5-4.5 7.5-9V6Z"/><path d="m9 12 2 2 4-4"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 7 8.5-7"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.6L19.5 9l-5.7 1.6L12 16l-1.8-5.4L4.5 9l5.7-1.4z"/><circle cx="19" cy="18" r="2"/></svg>'
  };

  icons.flag = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>';

  var discloseMail = "mailto:" + C.contacts.email +
    "?subject=" + encodeURIComponent("AI tool use disclosure") +
    "&body=" + encodeURIComponent(
      "Branch:\nDepartment:\nAI tool used:\nApprox. date first used:\nHow often (once / a few times / regularly / still using):\n" +
      "What I used it for:\nHighest data level that went in (Red / Yellow / Green / not sure):\n" +
      "Uploaded files or connected it to email, OneDrive, Teams, or P21? (yes / no / not sure):\n" +
      "Signed up with my work email or phone? (yes / no / not sure):\n" +
      "Stopped using it? (yes / no):\nWant IT to review it for approval? (yes / no):\nAnything else:\n");
  var discloseHref = C.disclosureForm || discloseMail;

  // ---------- Chrome: top bar, rail, help, footer ----------
  var top = document.createElement("header");
  top.className = "topbar";
  top.innerHTML =
    '<div class="topbar-inner">' +
      '<a class="brand" href="index.html" aria-label="Richards Supply AI Training home">' +
        '<img class="brand-logo" src="' + (C.logoUrl || "https://www.richardssupply.com/images/Header/NewLogo.jpg") + '" alt="Richards Supply Company" width="423" height="94">' +
        '<span class="brand-name">AI Training</span>' +
      '</a>' +
      '<span class="topbar-tag"><span class="dot"></span>Employee field guide · Responsible AI</span>' +
    '</div>';
  document.body.insertBefore(top, document.body.firstChild);

  var links = [
    ["home", "index.html", "Home"],
    ["t1", "training-1.html", "Training 1 · AI at Richards"],
    ["t2", "training-2.html", "Training 2 · AI & Your Data"],
    ["ref", "reference.html", "Quick reference"]
  ];
  var rail = document.createElement("nav");
  rail.className = "rail";
  rail.setAttribute("aria-label", "Site");
  rail.innerHTML = links.map(function (l) {
    return '<a href="' + l[1] + '" class="' + (page === l[0] ? "active" : "") + '"' +
      (page === l[0] ? ' aria-current="page"' : "") + '>' + icons[l[0]] +
      '<span class="tip">' + l[2] + '</span></a>';
  }).join("") +
    '<span class="sep"></span>' +
    '<a href="mailto:' + C.contacts.email + '?subject=AI%20question">' + icons.mail + '<span class="tip">Ask a question</span></a>' +
    '<a href="' + discloseHref + '"' + (C.disclosureForm ? ' target="_blank" rel="noopener"' : "") + '>' + icons.flag + '<span class="tip">Disclose an unapproved tool</span></a>';
  document.body.insertBefore(rail, top.nextSibling);

  var fab = document.createElement("a");
  fab.className = "help-fab";
  fab.href = "mailto:" + C.contacts.email + "?subject=AI%20question";
  fab.innerHTML = icons.spark + "Ask before you guess";
  document.body.appendChild(fab);

  var foot = document.createElement("footer");
  foot.className = "site";
  foot.innerHTML = "<span>Richards Supply · " + (C.policyVersion || "") + "</span><span>Questions: " + C.contacts.email + "</span>";
  document.body.appendChild(foot);

  // ---------- Quiz links ----------
  document.querySelectorAll("[data-quiz]").forEach(function (el) {
    var url = (C.quizzes || {})[el.getAttribute("data-quiz")];
    if (url) {
      el.href = url;
      el.target = "_blank";
      el.rel = "noopener";
    } else {
      el.setAttribute("aria-disabled", "true");
      el.textContent = "Quiz link coming soon";
    }
  });

  // ---------- Unapproved-tool disclosure (form preferred, email accepted) ----------
  document.querySelectorAll("[data-disclose]").forEach(function (el) {
    var mode = el.getAttribute("data-disclose");
    if (mode === "form" && C.disclosureForm) {
      el.href = C.disclosureForm;
      el.target = "_blank";
      el.rel = "noopener";
    } else if (mode === "form") {
      el.href = discloseMail;
    } else {
      el.href = discloseMail;
      if (!C.disclosureForm) el.style.display = "none"; // the main button already emails
    }
  });

  // ---------- Progress memory (per viewer, optional) ----------
  function load(key) { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

  // ---------- Primer decks ----------
  document.querySelectorAll(".primer").forEach(function (deck) {
    var id = deck.id || "deck";
    var slides = Array.prototype.slice.call(deck.querySelectorAll(".slide"));
    var dotsEl = deck.querySelector(".dots");
    var countEl = deck.querySelector(".count");
    var bar = deck.querySelector(".progress i");
    var prev = deck.querySelector("[data-prev]");
    var next = deck.querySelector("[data-next]");
    var seen = load("rs-seen-" + id) || [];
    var i = 0;

    slides.forEach(function (s, n) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", "Go to slide " + (n + 1) + ": " + (s.getAttribute("data-title") || ""));
      b.addEventListener("click", function () { go(n); });
      dotsEl.appendChild(b);
    });
    var dots = dotsEl.querySelectorAll("button");

    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function go(n, focus) {
      i = Math.max(0, Math.min(slides.length - 1, n));
      slides.forEach(function (s, k) { s.classList.toggle("active", k === i); });
      if (seen.indexOf(i) < 0) { seen.push(i); save("rs-seen-" + id, seen); }
      dots.forEach(function (d, k) {
        d.classList.toggle("active", k === i);
        d.classList.toggle("seen", seen.indexOf(k) >= 0);
      });
      countEl.textContent = pad(i + 1) + " / " + pad(slides.length);
      bar.style.width = ((i + 1) / slides.length * 100) + "%";
      prev.setAttribute("aria-disabled", i === 0 ? "true" : "false");
      var last = i === slides.length - 1;
      next.textContent = last ? "Take the quiz ↓" : "Next →";
      next.setAttribute("data-last", last ? "1" : "0");
      if (focus) deck.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    prev.addEventListener("click", function () { go(i - 1); });
    next.addEventListener("click", function () {
      if (next.getAttribute("data-last") === "1") {
        var q = document.getElementById("quiz");
        if (q) q.scrollIntoView({ behavior: "smooth" });
      } else { go(i + 1); }
    });
    deck.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { go(i + 1); e.preventDefault(); }
      if (e.key === "ArrowLeft") { go(i - 1); e.preventDefault(); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.target.closest && e.target.closest("input, textarea, button, a")) return;
      var r = deck.getBoundingClientRect();
      if (r.top > window.innerHeight * 0.6 || r.bottom < 120) return;
      if (e.key === "ArrowRight") go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
    });
    function fromHash() {
      var n = parseInt((location.hash.match(/slide-(\d+)/) || [])[1], 10);
      return isNaN(n) ? null : n - 1;
    }
    var start = fromHash();
    go(start === null ? 0 : start);
    window.addEventListener("hashchange", function () {
      var n = fromHash();
      if (n !== null) go(n, true);
    });
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
