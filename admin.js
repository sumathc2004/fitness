const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const D = SVDData, esc = D.esc;

// guard: trainers only
const me = SVDAuth.current();
if (!me) location.replace('login.html');
else if (me.role === 'client') location.replace('dashboard.html');

const toast = t => { const e = $('#toast'); e.textContent = t; e.classList.add('show'); setTimeout(() => e.classList.remove('show'), 1900); };
const st = { view: 'dash', cid: null, tab: 'overview', day: (new Date().getDay() + 6) % 7, q: '' };
const num = v => (v === '' || v == null || isNaN(+v)) ? 0 : +v;

$('#adminName').textContent = me ? me.name : '';
$('#dateChip').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
$('#logout').onclick = () => SVDAuth.logout();
$('#burger').onclick = () => $('#side').classList.toggle('open');
$$('#menu button').forEach(b => b.onclick = () => go(b.dataset.v));
$('#addTop').onclick = () => addClientModal();

function go(view, cid, tab) {
  st.view = view; if (cid) st.cid = cid; st.tab = tab || 'overview';
  $('#side').classList.remove('open');
  render(); scrollTo(0, 0);
}

// ---------- helpers ----------
const prog = c => { // % of the way from start weight to target weight
  const s = c.startWeight, t = c.targetWeight, w = D.curWeight(c);
  if (!t || s === t) return 100;
  return Math.max(0, Math.min(100, Math.round((s - w) / (s - t) * 100)));
};
const badge = c => {
  const a = D.adherence(c), la = D.daysAgo(D.lastActive(c));
  if (c.status !== 'active') return '<span class="bdg gray">Paused</span>';
  if (a === null) return '<span class="bdg gray">No plan</span>';
  if (a >= 75) return `<span class="bdg green">${a}% on track</span>`;
  if (a >= 40 && (la === null || la < 3)) return `<span class="bdg amber">${a}% adherence</span>`;
  return `<span class="bdg red">${a}% — needs attention</span>`;
};
const lastTxt = c => { const d = D.daysAgo(D.lastActive(c)); return d === null ? 'No activity yet' : d === 0 ? 'Active today' : d === 1 ? 'Active yesterday' : `Active ${d} days ago`; };
const needsAttention = c => c.status === 'active' && ((D.adherence(c) !== null && D.adherence(c) < 40) || D.lastActive(c) === null || D.daysAgo(D.lastActive(c)) >= 3);
const av = (c, cls = '') => `<div class="avt ${cls}">${esc(D.initials(c.name))}</div>`;

