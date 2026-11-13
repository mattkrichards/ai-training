/* RX Fit Check — quick self-guided assessment for a Richards Xpress (RX) program.
   Static: answers stay in the visitor's browser (localStorage) until they copy, print or email them.
   Edit CONFIG for contacts and program language. Tier data comes from the RX Sales Rollout (Sept 2026). */

const CONFIG = {
  contactEmail: "mattk@richardssupply.com",   // where "Email my results" goes (swap for an RX inbox)
  branches: ["Waco", "Temple", "Fort Worth"],
  submitEndpoint: "",                          // optional: Retool Workflow webhook to log submissions
  tiers: [
    { id: 1, name: "Core RX Support", min: 15000, minLabel: "$15,000 / yr" },
    { id: 2, name: "Managed Replenishment", min: 36000, minLabel: "$36,000 / yr" },
    { id: 3, name: "Automated Vending", min: null, minLabel: "Vending justification form" }
  ],
  // [component, tier1, tier2, tier3]  true = included, "opt" = optional, false = not included
  tierRows: [
    ["Special pricing", true, true, true],
    ["Dedicated inventory", true, true, true],
    ["Barcoding and bins", true, true, true],
    ["Reporting", true, true, true],
    ["Scheduled deliveries", true, true, true],
    ["RX Specialist performs cycle counts", false, true, true],
    ["RX Specialist restocks inventory", false, true, true],
    ["Richards cabinet(s) / shelving", false, true, true],
    ["Quarterly business reviews", false, "opt", true],
    ["Vending machine program", false, false, true],
    ["Growth incentive bonus program", false, false, "opt"],
    ["Base growth rebate program", false, false, "opt"]
  ],
  difference: [
    ["Maximum uptime", "Critical products stay on hand before shortages turn into downtime."],
    ["Clear focus", "Less time counting, ordering and chasing deliveries. More time on the work."],
    ["Tuned to your operation", "Stock levels set from actual usage, so you're covered without excess cash on the shelf."],
    ["A coordinated pit crew", "Multiple Richards touchpoints watch your service and respond fast."],
    ["Real-time adjustments", "Levels change, products swap and new items get added without starting over."],
    ["Better visibility", "Usage reporting and business reviews show what's used and where to improve."]
  ]
};

/* ---------------- Reference data ---------------- */
const INDUSTRIES = ["Manufacturing – metal fab / machining","Manufacturing – food & beverage","Manufacturing – other","Oil & gas / energy","Utilities","Municipal / government","Construction / contractor","Agriculture","Aggregates / mining","Healthcare / institutional","Education","Warehouse / logistics","Automotive / fleet","Other"];
const EMP = ["1–24","25–49","50–99","100–249","250–499","500+"];
const EMP_PTS = [2,4,6,8,9,10];
const SHIFTS = ["1 shift","2 shifts","3 shifts","24/7"];
const MGMT = [
  ["Our own team manages it", "Someone on staff counts and reorders", 10],
  ["Another distributor manages it", "Vendor-managed inventory today", 5],
  ["Vending machines", "Dispensing for some or all items", 6],
  ["A mix of the above", "", 8],
  ["No formal process", "We buy as needed", 12]
];
const PHIL = ["Min/max levels","Two-bin / kanban","Reorder when empty","Buy per job / as needed","Crib with an attendant","Consignment","Scheduled bulk buys"];
const SPACE = ["Dedicated tool crib / storeroom","Open shelving","Bins on racks","Point-of-use carts or cabinets","Vending machines","Secured cage","Spread across work areas"];
const UNIQ = ["Multiple buildings","Multi-shift / 24-7","Restricted access / badging","Site safety orientation","Union environment","Hazmat / flammables storage","Seasonal swings","Remote or rural site"];
const PAINS = [
  ["Stockouts of everyday items",3],["Emergency runs to the store",3],["Time spent counting & ordering",3],
  ["Downtime waiting on supplies",3],["Too many POs / invoices",2],["Too many vendors",2],
  ["Cash tied up in overstock",2],["No visibility into usage",2],["Shrink / walk-off",2],
  ["Slow or unreliable delivery",2],["Inconsistent brands / substitutions",1],["Obsolete or dead stock",1]
];
const CATS = ["Safety & PPE","Abrasives","Cutting Tools & Drills","Fasteners & Hardware","Lubricants, Adhesives & Chemicals","Janitorial & Facility","Welding Supplies","Hand & Power Tools","Power Transmission & Bearings","Electrical","Hydraulics & Pneumatics","Packaging & Shipping","Material Handling & Storage"];
const BRANDS = ["Brand-locked on some items","Open to equivalents","Engineering / spec-approved list","Want help standardizing"];
// [label, monthly midpoint, points]  — breakpoints line up with the tier minimums ($1,250 & $3,000 / mo)
const SPEND = [["Under $1,250",800,3],["$1,250 – $3,000",2100,8],["$3,000 – $5,000",4000,12],["$5,000 – $10,000",7500,15],["$10,000 – $25,000",17500,18],["$25,000+",35000,20],["Not sure yet",0,0]];
const SKUS = [["Under 50",35],["50 – 150",100],["150 – 300",225],["300 – 600",450],["600+",750]];
const TIMELINE = [["ASAP",10],["Within 90 days",8],["This year",5],["Just exploring",2]];

