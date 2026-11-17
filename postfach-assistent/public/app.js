import { stackedColumns, hBars, legend, table } from "./charts.js";
// Oberfläche des Postfach-Assistenten (ohne Framework).
// Wichtig: Alle Inhalte aus E-Mails laufen durch esc(), weil sie von Fremden stammen.

const $app = document.getElementById("app");
const state = { me: null, team: null, mailboxes: [], view: "overview", sel: null, filters: { status: "open" }, period: "week", digestMailbox: "" };

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso + "Z");
  return d.toLocaleString("de-DE", iso.length === 10 ? { day: "2-digit", month: "2-digit", year: "numeric" } : { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};
const today = () => new Date().toISOString().slice(0, 10);
const dueClass = (d) => !d ? "" : d < today() ? "due-late" : d <= new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10) ? "due-soon" : "";
const catLabel = (c) => state.me?.category_labels?.[c] || c || "–";
const STATUS = { open: "offen", answered: "beantwortet", done: "erledigt", spam: "Spam" };

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || "GET",
    headers: opts.body ? { "Content-Type": "application/json" } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/api/login") { state.me = null; renderLogin(); throw new Error("Bitte anmelden"); }
  if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
  return data;
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 2800);
}

// ---------- Anmeldung ----------
const DEMO = [
  ["petra@sonnenhof-hv.example", "Hausverwaltung Sonnenhof (klein, 3 Personen)"],
  ["anna@berger-steuer.example", "Kanzlei Berger & Partner (Steuerberatung)"],
  ["svenja@nordlicht-versand.example", "Nordlicht Versand GmbH (Online-Shop, 3 Postfächer)"],
];

function renderLogin(mode = "login") {
  $app.innerHTML = `
  <div class="login">
    <h1>Postfach-Assistent</h1>
    <p class="muted">Sortiert, fasst zusammen und beantwortet die E-Mails deiner Firma.</p>
    <div class="panel">
      ${mode === "login" ? `
      <form id="f">
        <label>E-Mail</label><input class="field" name="email" type="email" required autocomplete="username">
        <label>Passwort</label><input class="field" name="password" type="password" required autocomplete="current-password">
        <p><button class="btn primary">Anmelden</button> <a href="#" id="toReg" class="small">Neue Firma registrieren</a></p>
        <p id="err" class="small" style="color:var(--red)"></p>
      </form>
      <h3>Testfirmen (Passwort: demo1234)</h3>
      <div class="demo-list">${DEMO.map(([e, l]) => `<button class="btn" data-demo="${esc(e)}"><b>${esc(l)}</b><br><span class="small muted">${esc(e)}</span></button>`).join("")}</div>
      ` : `
      <form id="f">
        <label>Firmenname</label><input class="field" name="company" required>
        <label>Dein Name</label><input class="field" name="name" required>
        <label>E-Mail</label><input class="field" name="email" type="email" required>
        <label>Passwort (min. 8 Zeichen)</label><input class="field" name="password" type="password" minlength="8" required>
        <p><button class="btn primary">Firma anlegen</button> <a href="#" id="toLogin" class="small">Zurück zur Anmeldung</a></p>
        <p id="err" class="small" style="color:var(--red)"></p>
      </form>`}
    </div>
  </div>`;
  const f = document.getElementById("f");
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const body = Object.fromEntries(new FormData(f));
    try {
      await api(mode === "login" ? "/api/login" : "/api/register", { method: "POST", body });
      await boot();
    } catch (e) { document.getElementById("err").textContent = e.message; }
  };
  document.getElementById("toReg")?.addEventListener("click", (e) => { e.preventDefault(); renderLogin("register"); });
  document.getElementById("toLogin")?.addEventListener("click", (e) => { e.preventDefault(); renderLogin(); });
  document.querySelectorAll("[data-demo]").forEach((b) => b.onclick = async () => {
    f.email.value = b.dataset.demo; f.password.value = "demo1234"; f.requestSubmit();
  });
}

// ---------- Farben & Beschriftungen ----------
// Jede Kategorie hat überall dieselbe Farbe (Liste, Board, Diagramme). Dringlichkeit nutzt eigene Statusfarben + Symbol.
const CAT_ORDER = ["anfrage", "reklamation", "rechnung", "termin", "bewerbung", "info"];
const catColor = (c) => `var(--cat-${CAT_ORDER.includes(c) ? c : "other"})`;
const PRIO = {
  hoch: { label: "Dringend", icon: "▲", color: "var(--status-critical)" },
  mittel: { label: "Normal", icon: "●", color: "var(--status-warning)" },
  niedrig: { label: "Niedrig", icon: "▽", color: "var(--neutral-mark)" },
};
const prioBadge = (p) => p ? `<span class="badge prio-${esc(p)}"><span aria-hidden="true">${PRIO[p]?.icon || ""}</span> ${esc(PRIO[p]?.label || p)}</span>` : "";
const catChip = (c) => `<span class="chip"><span class="dot" style="background:${catColor(c)}"></span>${esc(catLabel(c))}</span>`;

// ---------- Rahmen ----------
const VIEWS = [
  ["overview", "Übersicht"], ["inbox", "Posteingang"], ["tasks", "Aufgaben"], ["followups", "Nachfassen"], ["team", "Team"], ["connect", "Einbinden"], ["settings", "Einstellungen"],
];
const ADMIN_VIEWS = ["connect", "settings"];

async function boot() {
  try { state.me = await api("/api/me"); } catch { return renderLogin(); }
  [state.team, state.mailboxes] = await Promise.all([api("/api/team"), api("/api/mailboxes")]);
  const v = location.hash.replace("#", "");
  if (VIEWS.some(([k]) => k === v)) state.view = v;
  render();
}