// ---------- views ----------
function viewDash() {
  const cs = D.all(), act = cs.filter(c => c.status === 'active');
  if (!cs.length) return emptyState();
  const ads = act.map(D.adherence).filter(a => a !== null), avg = ads.length ? Math.round(ads.reduce((a, b) => a + b, 0) / ads.length) : 0;
  const wk = D.weekDates(), wkStart = wk[0];
  const weighins = cs.reduce((a, c) => a + c.progress.filter(p => p.date >= wkStart).length, 0);
  const attn = cs.filter(needsAttention);
  const feed = cs.flatMap(c => c.progress.map(p => ({ c, p }))).sort((a, b) => b.p.date.localeCompare(a.p.date)).slice(0, 6);
  const hr = new Date().getHours(), ranked = act.map(c => ({ c, a: D.adherence(c) })).sort((x, y) => (y.a ?? -1) - (x.a ?? -1));
  const banner = `<div class="hero"><div class="hero-txt"><span class="hero-tag">${hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'}, ${esc(me.name.split(' ')[0])}</span>
    <h2>${attn.length ? attn.length + (attn.length > 1 ? ' clients need' : ' client needs') + ' your attention' : 'All clients are on track 🎉'}</h2>
    <p>${act.length} active client${act.length === 1 ? '' : 's'} · ${weighins} check-in${weighins === 1 ? '' : 's'} this week · average adherence ${avg}%</p>
    <div class="hero-btns"><button class="hbtn w" data-act="add">+ Add client</button><button class="hbtn g" data-act="gotoclients">View all clients</button></div></div>
    <div class="hero-ring" style="--p:${avg}"><div><b>${avg}%</b><small>adherence</small></div></div></div>`;
  return banner + `
  <div class="grid4">
    <div class="card stat s2"><span class="e">👥</span><small>Total clients</small><strong>${cs.length}</strong><em>${act.length} active</em></div>
    <div class="card stat s1"><span class="e">🎯</span><small>Avg. adherence</small><strong>${avg}%</strong><em>this week</em><div class="mini"><i style="width:${avg}%"></i></div></div>
    <div class="card stat s3"><span class="e">⚖️</span><small>Weigh-ins</small><strong>${weighins}</strong><em>this week</em></div>
    <div class="card stat s4"><span class="e">🚨</span><small>Need attention</small><strong>${attn.length}</strong><em>${attn.length ? 'follow up today' : 'all on track'}</em></div>
  </div>
  <div class="grid2">
    <div class="card"><h3>Clients</h3><p class="sub">Click a client to update their plan.</p>${cs.map(clientRow).join('')}</div>
    <div>
      <div class="card" style="margin-bottom:18px"><h3>Adherence this week</h3><p class="sub">Share of planned exercises completed.</p>
        ${ranked.length ? ranked.map(({ c, a }) => `<div class="rank" data-act="open" data-id="${c.id}">${av(c, 'sm')}<div><b>${esc(c.name)}</b><div class="track"><i class="g" style="width:${a || 0}%"></i></div></div><span class="pct">${a === null ? '–' : a + '%'}</span></div>`).join('') : '<div class="empty">No active clients.</div>'}</div>
      <div class="card" style="margin-bottom:18px"><h3>Needs attention</h3><p class="sub">Low adherence or inactive 3+ days.</p>
        ${attn.length ? attn.map(c => `<div class="row click" data-act="open" data-id="${c.id}"><div style="display:flex;gap:12px;align-items:center">${av(c, 'sm')}<div><b>${esc(c.name)}</b><small>${lastTxt(c)}</small></div></div>${badge(c)}</div>`).join('') : '<div class="empty">🎉 Everyone is on track.</div>'}</div>
      <div class="card"><h3>Recent weigh-ins</h3><p class="sub">Latest check-ins across clients.</p>
        ${feed.length ? feed.map(({ c, p }) => `<div class="row click" data-act="open" data-id="${c.id}" data-tab="progress"><div><b>${esc(c.name)}</b><small>${p.date}</small></div><b>${p.weight || '–'} kg</b></div>`).join('') : '<div class="empty">No weigh-ins logged yet.</div>'}</div>
    </div>
  </div>`;
}
const clientRow = c => `<div class="row click" data-act="open" data-id="${c.id}"><div style="display:flex;gap:12px;align-items:center;min-width:0">${av(c, 'sm')}<div style="min-width:0"><b>${esc(c.name)}</b><small>${esc(c.goal)} · ${D.curWeight(c)} kg → ${c.targetWeight} kg</small></div></div>${badge(c)}</div>`;

function emptyState() {
  return `<div class="card empty-big"><div class="eb">🏋️</div><h3>No clients yet</h3><p class="sub">Add your first client to start building workout and diet plans and tracking progress.</p>
    <div class="hero-btns" style="justify-content:center"><button class="btn" data-act="add">+ Add client</button><button class="btn ghost" data-act="seed">Load 2 sample clients</button></div></div>`;
}

function viewClients() {
  const all = D.all();
  if (!all.length) return emptyState();
  const q = st.q.toLowerCase(), cs = all.filter(c => (c.name + c.goal + c.email).toLowerCase().includes(q));
  return `<div class="toolbar"><input id="search" type="search" placeholder="Search clients…" value="${esc(st.q)}"><span class="mut">${cs.length} of ${all.length}</span></div>
  <div class="cgrid">${cs.map(c => `
    <div class="card ccard" data-act="open" data-id="${c.id}">
      <div class="ctop">${av(c)}<div><b>${esc(c.name)}</b><small>${esc(c.goal)}</small></div></div>
      <div class="cw"><span>${D.curWeight(c)} kg</span><small>target ${c.targetWeight} kg</small></div>
      <div class="track"><i class="g" style="width:${prog(c)}%"></i></div>
      <div class="cfoot">${badge(c)}<small>${lastTxt(c)}</small></div>
    </div>`).join('') || '<div class="empty">No clients match your search.</div>'}</div>`;
}

