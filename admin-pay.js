// Admin → Payments: READ-ONLY reports. The admin can view, filter and export, but cannot create, edit or delete payments.
// (Relies on globals from admin.js: st, esc, D, av, go, toast, addClientModal.)
const P = SVDPay;
Object.assign(st, { pr: '30', pt: 'all', pq: '' });

const planChip = c => c.plan && c.planUntil && c.planUntil >= D.today()
  ? `<span class="bdg green">${esc(c.plan)} · until ${c.planUntil}</span>` : '<span class="bdg gray">No active plan</span>';
const TYPE = { payin: ['Pay-in', 'green'], payout: ['Payout', 'amber'], refund: ['Refund', 'red'] };
const STAT = { success: 'green', pending: 'amber', failed: 'red' };
const METHOD = { qr: 'UPI QR', gateway: 'Gateway', bank: 'Bank (NEFT)', trial: 'Free trial' };
const dshort = ts => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' · ' + new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function payRows(list, clientsById) {
  return list.map(p => {
    const [tl, tc] = TYPE[p.type], out = p.type !== 'payin', cl = p.clientId && clientsById[p.clientId];
    return `<div class="tr"><span>${dshort(p.ts)}<small>${p.id}</small></span>
      <span>${cl ? `<a href="#" data-act="open" data-id="${cl.id}" data-tab="payments"><b>${esc(p.name)}</b></a>` : `<b>${esc(p.name || '—')}</b>`}<small>${esc(p.phone || '')}${p.type === 'payout' ? '' : (p.plan ? ' · ' + esc(p.plan) : '')}${p.type === 'payout' ? esc(p.plan) : ''}</small></span>
      <span><span class="bdg ${tc}">${tl}</span></span><span>${METHOD[p.method] || p.method}</span>
      <span class="${out ? 'amt-out' : 'amt-in'}">${out ? '−' : p.amount ? '+' : ''}${P.inr(p.amount)}</span>
      <span>${p.fee ? P.inr(p.fee) : '–'}</span><span><span class="bdg ${STAT[p.status]}">${p.status}</span></span><span class="mut" style="word-break:break-all">${esc(p.ref || '–')}</span></div>`;
  }).join('');
}

function revenueBars(list, range) {
  const ok = list.filter(p => p.type === 'payin' && p.status === 'success'), now = new Date(), b = [];
  const day = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return D.iso(d); };
  if (range === '7' || range === '30') {
    const n = +range; for (let i = n - 1; i >= 0; i--) { const k = day(i); b.push({ l: k.slice(8), v: ok.filter(p => D.iso(p.ts) === k).reduce((s, p) => s + p.amount, 0), t: k }); }
  } else if (range === '90') {
    for (let w = 12; w >= 0; w--) { const from = day(w * 7 + 6), to = day(w * 7); b.push({ l: from.slice(5), v: ok.filter(p => { const k = D.iso(p.ts); return k >= from && k <= to; }).reduce((s, p) => s + p.amount, 0), t: from + ' → ' + to }); }
  } else {
    for (let m = 5; m >= 0; m--) { const d = new Date(now.getFullYear(), now.getMonth() - m, 1), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); b.push({ l: d.toLocaleString(undefined, { month: 'short' }), v: ok.filter(p => D.iso(p.ts).startsWith(k)).reduce((s, p) => s + p.amount, 0), t: k }); }
  }
  const max = Math.max(...b.map(x => x.v), 1), short = v => v >= 1e5 ? (v / 1e5).toFixed(1) + 'L' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'k' : v || '';
  return `<div class="rev-bars">${b.map(x => `<div class="c" title="${x.t}: ${P.inr(x.v)}"><span>${b.length <= 14 ? short(x.v) : ''}</span><div class="b" style="height:${x.v / max * 100}%"></div><span>${x.l}</span></div>`).join('')}</div>`;
}

