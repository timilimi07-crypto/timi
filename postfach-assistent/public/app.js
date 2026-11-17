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

// ---------- Rahmen ----------
const VIEWS = [
  ["overview", "Übersicht"], ["inbox", "Posteingang"], ["tasks", "Aufgaben"], ["followups", "Nachfassen"], ["team", "Team"], ["settings", "Einstellungen"],
];

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
  $app.innerHTML = `
  <div class="shell">
    <aside class="side">
      <div class="brand">${esc(state.me.company.name)}<small>${esc(state.me.user.name)} · ${isAdmin ? "Admin" : "Mitarbeiter"}</small></div>
      <nav class="nav">
        ${VIEWS.filter(([k]) => k !== "settings" || isAdmin).map(([k, l]) => {
          const c = k === "inbox" ? `<span class="count ${s.urgent_open ? "red" : ""}">${s.open}</span>` : k === "tasks" ? `<span class="count ${s.tasks_due ? "red" : ""}">${s.tasks_open}</span>` : k === "followups" ? `<span class="count ${s.overdue_followups ? "red" : ""}">${s.overdue_followups}</span>` : "";
          return `<a href="#${k}" data-view="${k}" class="${state.view === k ? "active" : ""}">${l}${c}</a>`;
        }).join("")}
      </nav>
      <div class="foot">KI: ${esc(state.me.ai)}<br><a href="#" id="logout">Abmelden</a></div>
    </aside>
    <main id="main"></main>
  </div>`;
  document.querySelectorAll("[data-view]").forEach((a) => a.onclick = (e) => { e.preventDefault(); state.view = a.dataset.view; location.hash = a.dataset.view; render(); });
  document.getElementById("logout").onclick = async (e) => { e.preventDefault(); await api("/api/logout", { method: "POST", body: {} }); state.me = null; renderLogin(); };
  const main = document.getElementById("main");
  try {
    await ({ overview: viewOverview, inbox: viewInbox, tasks: viewTasks, followups: viewFollowups, team: viewTeam, settings: viewSettings }[state.view])(main);
  } catch (e) { main.innerHTML = `<div class="panel">${esc(e.message)}</div>`; }
}