function viewClient() {
  const c = D.get(st.cid);
  if (!c) { st.view = 'clients'; return viewClients(); }
  const tabs = [['overview', 'Overview'], ['workout', 'Workout plan'], ['diet', 'Diet plan'], ['progress', 'Progress'], ['payments', 'Payments'], ['profile', 'Profile & login']];
  return `<button class="back" data-act="back">← All clients</button>
  <div class="chead card"><div style="display:flex;gap:16px;align-items:center">${av(c, 'lg')}<div><h2>${esc(c.name)}</h2><p class="mut">${esc(c.goal)} · joined ${c.joined}</p></div></div><div style="display:flex;gap:8px;flex-wrap:wrap">${planChip(c)}${badge(c)}</div></div>
  <div class="days tabs">${tabs.map(([k, l]) => `<button class="${st.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${l}</button>`).join('')}</div>
  <div id="tabBody">${({ overview: tOverview, workout: tWorkout, diet: tDiet, progress: tProgress, payments: tPayments, profile: tProfile })[st.tab](c)}</div>`;
}

function tOverview(c) {
  const cw = D.curWeight(c), dlt = +(cw - c.startWeight).toFixed(1), a = D.adherence(c), t = D.dayStat(c, D.today());
  return `<div class="grid4">
    <div class="card stat s2"><small>Current weight</small><strong>${cw} kg</strong><em>${dlt > 0 ? '+' : ''}${dlt} kg since start</em></div>
    <div class="card stat s1"><small>To target</small><strong>${Math.abs(+(cw - c.targetWeight).toFixed(1))} kg</strong><em>${prog(c)}% there</em><div class="mini"><i style="width:${prog(c)}%"></i></div></div>
    <div class="card stat s3"><small>Week adherence</small><strong>${a === null ? '–' : a + '%'}</strong><em>${t.planned ? `today ${t.done}/${t.planned} exercises` : 'rest day today'}</em><div class="mini"><i style="width:${a || 0}%"></i></div></div>
    <div class="card stat s4"><small>Streak</small><strong>${D.streak(c)} days</strong><em>${lastTxt(c)}</em></div></div>
  <div class="grid2"><div class="card"><h3>This week</h3><p class="sub">Planned (light) vs completed (colour) exercises</p>${D.weekBars(c)}</div>
    <div class="card"><h3>Trainer notes</h3><p class="sub">Private — clients can't see this.</p><textarea class="notes" data-edit="notes" placeholder="Injuries, preferences, reminders…">${esc(c.notes)}</textarea></div></div>
  <div class="card"><h3>Weight trend</h3><p class="sub">Dashed line is the target.</p>${D.weightChart(c)}</div>`;
}

function tWorkout(c) {
  const dates = D.weekDates(), ds = dates[st.day], list = c.workouts[st.day] || [], L = (c.log[ds] || {}).ex || [], today = D.today();
  return `<div class="card"><h3>Weekly workout plan</h3><p class="sub">Edit anything — changes appear instantly on the client's dashboard.</p>
    <div class="days">${D.DAYS.map((d, i) => `<button class="${i === st.day ? 'on' : ''}" data-act="day" data-i="${i}">${d}${(c.workouts[i] || []).length ? ` <span class="dotc">${c.workouts[i].length}</span>` : ''}</button>`).join('')}</div>
    ${list.length ? `<div class="thead"><span>Exercise</span><span>Sets × reps</span><span>Notes</span><span></span></div>` + list.map((x, i) => `
      <div class="erow"><input data-edit="ex" data-i="${i}" data-k="n" value="${esc(x.n)}" aria-label="Exercise">
      <input data-edit="ex" data-i="${i}" data-k="s" value="${esc(x.s)}" aria-label="Sets">
      <input data-edit="ex" data-i="${i}" data-k="note" value="${esc(x.note || '')}" placeholder="optional note" aria-label="Note">
      <span class="st"><button class="howto" data-act="how" data-i="${i}" title="Preview 3D demo">▶ 3D</button>${L.includes(x.id) ? '<span class="bdg green">✓ Done</span>' : ds > today ? '<span class="bdg gray">Upcoming</span>' : '<span class="bdg gray">Not done</span>'}<button class="x" data-act="delex" data-i="${i}" aria-label="Remove">✕</button></span></div>`).join('') : '<div class="empty">Rest day — add exercises below.</div>'}
    <form class="add" data-form="ex"><input name="n" placeholder="Exercise (e.g. Bench Press)" required><input name="s" placeholder="4×10" style="max-width:120px"><input name="note" placeholder="Note (optional)"><button class="btn">Add</button></form>
    ${list.length ? `<div class="copy"><span class="mut">Copy ${D.DAYS[st.day]} to</span> ${D.DAYS.map((d, i) => i === st.day ? '' : `<button class="pill" data-act="copyday" data-i="${i}">${d}</button>`).join('')}</div>` : ''}
  </div>`;
}

function tDiet(c) {
  const T = c.diet.targets, M = c.diet.meals, sum = k => M.reduce((a, m) => a + num(m[k]), 0), eaten = (c.log[D.today()] || {}).meals || [];
  const tf = (k, l, u) => `<label>${l}<span class="unit"><input type="number" min="0" data-edit="target" data-k="${k}" value="${T[k]}"><em>${u}</em></span></label>`;
  const cmp = (k, l, u) => { const s = sum(k), d = s - T[k], ok = Math.abs(d) <= T[k] * .05; return `<div class="cmp"><small>${l}</small><b>${s}${u}</b><span class="${ok ? 'good' : 'off'}">${ok ? '✓ on target' : (d > 0 ? '+' : '') + d + u}</span></div>`; };
  return `<div class="card"><h3>Daily targets</h3><p class="sub">What the client should aim for each day.</p><div class="tgrid">${tf('k', 'Calories', 'kcal')}${tf('p', 'Protein', 'g')}${tf('c', 'Carbs', 'g')}${tf('f', 'Fat', 'g')}</div></div>
  <div class="card" style="margin-top:18px"><h3>Meal plan</h3><p class="sub">Meals add up against the targets above.</p>
    <div class="cmps">${cmp('k', 'Calories', '')}${cmp('p', 'Protein', 'g')}${cmp('c', 'Carbs', 'g')}${cmp('f', 'Fat', 'g')}</div>
    ${M.length ? `<div class="thead meal"><span>Time</span><span>Meal</span><span>kcal</span><span>P</span><span>C</span><span>F</span><span></span></div>` + M.map((m, i) => `
      <div class="erow meal"><input type="time" data-edit="meal" data-i="${i}" data-k="time" value="${esc(m.time)}"><input data-edit="meal" data-i="${i}" data-k="n" value="${esc(m.n)}">
      ${['k', 'p', 'c', 'f'].map(k => `<input type="number" min="0" data-edit="meal" data-i="${i}" data-k="${k}" value="${m[k]}">`).join('')}
      <span class="st">${eaten.includes(m.id) ? '<span class="bdg green">✓ Eaten</span>' : ''}<button class="x" data-act="delmeal" data-i="${i}" aria-label="Remove">✕</button></span></div>`).join('') : '<div class="empty">No meals yet — add the first one.</div>'}
    <form class="add" data-form="meal"><input name="time" type="time" value="08:00" style="max-width:120px"><input name="n" placeholder="Meal (e.g. Oats & whey)" required>
      <input name="k" type="number" min="0" placeholder="kcal" required style="max-width:90px"><input name="p" type="number" min="0" placeholder="P g" style="max-width:80px"><input name="c" type="number" min="0" placeholder="C g" style="max-width:80px"><input name="f" type="number" min="0" placeholder="F g" style="max-width:80px"><button class="btn">Add</button></form></div>`;
}

function tProgress(c) {
  const rows = [...c.progress].sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="grid2"><div class="card"><h3>Weight trend</h3><p class="sub">Start ${c.startWeight} kg → target ${c.targetWeight} kg</p>${D.weightChart(c)}</div>
    <div class="card"><h3>Log a check-in</h3><p class="sub">Weigh-in and measurements.</p>
      <form class="f" data-form="prog"><label class="full">Date<input type="date" name="date" value="${D.today()}" required></label>
      <label>Weight (kg)<input type="number" step="0.1" name="weight" required></label><label>Body fat %<input type="number" step="0.1" name="fat"></label>
      <label>Waist (cm)<input type="number" step="0.1" name="waist"></label><label>Note<input name="note" placeholder="optional"></label>
      <button class="btn full" style="margin-top:4px">Save check-in</button></form></div></div>
  <div class="card" style="margin-top:18px"><h3>History</h3><p class="sub">${rows.length} check-ins</p>
    ${rows.length ? `<div class="tbl"><div class="th"><span>Date</span><span>Weight</span><span>Body fat</span><span>Waist</span><span>Note</span><span></span></div>${rows.map(p => `<div class="tr"><span>${p.date}</span><b>${p.weight || '–'} kg</b><span>${p.fat ? p.fat + '%' : '–'}</span><span>${p.waist ? p.waist + ' cm' : '–'}</span><span class="mut">${esc(p.note || '')}</span><button class="x" data-act="delprog" data-date="${p.date}" data-w="${p.weight}" aria-label="Delete">✕</button></div>`).join('')}</div>` : '<div class="empty">No check-ins yet.</div>'}</div>`;
}