/* ---------------- State ---------------- */
const KEY = "rxFit.v1";
const fresh = () => ({ step: 0, rep: false, d: {} });
let S = (() => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.d) return Object.assign(fresh(), s); } catch (e) {} return fresh(); })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const D = () => S.d;
const arr = k => Array.isArray(S.d[k]) ? S.d[k] : [];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt$ = n => "$" + Math.round(n).toLocaleString();
function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 1900); }

/* ---------------- Field helpers ---------------- */
function field(f) {
  if (f.rep && !S.rep) return "";
  if (f.show && !f.show()) return "";
  const v = S.d[f.k];
  const lab = `<label class="lbl"${f.t === "text" || f.t === "email" || f.t === "tel" || f.t === "select" || f.t === "area" ? ` for="f-${f.k}"` : ""}>${esc(f.label)}${f.rep ? '<span class="repflag">REP</span>' : ""}</label>`;
  const help = f.help ? `<div class="help">${esc(f.help)}</div>` : "";
  let c = "";
  if (["text", "email", "tel"].includes(f.t)) c = `<input id="f-${f.k}" type="${f.t}" data-k="${f.k}" value="${esc(v)}" placeholder="${esc(f.ph || "")}" autocomplete="${f.ac || "off"}">`;
  else if (f.t === "area") c = `<textarea id="f-${f.k}" data-k="${f.k}" placeholder="${esc(f.ph || "")}">${esc(v)}</textarea>`;
  else if (f.t === "select") c = `<select id="f-${f.k}" data-k="${f.k}"><option value="">Select…</option>${f.o.map(o => `<option ${v === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
  else if (f.t === "one") c = `<div class="chips" role="group">${f.o.map(o => `<button type="button" class="chip" data-k="${f.k}" data-v="${esc(o)}" data-one="1" aria-pressed="${v === o}">${esc(o)}</button>`).join("")}</div>`;
  else if (f.t === "many") c = `<div class="chips" role="group">${f.o.map(o => `<button type="button" class="chip" data-k="${f.k}" data-v="${esc(o)}" aria-pressed="${arr(f.k).includes(o)}">${esc(o)}</button>`).join("")}</div>`;
  else if (f.t === "tiles") c = `<div class="tiles" role="group">${f.o.map(o => `<button type="button" class="tile" data-k="${f.k}" data-v="${esc(o[0])}" data-one="1" aria-pressed="${v === o[0]}">${esc(o[0])}${o[1] ? `<small>${esc(o[1])}</small>` : ""}</button>`).join("")}</div>`;
  return `<div class="${f.full ? "full" : ""}">${lab}${c}${help}</div>`;
}
const panel = (n, eyebrow, title, sub, body) => `<section class="panel redtop"><div class="panel-head"><div class="panel-num">${n}</div><div><p class="eyebrow">${eyebrow}</p><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ""}</div></div>${body}</section>`;
const grid = fs => `<div class="grid">${fs.map(field).join("")}</div>`;

/* ---------------- Steps ---------------- */
const STEPS = [
  { t: "Start", r: () => `
    <section class="hero">
      <img src="img/hero.jpg" alt="RX Specialist restocking a Richards Xpress cabinet on a machining floor" loading="eager">
      <div class="hero-in">
        <p class="eyebrow">RX Fit Check · Richards Xpress</p>
        <h1>Your operation can't afford to <em>slow down.</em></h1>
        <p class="lede">${S.rep ? "Walk through this with the customer. In about five minutes you'll have an RX fit score, a recommended service tier and a starting scope to bring into the walkthrough." : "Answer a few questions about how you stock supplies today. You'll see how a Richards Xpress program would keep your site fueled, tuned and running at full speed."}</p>
        <div class="cta"><button class="btn btn-hot" type="button" data-go="1">Start the fit check</button><span class="time">About 5 minutes · 4 short steps</span></div>
      </div>
    </section>
    <h2 class="eyebrow" style="margin:6px 0 10px">The Richards Xpress difference</h2>
    <div class="diff">${CONFIG.difference.map(d => `<div><b>${esc(d[0])}</b><span>${esc(d[1])}</span></div>`).join("")}</div>
    <div class="victory"><b>Built for Victory Lane</b><span>MORE UPTIME · MORE THROUGHPUT · MORE PROFITABILITY</span></div>` },

  { t: "Company", r: () => panel(1, "Step 1 of 4", "Your company", S.rep ? "Who we're talking to and where they run." : "Tell us about this location.", grid([
    { k: "company", label: "Company name", t: "text", ac: "organization" },
    { k: "contact", label: "Your name", t: "text", ac: "name" },
    { k: "title", label: "Title / role", t: "text", ph: "e.g. Maintenance Manager" },
    { k: "email", label: "Email", t: "email", ac: "email" },
    { k: "phone", label: "Phone", t: "tel", ac: "tel" },
    { k: "city", label: "Location (city)", t: "text" },
    { k: "existing", label: "Do you buy from Richards Supply today?", t: "one", o: ["Yes", "No", "Not sure"] },
    { k: "custId", label: "Richards customer # (if you know it)", t: "text", show: () => S.d.existing === "Yes" },
    { k: "industry", label: "Industry", t: "select", o: INDUSTRIES },
    { k: "branch", label: "Nearest Richards branch", t: "one", o: [...CONFIG.branches, "Not sure"] },
    { k: "employees", label: "Employees at this location", t: "one", o: EMP },
    { k: "shifts", label: "Operating schedule", t: "one", o: SHIFTS },
    { k: "repName", label: "Richards rep", t: "text", rep: true },
    { k: "repNotes", label: "Rep notes", t: "area", rep: true, full: true, ph: "Relationship context, competitor on site, who else is involved…" }
  ])) },

  { t: "Today", r: () => panel(2, "Step 2 of 4", "How it works today", "Who manages inventory, how it gets reordered, and what the space looks like.", grid([
    { k: "mgmt", label: "Who manages your MRO supplies today?", t: "tiles", o: MGMT, full: true },
    { k: "competitor", label: "Which distributor?", t: "text", full: true, show: () => S.d.mgmt === MGMT[1][0] || S.d.mgmt === MGMT[3][0], help: "If you know when that agreement renews, add it here." },
    { k: "phil", label: "How do you decide when to reorder? Pick all that apply.", t: "many", o: PHIL, full: true },
    { k: "space", label: "Storage and equipment setup. Pick all that apply.", t: "many", o: SPACE, full: true },
    { k: "skus", label: "About how many different items do you keep on hand?", t: "one", o: SKUS.map(s => s[0]) },
    { k: "timeline", label: "Timing for a change", t: "one", o: TIMELINE.map(t => t[0]) },
    { k: "uniq", label: "Anything unique about the site?", t: "many", o: UNIQ, full: true },
    { k: "uniqNotes", label: "Other key details", t: "area", full: true, ph: "Layout quirks, access rules, how receiving works…" }
  ])) },

  { t: "Needs", r: () => panel(3, "Step 3 of 4", "What's slowing you down", "Pick everything that applies, then the one that matters most.", grid([
    { k: "pains", label: "Pain points", t: "many", o: PAINS.map(p => p[0]), full: true },
    { k: "topPain", label: "Biggest priority", t: "select", o: arr("pains").length ? arr("pains") : PAINS.map(p => p[0]) },
    { k: "decision", label: "Who else weighs in on this decision?", t: "text", ph: "e.g. Plant manager, purchasing, safety" },
    { k: "goals", label: "What would a win look like six months from now?", t: "area", full: true, ph: "e.g. No more weekend runs for gloves, one invoice a month, usage by department" }
  ])) },

  { t: "Categories", r: () => panel(4, "Step 4 of 4", "Categories, brands & spend", "What you'd want covered, and roughly what you spend on it each month across all suppliers.", grid([
    { k: "cats", label: "Categories to include", t: "many", o: CATS, full: true },
    { k: "brandPref", label: "Brand approach", t: "many", o: BRANDS, full: true },
    { k: "brands", label: "Must-have brands or specs", t: "area", full: true, ph: "e.g. a specific glove, an approved abrasive brand, a lubricant your engineers specify" },
    { k: "spend", label: "Estimated monthly spend on these categories", t: "one", o: SPEND.map(s => s[0]), full: true, help: "A best guess is fine. Include what you buy from every supplier, not just Richards." }
  ])) },

  { t: "Results", r: renderResults }
];

/* ---------------- Scoring ---------------- */
function monthly() { const s = SPEND.find(x => x[0] === S.d.spend); return s ? s[1] : 0; }
function score() {
  const d = S.d, sp = SPEND.find(x => x[0] === d.spend);
  const spendPts = sp ? sp[2] : 0;
  const painPts = Math.min(20, Math.round(arr("pains").reduce((s, p) => s + ((PAINS.find(x => x[0] === p) || [0, 0])[1]), 0) * 1.4));
  const mgmtPts = (MGMT.find(m => m[0] === d.mgmt) || [0, 0, 0])[2];
  const empPts = EMP_PTS[EMP.indexOf(d.employees)] || 0;
  const opp = Math.min(60, Math.round((spendPts + painPts + mgmtPts + empPts) * 60 / 62));
  const space = arr("space");
  const spacePts = space.some(x => /crib|shelving|racks|cage|carts/i.test(x)) ? 10 : space.length ? 5 : 0;
  const catPts = Math.min(10, Math.round(arr("cats").length * 1.7));
  const tPts = (TIMELINE.find(t => t[0] === d.timeline) || [0, 0])[1];
  const relPts = Math.min(10, (d.existing === "Yes" ? 5 : 0) + (d.contact && (d.email || d.phone) ? 3 : 0) + (d.decision ? 2 : 0));
  const ready = Math.min(40, spacePts + catPts + tPts + relPts);
  const total = opp + ready;
  const band = total >= 75 ? ["Strong RX fit", "#1f7a46"] : total >= 55 ? ["Good RX fit", "#d3271d"] : total >= 35 ? ["Worth exploring", "#946200"] : ["Early stage", "#687078"];
  return { total, opp, ready, band };
}
function vendingSignal() { return S.d.mgmt === MGMT[2][0] || arr("space").includes("Vending machines"); }
function tier() {
  const m = monthly(), yr = m * 12, d = S.d;
  const countPain = arr("pains").includes("Time spent counting & ordering") || d.topPain === "Time spent counting & ordering";
  if (!m) return { id: 0, title: "Tier set after a usage review", why: "Add an estimate of monthly spend and we'll point to a tier. Your rep confirms it with a usage review either way." };
  if (yr >= 36000 && vendingSignal()) return { id: 3, title: "Automated Vending", also: 2, why: "Your spend supports full managed replenishment, and you already use or want vending. Tier 3 adds the vending machine program on top of Tier 2 service." + (S.rep ? " Requires the vending justification form." : "") };
  if (yr >= 36000) return { id: 2, title: "Managed Replenishment", also: vendingSignal() || arr("pains").includes("Shrink / walk-off") ? 3 : 0, why: "Your spend supports a full pit-crew program: an RX Specialist counts, restocks and keeps your Richards cabinets and shelving tuned to actual usage." };
  if (yr >= 15000) return { id: 1, title: "Core RX Support", also: countPain ? 2 : 0, why: "Dedicated inventory, barcoded bins, scheduled deliveries and reporting at special pricing." + (countPain ? " Counting time is a top pain point, so Tier 2 (RX Specialist counts and restocks) is worth a look as spend grows." : "") };
  return { id: 0, below: true, title: "Let's find the right starting point", why: S.rep ? `Stated spend (~${fmt$(yr)}/yr) is below the Tier 1 minimum of $15,000/yr. Look for categories to consolidate with Richards to reach it.` : "Programs are sized to spend. Your rep can look at which categories to bring together so RX makes sense for your site." };
}
function cadence() {
  const m = monthly(), sk = (SKUS.find(x => x[0] === S.d.skus) || [0, 0])[1];
  if (m >= 10000 || sk >= 300 || S.d.shifts === "24/7") return "Weekly";
  if (m >= 3000 || sk >= 150) return "Every 2 weeks";
  return "Monthly";
}
function starterCats() {
  const pri = ["Safety & PPE", "Abrasives", "Cutting Tools & Drills", "Fasteners & Hardware", "Lubricants, Adhesives & Chemicals", "Janitorial & Facility", "Welding Supplies"];
  return arr("cats").slice().sort((a, b) => (pri.indexOf(a) < 0 ? 99 : pri.indexOf(a)) - (pri.indexOf(b) < 0 ? 99 : pri.indexOf(b)));
}
function watchouts() {
  const w = [], d = S.d;
  if (d.mgmt === MGMT[1][0]) w.push(`Another distributor manages inventory today${d.competitor ? " (" + d.competitor + ")" : ""}. Learn the terms, renewal date and what isn't working before proposing a switch.`);
  if (vendingSignal()) w.push("Vending is in play. Decide which items stay in vending (high-value, controlled) and which move to RX bins (high-volume consumables). Tier 3 needs the vending justification form.");
  if (arr("brandPref").some(b => /locked|approved/i.test(b))) w.push("Brand or spec restrictions: capture the approved list before building the agreement.");
  if (arr("uniq").some(u => /badging|orientation/i.test(u))) w.push("Site access: plan badging, orientation and service windows for the RX Specialist before go-live.");
  if (arr("uniq").includes("Multiple buildings")) w.push("Multiple buildings: map bin locations per area in the agreement so counts and usage reporting line up.");
  if (arr("uniq").includes("Hazmat / flammables storage")) w.push("Hazmat / flammables: confirm storage rules before stocking chemicals and aerosols.");
  const t = tier(); if (t.below) w.push("Below Tier 1 minimum on stated spend. Validate spend across all suppliers; it's often understated.");
  if (d.timeline === "Just exploring") w.push("No firm timeline. Offer the site walkthrough as a low-commitment next step.");
  return w;
}

/* ---------------- Results ---------------- */
function gaugeSVG() {
  const cx = 150, cy = 160, R = 118;
  const pt = (v, r) => { const a = (210 - 2.4 * v) * Math.PI / 180; return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
  const arc = (v0, v1, r) => { const [x0, y0] = pt(v0, r), [x1, y1] = pt(v1, r); return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${(v1 - v0) * 2.4 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
  let ticks = "";
  for (let v = 0; v <= 100; v += 5) {
    const major = v % 10 === 0, [x0, y0] = pt(v, R - (major ? 16 : 9)), [x1, y1] = pt(v, R - 2);
    ticks += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="${v >= 75 ? "#d3271d" : "#fff"}" stroke-width="${major ? 3 : 1.5}" opacity="${major ? 1 : .6}"/>`;
    if (major && v % 20 === 0) { const [tx, ty] = pt(v, R - 32); ticks += `<text x="${tx.toFixed(1)}" y="${(ty + 5).toFixed(1)}" fill="#bbb" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="700" font-size="15" text-anchor="middle">${v}</text>`; }
  }
  return `<svg class="gauge" viewBox="0 0 300 230" role="img" aria-label="RX fit score gauge">
    <path d="${arc(0, 100, R + 8)}" stroke="rgba(255,255,255,.12)" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="${arc(75, 100, R + 8)}" stroke="#d3271d" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${ticks}
    <g class="needle" id="needle" style="transform:rotate(-120deg)"><path d="M147 160 L150 58 L153 160 Z" fill="#d3271d"/><circle cx="150" cy="160" r="11" fill="#1b1d20" stroke="#fff" stroke-width="2.5"/></g>
  </svg>`;
}
function renderResults() {
  const d = S.d, sc = score(), t = tier(), m = monthly(), cad = cadence(), sc2 = starterCats();
  const sk = (SKUS.find(x => x[0] === d.skus) || [0, 0])[1];
  const pains = arr("pains"), top = d.topPain || pains[0];
  const cell = v => v === true ? '<td class="c yes">✓</td>' : v === "opt" ? '<td class="c">Optional</td>' : '<td class="c no">—</td>';
  const on = id => (id === t.id ? "col-on" : "");
  let h = `<section class="panel res-top">
    <div class="gauge-wrap">${gaugeSVG()}<div class="gauge-val"><b id="gaugeNum">0</b><span>RX FIT SCORE</span></div></div>
    <div class="res-sum">
      <span class="band" style="background:${sc.band[1]};color:#fff">${sc.band[0]}</span>
      <h2>${esc(d.company || "Your operation")}${d.city ? " · " + esc(d.city) : ""}</h2>
      <div class="meta">${[d.industry, d.employees && d.employees + " employees", d.shifts].filter(Boolean).map(esc).join(" · ") || "Fill in the earlier steps for a complete picture."}</div>
      <div class="meters">
        <div class="meter"><div class="t"><span>Opportunity</span><span>${sc.opp}/60</span></div><div class="tr"><i data-w="${sc.opp / 60 * 100}"></i></div></div>
        <div class="meter r"><div class="t"><span>Readiness</span><span>${sc.ready}/40</span></div><div class="tr"><i data-w="${sc.ready / 40 * 100}"></i></div></div>
      </div>
      <p class="why">Opportunity weighs spend, pain points, today's process and site size. Readiness weighs space, category fit, timing and who's involved.</p>
    </div></section>`;

  h += `<section class="panel"><div class="panel-head"><div class="panel-num">RX</div><div><p class="eyebrow">Recommended service tier</p><h2>Your starting lineup</h2></div></div>
    <div class="tier-rec">${t.id ? `<div class="tier-badge"><small>TIER</small><b>${t.id}</b></div>` : `<div class="tier-badge"><small>TIER</small><b>?</b></div>`}
      <div><h3>${esc(t.title)}</h3><p>${esc(t.why)}</p>${t.also ? `<p class="muted" style="font-size:14px">Also worth discussing: Tier ${t.also}, ${esc(CONFIG.tiers[t.also - 1].name)}.</p>` : ""}</div></div>
    <div class="tbl-wrap"><table><thead><tr><th>Program component</th>${CONFIG.tiers.map(x => `<th class="c ${on(x.id)}">Tier ${x.id}<small>${esc(x.name)}</small></th>`).join("")}</tr></thead><tbody>
      ${S.rep ? `<tr><td><b>Minimum annual spend</b> <span class="repflag">REP</span></td>${CONFIG.tiers.map(x => `<td class="c ${on(x.id)}">${esc(x.minLabel)}</td>`).join("")}</tr>` : ""}
      ${CONFIG.tierRows.map(r => `<tr><td>${esc(r[0])}</td>${[1, 2, 3].map(i => cell(r[i]).replace('class="c', `class="c ${on(i)}`)).join("")}</tr>`).join("")}
    </tbody></table></div></section>`;

  h += `<section class="panel"><p class="eyebrow">Starting scope</p><h2 style="font:700 26px var(--cond);margin-bottom:14px">${S.rep ? "Confirm on the site walkthrough" : "Your rep confirms this with you on a site walkthrough"}</h2>
    <div class="kpis">
      <div class="kpi"><div class="l">Monthly spend in scope</div><div class="v">${esc(d.spend && d.spend !== "Not sure yet" ? d.spend : "TBD")}</div><div class="s">${m ? "≈ " + fmt$(m * 12) + " a year" : "estimate"}</div></div>
      <div class="kpi"><div class="l">Est. items / bins</div><div class="v">${sk ? "~" + sk : "TBD"}</div><div class="s">barcoded RX bins</div></div>
      <div class="kpi"><div class="l">Service rhythm</div><div class="v">${cad}</div><div class="s">scheduled deliveries${t.id >= 2 ? " + Specialist visits" : ""}</div></div>
      <div class="kpi"><div class="l">Servicing branch</div><div class="v">${esc(d.branch && d.branch !== "Not sure" ? d.branch : "TBD")}</div><div class="s">local stock, local people</div></div>
    </div></section>`;

  h += `<div class="cols">
    <section class="panel"><p class="eyebrow">Start with these categories</p>${sc2.length ? `<ul class="list">${sc2.map((c, i) => `<li class="${i < 3 ? "top" : "dim"}">${esc(c)}${i < 3 ? "" : " · later phase"}</li>`).join("")}</ul>` : '<p class="muted">Pick categories in step 4 to see a starting set.</p>'}</section>
    <section class="panel"><p class="eyebrow">What you told us matters most</p>${pains.length ? `<ul class="list">${top ? `<li class="top">${esc(top)} · top priority</li>` : ""}${pains.filter(p => p !== top).slice(0, 5).map(p => `<li>${esc(p)}</li>`).join("")}</ul>` : '<p class="muted">No pain points selected.</p>'}</section>
  </div>`;

  if (S.rep) {
    const W = watchouts();
    h += `<section class="panel" style="margin-top:18px"><p class="eyebrow">Watchouts <span class="repflag">REP</span></p>${W.length ? `<ul class="list">${W.map(w => `<li>${esc(w)}</li>`).join("")}</ul>` : '<p class="muted">Nothing flagged.</p>'}
      <p class="note" style="margin-top:12px"><b>Scorecard targets once live:</b> fill rate 98%+, zero stockouts, service completion 98%+, sales at or above the tier minimum.</p></section>`;
  }

  h += `<div class="photo-band" style="margin-top:18px"><img src="img/line.jpg" alt="Production line with an RX Specialist servicing a Richards Xpress cabinet" loading="lazy"><div><b>Stay fueled, tuned and <em>in the race.</em></b><p>We track fill rate, stockouts and on-time service, and adjust as your operation changes.</p></div></div>`;

  h += `<section class="panel"><p class="eyebrow">What happens next</p><h2 style="font:700 26px var(--cond);margin-bottom:14px">From fit check to go-live</h2>
    <ol class="road">
      <li><b>Site walkthrough</b><span>An RX team member reviews your space, points of use and access.</span></li>
      <li><b>Usage review</b><span>${d.existing === "Yes" ? "We pull your Richards history and add" : "We review"} what you buy from other suppliers to size the program.</span></li>
      <li><b>RX agreement</b><span>Items, bin locations and min/max levels, set to your actual usage. You review and sign.</span></li>
      <li><b>Setup & go-live</b><span>Stock levels set, bins barcoded, first stock delivered, ${cad.toLowerCase()} service starts.</span></li>
      <li><b>Tune & review</b><span>Usage reporting and ${t.id >= 2 ? "quarterly business reviews" : "regular check-ins"} keep levels right.</span></li>
    </ol></section>`;

  h += `<section class="panel noprint"><p class="eyebrow">Save & share</p>
    <div class="btn-row">
      <button class="btn btn-red" type="button" data-act="email">Email my results to Richards</button>
      <button class="btn btn-dark" type="button" data-act="copy">Copy summary</button>
      <button class="btn" type="button" data-act="print">Print / save PDF</button>
      ${CONFIG.submitEndpoint ? `<button class="btn" type="button" data-act="submit">Submit</button>` : ""}
      <button class="btn" type="button" data-act="reset" id="resetBtn">Start over</button>
    </div>
    <p class="help" style="margin-top:10px">Your answers are saved only in this browser. Emailing opens your mail app with the summary filled in${CONFIG.contactEmail ? ` (to ${esc(CONFIG.contactEmail)})` : ""}.</p></section>`;
  return h;
}
function animateResults() {
  const sc = score();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const n = $("#needle"); if (n) n.style.transform = `rotate(${-120 + sc.total * 2.4}deg)`;
    document.querySelectorAll(".meter .tr i").forEach(i => i.style.width = i.dataset.w + "%");
    const el = $("#gaugeNum"); if (!el) return;
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { el.textContent = sc.total; return; }
    const t0 = performance.now(), dur = 1250;
    const tick = now => { const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(sc.total * e); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }));
}

/* ---------------- Summary / export ---------------- */
function summary() {
  const d = S.d, sc = score(), t = tier();
  const L = [
    "RX FIT CHECK · Richards Xpress",
    `${d.company || "—"}${d.city ? " · " + d.city : ""}`,
    `Contact: ${[d.contact, d.title, d.email, d.phone].filter(Boolean).join(" · ") || "—"}`,
    `Industry: ${d.industry || "—"} · Employees: ${d.employees || "—"} · ${d.shifts || ""}`,
    `Richards customer: ${d.existing || "—"}${d.custId ? " (#" + d.custId + ")" : ""} · Nearest branch: ${d.branch || "—"}`,
    "",
    `RX FIT SCORE: ${sc.total}/100 · ${sc.band[0]} (Opportunity ${sc.opp}/60, Readiness ${sc.ready}/40)`,
    `Recommended: ${t.id ? "Tier " + t.id + " – " + t.title : t.title}${t.also ? " (also consider Tier " + t.also + ")" : ""}`,
    `Monthly spend in scope: ${d.spend || "—"} · Items: ${d.skus || "—"} · Service rhythm: ${cadence()}`,
    `Start with: ${starterCats().slice(0, 3).join(", ") || "—"}`,
    "",
    `Today: ${d.mgmt || "—"}${d.competitor ? " (" + d.competitor + ")" : ""}`,
    `Reorder method: ${arr("phil").join(", ") || "—"}`,
    `Space: ${arr("space").join(", ") || "—"}`,
    `Site: ${arr("uniq").join(", ") || "—"}${d.uniqNotes ? " | " + d.uniqNotes : ""}`,
    `Top priority: ${d.topPain || arr("pains")[0] || "—"}`,
    `Pain points: ${arr("pains").join(", ") || "—"}`,
    `Categories: ${arr("cats").join(", ") || "—"}`,
    `Brands: ${arr("brandPref").join(", ") || "—"}${d.brands ? " | " + d.brands : ""}`,
    `Timeline: ${d.timeline || "—"} · Decision makers: ${d.decision || "—"}`,
    d.goals ? `Success in 6 months: ${d.goals}` : ""
  ];
  if (S.rep) { const W = watchouts(); if (W.length) L.push("", "WATCHOUTS:", ...W.map(w => "  - " + w)); if (d.repName) L.push("", "Rep: " + d.repName); if (d.repNotes) L.push("Rep notes: " + d.repNotes); }
  return L.filter((x, i) => x !== "" || L[i - 1] !== "").join("\n");
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast("Summary copied"); }
  catch (e) { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); toast("Summary copied"); } catch (_) { toast("Copy blocked. Select and copy manually."); } ta.remove(); }
}