// ---------- Übersicht: alle E-Mails zusammenfassen ----------
async function viewOverview(main) {
  main.innerHTML = `
    <div class="top">
      <h1>Übersicht</h1>
      <div class="row">
        <select id="period">${[["today", "Heute"], ["week", "Letzte 7 Tage"], ["month", "Letzte 30 Tage"], ["all", "Alles"]].map(([v, l]) => `<option value="${v}" ${state.period === v ? "selected" : ""}>${l}</option>`).join("")}</select>
        <select id="mb"><option value="">Alle Postfächer</option>${state.mailboxes.map((m) => `<option value="${m.id}" ${String(state.digestMailbox) === String(m.id) ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select>
        <button class="btn primary" id="go">Alle E-Mails zusammenfassen</button>
      </div>
    </div>
    <div id="digest"><div class="panel empty">Fasse zusammen …</div></div>`;
  const load = async () => {
    document.getElementById("digest").innerHTML = `<div class="panel empty">Fasse zusammen …</div>`;
    const d = await api(`/api/digest?period=${state.period}${state.digestMailbox ? `&mailbox=${state.digestMailbox}` : ""}`);
    renderDigest(d);
  };
  document.getElementById("period").onchange = (e) => { state.period = e.target.value; load(); };
  document.getElementById("mb").onchange = (e) => { state.digestMailbox = e.target.value; load(); };
  document.getElementById("go").onclick = load;
  await load();
}

function renderDigest(d) {
  const s = d.stats;
  const cats = Object.entries(s.by_category).filter(([c]) => c !== "spam").sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...cats.map(([, n]) => n));
  document.getElementById("digest").innerHTML = `
    <div class="panel" style="margin-bottom:12px">
      <div class="headline">${esc(d.headline)}</div>
      <p>${esc(d.overview)}</p>
      <div class="small muted">${esc(d.period_label)} · erstellt ${fmtDate(d.generated_at)} · ${d.generated_by === "claude" ? "von Claude" : "lokale Auswertung"}</div>
    </div>
    <div class="grid kpis" style="margin-bottom:12px">
      ${[["E-Mails", s.total], ["Offen", s.open], ["Dringend offen", s.urgent_open], ["Beantwortet", s.answered], ["Warten > Frist", s.overdue_followups], ["Aufgaben fällig", s.tasks_due], ["Spam aussortiert", s.spam]]
        .map(([l, v]) => `<div class="panel kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("")}
    </div>
    <div class="grid two">
      <div class="panel">
        <h2>Jetzt erledigen</h2>
        ${d.actions.length ? `<ul class="clean">${d.actions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : `<p class="muted">Nichts Dringendes.</p>`}
      </div>
      <div class="panel">
        <h2>Dringende E-Mails</h2>
        ${d.urgent.length ? `<ul class="clean">${d.urgent.map((u) => `<li><a href="#" data-open="${u.id}"><b>${esc(u.subject)}</b></a><br><span class="small muted">${esc(u.summary)}</span></li>`).join("")}</ul>` : `<p class="muted">Keine dringenden E-Mails offen.</p>`}
      </div>
      <div class="panel">
        <h2>Themen</h2>
        <ul class="clean">${d.topics.map((t) => `<li>${esc(t)}</li>`).join("") || "<li class='muted'>Keine E-Mails im Zeitraum.</li>"}</ul>
      </div>
      <div class="panel">
        <h2>Nach Kategorie</h2>
        ${cats.map(([c, n]) => `<div class="bar-row"><span>${esc(catLabel(c))}</span><div class="bar" style="width:${(n / max) * 100}%"></div><span>${n}</span></div>`).join("") || "<p class='muted'>–</p>"}
      </div>
    </div>`;
  document.querySelectorAll("[data-open]").forEach((a) => a.onclick = (e) => { e.preventDefault(); state.sel = Number(a.dataset.open); state.filters = { status: "open" }; state.view = "inbox"; location.hash = "inbox"; render(); });
}

// ---------- Posteingang ----------
async function viewInbox(main) {
  const f = state.filters;
  const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
  const emails = await api(`/api/emails?${q}`);
  if (state.sel && !emails.some((e) => e.id === state.sel)) state.sel = emails[0]?.id ?? null;
  if (!state.sel && emails.length && window.innerWidth > 860) state.sel = emails[0].id;
  main.innerHTML = `
    <div class="top">
      <h1>Posteingang</h1>
      <div class="row">
        <input id="q" placeholder="Suchen …" value="${esc(f.q || "")}">
        <select data-f="status">${[["open", "Offen"], ["answered", "Beantwortet"], ["done", "Erledigt"], ["spam", "Spam"], ["all", "Alle"]].map(([v, l]) => `<option value="${v}" ${f.status === v ? "selected" : ""}>${l}</option>`).join("")}</select>
        <select data-f="category"><option value="">Alle Kategorien</option>${state.me.categories.map((c) => `<option value="${c}" ${f.category === c ? "selected" : ""}>${esc(catLabel(c))}</option>`).join("")}</select>
        <select data-f="priority"><option value="">Jede Dringlichkeit</option>${["hoch", "mittel", "niedrig"].map((p) => `<option ${f.priority === p ? "selected" : ""}>${p}</option>`).join("")}</select>
        ${state.mailboxes.length > 1 ? `<select data-f="mailbox"><option value="">Alle Postfächer</option>${state.mailboxes.map((m) => `<option value="${m.id}" ${String(f.mailbox) === String(m.id) ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select>` : ""}
        <label class="row" style="margin:0;color:var(--text)"><input type="checkbox" id="mine" ${f.mine === "1" ? "checked" : ""}> Nur meine</label>
      </div>
    </div>
    <div class="inbox">
      <div class="panel list">${emails.length ? emails.map((e) => `
        <div class="item ${e.id === state.sel ? "sel" : ""}" data-id="${e.id}">
          <div class="h"><span class="from">${esc(e.from_name || e.from_addr)}</span><span class="small muted">${fmtDate(e.received_at)}</span></div>
          <div class="subj">${esc(e.subject)}${e.thread_count > 1 ? ` <span class="badge">${e.thread_count}</span>` : ""}</div>
          <div class="sum">${esc(e.summary || "")}</div>
          <div class="meta"><span class="badge ${esc(e.priority)}">${esc(e.priority || "–")}</span><span class="badge cat">${esc(catLabel(e.category))}</span>${e.department ? `<span class="badge">${esc(e.department)}</span>` : ""}${e.sentiment === "negativ" ? `<span class="badge negativ">verärgert</span>` : ""}${e.status !== "open" ? `<span class="badge ${esc(e.status)}">${STATUS[e.status]}</span>` : ""}</div>
        </div>`).join("") : `<div class="empty">Keine E-Mails für diesen Filter. 🎉</div>`}
      </div>
      <div id="detail">${state.sel ? `<div class="panel empty">Lade …</div>` : `<div class="panel empty">E-Mail auswählen</div>`}</div>
    </div>`;
  document.querySelectorAll("[data-f]").forEach((s) => s.onchange = () => { f[s.dataset.f] = s.value; render(); });
  document.getElementById("mine").onchange = (e) => { f.mine = e.target.checked ? "1" : ""; render(); };
  let t; document.getElementById("q").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value; render().then(() => { const q = document.getElementById("q"); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }); }, 350); };
  document.querySelectorAll(".item").forEach((it) => it.onclick = () => {
    state.sel = Number(it.dataset.id);
    document.querySelectorAll(".item").forEach((x) => x.classList.toggle("sel", x === it));
    showDetail(state.sel);
    if (window.innerWidth <= 860) document.getElementById("detail").scrollIntoView({ behavior: "smooth" });
  });
  if (state.sel) showDetail(state.sel);
}

async function showDetail(id) {
  const box = document.getElementById("detail");
  const e = await api(`/api/emails/${id}`);
  const users = state.team.users, depts = state.team.departments;
  box.innerHTML = `
    <div class="panel">
      <div class="row" style="justify-content:space-between">
        <h2 style="margin:0">${esc(e.subject)}</h2>
        <div class="row">
          <button class="btn" data-status="done">Erledigt</button>
          <button class="btn" data-status="spam">Spam</button>
          ${e.status !== "open" ? `<button class="btn" data-status="open">Wieder öffnen</button>` : ""}
        </div>
      </div>
      <div class="small muted">Von ${esc(e.from_name || "")} &lt;${esc(e.from_addr)}&gt; · ${fmtDate(e.received_at)} · Postfach ${esc(e.mailbox)}</div>
      <div class="row" style="margin-top:8px">
        <span class="badge ${esc(e.priority)}">Dringlichkeit: ${esc(e.priority)}</span>
        <span class="badge cat">${esc(catLabel(e.category))}</span>
        <span class="badge ${esc(e.sentiment)}">Stimmung: ${esc(e.sentiment)}</span>
        <span class="badge ${esc(e.status)}">${STATUS[e.status]}</span>
      </div>
      <div class="summary-box"><b>Kurz gesagt:</b> ${esc(e.summary)}</div>
      <div class="row">
        <span class="small muted">Zuständig:</span>
        <select id="dept"><option value="">– Abteilung –</option>${depts.map((d) => `<option value="${d.id}" ${d.id === e.department_id ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select>
        <select id="asg"><option value="">– Person –</option>${users.map((u) => `<option value="${u.id}" ${u.id === e.assignee_id ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select>
      </div>
      ${e.tasks.length ? `<h3 style="margin-top:14px">Erkannte Aufgaben</h3><ul class="tasks">${e.tasks.map((t) => `<li>${esc(t.title)} ${t.due_date ? `<span class="${dueClass(t.due_date)}">· bis ${fmtDate(t.due_date)}</span>` : ""}</li>`).join("")}</ul>` : ""}
      ${e.thread.length > 1 ? `
        <h3 style="margin-top:14px">Verlauf (${e.thread.length} Nachrichten) <button class="btn small" id="tsum">Verlauf zusammenfassen</button></h3>
        <div id="tsumout"></div>
        ${e.thread.map((m) => `<div class="thread-msg ${m.direction}"><div class="small muted">${m.direction === "out" ? "Unsere Antwort" : esc(m.from_name || m.from_addr)} · ${fmtDate(m.received_at)}</div><div class="small">${esc(m.summary || m.body.slice(0, 200))}</div></div>`).join("")}` : ""}
      <h3 style="margin-top:14px">Original</h3>
      <div class="body">${esc(e.body)}</div>
      ${e.status === "spam" ? "" : `
      <h3 style="margin-top:14px">Antwort ${e.draft ? "(Entwurf der KI – bitte prüfen)" : ""}</h3>
      <textarea id="draft" rows="12">${esc(e.draft || "")}</textarea>
      <div class="row" style="margin-top:8px">
        <button class="btn primary" id="send">Senden</button>
        <button class="btn" id="save">Entwurf speichern</button>
        <button class="btn" id="re">Neu auswerten</button>
        <span class="small muted">Es wird nichts ohne deinen Klick verschickt.</span>
      </div>`}
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
  box.querySelector("#save")?.addEventListener("click", () => patch({ draft: box.querySelector("#draft").value }, "Entwurf gespeichert"));
  box.querySelector("#re")?.addEventListener("click", async () => { await api(`/api/emails/${id}/reanalyze`, { method: "POST", body: {} }); toast("Neu ausgewertet"); showDetail(id); });
  box.querySelector("#send")?.addEventListener("click", async (ev) => {
    const text = box.querySelector("#draft").value;
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

// ---------- Einstellungen ----------
async function viewSettings(main) {
  const [s, rules, mbs] = await Promise.all([api("/api/settings"), api("/api/rules"), api("/api/mailboxes")]);
  const t = state.team;
  main.innerHTML = `<div class="top"><h1>Einstellungen</h1></div>
    <div class="grid two">
      <form class="panel" id="st">
        <h2>Firma & Antwortstil</h2>
        <label>Firmenname</label><input class="field" name="name" value="${esc(s.name)}">
        <label>Tonfall der Antworten</label><input class="field" name="tone" value="${esc(s.tone)}">
        <label>Signatur</label><textarea name="signature" rows="3">${esc(s.signature)}</textarea>
        <label>Firmenwissen (eine Info pro Zeile, Format „Thema: Information“) – daraus schreibt die KI Antworten</label>
        <textarea name="knowledge" rows="8">${esc(s.knowledge)}</textarea>
        <label>Nachfassen nach (Stunden ohne Antwort)</label><input name="followup_hours" type="number" min="1" value="${s.followup_hours}">
        <p><button class="btn primary">Speichern</button></p>
      </form>
      <div class="grid">
        <div class="panel">
          <h2>Zuweisungsregeln</h2>
          <p class="small muted">Stichwort-Regeln gelten vor Kategorie-Regeln.</p>
          <ul class="clean">${rules.map((r) => `<li class="row" style="justify-content:space-between"><span>${r.keyword ? `Stichwort „${esc(r.keyword)}“` : `Kategorie ${esc(catLabel(r.category))}`} → <b>${esc(r.department || r.user || "–")}</b></span><button class="btn danger small" data-del="${r.id}">Löschen</button></li>`).join("")}</ul>
          <form id="nr" class="row" style="margin-top:10px">
            <select name="category"><option value="">Kategorie …</option>${state.me.categories.map((c) => `<option value="${c}">${esc(catLabel(c))}</option>`).join("")}</select>
            <input name="keyword" placeholder="oder Stichwort">
            <select name="department_id" required><option value="">→ Abteilung</option>${t.departments.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}</select>
            <button class="btn">Regel anlegen</button>
          </form>
        </div>
        <div class="panel">
          <h2>Postfächer</h2>
          <ul class="clean">${mbs.map((m) => `<li><b>${esc(m.name)}</b> · ${esc(m.address)} <span class="badge">${esc(m.kind)}</span>
            ${m.kind === "imap" ? `<button class="btn small" data-sync="${m.id}">Jetzt abrufen</button><br><span class="small muted">Letzter Abruf: ${esc(m.last_sync_at || "nie")}</span>` : ""}
            ${m.inbound_url ? `<br><span class="small muted">Weiterleitungs-Adresse für Mail-Dienste: <code>${esc(location.origin + m.inbound_url)}</code></span>` : ""}</li>`).join("")}</ul>
          <h3 style="margin-top:14px">Postfach verbinden</h3>
          <form id="nm">
            <div class="row"><input name="name" placeholder="Name, z. B. Support" required><input name="address" type="email" placeholder="Adresse" required></div>
            <p class="small muted">IMAP/SMTP leer lassen, wenn Mails per Weiterleitung kommen sollen.</p>
            <div class="row"><input name="imap_host" placeholder="IMAP-Server"><input name="imap_port" type="number" placeholder="993" style="width:90px"><input name="imap_user" placeholder="Benutzer"><input name="imap_pass" type="password" placeholder="Passwort"></div>
            <div class="row" style="margin-top:6px"><input name="smtp_host" placeholder="SMTP-Server"><input name="smtp_port" type="number" placeholder="587" style="width:90px"><input name="smtp_user" placeholder="Benutzer"><input name="smtp_pass" type="password" placeholder="Passwort"></div>
            <p><button class="btn primary">Verbinden</button></p>
          </form>
        </div>
      </div>
    </div>`;
  main.querySelector("#st").onsubmit = async (e) => { e.preventDefault(); await api("/api/settings", { method: "PUT", body: Object.fromEntries(new FormData(e.target)) }); state.me = await api("/api/me"); toast("Gespeichert"); render(); };
  main.querySelector("#nr").onsubmit = async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); b.department_id = Number(b.department_id);
    try { await api("/api/rules", { method: "POST", body: b }); toast("Regel angelegt"); render(); } catch (err) { toast(err.message); }
  };
  main.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => { await api(`/api/rules/${b.dataset.del}`, { method: "DELETE", body: {} }); render(); });
  main.querySelectorAll("[data-sync]").forEach((b) => b.onclick = async () => {
    b.disabled = true;
    try { const r = await api(`/api/mailboxes/${b.dataset.sync}/sync`, { method: "POST", body: {} }); toast(`${r.new_emails} neue E-Mails`); render(); } catch (err) { toast(err.message); b.disabled = false; }
  });
  main.querySelector("#nm").onsubmit = async (e) => {
    e.preventDefault(); const b = Object.fromEntries([...new FormData(e.target)].filter(([, v]) => v));
    for (const k of ["imap_port", "smtp_port"]) if (b[k]) b[k] = Number(b[k]);
    try { await api("/api/mailboxes", { method: "POST", body: b }); state.mailboxes = await api("/api/mailboxes"); toast("Postfach verbunden"); render(); } catch (err) { toast(err.message); }
  };
}

window.addEventListener("hashchange", () => { const v = location.hash.slice(1); if (state.me && v !== state.view && VIEWS.some(([k]) => k === v)) { state.view = v; render(); } });
boot();