function tProfile(c) {
  const f = (k, l, t = 'text', ex = '') => `<label>${l}<input type="${t}" ${ex} data-edit="profile" data-k="${k}" value="${esc(c[k])}"></label>`;
  return `<div class="grid2"><div class="card"><h3>Profile</h3><p class="sub">Basics and goals.</p>
    <div class="f">${f('name', 'Full name')}${f('goal', 'Goal')}${f('email', 'Email', 'email')}${f('phone', 'Phone')}${f('age', 'Age', 'number')}
      <label>Gender<select data-edit="profile" data-k="gender"><option value="m" ${c.gender === 'm' ? 'selected' : ''}>Male</option><option value="f" ${c.gender === 'f' ? 'selected' : ''}>Female</option></select></label>
      ${f('height', 'Height (cm)', 'number')}${f('startWeight', 'Start weight (kg)', 'number', 'step="0.1"')}${f('targetWeight', 'Target weight (kg)', 'number', 'step="0.1"')}
      <label>Status<select data-edit="profile" data-k="status"><option value="active" ${c.status === 'active' ? 'selected' : ''}>Active</option><option value="paused" ${c.status === 'paused' ? 'selected' : ''}>Paused</option></select></label></div></div>
    <div><div class="card"><h3>Client login</h3><p class="sub">Lets ${esc(c.name.split(' ')[0])} see their plan and tick off workouts &amp; meals.</p>
      ${c.login && SVDAuth.hasUser(c.login) ? `<div class="row"><div><b>${esc(c.login)}</b><small>Username</small></div><span class="bdg green">Login active</span></div>
        <form class="add" data-form="pw"><input name="pw" type="text" minlength="4" placeholder="New password (4+ chars)" required><button class="btn">Reset password</button></form>`
      : `<form class="add" data-form="mklogin"><input name="u" placeholder="Username" required><input name="pw" type="text" minlength="4" placeholder="Password (4+ chars)" required><button class="btn">Create login</button></form>`}
    </div>
    <div class="card danger" style="margin-top:18px"><h3>Danger zone</h3><p class="sub">Deleting removes the client, all plans, logs and their login.</p><button class="btn red" data-act="delclient">Delete client</button></div></div></div>`;
}

