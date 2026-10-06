const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const D = SVDData, esc = D.esc;

// guard: clients only (trainers go to the admin panel)
const me = SVDAuth.current();
if (!me) location.replace('login.html');
else if (me.role !== 'client') location.replace('admin.html');

const toast = t => { const e = $('#toast'); e.textContent = t; e.classList.add('show'); setTimeout(() => e.classList.remove('show'), 1800); };
const TITLES = { overview: 'Overview', workout: 'My Workout', diet: 'My Diet', progress: 'Progress', membership: 'Membership', calc: 'Calculator' };
const TIPS = ['Protein within an hour after training helps muscles recover faster.', 'Sleep 7–9 hours — it\'s when your body actually builds strength.', 'Warm up for 5–10 minutes before heavy lifts to protect your joints.', 'Progressive overload: add a little weight or a rep each week.', 'Hydrate early — thirst means you\'re already a little behind.'];
const todayIdx = D.dow(D.today());
let selDay = todayIdx;

const rec = () => me && me.clientId ? D.get(me.clientId) : null;
const todayLog = c => (c.log[D.today()] = c.log[D.today()] || { ex: [], meals: [], water: 0 });
const toggle = (arr, id) => { const i = arr.indexOf(id); i < 0 ? arr.push(id) : arr.splice(i, 1); };