async function render() {
  const s = await api(`/api/stats?period=all`);
  const isAdmin = state.me.user.role === "admin";
  if (!isAdmin && ADMIN_VIEWS.includes(state.view)) state.view = "overview";
  $app.innerHTML = `
  <div class="shell">
    <aside class="side">
      <div class="brand">${esc(state.me.company.name)}<small>${esc(state.me.user.name)} · ${isAdmin ? "Admin" : "Mitarbeiter"}</small></div>
      <nav class="nav">
        ${VIEWS.filter(([k]) => isAdmin || !ADMIN_VIEWS.includes(k)).map(([k, l]) => {
          const c = k === "inbox" ? `<span class="count ${s.urgent_open ? "red" : ""}">${s.open}</span>` : k === "tasks" ? `<span class="count ${s.tasks_due ? "red" : ""}">${s.tasks_open}</span>` : k === "followups" ? `<span class="count ${s.overdue_followups ? "red" : ""}">${s.overdue_followups}</span>` : "";
          return `<a href="#${k}" data-view="${k}" class="${state.view === k ? "active" : ""}">${l}${c}</a>`;
        }).join("")}
      </nav>
      <div class="foot">KI: ${esc(state.me.ai)}<br><a href="#" id="logout">Abmelden</a></div>
    </aside>
    <main id="main"></main>
  </div>`;
  document.querySelectorAll("[data-view]").forEach((a) => a.onclick = (e) => { e.preventDefault(); go(a.dataset.view); });
  document.getElementById("logout").onclick = async (e) => { e.preventDefault(); await api("/api/logout", { method: "POST", body: {} }); state.me = null; renderLogin(); };
  const main = document.getElementById("main");
  try {
    await ({ overview: viewOverview, inbox: viewInbox, tasks: viewTasks, followups: viewFollowups, team: viewTeam, connect: viewConnect, settings: viewSettings }[state.view])(main);
  } catch (e) { main.innerHTML = `<div class="panel">${esc(e.message)}</div>`; }
}
const go = (view) => { state.view = view; location.hash = view; render(); };
const openMail = (id, filters = { status: "open" }) => { state.sel = id; state.filters = filters; state.inboxMode = "list"; go("inbox"); };

