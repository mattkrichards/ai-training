// Microsoft 365 back end for MeetingRunner.
//
// Replaces the Base44 SDK:
//   - Sign-in:   Microsoft Entra ID (MSAL, redirect flow)
//   - Data:      one JSON file per agenda in a SharePoint document library
//                (<site>/<library>/<folder>/agendas/<id>.json), via Microsoft Graph
//   - Email:     Graph /me/sendMail, sent from the signed-in person's mailbox
//
// Settings live in /meeting-runner/config.js (window.MEETING_RUNNER_CONFIG) so they
// can be changed on GitHub without rebuilding the app.

import { PublicClientApplication, InteractionRequiredAuthError } from "@azure/msal-browser";

const GRAPH = "https://graph.microsoft.com/v1.0";
const SCOPES = ["User.Read", "Sites.ReadWrite.All", "Mail.Send"];

const raw = (typeof window !== "undefined" && window.MEETING_RUNNER_CONFIG) || {};
export const config = {
  tenantId: (raw.tenantId || "").trim(),
  clientId: (raw.clientId || "").trim(),
  siteUrl: (raw.siteUrl || "").trim().replace(/\/+$/, ""),
  library: (raw.library || "").trim(), // blank = the site's default "Documents" library
  folder: (raw.folder || "MeetingRunner").trim().replace(/^\/+|\/+$/g, ""),
};

export const isConfigured = Boolean(config.tenantId && config.clientId && config.siteUrl);

// The app is served from a fixed base path (/meeting-runner/). Every page redirects back here
// after sign-in, so only this one redirect URI needs to be registered in Entra.
const redirectUri = window.location.origin + import.meta.env.BASE_URL;

export const msal = isConfigured
  ? new PublicClientApplication({
      auth: {
        clientId: config.clientId,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
        redirectUri,
        postLogoutRedirectUri: redirectUri,
        navigateToLoginRequestUrl: true,
      },
      cache: { cacheLocation: "localStorage" },
    })
  : null;

// ── Auth ───────────────────────────────────────────────────────────────
export async function initAuth() {
  await msal.initialize();
  const result = await msal.handleRedirectPromise();
  if (result?.account) msal.setActiveAccount(result.account);
  if (!msal.getActiveAccount()) {
    const [first] = msal.getAllAccounts();
    if (first) msal.setActiveAccount(first);
  }
  return msal.getActiveAccount();
}

export function signIn() {
  return msal.loginRedirect({ scopes: SCOPES, redirectStartPage: window.location.href });
}

export function signOut() {
  return msal.logoutRedirect({ account: msal.getActiveAccount() });
}

async function getToken() {
  const account = msal.getActiveAccount();
  if (!account) {
    await signIn();
    throw new Error("Signing in…");
  }
  try {
    const r = await msal.acquireTokenSilent({ scopes: SCOPES, account });
    return r.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      await msal.acquireTokenRedirect({ scopes: SCOPES, account, redirectStartPage: window.location.href });
    }
    throw e;
  }
}

async function graph(path, { method = "GET", body, headers = {}, raw: rawResponse = false } = {}) {
  const token = await getToken();
  const res = await fetch(path.startsWith("http") ? path : GRAPH + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined && typeof body !== "string" ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  if (rawResponse) return res;
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.error?.message || ""; } catch { /* no body */ }
    const err = new Error(`Microsoft Graph ${method} ${path} failed (${res.status})${detail ? `: ${detail}` : ""}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  const type = res.headers.get("content-type") || "";
  return type.includes("json") ? res.json() : res.text();
}

// ── SharePoint storage ─────────────────────────────────────────────────
let drivePromise = null;

// Resolves the site URL in config.js to a Graph drive path, e.g. /drives/b!abc…
function getDriveBase() {
  if (!drivePromise) {
    drivePromise = (async () => {
      const u = new URL(config.siteUrl);
      const sitePath = u.pathname.replace(/\/+$/, "");
      const site = await graph(`/sites/${u.hostname}:${sitePath || "/"}`);
      if (!config.library) {
        const drive = await graph(`/sites/${site.id}/drive?$select=id`);
        return `/drives/${drive.id}`;
      }
      const { value } = await graph(`/sites/${site.id}/drives?$select=id,name`);
      const match = value.find((d) => d.name.toLowerCase() === config.library.toLowerCase());
      if (!match) throw new Error(`Document library "${config.library}" was not found on ${config.siteUrl}.`);
      return `/drives/${match.id}`;
    })().catch((e) => {
      drivePromise = null;
      throw e;
    });
  }
  return drivePromise;
}

const enc = (s) => s.split("/").map(encodeURIComponent).join("/");
const agendaPath = (id) => enc(`${config.folder}/agendas/${id}.json`);
const agendasFolder = () => enc(`${config.folder}/agendas`);
const teamPath = (id) => enc(`${config.folder}/teams/${id}.json`);
const teamsFolder = () => enc(`${config.folder}/teams`);

// Generic JSON file helpers for a folder of records (agendas, teams).
async function readJson(path) {
  const base = await getDriveBase();
  const res = await graph(`${base}/root:/${path}:/content`, { raw: true });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Couldn't open ${decodeURIComponent(path)} (${res.status}).`);
  return res.json();
}

