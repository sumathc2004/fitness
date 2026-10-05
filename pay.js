// Payments (DEMO): ledger for pay-ins / payouts / refunds, static UPI QR, and the checkout modal.
// No real money moves. A real gateway (Razorpay, Cashfree, PayU…) needs a backend + secret keys,
// and a static QR can't be auto-verified without a bank/gateway webhook — see notes in the UI.
const SVDPay = (() => {
  const KEY = 'svd_payments';
  const CFG = { upi: 'svdfitness@upi', name: 'SVD Fitness', gatewayFeePct: 2 };   // static QR = 0% fee, gateway = 2%
  const PLANS = {
    Basic: { price: 1999, perks: ['Gym floor access', 'Workout planner', 'Fitness calculator'] },
    Pro: { price: 3999, perks: ['Everything in Basic', 'Unlimited group classes', 'Nutrition plans'] },
    Elite: { price: 6999, perks: ['Everything in Pro', 'Personal trainer sessions', '24/7 access'] }
  };
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const write = a => localStorage.setItem(KEY, JSON.stringify(a));
  const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const upiUrl = () => `upi://pay?pa=${CFG.upi}&pn=${encodeURIComponent(CFG.name)}&cu=INR`;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mkId = pre => pre + Math.random().toString(36).slice(2, 8).toUpperCase() + Date.now().toString(36).slice(-3).toUpperCase();
  const isoDay = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };

  // ---------- ledger ----------
  const build = p => {
    const r = { id: mkId('TXN'), ts: new Date().toISOString(), type: 'payin', method: 'gateway', amount: 0, fee: 0, status: 'success',
      clientId: null, name: '', phone: '', plan: '', ref: '', settledIn: null, ...p };
    if (r.type === 'payin' && p.fee === undefined) r.fee = r.status === 'success' && r.method === 'gateway' ? +(r.amount * CFG.gatewayFeePct / 100).toFixed(2) : 0;
    return r;
  };
  const add = p => { const a = read(), r = build(p); a.push(r); write(a); return r; };
  const all = () => read().sort((a, b) => b.ts.localeCompare(a.ts));
  const forClient = id => all().filter(p => p.clientId === id);

  // Automatic settlement: every day's successful pay-ins (net of fees, minus refunds) are paid out to the bank next day.
  const settleDue = () => {
    const a = read(), today = isoDay(new Date()), days = {};
    a.filter(p => p.type === 'payin' && p.status === 'success' && p.amount > 0 && !p.settledIn && isoDay(p.ts) < today)
      .forEach(p => (days[isoDay(p.ts)] = days[isoDay(p.ts)] || []).push(p));
    let n = 0;
    Object.keys(days).sort().forEach(d => {
      const net = days[d].reduce((s, p) => s + p.amount - p.fee, 0);
      const t = new Date(d + 'T00:00'); t.setDate(t.getDate() + 1); t.setHours(11, 30);
      const po = build({ type: 'payout', method: 'bank', amount: +net.toFixed(2), name: 'Settlement to bank ••4821', plan: days[d].length + ' payment' + (days[d].length > 1 ? 's' : ''), ref: 'NEFT' + d.replace(/-/g, '') + String(days[d].length).padStart(2, '0'), ts: t.toISOString(), fee: 0 });
      a.push(po); days[d].forEach(p => p.settledIn = po.id); n++;
    });
    if (n) write(a);
    return n;
  };
  const totals = list => {
    const ok = list.filter(p => p.status === 'success'), sum = (t, k = 'amount') => ok.filter(p => p.type === t).reduce((s, p) => s + p[k], 0);
    return { collected: sum('payin'), fees: sum('payin', 'fee'), refunds: sum('refund'), payouts: sum('payout'),
      count: ok.filter(p => p.type === 'payin' && p.amount > 0).length, failed: list.filter(p => p.status === 'failed').length };
  };
  const pending = () => { const t = totals(read()); return Math.max(0, t.collected - t.fees - t.refunds - t.payouts); };
  const csv = list => {
    const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    return ['ID,Date,Type,Status,Name,Phone,Plan,Method,Amount,Fee,Reference'].concat(list.map(p =>
      [p.id, p.ts.slice(0, 16).replace('T', ' '), p.type, p.status, p.name, p.phone, p.plan, p.method, p.amount, p.fee, p.ref].map(q).join(','))).join('\n');
  };

  // ---------- client linking ----------
  const applyPlan = (clientId, plan) => {
    const c = SVDData.get(clientId); if (!c || !PLANS[plan]) return;
    const base = c.planUntil && c.planUntil > isoDay(new Date()) ? new Date(c.planUntil + 'T00:00') : new Date();
    base.setDate(base.getDate() + 30); c.plan = plan; c.planUntil = isoDay(base); SVDData.save(c);
  };
  // when a trainer adds a payer as a client: attach their earlier payments and activate their latest paid plan
  const onboard = c => {
    if (!c.phone) return;
    const a = read(); let latest = null;
    a.forEach(p => { if (!p.clientId && p.phone === c.phone) { p.clientId = c.id; if (p.type === 'payin' && p.status === 'success' && PLANS[p.plan] && (!latest || p.ts > latest.ts)) latest = p; } });
    write(a); if (latest) applyPlan(c.id, latest.plan);
  };
  // payers who aren't clients yet (incl. free-trial leads)
  const unlinked = () => {
    const m = {};
    all().filter(p => !p.clientId && p.type === 'payin' && p.status === 'success').forEach(p => {
      const k = p.phone || p.name; if (!k) return;
      (m[k] = m[k] || { name: p.name, phone: p.phone, plan: p.plan, paid: 0, last: p.ts });
      m[k].paid += p.amount;
    });
    return Object.values(m);
  };

  // ---------- demo data ----------
  const seed = () => {
    const cs = SVDData.all(), who = cs.map(c => ({ n: c.name, p: c.phone || '9000000000', id: c.id }))
      .concat([{ n: 'Rahul Verma', p: '9812345670', id: null }, { n: 'Anita Desai', p: '9898989898', id: null }, { n: 'Kiran Rao', p: '9765432101', id: null }, { n: 'Sneha Iyer', p: '9845012345', id: null }]);
    let s = 11; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const names = Object.keys(PLANS), a = read();
    for (let i = 0; i < 28; i++) {
      const d = new Date(); d.setDate(d.getDate() - (Math.floor(rnd() * 58) + 1)); d.setHours(8 + Math.floor(rnd() * 12), Math.floor(rnd() * 60), 0, 0);
      const w = who[Math.floor(rnd() * who.length)], plan = names[Math.floor(rnd() * 3)], method = rnd() > .45 ? 'qr' : 'gateway', failed = rnd() > .93;
      const r = build({ ts: d.toISOString(), method, amount: PLANS[plan].price, status: failed ? 'failed' : 'success', clientId: w.id, name: w.n, phone: w.p, plan,
        ref: method === 'qr' ? String(Math.floor(100000000000 + rnd() * 899999999999)) : 'pay_' + Math.random().toString(36).slice(2, 12) });
      a.push(r);
    }
    const ok = a.filter(p => p.type === 'payin' && p.status === 'success' && p.amount > 0);
    ok.slice(2, 4).forEach(p => { const d = new Date(p.ts); d.setDate(d.getDate() + 3); a.push(build({ type: 'refund', method: p.method, amount: Math.round(p.amount / 2), ts: d.toISOString(), clientId: p.clientId, name: p.name, phone: p.phone, plan: p.plan, ref: 'RFD' + p.id.slice(3), fee: 0 })); });
    write(a); settleDue();
  };

  // ---------- QR ----------
  let qrP;
  const loadQR = () => qrP = qrP || new Promise(res => {
    if (window.QRCode) return res(true);
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s);
  });
  const qr = async (box, size = 180, text = upiUrl()) => {
    box.innerHTML = '';
    if (!(await loadQR()) || !window.QRCode) { box.innerHTML = `<div class="qr-fallback">QR unavailable offline<br><b>${esc(CFG.upi)}</b></div>`; return; }
    new QRCode(box, { text, width: size, height: size, colorDark: '#0b0d0c', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
  };

  // ---------- checkout modal ----------
  let el, st;
  const $ = s => el.querySelector(s);
  const close = () => { if (el) el.classList.remove('open'); document.body.classList.remove('pay-lock'); };
  const ensure = () => {
    if (el) return;
    el = document.createElement('div'); el.className = 'pay-ov'; el.setAttribute('aria-hidden', 'true');
    el.addEventListener('click', e => { if (e.target === el) close(); });
    addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    document.body.appendChild(el);
  };
  const open = opts => {
    ensure();
    const trial = !!opts.trial || opts.plan === 'Free Trial';
    st = { plan: opts.plan, trial, amount: trial ? 0 : PLANS[opts.plan].price, clientId: opts.clientId || null, name: opts.name || '', phone: opts.phone || '', method: 'qr', onDone: opts.onDone, locked: !!opts.clientId };
    el.innerHTML = `<div class="pay-box" role="dialog" aria-modal="true" aria-label="Checkout">
      <button class="pay-x" aria-label="Close">✕</button>
      <div id="pStep"></div></div>`;
    $('.pay-x').onclick = close;
    form();
    el.classList.add('open'); document.body.classList.add('pay-lock');
  };
  const form = () => {
    const t = st.trial;
    $('#pStep').innerHTML = `
      <span class="pay-eyebrow">${t ? 'Free week' : 'Secure checkout · demo'}</span>
      <h3>${t ? 'Book your free week' : esc(st.plan) + ' membership'}</h3>
      <div class="pay-price">${t ? '₹0' : inr(st.amount)}<small>${t ? ' · 7 days' : ' / 30 days'}</small></div>
      <div class="pay-grid"><label>Full name<input id="pName" value="${esc(st.name)}" ${st.locked ? 'readonly' : ''} placeholder="Your name" autocomplete="name"></label>
        <label>Mobile number<input id="pPhone" value="${esc(st.phone)}" inputmode="numeric" maxlength="10" ${st.locked && st.phone ? 'readonly' : ''} placeholder="10-digit number" autocomplete="tel"></label></div>
      ${t ? '' : `<div class="pay-tabs"><button data-m="qr" class="on">Scan QR (UPI)</button><button data-m="gateway">Gateway checkout</button></div>
      <div id="pPanel"></div>`}
      <div class="pay-msg" id="pMsg"></div>
      <button class="pay-go" id="pGo">${t ? 'Book my free week' : 'I\'ve paid ' + inr(st.amount)}</button>
      <p class="pay-note">${t ? 'We\'ll call you to schedule your first session. No payment needed.' : 'Demo mode — no real money is moved.'}</p>`;
    if (!t) {
      el.querySelectorAll('.pay-tabs button').forEach(b => b.onclick = () => { st.method = b.dataset.m; el.querySelectorAll('.pay-tabs button').forEach(x => x.classList.toggle('on', x === b)); panel(); });
      panel();
    }
    $('#pGo').onclick = submit;
  };
  const panel = () => {
    const q = st.method === 'qr';
    $('#pPanel').innerHTML = q ? `<div class="pay-qr"><div class="qr-box" id="qrBox"></div>
        <div><b>${esc(CFG.upi)}</b><ol><li>Open any UPI app and scan</li><li>Pay exactly <b>${inr(st.amount)}</b></li><li>Enter the 12-digit UTR / reference below</li></ol></div></div>
        <label class="pay-utr">UTR / Reference no.<input id="pUtr" inputmode="numeric" maxlength="12" placeholder="12-digit number from your UPI app"></label>`
      : `<div class="pay-gw"><b>Pay with UPI app, card or netbanking</b><p>You'll be taken to the payment gateway (test mode). Fee ${CFG.gatewayFeePct}% is borne by the gym.</p></div>`;
    if (q) qr($('#qrBox'), 150);
    $('#pGo').textContent = q ? 'I\'ve paid ' + inr(st.amount) : 'Pay ' + inr(st.amount) + ' securely';
  };
  const say = t => { $('#pMsg').textContent = t; };
  const submit = () => {
    const name = $('#pName').value.trim(), phone = $('#pPhone').value.replace(/\D/g, '');
    if (name.length < 2) return say('Please enter your name.');
    if (!/^[6-9]\d{9}$/.test(phone)) return say('Enter a valid 10-digit mobile number.');
    let utr = '';
    if (!st.trial && st.method === 'qr') { utr = ($('#pUtr').value || '').replace(/\D/g, ''); if (utr.length !== 12) return say('Enter the 12-digit UTR from your UPI app.'); }
    say(''); const go = $('#pGo'); go.disabled = true; go.textContent = st.method === 'gateway' && !st.trial ? 'Redirecting to gateway…' : 'Verifying…';
    setTimeout(() => {
      const rec = add({ name, phone, plan: st.plan, amount: st.amount, method: st.trial ? 'trial' : st.method, clientId: st.clientId,
        ref: st.trial ? '' : st.method === 'qr' ? utr : 'pay_' + Math.random().toString(36).slice(2, 12) });
      if (st.clientId && !st.trial) applyPlan(st.clientId, st.plan);
      done(rec);
    }, st.method === 'gateway' && !st.trial ? 1700 : 900);
  };
  const done = rec => {
    const t = st.trial;
    $('#pStep').innerHTML = `<div class="pay-ok">✓</div><h3>${t ? 'You\'re booked!' : 'Payment successful'}</h3>
      <p class="pay-note" style="margin-top:0">${t ? 'We\'ll contact you on ' + esc(rec.phone) + ' to schedule your free week.' : 'Your ' + esc(st.plan) + ' membership is active for 30 days.'}</p>
      <div class="pay-rcpt">${t ? '' : `<div><span>Amount</span><b>${inr(rec.amount)}</b></div><div><span>Method</span><b>${rec.method === 'qr' ? 'UPI QR' : 'Gateway'}</b></div>`}
        <div><span>Name</span><b>${esc(rec.name)}</b></div><div><span>Receipt no.</span><b>${rec.id}</b></div><div><span>Date</span><b>${new Date(rec.ts).toLocaleString()}</b></div></div>
      ${t || st.clientId ? '' : '<p class="pay-note">Next: your trainer will create your member login and share it with you.</p>'}
      <button class="pay-go" id="pDone">Done</button>`;
    $('#pDone').onclick = () => { close(); if (st.onDone) st.onDone(rec); };
  };

  return { CFG, PLANS, inr, upiUrl, add, all, forClient, settleDue, totals, pending, csv, applyPlan, onboard, unlinked, seed, qr, open, close, esc };
})();