// ---------- Übersicht: alle E-Mails zusammenfassen + Diagramme ----------
async function viewOverview(main) {
  main.innerHTML = `
    <div class="top">
      <h1>Übersicht</h1>
      <div class="row">
        <select id="period" aria-label="Zeitraum">${[["today", "Heute"], ["week", "Letzte 7 Tage"], ["month", "Letzte 30 Tage"], ["all", "Alles"]].map(([v, l]) => `<option value="${v}" ${state.period === v ? "selected" : ""}>${l}</option>`).join("")}</select>
        <select id="mb" aria-label="Postfach"><option value="">Alle Postfächer</option>${state.mailboxes.map((m) => `<option value="${m.id}" ${String(state.digestMailbox) === String(m.id) ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select>
        <button class="btn primary" id="go">Alle E-Mails zusammenfassen</button>
      </div>
    </div>
    <div id="digest"><div class="panel empty">Fasse zusammen …</div></div>`;
  const load = async () => {
    document.getElementById("digest").innerHTML = `<div class="panel empty">Fasse zusammen …</div>`;
    const q = `period=${state.period}${state.digestMailbox ? `&mailbox=${state.digestMailbox}` : ""}`;
    const [d, a] = await Promise.all([api(`/api/digest?${q}`), api(`/api/analytics?${q}`)]);
    renderDigest(d, a);
  };
  document.getElementById("period").onchange = (e) => { state.period = e.target.value; load(); };
  document.getElementById("mb").onchange = (e) => { state.digestMailbox = e.target.value; load(); };
  document.getElementById("go").onclick = load;
  await load();
}

const fmtHours = (h) => h == null ? "–" : h < 1 ? `${Math.round(h * 60)} Min.` : h < 48 ? `${String(h).replace(".", ",")} Std.` : `${Math.round(h / 24)} Tage`;

function renderDigest(d, a) {
  const s = d.stats;
  const cats = CAT_ORDER.filter((c) => s.by_category[c]).map((c) => ({ key: c, n: s.by_category[c] }));
  const daysWithData = a.days.some((x) => Object.keys(x.by_category).length);
  document.getElementById("digest").innerHTML = `
    <div class="panel hero" style="margin-bottom:12px">
      <div class="headline">${esc(d.headline)}</div>
      <p>${esc(d.overview)}</p>
      <div class="small muted">${esc(d.period_label)} · erstellt ${fmtDate(d.generated_at)} · ${d.generated_by === "claude" ? "von Claude" : "lokale Auswertung"}</div>
    </div>
    <div class="grid kpis" style="margin-bottom:12px">
      ${[["E-Mails", s.total, ""], ["Offen", s.open, ""], ["Dringend offen", s.urgent_open, s.urgent_open ? "alert" : ""], ["Warten zu lange", s.overdue_followups, s.overdue_followups ? "alert" : ""],
        ["Ø Antwortzeit", fmtHours(a.response?.avg_hours), ""], ["In 24 Std. beantwortet", a.response ? a.response.within_24h + " %" : "–", ""], ["Spam aussortiert", s.spam, ""]]
        .map(([l, v, cls]) => `<div class="panel kpi ${cls}"><div class="v">${v}</div><div class="l">${cls ? "▲ " : ""}${l}</div></div>`).join("")}
    </div>
    <div class="grid two" style="margin-bottom:12px">
      <div class="panel">
        <h2>Jetzt erledigen</h2>
        ${d.actions.length ? `<ol class="steps">${d.actions.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : `<p class="muted">Nichts Dringendes.</p>`}
      </div>
      <div class="panel">
        <h2>Dringende E-Mails</h2>
        ${d.urgent.length ? `<ul class="clean">${d.urgent.map((u) => `<li><a href="#" data-open="${u.id}"><b>${esc(u.subject)}</b></a><br><span class="small muted">${esc(u.summary)}</span></li>`).join("")}</ul>` : `<p class="muted">Keine dringenden E-Mails offen.</p>`}
      </div>
    </div>
    <div class="panel" style="margin-bottom:12px">
      <div class="row" style="justify-content:space-between"><h2 style="margin:0">Eingang pro Tag nach Kategorie</h2><button class="btn small" id="tblToggle" aria-pressed="false">Als Tabelle</button></div>
      <div id="dayLegend"></div>
      <div id="dayChart">${daysWithData ? "" : `<p class="muted">Keine E-Mails im Zeitraum.</p>`}</div>
    </div>
    <div class="grid two">
      <div class="panel"><h2>Nach Kategorie</h2><div id="catChart"></div></div>
      <div class="panel"><h2>Offen je Abteilung</h2><div id="deptLegend"></div><div id="deptChart"></div></div>
      <div class="panel"><h2>Themen</h2><ul class="clean">${d.topics.map((t) => `<li>${esc(t)}</li>`).join("") || "<li class='muted'>Keine E-Mails im Zeitraum.</li>"}</ul></div>
      <div class="panel"><h2>Häufigste Absender</h2>
        ${a.senders.length ? `<ul class="clean">${a.senders.map((x) => `<li class="row" style="justify-content:space-between"><span>${esc(x.sender)}</span><b>${x.n}</b></li>`).join("")}</ul>` : "<p class='muted'>–</p>"}
      </div>
    </div>`;
  document.querySelectorAll("[data-open]").forEach((el) => el.onclick = (e) => { e.preventDefault(); openMail(Number(el.dataset.open)); });

  const keys = CAT_ORDER.filter((c) => a.days.some((x) => x.by_category[c]));
  const dayLabel = (iso, long) => new Date(iso + "T12:00:00").toLocaleDateString("de-DE", long ? { weekday: "long", day: "2-digit", month: "2-digit" } : { day: "2-digit", month: "2-digit" });
  if (daysWithData) {
    legend(keys.map((k) => ({ label: catLabel(k), color: catColor(k) })), document.getElementById("dayLegend"));
    const drawChart = () => stackedColumns(document.getElementById("dayChart"), { days: a.days, keys, labelFor: catLabel, colorFor: catColor, dateLabel: dayLabel });
    const drawTable = () => table(document.getElementById("dayChart"), ["Tag", ...keys.map(catLabel), "Gesamt"],
      a.days.map((x) => [dayLabel(x.date, true), ...keys.map((k) => x.by_category[k] || 0), keys.reduce((n, k) => n + (x.by_category[k] || 0), 0)]));
    drawChart();
    const btn = document.getElementById("tblToggle");
    btn.onclick = () => { const on = btn.getAttribute("aria-pressed") !== "true"; btn.setAttribute("aria-pressed", on); btn.textContent = on ? "Als Diagramm" : "Als Tabelle"; on ? drawTable() : drawChart(); };
  } else document.getElementById("tblToggle").remove();

  hBars(document.getElementById("catChart"), cats.map((c) => ({ label: catLabel(c.key), n: c.n, swatch: catColor(c.key) })), { segments: [{ key: "n", label: "E-Mails" }] });
  legend([{ label: "▲ dringend", color: PRIO.hoch.color }, { label: "übrige", color: "var(--neutral-mark)" }], document.getElementById("deptLegend"));
  hBars(document.getElementById("deptChart"), a.departments.map((x) => ({ label: x.department, urgent: x.urgent, rest: x.open - x.urgent })), {
    segments: [{ key: "urgent", label: "dringend", color: PRIO.hoch.color }, { key: "rest", label: "übrige", color: "var(--neutral-mark)" }],
    valueLabel: (v, it) => it.urgent ? `${v} (${it.urgent} dringend)` : String(v),
  });
}

// ---------- Posteingang: Liste mit Gruppen oder Board ----------
const GROUPS = {
  priority: { label: "Dringlichkeit", field: "priority", order: ["hoch", "mittel", "niedrig"], title: (k) => `${PRIO[k]?.icon || ""} ${PRIO[k]?.label || k}`, color: (k) => PRIO[k]?.color, of: (e) => e.priority },
  category: { label: "Kategorie", field: "category", order: [...CAT_ORDER, "spam"], title: (k) => catLabel(k), color: (k) => catColor(k), of: (e) => e.category },
  status: { label: "Bearbeitungsstand", field: "status", order: ["open", "answered", "done"], title: (k) => ({ open: "Offen", answered: "Beantwortet", done: "Erledigt", spam: "Spam" })[k] || k, color: () => null, of: (e) => e.status },
  department: { label: "Abteilung", field: "department_id", order: null, title: (k, e) => e?.department || "Nicht zugewiesen", color: () => null, of: (e) => e.department_id ?? "none" },
  mailbox: { label: "Postfach", field: null, order: null, title: (k, e) => e?.mailbox || k, color: () => null, of: (e) => e.mailbox_id },
  date: { label: "Datum", field: null, order: ["today", "yesterday", "week", "older"], title: (k) => ({ today: "Heute", yesterday: "Gestern", week: "Diese Woche", older: "Älter" })[k], color: () => null,
    of: (e) => { const days = (Date.now() - Date.parse(e.received_at + "Z")) / 864e5; const t = new Date().toISOString().slice(0, 10); return e.received_at.startsWith(t) ? "today" : days < 2 ? "yesterday" : days < 7 ? "week" : "older"; } },
  none: { label: "Keine Gruppen", field: null, order: ["all"], title: () => "Alle E-Mails", color: () => null, of: () => "all" },
};

function groupEmails(emails, by) {
  const g = GROUPS[by];
  const map = new Map();
  for (const e of emails) {
    const k = g.of(e);
    if (!map.has(k)) map.set(k, { key: k, sample: e, items: [] });
    map.get(k).items.push(e);
  }
  let keys = g.order ? g.order.filter((k) => map.has(k)).concat([...map.keys()].filter((k) => !g.order.includes(k))) : [...map.keys()].sort((a, b) => map.get(b).items.length - map.get(a).items.length);
  // Im Board nach Bearbeitungsstand sollen alle Spalten sichtbar sein, auch leere.
  if (by === "status" && state.inboxMode === "board") keys = g.order;
  return keys.map((k) => map.get(k) || { key: k, items: [] });
}

const card = (e, sel) => `
  <div class="item ${sel ? "sel" : ""}" data-id="${e.id}" style="--cat:${catColor(e.category)}" ${state.inboxMode === "board" && GROUPS[state.groupBy].field ? `draggable="true"` : ""} tabindex="0">
    <div class="h"><span class="from">${esc(e.from_name || e.from_addr)}</span><span class="small muted">${fmtDate(e.received_at)}</span></div>
    <div class="subj">${esc(e.subject)}${e.thread_count > 1 ? ` <span class="badge" title="Nachrichten im Verlauf">${e.thread_count}</span>` : ""}</div>
    <div class="sum">${esc(e.summary || "")}</div>
    <div class="meta">${prioBadge(e.priority)}${catChip(e.category)}${e.department ? `<span class="badge">${esc(e.department)}</span>` : ""}${e.sentiment === "negativ" ? `<span class="badge negativ">☹ verärgert</span>` : ""}${e.status !== "open" ? `<span class="badge ${esc(e.status)}">${STATUS[e.status]}</span>` : ""}</div>
  </div>`;

async function viewInbox(main) {
  const f = state.filters;
  state.groupBy ||= "priority";
  state.inboxMode ||= "list";
  state.collapsed ||= new Set();
  const board = state.inboxMode === "board";
  const params = Object.entries(f).filter(([, v]) => v);
  // Board nach Bearbeitungsstand zeigt alle Stände (ohne Spam).
  const q = new URLSearchParams(board && state.groupBy === "status" ? params.filter(([k]) => k !== "status") : params);
  const emails = await api(`/api/emails?${q}`);
  if (state.sel && !emails.some((e) => e.id === state.sel)) state.sel = board ? null : emails[0]?.id ?? null;
  if (!board && !state.sel && emails.length && window.innerWidth > 860) state.sel = emails[0].id;
  const groups = groupEmails(emails, state.groupBy);
  const counts = {};
  for (const e of emails) counts[e.category] = (counts[e.category] || 0) + 1;

  main.innerHTML = `
    <div class="top">
      <h1>Posteingang <span class="muted small">${emails.length} E-Mails</span></h1>
      <div class="row">
        <div class="seg" role="group" aria-label="Ansicht">
          <button class="${!board ? "on" : ""}" data-mode="list" aria-pressed="${!board}">☰ Liste</button>
          <button class="${board ? "on" : ""}" data-mode="board" aria-pressed="${board}">▦ Board</button>
        </div>
        <label class="inline">Ordnen nach
          <select id="groupBy">${Object.entries(GROUPS).map(([k, g]) => `<option value="${k}" ${state.groupBy === k ? "selected" : ""}>${g.label}</option>`).join("")}</select>
        </label>
      </div>
    </div>
    <div class="row filters">
      <input id="q" placeholder="Suchen …" value="${esc(f.q || "")}" aria-label="Suchen">
      ${board && state.groupBy === "status" ? "" : `<select data-f="status" aria-label="Status">${[["open", "Offen"], ["answered", "Beantwortet"], ["done", "Erledigt"], ["spam", "Spam"], ["all", "Alle"]].map(([v, l]) => `<option value="${v}" ${f.status === v ? "selected" : ""}>${l}</option>`).join("")}</select>`}
      <select data-f="priority" aria-label="Dringlichkeit"><option value="">Jede Dringlichkeit</option>${["hoch", "mittel", "niedrig"].map((p) => `<option value="${p}" ${f.priority === p ? "selected" : ""}>${PRIO[p].label}</option>`).join("")}</select>
      ${state.mailboxes.length > 1 ? `<select data-f="mailbox" aria-label="Postfach"><option value="">Alle Postfächer</option>${state.mailboxes.map((m) => `<option value="${m.id}" ${String(f.mailbox) === String(m.id) ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select>` : ""}
      <label class="inline"><input type="checkbox" id="mine" ${f.mine === "1" ? "checked" : ""}> Nur meine</label>
    </div>
    <div class="catbar" role="group" aria-label="Nach Kategorie filtern">
      <button class="chip ${!f.category ? "on" : ""}" data-cat="">Alle</button>
      ${CAT_ORDER.map((c) => `<button class="chip ${f.category === c ? "on" : ""}" data-cat="${c}"><span class="dot" style="background:${catColor(c)}"></span>${esc(catLabel(c))} <span class="muted">${counts[c] || 0}</span></button>`).join("")}
    </div>
    ${board ? `
      <div class="board">${groups.map((g) => `
        <section class="col" data-key="${esc(g.key)}">
          <header>${GROUPS[state.groupBy].color(g.key) ? `<span class="dot" style="background:${GROUPS[state.groupBy].color(g.key)}"></span>` : ""}<b>${esc(GROUPS[state.groupBy].title(g.key, g.sample))}</b><span class="count">${g.items.length}</span></header>
          <div class="col-body">${g.items.map((e) => card(e, false)).join("") || `<div class="empty small">leer</div>`}</div>
        </section>`).join("") || `<div class="panel empty">Keine E-Mails für diesen Filter.</div>`}
      </div>
      ${GROUPS[state.groupBy].field ? `<p class="small muted">Tipp: Karten per Ziehen in eine andere Spalte verschieben, um ${esc(GROUPS[state.groupBy].label)} zu ändern.</p>` : ""}
      <div id="drawer" class="drawer" hidden><div class="drawer-inner"><button class="btn close" id="closeDrawer" aria-label="Schließen">✕</button><div id="detail"></div></div></div>
    ` : `
      <div class="inbox">
        <div class="panel list">${groups.length ? groups.map((g) => {
          const id = `${state.groupBy}:${g.key}`, closed = state.collapsed.has(id), color = GROUPS[state.groupBy].color(g.key);
          return `<div class="group">
            <button class="group-h" data-group="${esc(id)}" aria-expanded="${!closed}">
              <span class="caret">${closed ? "▸" : "▾"}</span>${color ? `<span class="dot" style="background:${color}"></span>` : ""}
              <b>${esc(GROUPS[state.groupBy].title(g.key, g.sample))}</b><span class="count">${g.items.length}</span>
            </button>
            ${closed ? "" : g.items.map((e) => card(e, e.id === state.sel)).join("")}
          </div>`;
        }).join("") : `<div class="empty">Keine E-Mails für diesen Filter. 🎉</div>`}
        </div>
        <div id="detail">${state.sel ? `<div class="panel empty">Lade …</div>` : `<div class="panel empty">E-Mail auswählen</div>`}</div>
      </div>`}`;

  main.querySelectorAll("[data-mode]").forEach((b) => b.onclick = () => { state.inboxMode = b.dataset.mode; state.sel = null; if (state.inboxMode === "board" && state.groupBy === "priority") state.groupBy = "status"; render(); });
  main.querySelector("#groupBy").onchange = (e) => { state.groupBy = e.target.value; render(); };
  main.querySelectorAll("[data-f]").forEach((s) => s.onchange = () => { f[s.dataset.f] = s.value; render(); });
  main.querySelectorAll("[data-cat]").forEach((b) => b.onclick = () => { f.category = b.dataset.cat; render(); });
  main.querySelector("#mine").onchange = (e) => { f.mine = e.target.checked ? "1" : ""; render(); };
  main.querySelectorAll("[data-group]").forEach((b) => b.onclick = () => { const id = b.dataset.group; state.collapsed.has(id) ? state.collapsed.delete(id) : state.collapsed.add(id); render(); });
  let t; main.querySelector("#q").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value; render().then(() => { const q = document.getElementById("q"); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }); }, 350); };

  const open = (id) => {
    state.sel = id;
    main.querySelectorAll(".item").forEach((x) => x.classList.toggle("sel", Number(x.dataset.id) === id));
    if (board) { const d = main.querySelector("#drawer"); d.hidden = false; }
    showDetail(id);
    if (!board && window.innerWidth <= 860) document.getElementById("detail").scrollIntoView({ behavior: "smooth" });
  };
  main.querySelectorAll(".item").forEach((it) => {
    it.onclick = () => open(Number(it.dataset.id));
    it.onkeydown = (e) => { if (e.key === "Enter") open(Number(it.dataset.id)); };
  });
  if (board) {
    const drawer = main.querySelector("#drawer");
    main.querySelector("#closeDrawer").onclick = () => { drawer.hidden = true; state.sel = null; };
    drawer.onclick = (e) => { if (e.target === drawer) { drawer.hidden = true; state.sel = null; } };
    const field = GROUPS[state.groupBy].field;
    if (field) {
      main.querySelectorAll(".item[draggable]").forEach((it) => it.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", it.dataset.id); it.classList.add("dragging"); }));
      main.querySelectorAll(".col").forEach((col) => {
        col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("over"); });
        col.addEventListener("dragleave", () => col.classList.remove("over"));
        col.addEventListener("drop", async (e) => {
          e.preventDefault(); col.classList.remove("over");
          const id = Number(e.dataTransfer.getData("text/plain"));
          let value = col.dataset.key;
          if (field === "department_id") value = value === "none" ? "" : Number(value);
          try { await api(`/api/emails/${id}`, { method: "PATCH", body: { [field]: value } }); toast("Verschoben"); render(); } catch (err) { toast(err.message); }
        });
      });
    }
    if (state.sel) { drawer.hidden = false; showDetail(state.sel); }
  } else if (state.sel) showDetail(state.sel);
}

async function showDetail(id) {
  const box = document.getElementById("detail");
  const e = await api(`/api/emails/${id}`);
  const users = state.team.users, depts = state.team.departments;
  const replySubject = /^(re|aw):/i.test(e.subject) ? e.subject : `AW: ${e.subject}`;
  box.innerHTML = `
    <div class="panel detail" style="--cat:${catColor(e.category)}">
      <div class="row" style="justify-content:space-between">
        <h2 style="margin:0">${esc(e.subject)}</h2>
        <div class="row">
          <button class="btn" data-status="done">✓ Erledigt</button>
          <button class="btn" data-status="spam">Spam</button>
          ${e.status !== "open" ? `<button class="btn" data-status="open">Wieder öffnen</button>` : ""}
        </div>
      </div>
      <div class="small muted">Von ${esc(e.from_name || "")} &lt;${esc(e.from_addr)}&gt; · ${fmtDate(e.received_at)} · Postfach ${esc(e.mailbox)}</div>
      <div class="row" style="margin-top:8px">
        ${prioBadge(e.priority)} ${catChip(e.category)}
        <span class="badge ${esc(e.sentiment)}">Stimmung: ${esc(e.sentiment)}</span>
        <span class="badge ${esc(e.status)}">${STATUS[e.status]}</span>
      </div>
      <div class="summary-box"><b>Kurz gesagt:</b> ${esc(e.summary)}</div>
      <div class="row">
        <span class="small muted">Zuständig:</span>
        <select id="dept" aria-label="Abteilung"><option value="">– Abteilung –</option>${depts.map((d) => `<option value="${d.id}" ${d.id === e.department_id ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select>
        <select id="asg" aria-label="Person"><option value="">– Person –</option>${users.map((u) => `<option value="${u.id}" ${u.id === e.assignee_id ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select>
      </div>
      ${e.tasks.length ? `<h3 style="margin-top:14px">Erkannte Aufgaben</h3><ul class="tasks">${e.tasks.map((t) => `<li>${esc(t.title)} ${t.due_date ? `<span class="${dueClass(t.due_date)}">· bis ${fmtDate(t.due_date)}</span>` : ""}</li>`).join("")}</ul>` : ""}
      ${e.thread.length > 1 ? `
        <h3 style="margin-top:14px">Verlauf (${e.thread.length} Nachrichten) <button class="btn small" id="tsum">Verlauf zusammenfassen</button></h3>
        <div id="tsumout"></div>
        <ol class="timeline">${e.thread.map((m) => `<li class="${m.direction}"><div class="small muted">${m.direction === "out" ? "↩ Unsere Antwort" : esc(m.from_name || m.from_addr)} · ${fmtDate(m.received_at)}</div><div class="small">${esc(m.summary || m.body.slice(0, 200))}</div></li>`).join("")}</ol>` : ""}
      <details style="margin-top:14px"><summary><b>Original-E-Mail</b></summary><div class="body">${esc(e.body)}</div></details>
      ${e.status === "spam" ? "" : `
      <h3 style="margin-top:14px">Antwort ${e.draft ? "(Entwurf der KI – bitte prüfen)" : ""}</h3>
      <textarea id="draft" rows="12" aria-label="Antworttext">${esc(e.draft || "")}</textarea>
      <div class="row" style="margin-top:8px">
        <button class="btn primary" id="send">Senden</button>
        <a class="btn" id="mailto" href="#">Im Mailprogramm öffnen</a>
        <button class="btn" id="copy">Kopieren</button>
        <button class="btn" id="save">Entwurf speichern</button>
        <button class="btn" id="re">Neu auswerten</button>
      </div>
      <p class="small muted">Es wird nichts ohne deinen Klick verschickt. „Im Mailprogramm öffnen“ übergibt die Antwort an Outlook, Apple Mail & Co.</p>`}
    </div>`;
  const patch = async (body, msg) => { await api(`/api/emails/${id}`, { method: "PATCH", body }); if (msg) toast(msg); };
  box.querySelectorAll("[data-status]").forEach((b) => b.onclick = async () => { await patch({ status: b.dataset.status }, `Als „${STATUS[b.dataset.status]}" markiert`); render(); });
  box.querySelector("#dept").onchange = (ev) => patch({ department_id: ev.target.value ? Number(ev.target.value) : "" }, "Zuständigkeit geändert");
  box.querySelector("#asg").onchange = (ev) => patch({ assignee_id: ev.target.value ? Number(ev.target.value) : "" }, "Person zugewiesen");
  box.querySelector("#tsum")?.addEventListener("click", async (ev) => {
    ev.target.disabled = true;
    const t = await api(`/api/threads/${e.thread_key}`);
    box.querySelector("#tsumout").innerHTML = `<div class="summary-box" style="white-space:pre-wrap">${esc(t.summary)}</div>`;
    ev.target.disabled = false;
  });
  const draftText = () => box.querySelector("#draft").value;
  box.querySelector("#mailto")?.addEventListener("click", (ev) => {
    ev.preventDefault();
    location.href = `mailto:${encodeURIComponent(e.from_addr)}?subject=${encodeURIComponent(replySubject)}&body=${encodeURIComponent(draftText())}`;
    patch({ draft: draftText() });
  });
  box.querySelector("#copy")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(draftText()); toast("Antwort kopiert"); } catch { toast("Kopieren nicht möglich – Text bitte markieren"); }
  });
  box.querySelector("#save")?.addEventListener("click", () => patch({ draft: draftText() }, "Entwurf gespeichert"));
  box.querySelector("#re")?.addEventListener("click", async () => { await api(`/api/emails/${id}/reanalyze`, { method: "POST", body: {} }); toast("Neu ausgewertet"); showDetail(id); });
  box.querySelector("#send")?.addEventListener("click", async (ev) => {
    const text = draftText();
    if (!text.trim()) return toast("Antworttext fehlt");
    if (!confirm(`Antwort an ${e.from_addr} senden?`)) return;
    ev.target.disabled = true;
    try { const r = await api(`/api/emails/${id}/reply`, { method: "POST", body: { body: text } }); toast(`Antwort ${r.delivery}`); render(); }
    catch (err) { toast(err.message); ev.target.disabled = false; }
  });
}

// ---------- Aufgaben ----------
async function viewTasks(main) {
  const tasks = await api("/api/tasks");
  main.innerHTML = `<div class="top"><h1>Aufgaben aus E-Mails</h1></div>
    <div class="panel">${tasks.length ? `<table><tr><th></th><th>Aufgabe</th><th>Frist</th><th>Von</th><th>Zuständig</th></tr>
      ${tasks.map((t) => `<tr><td><input type="checkbox" data-done="${t.id}"></td><td>${esc(t.title)}<br><a href="#" class="small" data-mail="${t.email_id}">${esc(t.subject)}</a></td>
        <td class="${dueClass(t.due_date)}">${t.due_date ? fmtDate(t.due_date) : "–"}</td><td class="small">${esc(t.from_name || t.from_addr)}</td><td class="small">${esc(t.assignee || "–")}</td></tr>`).join("")}</table>`
      : `<div class="empty">Keine offenen Aufgaben.</div>`}</div>`;
  main.querySelectorAll("[data-done]").forEach((c) => c.onchange = async () => { await api(`/api/tasks/${c.dataset.done}`, { method: "PATCH", body: { done: true } }); toast("Aufgabe erledigt"); render(); });
  main.querySelectorAll("[data-mail]").forEach((a) => a.onclick = (e) => { e.preventDefault(); state.sel = Number(a.dataset.mail); state.filters = { status: "all" }; state.view = "inbox"; location.hash = "inbox"; render(); });
}

// ---------- Nachfassen ----------
async function viewFollowups(main) {
  const list = await api("/api/followups");
  main.innerHTML = `<div class="top"><h1>Nachfassen</h1><span class="muted">Kunden, die länger als ${state.me.company.followup_hours} Stunden auf eine Antwort warten</span></div>
    <div class="panel">${list.length ? `<ul class="clean">${list.map((e) => `<li><a href="#" data-mail="${e.id}"><b>${esc(e.subject)}</b></a> <span class="badge ${esc(e.priority)}">${esc(e.priority)}</span><br>
      <span class="small muted">${esc(e.from)} · wartet seit ${fmtDate(e.received_at)}</span><br><span class="small">${esc(e.summary)}</span></li>`).join("")}</ul>` : `<div class="empty">Niemand wartet zu lange. 👍</div>`}</div>`;
  main.querySelectorAll("[data-mail]").forEach((a) => a.onclick = (e) => { e.preventDefault(); state.sel = Number(a.dataset.mail); state.filters = { status: "open" }; state.view = "inbox"; location.hash = "inbox"; render(); });
}

// ---------- Team ----------
async function viewTeam(main) {
  const isAdmin = state.me.user.role === "admin";
  const t = state.team = await api("/api/team");
  main.innerHTML = `<div class="top"><h1>Team</h1></div>
    <div class="grid two">
      <div class="panel"><h2>Mitarbeiter</h2><table><tr><th>Name</th><th>Abteilung</th><th>Rolle</th></tr>
        ${t.users.map((u) => `<tr><td>${esc(u.name)}<br><span class="small muted">${esc(u.email)}</span></td><td>${esc(u.department || "–")}</td><td>${u.role === "admin" ? "Admin" : "Mitarbeiter"}</td></tr>`).join("")}</table>
        ${isAdmin ? `<h3 style="margin-top:14px">Mitarbeiter hinzufügen</h3><form id="nu">
          <input name="name" placeholder="Name" required> <input name="email" type="email" placeholder="E-Mail" required>
          <input name="password" type="password" placeholder="Startpasswort (min. 8)" minlength="8" required>
          <select name="department_id"><option value="">– Abteilung –</option>${t.departments.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}</select>
          <button class="btn primary">Hinzufügen</button></form>` : ""}
      </div>
      <div class="panel"><h2>Abteilungen</h2><ul class="clean">${t.departments.map((d) => `<li>${esc(d.name)}</li>`).join("")}</ul>
        ${isAdmin ? `<form id="nd" class="row" style="margin-top:10px"><input name="name" placeholder="Neue Abteilung" required><button class="btn">Anlegen</button></form>` : ""}
      </div>
    </div>`;
  main.querySelector("#nu")?.addEventListener("submit", async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); b.department_id = b.department_id ? Number(b.department_id) : null;
    try { await api("/api/team/users", { method: "POST", body: b }); toast("Mitarbeiter angelegt"); render(); } catch (err) { toast(err.message); }
  });
  main.querySelector("#nd")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try { await api("/api/team/departments", { method: "POST", body: Object.fromEntries(new FormData(e.target)) }); toast("Abteilung angelegt"); render(); } catch (err) { toast(err.message); }
  });
}