async function writeJson(path, record) {
  const base = await getDriveBase();
  await graph(`${base}/root:/${path}:/content`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record, null, 2),
  });
  return record;
}

async function deleteJson(path) {
  const base = await getDriveBase();
  const res = await graph(`${base}/root:/${path}`, { method: "DELETE", raw: true });
  if (!res.ok && res.status !== 404) throw new Error(`Couldn't delete (${res.status}).`);
}

async function listJson(folder) {
  const base = await getDriveBase();
  let items = [];
  let next = `${base}/root:/${folder}:/children?$top=999`;
  while (next) {
    const res = await graph(next, { raw: true });
    if (res.status === 404) break;
    if (!res.ok) throw new Error(`Couldn't list ${decodeURIComponent(folder)} (${res.status}).`);
    const page = await res.json();
    items = items.concat(page.value || []);
    next = page["@odata.nextLink"] || null;
  }
  const files = items.filter((f) => f.file && f.name.endsWith(".json"));
  const out = await Promise.all(
    files.map(async (f) => {
      try {
        const url = f["@microsoft.graph.downloadUrl"];
        if (url) return await (await fetch(url, { cache: "no-store" })).json();
        return await readJson(`${folder}/${encodeURIComponent(f.name)}`);
      } catch {
        return null;
      }
    })
  );
  return out.filter(Boolean);
}

// Base44's CSV export (and text inputs) can hand back numbers as text ("05"), which then
// get joined instead of added. Store and return them as real numbers.
const toNum = (v) => (v === "" || v === null || v === undefined || Number.isNaN(Number(v)) ? v : Number(v));
function normalize(rec) {
  if (!rec || typeof rec !== "object") return rec;
  const out = { ...rec };
  if (Array.isArray(out.items)) out.items = out.items.map((i) => ({ ...i, duration: toNum(i.duration) }));
  if (Array.isArray(out.scorecard)) {
    out.scorecard = out.scorecard.map((m) => ({
      ...m,
      target: toNum(m.target),
      history: Array.isArray(m.history) ? m.history.map((h) => ({ ...h, value: toNum(h.value) })) : m.history,
    }));
  }
  return out;
}

async function readAgendaFile(id) {
  const base = await getDriveBase();
  const res = await graph(`${base}/root:/${agendaPath(id)}:/content`, { raw: true });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Couldn't open agenda ${id} (${res.status}).`);
  return normalize(await res.json());
}

async function writeAgendaFile(input) {
  const record = normalize(input);
  const base = await getDriveBase();
  await graph(`${base}/root:/${agendaPath(record.id)}:/content`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record, null, 2),
  });
  return record;
}

const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 24);

let currentUserEmail = "";

function sortBy(list, sort) {
  if (!sort) return list;
  const desc = sort.startsWith("-");
  const key = desc ? sort.slice(1) : sort;
  return [...list].sort((a, b) => {
    const av = a[key] ?? "";
    const bv = b[key] ?? "";
    return (av < bv ? -1 : av > bv ? 1 : 0) * (desc ? -1 : 1);
  });
}

// ── Teams ──────────────────────────────────────────────────────────────
// A team: { id, name, members: [{ id, first_name, last_name, email, title }] }.
// Agendas with a team_id show that team's members as their "team", and edits to an
// agenda's team members are saved to the team (so every agenda of the team sees them).
const Team = {
  async list(sort = "name") {
    return sortBy(await listJson(teamsFolder()), sort);
  },
  async get(id) {
    return id ? readJson(teamPath(id)) : null;
  },
  async update(id, patch) {
    const current = (await readJson(teamPath(id))) || { id };
    return writeJson(teamPath(id), { ...current, ...patch, id, updated_date: new Date().toISOString() });
  },
  async delete(id) {
    await deleteJson(teamPath(id));
  },
  async create(data) {
    const now = new Date().toISOString();
    const rec = { name: "", members: [], ...data, id: newId(), created_date: now, updated_date: now, created_by: currentUserEmail };
    return writeJson(teamPath(rec.id), rec);
  },
};