/* ---------------- Navigation & render ---------------- */
let lastStep = S.step;
function go(i) { S.step = Math.max(0, Math.min(STEPS.length - 1, i)); save(); render(); window.scrollTo({ top: 0, behavior: "smooth" }); }
function renderNav() {
  const nav = $("#steps");
  nav.querySelectorAll("button").forEach(b => b.remove());
  STEPS.forEach((s, j) => {
    const b = document.createElement("button");
    b.type = "button"; b.dataset.go = j;
    b.className = j === S.step ? "on" : j < S.step ? "done" : "";
    if (j === S.step) b.setAttribute("aria-current", "step");
    b.innerHTML = `<span class="n">${j === 0 ? "▸" : j === STEPS.length - 1 ? "★" : j}</span><span class="t">${s.t}</span>`;
    nav.appendChild(b);
  });
  moveIndicator();
}
function moveIndicator() {
  const nav = $("#steps"), on = nav.querySelector("button.on"), ind = $("#stepsInd");
  if (!on) return;
  ind.style.width = on.offsetWidth + "px";
  ind.style.transform = `translateX(${on.offsetLeft}px)`;
  if (on.scrollIntoView && nav.scrollWidth > nav.clientWidth) on.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
}
function updateGauge() { $("#rpmVal").textContent = score().total; }
function render() {
  const v = $("#view"), i = S.step;
  v.innerHTML = STEPS[i].r();
  v.classList.remove("enter", "enter-back"); void v.offsetWidth;
  v.classList.add(i >= lastStep ? "enter" : "enter-back"); lastStep = i;
  renderNav();
  $("#revline").style.width = (i / (STEPS.length - 1) * 100) + "%";
  $("#back").disabled = i === 0;
  $("#next").textContent = i === 0 ? "Start" : i === STEPS.length - 2 ? "See my results" : "Next";
  $("#actionbar").classList.toggle("hide", i === STEPS.length - 1);
  $("#abStep").textContent = i === 0 ? "RX Fit Check" : i < STEPS.length - 1 ? `Step ${i} of ${STEPS.length - 2}` : "Results";
  $("#repMode").checked = S.rep;
  updateGauge();
  if (i === STEPS.length - 1) animateResults();
}