// ---------- render ----------
const TITLES = { dash: ['Dashboard', 'Your clients at a glance.'], clients: ['Clients', 'Manage plans and track progress.'], pay: ['Payments', 'Read-only payment reports.'] };
function render() {
  const c = st.view === 'client' ? D.get(st.cid) : null;
  const [t, s] = c ? [c.name, 'Update plans and track progress.'] : TITLES[st.view === 'client' ? 'clients' : st.view];
  $('#pageTitle').textContent = t; $('#pageSub').textContent = s;
  $$('#menu button').forEach(b => b.classList.toggle('on', b.dataset.v === (st.view === 'client' ? 'clients' : st.view)));
  const keepSearch = document.activeElement && document.activeElement.id === 'search';
  $('#root').innerHTML = `<div class="view on">${st.view === 'dash' ? viewDash() : st.view === 'clients' ? viewClients() : st.view === 'pay' ? viewPay() : viewClient()}</div>`;
  if (keepSearch) { const e = $('#search'); e.focus(); e.setSelectionRange(e.value.length, e.value.length); }
}

// ---------- modal: add client ----------
function addClientModal(pre = {}) {
  const m = $('#modal'), b = $('#modalBox');
  b.innerHTML = `<button class="modal-x" data-act="closem" aria-label="Close">✕</button><h3 style="font-size:1.5rem;margin-bottom:4px">Add client</h3><p class="sub">Create their profile and (optionally) their login.</p>
   <form class="f" id="newc"><label class="full">Full name<input name="name" required value="${esc(pre.name || '')}"></label>
    <label>Goal<select name="goal"><option>Lose fat</option><option>Build muscle</option><option>Maintain</option><option>Improve fitness</option></select></label>
    <label>Gender<select name="gender"><option value="m">Male</option><option value="f">Female</option></select></label>
    <label>Age<input type="number" name="age" value="28" min="12" max="90"></label><label>Height (cm)<input type="number" name="height" value="170"></label>
    <label>Start weight (kg)<input type="number" step="0.1" name="startWeight" value="70" required></label><label>Target weight (kg)<input type="number" step="0.1" name="targetWeight" value="65" required></label>
    <label>Email<input type="email" name="email"></label><label>Phone<input name="phone" value="${esc(pre.phone || '')}"></label>
    <label>Login username<input name="login" placeholder="optional"></label><label>Password<input name="pw" type="text" placeholder="4+ chars" minlength="4"></label>
    <div class="full msg" id="newMsg"></div><button class="btn full">Create client</button></form>`;
  m.classList.add('open');
  $('#newc').onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target)), msg = $('#newMsg');
    if (f.login && SVDAuth.hasUser(f.login)) { msg.textContent = 'That username is already taken.'; return; }
    if (f.login && (f.pw || '').length < 4) { msg.textContent = 'Give the login a password of 4+ characters.'; return; }
    const c = D.blank({ name: f.name.trim(), goal: f.goal, gender: f.gender, age: num(f.age), height: num(f.height), startWeight: num(f.startWeight), targetWeight: num(f.targetWeight), email: f.email, phone: f.phone, login: f.login.trim().toLowerCase() });
    c.progress.push({ date: D.today(), weight: c.startWeight, fat: null, waist: null, note: 'Starting weight' });
    D.save(c);
    if (c.login) await SVDAuth.addClientUser(c.name, c.login, f.pw, c.id);
    SVDPay.onboard(c);
    m.classList.remove('open'); toast('Client added'); go('client', c.id, 'workout');
  };
}
const closeModal = () => $('#modal').classList.remove('open');
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ---------- events ----------
const cur = () => D.get(st.cid);
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act, c = st.cid ? cur() : null, i = +el.dataset.i;
  if (a === 'open') return go('client', el.dataset.id, el.dataset.tab);
  if (a === 'back') return go('clients');
  if (a === 'add') return addClientModal();
  if (a === 'gotoclients') return go('clients');
  if (a === 'closem') return closeModal();
  if (a === 'seed') { for (const c of D.seed()) await SVDAuth.addClientUser(c.name, c.login, 'demo123', c.id); toast('Sample clients added — logins: priya / marcus, password demo123'); return render(); }
  if (a === 'tab') { st.tab = el.dataset.tab; return render(); }
  if (!c) return;
  if (a === 'how') return SVDExercise.open(c.workouts[st.day][i].n, { gender: c.gender });
  if (a === 'day') { st.day = i; return render(); }
  if (a === 'delex') { c.workouts[st.day].splice(i, 1); D.save(c); return render(); }
  if (a === 'copyday') {
    c.workouts[i] = (c.workouts[st.day] || []).map(x => ({ ...x, id: D.uid() })); D.save(c); toast('Copied to ' + D.DAYS[i]); return;
  }
  if (a === 'delmeal') { c.diet.meals.splice(i, 1); D.save(c); return render(); }
  if (a === 'delprog') {
    const k = c.progress.findIndex(p => p.date === el.dataset.date && String(p.weight) === el.dataset.w); if (k > -1) c.progress.splice(k, 1);
    D.save(c); return render();
  }
  if (a === 'delclient') {
    if (!confirm('Delete ' + c.name + ' and all their data? This cannot be undone.')) return;
    if (c.login) SVDAuth.removeUser(c.login);
    D.remove(c.id); toast('Client deleted'); return go('clients');
  }
});

