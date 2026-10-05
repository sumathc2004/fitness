// Shared client data store (localStorage) + tracking helpers used by admin.html and dashboard.html.
const SVDData = (() => {
  const KEY = 'svd_clients';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const write = a => localStorage.setItem(KEY, JSON.stringify(a));
  const uid = () => Math.random().toString(36).slice(2, 9);
  const iso = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const today = () => iso(new Date());
  const dow = ds => (new Date(ds + 'T00:00').getDay() + 6) % 7;           // Mon = 0
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const blank = (o = {}) => ({
    id: uid(), name: '', email: '', phone: '', age: 28, gender: 'm', height: 170,
    startWeight: 70, targetWeight: 65, goal: 'Lose fat', joined: today(), status: 'active', notes: '', login: '',
    workouts: {}, diet: { targets: { k: 2200, p: 140, c: 250, f: 70 }, meals: [] }, progress: [], log: {}, ...o
  });

  const weekDates = () => {
    const t = new Date(), m = new Date(t); m.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    return DAYS.map((_, i) => { const d = new Date(m); d.setDate(m.getDate() + i); return iso(d); });
  };
  const dayStat = (c, ds) => {
    const planned = c.workouts[dow(ds)] || [], L = c.log[ds] || {};
    const done = (L.ex || []).filter(id => planned.some(p => p.id === id)).length;
    const meals = c.diet.meals, eaten = (L.meals || []).filter(id => meals.some(m => m.id === id));
    return { planned: planned.length, done, mealsPlanned: meals.length, mealsEaten: eaten.length,
      kcal: eaten.reduce((a, id) => a + (meals.find(m => m.id === id).k || 0), 0) };
  };
  const adherence = c => {                       // % of planned exercises done, this week up to today
    let p = 0, d = 0; const t = today();
    weekDates().filter(ds => ds <= t).forEach(ds => { const s = dayStat(c, ds); p += s.planned; d += s.done; });
    return p ? Math.round(d / p * 100) : null;
  };
  const lastActive = c => Object.keys(c.log).filter(k => (c.log[k].ex || []).length || (c.log[k].meals || []).length).sort().pop() || null;
  const daysAgo = ds => ds ? Math.round((new Date(today() + 'T00:00') - new Date(ds + 'T00:00')) / 864e5) : null;
  const streak = c => {
    let n = 0; const d = new Date();
    for (let i = 0; i < 365; i++) {
      const L = c.log[iso(d)] || {};
      if ((L.ex || []).length || (L.meals || []).length) n++; else if (i > 0) break;
      d.setDate(d.getDate() - 1);
    }
    return n;
  };
  const weights = c => [...c.progress].filter(p => p.weight).sort((a, b) => a.date.localeCompare(b.date));
  const curWeight = c => { const w = weights(c); return w.length ? w[w.length - 1].weight : c.startWeight; };
  const initials = n => n.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase() || '?';

  const weekBars = c => {
    const ds = weekDates(), t = today(), st = ds.map(d => dayStat(c, d)), max = Math.max(...st.map(s => s.planned), 3);
    return `<div class="bars">` + ds.map((d, i) => {
      const s = st[i], h = s.planned ? Math.max(s.planned / max * 100, 22) : 10, f = s.planned ? s.done / s.planned * 100 : 0;
      return `<div class="c"><span class="n">${s.planned ? s.done + '/' + s.planned : ''}</span><div class="t ${d === t ? 'today' : ''} ${s.planned ? '' : 'rest'}" style="height:${h}%"><i style="height:${f}%"></i></div><span class="day ${d === t ? 'today' : ''}">${DAYS[i]}</span></div>`;
    }).join('') + `</div>`;
  };

  // simple SVG line chart of weight over time, with optional target line
  const weightChart = c => {
    const pts = weights(c);
    if (pts.length < 2) return '<div class="empty">Log at least two weigh-ins to see the trend.</div>';
    const W = 560, H = 200, P = 34, vals = pts.map(p => p.weight).concat(c.targetWeight || []);
    const lo = Math.min(...vals) - 1, hi = Math.max(...vals) + 1;
    const x = i => P + i * (W - P * 2) / (pts.length - 1), y = v => H - P - (v - lo) / (hi - lo) * (H - P * 2);
    const path = pts.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.weight).toFixed(1)).join(' ');
    const area = path + ` L${x(pts.length - 1)} ${H - P} L${x(0)} ${H - P} Z`;
    const ty = c.targetWeight ? y(c.targetWeight) : null;
    return `<svg class="wchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight trend">
      <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14b8a6" stop-opacity=".28"/><stop offset="1" stop-color="#14b8a6" stop-opacity="0"/></linearGradient></defs>
      ${ty !== null ? `<line x1="${P}" x2="${W - P}" y1="${ty}" y2="${ty}" stroke="#ff7a59" stroke-dasharray="5 5"/><text x="${W - P}" y="${ty - 6}" text-anchor="end" font-size="11" fill="#ff7a59">target ${c.targetWeight} kg</text>` : ''}
      <path d="${area}" fill="url(#wg)"/><path d="${path}" fill="none" stroke="#14b8a6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      ${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.weight)}" r="4.5" fill="#fff" stroke="#14b8a6" stroke-width="2.5"><title>${p.date}: ${p.weight} kg</title></circle>`).join('')}
      <text x="${P}" y="${H - 8}" font-size="11" fill="#6b7689">${pts[0].date}</text><text x="${W - P}" y="${H - 8}" text-anchor="end" font-size="11" fill="#6b7689">${pts[pts.length - 1].date}</text></svg>`;
  };

  // two realistic sample clients (with history) so the admin can try everything
  const sample = only => {
    const mk = (name, goal, sw, tw, h, g, days, login) => {
      const c = blank({ name, goal, startWeight: sw, targetWeight: tw, height: h, gender: g, login, email: login + '@example.com', phone: '+91 90000 0000' + (login.length % 9),
        notes: 'Prefers morning sessions. Mild knee sensitivity — avoid deep lunges.' });
      const ex = (n, s) => ({ id: uid(), n, s, note: '' });
      c.workouts = { 0: [ex('Barbell Bench Press', '4×10'), ex('Incline Dumbbell Press', '3×12'), ex('Triceps Pushdown', '3×15')],
        1: [ex('Deadlift', '4×6'), ex('Pull-ups', '3×8'), ex('Seated Row', '3×12')], 3: [ex('Back Squat', '5×8'), ex('Leg Press', '3×12'), ex('Calf Raise', '4×15')],
        4: [ex('Overhead Press', '4×8'), ex('Lateral Raise', '3×15')], 5: [ex('Treadmill intervals', '20 min')] };
      const meal = (time, n, k, p, cc, f) => ({ id: uid(), time, n, k, p, c: cc, f });
      c.diet.meals = [meal('08:00', 'Oats, banana & whey', 480, 32, 70, 8), meal('13:00', 'Chicken rice bowl', 650, 48, 70, 16), meal('17:00', 'Greek yogurt & almonds', 280, 20, 14, 14), meal('20:30', 'Paneer, roti & salad', 600, 36, 55, 24)];
      c.diet.targets = { k: 2100, p: 140, c: 230, f: 65 };
      for (let i = days; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i); const ds = iso(d);
        if (i % 7 === 0 || i === 0 && days > 20) c.progress.push({ date: ds, weight: +(sw + (tw - sw) * (1 - i / days) * 0.55).toFixed(1), fat: +(24 - (days - i) * 0.05).toFixed(1), waist: +(88 - (days - i) * 0.06).toFixed(1), note: '' });
        const planned = c.workouts[dow(ds)] || [];
        if (planned.length && (i + name.length) % 4 !== 0) c.log[ds] = { ex: planned.slice(0, planned.length - ((i + 1) % 3 === 0 ? 1 : 0)).map(p => p.id), meals: c.diet.meals.slice(0, 2 + (i % 3)).map(m => m.id), water: 5 };
      }
      return c;
    };
    if (only) return [mk(...only)];
    return [mk('Priya Sharma', 'Lose fat', 74, 66, 163, 'f', 42, 'priya'), mk('Marcus Kim', 'Build muscle', 68, 75, 178, 'm', 35, 'marcus')];
  };

  return {
    DAYS, esc, iso, today, dow, uid, blank, initials, weekDates, dayStat, adherence, lastActive, daysAgo, streak, weights, curWeight, weekBars, weightChart,
    all: read, get: id => read().find(c => c.id === id),
    save: c => { const a = read(), i = a.findIndex(x => x.id === c.id); i < 0 ? a.push(c) : a[i] = c; write(a); },
    remove: id => write(read().filter(c => c.id !== id)),
    demoClient: (name, login) => sample([name, 'Lose fat', 72, 66, 175, 'm', 30, login])[0],
    seed: () => { const a = read(), n = sample(); n.forEach(c => a.push(c)); write(a); return n; }
  };
})();