document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.go !== undefined) return go(+b.dataset.go);
  if (b.dataset.k) {
    const k = b.dataset.k, v = b.dataset.v;
    if (b.dataset.one) S.d[k] = S.d[k] === v ? "" : v;
    else { const a = arr(k); S.d[k] = a.includes(v) ? a.filter(x => x !== v) : [...a, v]; }
    save();
    // Update in place when nothing else on the step depends on it; re-render when it does.
    if (["existing", "mgmt", "pains"].includes(k)) { const y = window.scrollY; const v2 = $("#view"); v2.innerHTML = STEPS[S.step].r(); window.scrollTo(0, y); }
    else if (b.dataset.one) b.parentElement.querySelectorAll("[data-k]").forEach(x => x.setAttribute("aria-pressed", S.d[k] === x.dataset.v));
    else b.setAttribute("aria-pressed", arr(k).includes(v));
    updateGauge(); return;
  }
  const act = b.dataset.act; if (!act) return;
  if (act === "copy") copy(summary());
  if (act === "print") window.print();
  if (act === "email") {
    const subj = `RX Fit Check: ${S.d.company || "results"}`;
    location.href = `mailto:${CONFIG.contactEmail}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(summary())}`;
  }
  if (act === "submit" && CONFIG.submitEndpoint) {
    fetch(CONFIG.submitEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: S.d, score: score(), tier: tier(), summary: summary(), created: new Date().toISOString() }) })
      .then(r => toast(r.ok ? "Submitted. Thank you!" : "Submit failed")).catch(() => toast("Submit failed"));
  }
  if (act === "reset") {
    if (b.dataset.armed) { const rep = S.rep; S = fresh(); S.rep = rep; save(); lastStep = 0; render(); toast("Cleared"); }
    else { b.dataset.armed = "1"; b.textContent = "Click again to clear answers"; b.classList.add("btn-red"); }
  }
});
document.addEventListener("input", e => { const k = e.target.dataset.k; if (!k) return; S.d[k] = e.target.value; save(); updateGauge(); });
$("#repMode").addEventListener("change", e => { S.rep = e.target.checked; save(); const y = window.scrollY; $("#view").innerHTML = STEPS[S.step].r(); if (S.step === STEPS.length - 1) animateResults(); window.scrollTo(0, y); toast(S.rep ? "Rep mode on" : "Customer view"); });
$("#back").onclick = () => go(S.step - 1);
$("#next").onclick = () => go(S.step + 1);
window.addEventListener("resize", moveIndicator);
document.fonts && document.fonts.ready.then(moveIndicator);
render();