function viewPay() {
  P.settleDue();
  const everything = P.all(), clients = Object.fromEntries(D.all().map(c => [c.id, c]));
  if (!everything.length) return `<div class="card empty-big"><div class="eb">💳</div><h3>No payments yet</h3><p class="sub">Payments from the website and client portal appear here automatically. This report is read-only.</p>
    <div class="hero-btns" style="justify-content:center"><button class="btn ghost" data-act="seedpay">Load sample payments</button></div>${qrCard()}</div>`.replace('</div></div>', '</div></div>') + '';
  const since = st.pr === 'all' ? '' : new Date(Date.now() - (+st.pr) * 864e5).toISOString();
  const inRange = everything.filter(p => !since || p.ts >= since), T = P.totals(inRange);
  const q = st.pq.toLowerCase(), shown = inRange.filter(p => (st.pt === 'all' || p.type === st.pt) && (!q || (p.name + p.phone + p.id + p.ref + p.plan).toLowerCase().includes(q)));
  const okIn = inRange.filter(p => p.type === 'payin' && p.status === 'success' && p.amount > 0);
  const by = (k, vals) => vals.map(v => ({ v, amt: okIn.filter(p => p[k] === v).reduce((s, p) => s + p.amount, 0) }));
  const max = Math.max(T.collected, 1);
  const chips = (key, items) => `<div class="fchips">${items.map(([v, l]) => `<button class="${st[key] === v ? 'on' : ''}" data-act="pf" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const leads = P.unlinked();
  return `<div class="chead card"><div><h2 style="font-size:1.4rem">Payment reports</h2><p class="mut">Pay-ins, automatic payouts and refunds.</p></div><span class="rdonly">🔒 Read-only</span></div>
  ${chips('pr', [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['all', 'All time']])}
  <div class="grid4">
    <div class="card stat s2"><span class="e">💰</span><small>Collected (pay-ins)</small><strong>${P.inr(T.collected)}</strong><em>${T.count} payment${T.count === 1 ? '' : 's'}${T.failed ? ' · ' + T.failed + ' failed' : ''}</em></div>
    <div class="card stat s3"><span class="e">🏦</span><small>Paid out to bank</small><strong>${P.inr(T.payouts)}</strong><em>auto-settled next day</em></div>
    <div class="card stat s1"><span class="e">↩️</span><small>Refunds</small><strong>${P.inr(T.refunds)}</strong><em>fees ${P.inr(T.fees)}</em></div>
    <div class="card stat s4"><span class="e">⏳</span><small>Awaiting payout</small><strong>${P.inr(P.pending())}</strong><em>settles tomorrow</em></div>
  </div>
  <div class="grid2"><div class="card"><h3>Collections</h3><p class="sub">Pay-ins per ${st.pr === '90' ? 'week' : st.pr === 'all' ? 'month' : 'day'}</p>${revenueBars(inRange, st.pr)}</div>
    <div class="card"><h3>Breakdown</h3><p class="sub">Where the money comes from</p>
      <b style="font-size:.8rem;color:var(--mut)">BY METHOD</b>
      ${by('method', ['qr', 'gateway']).map(x => `<div class="split"><div class="t"><span>${METHOD[x.v]}</span><b>${P.inr(x.amt)}</b></div><div class="track"><i class="g" style="width:${x.amt / max * 100}%"></i></div></div>`).join('')}
      <b style="font-size:.8rem;color:var(--mut)">BY PLAN</b>
      ${by('plan', Object.keys(P.PLANS)).map(x => `<div class="split"><div class="t"><span>${x.v}</span><b>${P.inr(x.amt)}</b></div><div class="track"><i class="g" style="width:${x.amt / max * 100}%"></i></div></div>`).join('')}
    </div></div>
  <div class="card" style="margin-top:18px"><div class="toolbar" style="margin-bottom:6px"><h3 style="margin:0">Transactions</h3><span class="mut" style="flex:1">${shown.length} shown</span>
      <input id="psearch" type="search" placeholder="Search name, phone, ID, UTR…" value="${esc(st.pq)}"><button class="btn ghost" data-act="csv">⬇ Export CSV</button></div>
    ${chips('pt', [['all', 'All'], ['payin', 'Pay-ins'], ['payout', 'Payouts'], ['refund', 'Refunds']])}
    <div class="ptbl"><div class="th"><span>Date</span><span>Payer / payee</span><span>Type</span><span>Method</span><span>Amount</span><span>Fee</span><span>Status</span><span>Reference</span></div>
    ${shown.length ? payRows(shown.slice(0, 100), clients) : '<div class="empty">No transactions match.</div>'}</div>
    ${shown.length > 100 ? `<p class="mut" style="margin-top:10px">Showing the latest 100 — export CSV for everything.</p>` : ''}</div>
  <div class="grid2" style="margin-top:18px">
    <div class="card"><h3>New payers &amp; free-trial leads</h3><p class="sub">Paid or booked on the website but not a client yet.</p>
      ${leads.length ? leads.map(l => `<div class="row"><div><b>${esc(l.name)}</b><small>${esc(l.phone)} · ${esc(l.plan || '—')}${l.paid ? ' · paid ' + P.inr(l.paid) : ''}</small></div><button class="pill" data-act="onboard" data-name="${esc(l.name)}" data-phone="${esc(l.phone)}">Add as client</button></div>`).join('') : '<div class="empty">Everyone who paid is already a client. 🎉</div>'}</div>
    ${qrCard()}</div>`;
}
const qrCard = () => `<div class="card"><h3>Static payment QR</h3><p class="sub">Print this at the front desk. Same code for every customer.</p>
  <div class="qrcard"><div class="qr-box" id="adminQr"></div><div><b>${esc(P.CFG.upi)}</b><p>Customers scan, pay the plan amount and submit the 12-digit UTR — it then shows up here. Static QR payments can't be auto-verified; match UTRs against your bank statement.</p></div></div></div>`;