// ---------- Einbinden: Postfächer anschließen ----------
async function viewConnect(main) {
  const [{ providers, inbound_domain }, mbs] = await Promise.all([api("/api/providers"), api("/api/mailboxes")]);
  state.mailboxes = mbs;
  const fwdTarget = (m) => m.inbound_email || (m.inbound_url ? location.origin + m.inbound_url : null);
  main.innerHTML = `<div class="top"><h1>Einbinden</h1><span class="muted">So kommen die E-Mails deiner Firma in den Assistenten</span></div>
    <div class="panel" style="margin-bottom:12px">
      <h2>Welcher Weg passt?</h2>
      <table>
        <tr><th>Deine E-Mails liegen bei …</th><th>Empfohlener Weg</th><th>Aufwand</th></tr>
        <tr><td>IONOS, STRATO, GMX, WEB.DE, Telekom, mailbox.org, eigener Server</td><td><b>A · Direkt verbinden</b> (IMAP/SMTP) – Abruf alle 5 Minuten, Antworten gehen direkt raus</td><td>2 Minuten</td></tr>
        <tr><td>Gmail privat</td><td><b>A · Direkt verbinden</b> mit App-Passwort</td><td>5 Minuten</td></tr>
        <tr><td>Microsoft 365 / Outlook, Google Workspace</td><td><b>B · Weiterleitung</b> an die Eingangsadresse unten; Antworten über „Im Mailprogramm öffnen“</td><td>5–10 Minuten, ggf. mit IT-Admin</td></tr>
      </table>
      <p class="small muted">Warum nicht direkt bei Microsoft 365 und Google Workspace? Beide erlauben die Anmeldung per Passwort nicht mehr (nur noch OAuth). Eine direkte Anbindung per Microsoft-/Google-Login ist der nächste Ausbauschritt.</p>
    </div>

    <div class="grid two">
      <form class="panel" id="nm">
        <h2>A · Direkt verbinden</h2>
        <label>Anbieter</label>
        <select id="prov" class="field">${providers.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select>
        <p id="provHint" class="hint small"></p>
        <div id="imapFields">
          <div class="row"><input name="name" placeholder="Name, z. B. Kundenservice" required><input name="address" type="email" placeholder="E-Mail-Adresse" required></div>
          <label>Posteingang (IMAP)</label>
          <div class="row"><input name="imap_host" placeholder="Server"><input name="imap_port" type="number" placeholder="993" style="width:90px"></div>
          <label>Postausgang (SMTP)</label>
          <div class="row"><input name="smtp_host" placeholder="Server"><input name="smtp_port" type="number" placeholder="587" style="width:90px"></div>
          <label>Zugang</label>
          <div class="row"><input name="imap_user" placeholder="Benutzer (meist die E-Mail-Adresse)"><input name="imap_pass" type="password" placeholder="Passwort" autocomplete="new-password"></div>
          <p class="row"><button type="button" class="btn" id="test">Verbindung testen</button><button class="btn primary">Verbinden</button><span id="testOut" class="small"></span></p>
        </div>
      </form>

      <div class="panel">
        <h2>B · Weiterleitung einrichten</h2>
        <p class="small muted">Leite eingehende Mails an diese Adresse${inbound_domain ? "" : " bzw. an einen Mail-Dienst, der sie an die URL schickt"}:</p>
        <ul class="clean">${mbs.map((m) => `<li><b>${esc(m.name)}</b> <span class="muted small">${esc(m.address)}</span><br>
          ${fwdTarget(m) ? `<code>${esc(fwdTarget(m))}</code> <button class="btn small" data-copy="${esc(fwdTarget(m))}">Kopieren</button>` : `<span class="muted small">Demo-Postfach</span>`}</li>`).join("")}</ul>
        <details><summary><b>Microsoft 365 / Outlook</b></summary><ol class="steps small">
          <li>Outlook im Browser → Einstellungen → E-Mail → <i>Weiterleitung</i> → Weiterleitung aktivieren, Adresse oben eintragen, „Kopie behalten“ anhaken.</li>
          <li>Kommt eine Fehlermeldung zur externen Weiterleitung: Der IT-Admin muss sie im Microsoft Defender erlauben (Richtlinie für ausgehenden Spam → <i>Automatische Weiterleitung</i> → „Ein“ für diese Postfächer).</li>
          <li>Für gemeinsame Postfächer (z. B. info@) richtet der Admin die Weiterleitung im Exchange Admin Center ein.</li>
        </ol></details>
        <details><summary><b>Gmail / Google Workspace</b></summary><ol class="steps small">
          <li>Gmail → Einstellungen → <i>Weiterleitung und POP/IMAP</i> → „Weiterleitungsadresse hinzufügen“, Adresse oben eintragen.</li>
          <li>Google schickt einen Bestätigungscode – er erscheint hier im Posteingang des Assistenten. Code in Gmail eingeben.</li>
          <li>„Kopie im Posteingang behalten“ wählen und speichern. Bei Workspace muss der Admin externe Weiterleitung erlauben.</li>
        </ol></details>
        <details><summary><b>Antworten senden bei Weiterleitung</b></summary><p class="small">Klicke bei einer Mail auf <i>Im Mailprogramm öffnen</i>: Die fertige Antwort öffnet sich in Outlook bzw. Gmail und geht von deiner normalen Adresse raus. So bleiben Absender, Signatur und „Gesendet“-Ordner wie gewohnt.</p></details>
      </div>
    </div>

    <div class="panel" style="margin-top:12px">
      <h2>Verbundene Postfächer</h2>
      <table><tr><th>Postfach</th><th>Art</th><th>Status</th><th></th></tr>
        ${mbs.map((m) => `<tr><td><b>${esc(m.name)}</b><br><span class="small muted">${esc(m.address)}</span></td>
          <td>${{ imap: "Direkt (IMAP)", webhook: "Weiterleitung", demo: "Demo" }[m.kind] || esc(m.kind)}</td>
          <td class="small">${m.kind === "imap" ? (m.last_error ? `<span class="status-bad">▲ Fehler: ${esc(m.last_error)}</span>` : m.last_sync_at ? `<span class="status-ok">✓ Abgerufen ${fmtDate(m.last_sync_at)}</span>` : "noch nicht abgerufen") : "–"}</td>
          <td>${m.kind === "imap" ? `<button class="btn small" data-sync="${m.id}">Jetzt abrufen</button>` : ""}</td></tr>`).join("")}
      </table>
    </div>`;

  const form = main.querySelector("#nm");
  const applyProvider = () => {
    const p = providers.find((x) => x.id === main.querySelector("#prov").value);
    main.querySelector("#provHint").textContent = p.hint || "";
    main.querySelector("#imapFields").hidden = Boolean(p.forwarding_only);
    for (const k of ["imap_host", "imap_port", "smtp_host", "smtp_port"]) if (p[k] != null) form[k].value = p[k];
    if (p.id === "other") for (const k of ["imap_host", "imap_port", "smtp_host", "smtp_port"]) form[k].value = "";
  };
  main.querySelector("#prov").onchange = applyProvider;
  applyProvider();
  form.address.oninput = () => { if (!form.imap_user.dataset.touched) form.imap_user.value = form.address.value; };
  form.imap_user.oninput = () => { form.imap_user.dataset.touched = "1"; };
  const values = () => {
    const b = Object.fromEntries([...new FormData(form)].filter(([, v]) => v));
    for (const k of ["imap_port", "smtp_port"]) if (b[k]) b[k] = Number(b[k]);
    b.smtp_user = b.imap_user; b.smtp_pass = b.imap_pass;
    return b;
  };
  main.querySelector("#test").onclick = async (ev) => {
    const out = main.querySelector("#testOut");
    ev.target.disabled = true; out.textContent = "Teste …"; out.className = "small";
    try {
      const r = await api("/api/mailboxes/test", { method: "POST", body: values() });
      out.textContent = r.ok ? `✓ Verbindung klappt (${r.messages} E-Mails im Posteingang)` : `▲ ${r.error}`;
      out.className = `small ${r.ok ? "status-ok" : "status-bad"}`;
    } catch (err) { out.textContent = `▲ ${err.message}`; out.className = "small status-bad"; }
    ev.target.disabled = false;
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    try { await api("/api/mailboxes", { method: "POST", body: values() }); toast("Postfach verbunden – Abruf alle 5 Minuten"); render(); } catch (err) { toast(err.message); }
  };
  main.querySelectorAll("[data-copy]").forEach((b) => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); toast("Adresse kopiert"); } catch { toast("Bitte Adresse markieren und kopieren"); } });
  main.querySelectorAll("[data-sync]").forEach((b) => b.onclick = async () => {
    b.disabled = true;
    try { const r = await api(`/api/mailboxes/${b.dataset.sync}/sync`, { method: "POST", body: {} }); toast(`${r.new_emails} neue E-Mails`); render(); } catch (err) { toast(err.message); b.disabled = false; }
  });
}

