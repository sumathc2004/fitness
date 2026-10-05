// Demo authentication + roles stored in this browser's localStorage (no server, no email verification).
// Roles: 'admin' (trainer) and 'client'. Accounts created before roles existed count as admin.
// Not secure for production — move to a real backend before launch.
const SVDAuth = (() => {
  const USERS = 'svd_users', SESSION = 'svd_session';
  const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const hash = async s => {
    try {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
    } catch { return btoa(unescape(encodeURIComponent(s))); }
  };
  const key = u => u.trim().toLowerCase();
  // accounts are stored as 'role:username' so a trainer and a client may share a username; plain keys are legacy
  const slot = (all, role, user) => { const k = key(user); return all[role + ':' + k] ? role + ':' + k : (all[k] && (all[k].role || 'admin') === role ? k : role + ':' + k); };
  const users = () => read(USERS) || {};
  const put = u => localStorage.setItem(USERS, JSON.stringify(u));
  const session = (u, k) => localStorage.setItem(SESSION, JSON.stringify({ name: u.name, user: k, role: u.role || 'admin', clientId: u.clientId || null }));
  const api = {
    current: () => read(SESSION),
    hasAdmin: () => Object.values(users()).some(u => (u.role || 'admin') === 'admin'),
    home: me => (me && me.role === 'client') ? 'dashboard.html' : 'admin.html',
    async signup(name, user, pass) {
      if (api.hasAdmin()) throw new Error('Accounts are created by your trainer. Ask them for your login.');
      const h = await hash(pass), all = users(), k = slot(all, 'admin', user);
      if (all[k]) throw new Error('An account with that email/username already exists.');
      all[k] = { name, pass: h, role: 'admin' };
      put(all); session(all[k], key(user));
    },
    async login(user, pass, role = 'client') {
      const all = users(), u = all[slot(all, role, user)];
      if (!u || u.pass !== await hash(pass)) throw new Error('Incorrect email/username or password.');
      session(u, key(user));
    },
    // admin only: create / update / remove a client's login without touching the admin session
    async addClientUser(name, user, pass, clientId) {
      const h = await hash(pass), all = users(), k = slot(all, 'client', user);   // hash first: read-modify-write must be synchronous
      if (all[k] && all[k].clientId !== clientId) throw new Error('That username is already taken.');
      all[k] = { name, pass: h, role: 'client', clientId };
      put(all);
    },
    async setPassword(user, pass) {
      const h = await hash(pass), all = users(), k = slot(all, 'client', user);
      if (!all[k]) throw new Error('Login not found.');
      all[k].pass = h; put(all);
    },
    renameUser(user, name) { const all = users(), k = slot(all, 'client', user); if (all[k]) { all[k].name = name; put(all); } },
    removeUser(user) { const all = users(); delete all[slot(all, 'client', user)]; put(all); },
    hasUser: user => { const all = users(); return !!all[slot(all, 'client', user)]; },
    // Demo convenience: guarantee a trainer and a client login, both username & password = id
    async ensureDemo(id) {
      const all0 = users();
      if (!all0[slot(all0, 'admin', id)]) { const h = await hash(id), all = users(); all['admin:' + id] = { name: 'Trainer', pass: h, role: 'admin' }; put(all); }
      if (typeof SVDData === 'undefined') return;
      let c = SVDData.all().find(x => x.login === id);
      if (!c) { c = SVDData.demoClient('Demo Client', id); SVDData.save(c); }
      const a1 = users();
      if (!a1[slot(a1, 'client', id)]) await api.addClientUser(c.name, id, id, c.id);
    },
    logout() { localStorage.removeItem(SESSION); location.href = 'index.html'; }
  };
  return api;
})();

// Landing-page nav button reflects login state
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('authBtn');
  const me = SVDAuth.current();
  if (!btn || !me) return;
  btn.textContent = 'Hi, ' + me.name.split(' ')[0] + ' · ' + (me.role === 'client' ? 'My plan' : 'Admin') + ' →';
  btn.href = SVDAuth.home(me);
});