async function withTeam(rec, teamsById) {
  if (!rec || !rec.team_id) return rec;
  const team = teamsById ? teamsById.get(rec.team_id) : await Team.get(rec.team_id);
  if (!team) return rec; // team deleted: fall back to the agenda's own list
  return { ...rec, team: team.members || [], team_name: team.name };
}

// Same shape as base44.entities.Agenda so the screens didn't need to change.
const Agenda = {
  async list(sort) {
    const base = await getDriveBase();
    let items = [];
    let next = `${base}/root:/${agendasFolder()}:/children?$top=999`;
    while (next) {
      const res = await graph(next, { raw: true });
      if (res.status === 404) break; // folder not created yet = no agendas
      if (!res.ok) throw new Error(`Couldn't list agendas (${res.status}).`);
      const page = await res.json();
      items = items.concat(page.value || []);
      next = page["@odata.nextLink"] || null;
    }
    const files = items.filter((f) => f.file && f.name.endsWith(".json"));
    const records = await Promise.all(
      files.map(async (f) => {
        try {
          const url = f["@microsoft.graph.downloadUrl"];
          if (url) return normalize(await (await fetch(url, { cache: "no-store" })).json());
          return await readAgendaFile(f.name.replace(/\.json$/, ""));
        } catch {
          return null;
        }
      })
    );
    const teams = await Team.list().catch(() => []);
    const byId = new Map(teams.map((t) => [t.id, t]));
    const resolved = await Promise.all(records.filter(Boolean).map((r) => withTeam(r, byId)));
    return sortBy(resolved, sort);
  },

  async filter(query = {}) {
    if (query.id) {
      const rec = await readAgendaFile(query.id);
      return rec ? [await withTeam(rec)] : [];
    }
    const all = await Agenda.list();
    return all.filter((r) => Object.entries(query).every(([k, v]) => r[k] === v));
  },

  async create(data, { keepId = false } = {}) {
    if (data && data.team_id) data = { ...data, team: undefined };
    const now = new Date().toISOString();
    const record = {
      ...data,
      id: keepId && data.id ? String(data.id) : newId(),
      created_date: (keepId && data.created_date) || now,
      updated_date: now,
      created_by: (keepId && data.created_by) || currentUserEmail,
    };
    return writeAgendaFile(record);
  },

  // Base44 updates merged the given fields into the record. Re-read the file first so
  // a teammate's change to a different section (e.g. scorecard vs. to-dos) isn't lost.
  async update(id, patch) {
    const current = (await readAgendaFile(id)) || { id };
    const merged = { ...current, ...patch, id, updated_date: new Date().toISOString() };
    // Member edits on a team's agenda go to the team itself.
    if (merged.team_id) {
      const team = await Team.get(merged.team_id);
      if (team) {
        if (Object.prototype.hasOwnProperty.call(patch, "team")) await Team.update(merged.team_id, { members: patch.team });
        delete merged.team; // members live on the team, not the agenda
      }
    }
    delete merged.team_name;
    const saved = await writeAgendaFile(merged);
    return withTeam(saved);
  },

  async delete(id) {
    const base = await getDriveBase();
    const res = await graph(`${base}/root:/${agendaPath(id)}`, { method: "DELETE", raw: true });
    if (!res.ok && res.status !== 404) throw new Error(`Couldn't delete agenda (${res.status}).`);
  },
};

async function me() {
  const user = await graph("/me?$select=displayName,mail,userPrincipalName");
  currentUserEmail = user.mail || user.userPrincipalName || "";
  return { full_name: user.displayName, email: currentUserEmail };
}

// Same arguments as base44.integrations.Core.SendEmail. "to" can hold several
// addresses separated by commas or semicolons.
async function SendEmail({ to, subject, body }) {
  const toRecipients = String(to)
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((address) => ({ emailAddress: { address } }));
  await graph("/me/sendMail", {
    method: "POST",
    body: {
      message: { subject, body: { contentType: "HTML", content: body }, toRecipients },
      saveToSentItems: true,
    },
  });
}

export const api = {
  entities: { Agenda, Team },
  auth: { me, logout: signOut },
  integrations: { Core: { SendEmail } },
};