if (me) {
  $('#uname').textContent = me.name; $('#av').textContent = me.name[0].toUpperCase();
  $('#greet').textContent = 'Welcome back, ' + me.name.split(' ')[0] + '. Let\'s train.';
  $('#dateChip').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
  $('#logout').onclick = () => SVDAuth.logout();
}
let view = 'overview';
const show = v => {
  view = v;
  $$('.view').forEach(e => e.classList.toggle('on', e.id === 'v-' + v));
  $$('#menu button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $('#pageTitle').textContent = TITLES[v];
  $('#side').classList.remove('open');
  render();
};
$$('#menu button').forEach(b => b.onclick = () => show(b.dataset.v));
$$('[data-go]').forEach(b => b.onclick = () => show(b.dataset.go));
$('#burger').onclick = () => $('#side').classList.toggle('open');

// ---------- overview ----------
function renderOverview(c) {
  const t = D.today(), s = D.dayStat(c, t), ad = D.adherence(c), cw = D.curWeight(c), dlt = +(cw - c.startWeight).toFixed(1);
  const pct = s.planned ? Math.round(s.done / s.planned * 100) : 0, hr = new Date().getHours();
  $('#heroTag').textContent = (hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening') + ', ' + me.name.split(' ')[0];
  $('#heroTitle').textContent = !s.planned ? 'Rest day — recover well' : s.done === s.planned ? 'Workout complete! 🎉' : s.done ? 'Keep going, ' + (s.planned - s.done) + ' to go' : 'Ready for ' + s.planned + ' exercises?';
  $('#heroSub').textContent = !s.planned ? 'Stretch, hydrate and sleep well.' : `${s.done} of ${s.planned} exercises finished today · ${s.mealsEaten} of ${s.mealsPlanned} meals eaten.`;
  $('#heroRing').style.setProperty('--p', pct); $('#heroPct').textContent = pct + '%';
  $('#sW').textContent = cw + ' kg'; $('#sWd').textContent = (dlt > 0 ? '+' : '') + dlt + ' kg since start · goal ' + c.targetWeight;
  const T = c.diet.targets.k;
  $('#sKcal').textContent = s.kcal.toLocaleString(); $('#sKt').textContent = 'of ' + T.toLocaleString() + ' kcal'; $('#pKcal').style.width = Math.min(s.kcal / T * 100, 100) + '%';
  $('#sAd').textContent = ad === null ? '–' : ad + '%'; $('#pAd').style.width = (ad || 0) + '%';
  $('#sStreak').textContent = D.streak(c) + ' days';
  $('#chart').innerHTML = D.weekBars(c);
  $('#todayLbl').textContent = D.DAYS[todayIdx] + ' · tap to complete';
  renderExList('#todayList', c, todayIdx, true);
  const w = todayLog(c).water || 0; $('#wCount').textContent = w;
  $('#glasses').innerHTML = Array.from({ length: 8 }, (_, i) => `<button class="glass ${i < w ? 'on' : ''}" data-g="${i + 1}" aria-label="Glass ${i + 1}"></button>`).join('');
  $$('#glasses [data-g]').forEach(b => b.onclick = () => { const n = +b.dataset.g, L = todayLog(c); L.water = L.water === n ? n - 1 : n; D.save(c); render(); });
  $('#tipText').textContent = TIPS[new Date().getDate() % TIPS.length];
}

function renderExList(sel, c, dayIdx, canTick) {
  const list = c.workouts[dayIdx] || [], ds = D.weekDates()[dayIdx], done = (c.log[ds] || {}).ex || [], isToday = ds === D.today();
  $(sel).innerHTML = list.length ? list.map((x, i) => `<div class="row ${done.includes(x.id) ? 'done' : ''}"><div><b>${esc(x.n)}</b><small>${esc(x.s || '')}${x.note ? ' · ' + esc(x.note) : ''}</small></div>
    <span class="rt"><button class="howto" data-how="${esc(x.n)}">▶ How to</button>${canTick && isToday ? `<button class="chk ${done.includes(x.id) ? 'on' : ''}" data-t="${x.id}" aria-label="Mark done">${done.includes(x.id) ? '✓' : ''}</button>` : done.includes(x.id) ? '<span class="bdg green">✓ Done</span>' : ds > D.today() ? '<span class="bdg gray">Upcoming</span>' : '<span class="bdg gray">Missed</span>'}</span></div>`).join('') : '<div class="empty">Rest day 😴 — nothing planned.</div>';
  $$(sel + ' [data-how]').forEach(b => b.onclick = () => SVDExercise.open(b.dataset.how, { gender: c.gender }));
  $$(sel + ' [data-t]').forEach(b => b.onclick = () => { toggle(todayLog(c).ex, b.dataset.t); D.save(c); render(); });
}

// ---------- workout ----------
function renderWorkout(c) {
  const t = D.weekDates();
  $('#days').innerHTML = D.DAYS.map((d, i) => `<button class="${i === selDay ? 'on' : ''}" data-d="${i}">${d}${t[i] === D.today() ? ' •' : ''}</button>`).join('');
  $$('#days button').forEach(b => b.onclick = () => { selDay = +b.dataset.d; renderWorkout(c); });
  renderExList('#wList', c, selDay, true);
}

// ---------- diet ----------
function renderDiet(c) {
  const T = c.diet.targets, L = todayLog(c), M = c.diet.meals, eaten = M.filter(m => L.meals.includes(m.id));
  const s = k => eaten.reduce((a, m) => a + (+m[k] || 0), 0), kc = s('k');
  $('#dietSub').textContent = `Target: ${T.k.toLocaleString()} kcal`;
  $('#rKcal').textContent = kc.toLocaleString(); $('#rOf').textContent = 'of ' + T.k.toLocaleString();
  $('#ring').style.setProperty('--p', Math.min(kc / T.k * 100, 100));
  [['P', 'p'], ['C', 'c'], ['F', 'f']].forEach(([id, k]) => { $('#m' + id).textContent = `${s(k)} / ${T[k]} g`; $('#b' + id).style.width = Math.min(s(k) / (T[k] || 1) * 100, 100) + '%'; });
  $('#mList').innerHTML = M.length ? M.map(m => `<div class="row ${L.meals.includes(m.id) ? 'done' : ''}"><div><b>${esc(m.time)} · ${esc(m.n)}</b><small>${m.k} kcal · P${m.p} C${m.c} F${m.f}</small></div><button class="chk ${L.meals.includes(m.id) ? 'on' : ''}" data-m="${m.id}" aria-label="Mark eaten">${L.meals.includes(m.id) ? '✓' : ''}</button></div>`).join('') : '<div class="empty">Your trainer hasn\'t added a meal plan yet.</div>';
  $$('#mList [data-m]').forEach(b => b.onclick = () => { toggle(todayLog(c).meals, b.dataset.m); D.save(c); render(); });
}

// ---------- progress ----------
function renderProgress(c) {
  $('#wSub').textContent = `Start ${c.startWeight} kg → target ${c.targetWeight} kg`;
  $('#wchart').innerHTML = D.weightChart(c);
  const rows = [...c.progress].sort((a, b) => b.date.localeCompare(a.date));
  $('#hSub').textContent = rows.length + ' check-ins';
  $('#hist').innerHTML = rows.length ? `<div class="tbl"><div class="th"><span>Date</span><span>Weight</span><span>Body fat</span><span>Waist</span><span>Note</span><span></span></div>${rows.map(p => `<div class="tr"><span>${p.date}</span><b>${p.weight || '–'} kg</b><span>${p.fat ? p.fat + '%' : '–'}</span><span>${p.waist ? p.waist + ' cm' : '–'}</span><span class="mut">${esc(p.note || '')}</span><span></span></div>`).join('')}</div>` : '<div class="empty">No check-ins yet.</div>';
  const d = $('#pForm [name=date]'); if (!d.value) d.value = D.today();
}
$('#pForm').onsubmit = e => {
  e.preventDefault(); const c = rec(), f = Object.fromEntries(new FormData(e.target));
  c.progress.push({ date: f.date, weight: +f.weight, fat: null, waist: f.waist ? +f.waist : null, note: '' });
  D.save(c); e.target.reset(); toast('Check-in saved'); render();
};

// ---------- membership & payments ----------
function renderMembership(c) {
  const P = SVDPay, active = c.plan && c.planUntil && c.planUntil >= D.today();
  const left = active ? Math.max(0, Math.round((new Date(c.planUntil + 'T00:00') - new Date(D.today() + 'T00:00')) / 864e5)) : 0;
  $('#memStatus').innerHTML = active
    ? `<div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap"><div><h3>${esc(c.plan)} membership is active</h3><p class="sub" style="margin:0">Valid until ${c.planUntil} · ${left} day${left === 1 ? '' : 's'} left</p></div><span class="bdg green">Active</span></div>`
    : `<div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap"><div><h3>No active membership</h3><p class="sub" style="margin:0">Pick a plan below to get started.</p></div><span class="bdg gray">Inactive</span></div>`;
  $('#memPlans').innerHTML = Object.entries(P.PLANS).map(([n, p]) => `<div class="card ${active && c.plan === n ? 'cur' : ''}"><h3>${n}</h3><div class="amt">${P.inr(p.price)}<small style="font-size:.9rem;opacity:.65"> / 30 days</small></div><ul>${p.perks.map(x => `<li>${x}</li>`).join('')}</ul><button class="${active && c.plan === n ? 'pill on' : 'btn'}" data-pay="${n}">${active && c.plan === n ? 'Renew ' + n : 'Pay ' + P.inr(p.price)}</button></div>`).join('');
  $$('#memPlans [data-pay]').forEach(b => b.onclick = () => P.open({ plan: b.dataset.pay, clientId: c.id, name: c.name, phone: c.phone || '', onDone: () => { toast('Payment successful'); render(); } }));
  const h = P.forClient(c.id);
  $('#memHist').innerHTML = h.length ? h.slice(0, 12).map(p => `<div class="row"><div><b>${esc(p.plan || 'Payment')} · ${P.inr(p.amount)}</b><small>${new Date(p.ts).toLocaleDateString()} · ${p.method === 'qr' ? 'UPI QR' : 'Gateway'} · ${p.id}</small></div><span class="bdg ${p.type === 'refund' ? 'red' : p.status === 'success' ? 'green' : 'red'}">${p.type === 'refund' ? 'refund' : p.status}</span></div>`).join('') : '<div class="empty">No payments yet.</div>';
  $('#memUpi').textContent = P.CFG.upi; P.qr($('#memQr'), 160);
}

// ---------- calculator ----------
function calc() {
  const age = +$('#age').value, h = +$('#height').value, w = +$('#weight').value;
  if (!age || !h || !w) return;
  const bmi = w / ((h / 100) ** 2), bmr = 10 * w + 6.25 * h - 5 * age + ($('#gender').value === 'm' ? 5 : -161);
  $('#bmi').textContent = bmi.toFixed(1);
  $('#cat').textContent = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy weight' : bmi < 30 ? 'Overweight' : 'Obese';
  $('#kcal').textContent = Math.round(bmr * +$('#activity').value + +$('#goal').value).toLocaleString();
  $('#prot').textContent = Math.round(w * 1.8); $('#water').textContent = (w * .035).toFixed(1);
}
$('#calc').addEventListener('input', calc);

function render() {
  const c = rec(), none = !c;
  $('#noRec').style.display = none ? 'block' : 'none';
  $$('.view').forEach(v => { if (none) v.style.display = 'none'; else v.style.display = ''; });
  if (none) return;
  $('#sideGoal').textContent = c.goal;
  ({ overview: renderOverview, workout: renderWorkout, diet: renderDiet, progress: renderProgress, membership: renderMembership, calc: () => {} })[view](c);
  if (view === 'calc') calc();
}
if (me && me.role === 'client') {
  const c = rec();
  if (c) { $('#age').value = c.age; $('#gender').value = c.gender; $('#height').value = c.height; $('#weight').value = D.curWeight(c); $('#goal').value = c.goal === 'Lose fat' ? -400 : c.goal === 'Build muscle' ? 350 : 0; }
  render();
}