function tPayments(c) {
  const list = P.forClient(c.id), t = P.totals(list);
  return `<div class="grid4"><div class="card stat s2"><small>Membership</small><strong style="font-size:1.4rem">${c.plan ? esc(c.plan) : 'None'}</strong><em>${c.planUntil ? 'until ' + c.planUntil : 'no active plan'}</em></div>
    <div class="card stat s3"><small>Total paid</small><strong>${P.inr(t.collected)}</strong><em>${t.count} payment${t.count === 1 ? '' : 's'}</em></div>
    <div class="card stat s1"><small>Refunded</small><strong>${P.inr(t.refunds)}</strong></div><div class="card stat s4"><small>Phone</small><strong style="font-size:1.2rem">${esc(c.phone || '–')}</strong></div></div>
  <div class="card"><h3>Payment history</h3><p class="sub">Read-only.</p><div class="ptbl"><div class="th"><span>Date</span><span>Payer</span><span>Type</span><span>Method</span><span>Amount</span><span>Fee</span><span>Status</span><span>Reference</span></div>
    ${list.length ? payRows(list, { [c.id]: c }) : '<div class="empty">No payments from this client yet.</div>'}</div></div>`;
}

// paint QR after each render of the payments view
const _render = render;
render = function () { _render(); const b = document.getElementById('adminQr'); if (b) P.qr(b, 160); };

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act;
  if (a === 'pf') { st[el.dataset.k] = el.dataset.v; render(); }
  if (a === 'seedpay') { P.seed(); toast('Sample payments loaded'); render(); }
  if (a === 'csv') {
    const rows = P.all(), blob = new Blob([P.csv(rows)], { type: 'text/csv' }), u = URL.createObjectURL(blob), l = document.createElement('a');
    l.href = u; l.download = 'svd-payments-' + D.today() + '.csv'; l.click(); setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  if (a === 'onboard') addClientModal({ name: el.dataset.name, phone: el.dataset.phone });
});
document.addEventListener('input', e => {
  if (e.target.id !== 'psearch') return;
  st.pq = e.target.value; render();
  const i = document.getElementById('psearch'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
});