// ---------- Einstellungen ----------
async function viewSettings(main) {
  const [s, rules] = await Promise.all([api("/api/settings"), api("/api/rules")]);
  const t = state.team;
  main.innerHTML = `<div class="top"><h1>Einstellungen</h1><a href="#connect" data-go="connect">Postfächer verbinden →</a></div>
    <div class="grid two">
      <form class="panel" id="st">
        <h2>Firma & Antwortstil</h2>
        <label>Firmenname</label><input class="field" name="name" value="${esc(s.name)}">
        <label>Tonfall der Antworten (z. B. „Sie-Form, sachlich“ oder „Du-Form, locker“)</label><input class="field" name="tone" value="${esc(s.tone)}">
        <label>Signatur</label><textarea name="signature" rows="3">${esc(s.signature)}</textarea>
        <label>Firmenwissen (eine Info pro Zeile, Format „Thema: Information“) – daraus schreibt die KI Antworten</label>
        <textarea name="knowledge" rows="8">${esc(s.knowledge)}</textarea>
        <label>Nachfassen nach (Stunden ohne Antwort)</label><input name="followup_hours" type="number" min="1" value="${s.followup_hours}">
        <p><button class="btn primary">Speichern</button></p>
      </form>
      <div class="panel">
        <h2>Zuweisungsregeln</h2>
        <p class="small muted">Stichwort-Regeln gelten vor Kategorie-Regeln.</p>
        <ul class="clean">${rules.map((r) => `<li class="row" style="justify-content:space-between"><span>${r.keyword ? `Stichwort „${esc(r.keyword)}“` : catChip(r.category)} → <b>${esc(r.department || r.user || "–")}</b></span><button class="btn danger small" data-del="${r.id}">Löschen</button></li>`).join("")}</ul>
        <form id="nr" class="row" style="margin-top:10px">
          <select name="category" aria-label="Kategorie"><option value="">Kategorie …</option>${state.me.categories.map((c) => `<option value="${c}">${esc(catLabel(c))}</option>`).join("")}</select>
          <input name="keyword" placeholder="oder Stichwort" aria-label="Stichwort">
          <select name="department_id" required aria-label="Abteilung"><option value="">→ Abteilung</option>${t.departments.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}</select>
          <button class="btn">Regel anlegen</button>
        </form>
      </div>
    </div>`;
  main.querySelector("[data-go]").onclick = (e) => { e.preventDefault(); go("connect"); };
  main.querySelector("#st").onsubmit = async (e) => { e.preventDefault(); await api("/api/settings", { method: "PUT", body: Object.fromEntries(new FormData(e.target)) }); state.me = await api("/api/me"); toast("Gespeichert"); render(); };
  main.querySelector("#nr").onsubmit = async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); b.department_id = Number(b.department_id);
    try { await api("/api/rules", { method: "POST", body: b }); toast("Regel angelegt"); render(); } catch (err) { toast(err.message); }
  };
  main.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => { await api(`/api/rules/${b.dataset.del}`, { method: "DELETE", body: {} }); render(); });
}

window.addEventListener("hashchange", () => { const v = location.hash.slice(1); if (state.me && v !== state.view && VIEWS.some(([k]) => k === v)) { state.view = v; render(); } });
boot();