document.addEventListener('change', e => {
  const el = e.target, k = el.dataset.k, c = st.cid ? cur() : null;
  if (!el.dataset.edit || !c) return;
  const ed = el.dataset.edit, i = +el.dataset.i;
  if (ed === 'notes') c.notes = el.value;
  else if (ed === 'ex') c.workouts[st.day][i][k] = el.value;
  else if (ed === 'meal') c.diet.meals[i][k] = ['time', 'n'].includes(k) ? el.value : num(el.value);
  else if (ed === 'target') c.diet.targets[k] = num(el.value);
  else if (ed === 'profile') {
    c[k] = ['age', 'height', 'startWeight', 'targetWeight'].includes(k) ? num(el.value) : el.value;
    if (k === 'name' && c.login) SVDAuth.renameUser(c.login, c.name);
  }
  D.save(c);
  if (ed === 'notes') toast('Notes saved');
  else if (ed === 'target' || ed === 'meal' || (ed === 'profile' && ['status', 'name', 'goal'].includes(k))) render();
  else toast('Saved');
});

document.addEventListener('submit', async e => {
  const form = e.target.closest('[data-form]'); if (!form) return;
  e.preventDefault();
  const c = cur(), f = Object.fromEntries(new FormData(form)), t = form.dataset.form;
  if (t === 'ex') { (c.workouts[st.day] = c.workouts[st.day] || []).push({ id: D.uid(), n: f.n.trim(), s: f.s.trim(), note: f.note.trim() }); toast('Exercise added'); }
  if (t === 'meal') { c.diet.meals.push({ id: D.uid(), time: f.time, n: f.n.trim(), k: num(f.k), p: num(f.p), c: num(f.c), f: num(f.f) }); c.diet.meals.sort((a, b) => a.time.localeCompare(b.time)); toast('Meal added'); }
  if (t === 'prog') { c.progress.push({ date: f.date, weight: num(f.weight), fat: f.fat ? num(f.fat) : null, waist: f.waist ? num(f.waist) : null, note: f.note.trim() }); toast('Check-in saved'); }
  if (t === 'pw') { await SVDAuth.setPassword(c.login, f.pw); toast('Password updated'); form.reset(); return; }
  if (t === 'mklogin') {
    const u = f.u.trim().toLowerCase();
    if (SVDAuth.hasUser(u)) return toast('Username already taken');
    await SVDAuth.addClientUser(c.name, u, f.pw, c.id); c.login = u; toast('Login created');
  }
  D.save(c); render();
});

document.addEventListener('input', e => { if (e.target.id === 'search') { st.q = e.target.value; render(); } });

if (me && me.role !== 'client') render();
