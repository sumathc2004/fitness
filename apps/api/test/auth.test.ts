import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { AUTH } from '@gym/config';
import { prisma } from '@gym/database';
import { outbox } from '../src/lib/mailer';
import { sha256 } from '../src/lib/crypto';
import { PASSWORD, app, cookieValue, createUser, loggedInAgent, resetDb } from './helpers';

beforeAll(resetDb);

describe('health', () => {
  it('reports the database is up', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, db: 'up' });
  });
});

describe('login', () => {
  it('signs in with valid credentials, sets httpOnly cookies and never returns the password hash', async () => {
    const { email } = await createUser('CLIENT');
    const res = await request(app).post('/api/auth/login').send({ identifier: email.toUpperCase(), password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email, role: 'CLIENT' });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    const cookies = (res.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cookies).toContain(`${AUTH.accessCookie}=`);
    expect(cookies).toContain(`${AUTH.refreshCookie}=`);
    expect(cookies.toLowerCase()).toContain('httponly');
    expect(cookies.toLowerCase()).toContain('samesite=lax');
  });

  it('gives the same answer for a wrong password and an unknown email (no account enumeration)', async () => {
    const { email } = await createUser('CLIENT');
    const wrong = await request(app).post('/api/auth/login').send({ identifier: email, password: 'nope-nope-1' });
    const unknown = await request(app).post('/api/auth/login').send({ identifier: 'ghost@test.local', password: 'nope-nope-1' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('validates input', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: '', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.identifier).toBeDefined();
  });

  it('locks the account after repeated failures, even for the right password', async () => {
    const { email, password } = await createUser('CLIENT');
    for (let i = 0; i < AUTH.maxFailedLogins; i++) await request(app).post('/api/auth/login').send({ identifier: email, password: 'wrong-wrong-9' });
    const locked = await request(app).post('/api/auth/login').send({ identifier: email, password });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  it('refuses suspended accounts', async () => {
    const { email, password } = await createUser('CLIENT', { status: 'SUSPENDED' });
    const res = await request(app).post('/api/auth/login').send({ identifier: email, password });
    expect(res.status).toBe(403);
  });

  it('records login and failed-login events in the audit log', async () => {
    const { email, user } = await createUser('TRAINER');
    await request(app).post('/api/auth/login').send({ identifier: email, password: 'wrong-wrong-9' });
    await request(app).post('/api/auth/login').send({ identifier: email, password: PASSWORD });
    const actions = (await prisma.auditLog.findMany({ where: { actorUserId: user.id } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['LOGIN_FAILED', 'LOGIN']));
  });
});

describe('session', () => {
  it('/me requires authentication and returns the user when signed in', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const { email } = await createUser('TRAINER');
    const agent = await loggedInAgent(email);
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ email, role: 'TRAINER' });
    expect(me.body.user.trainerId).toBeTruthy();
  });

  it('rejects a tampered access token', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', `${AUTH.accessCookie}=abc.def.ghi`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('suspending a user kills their live session immediately', async () => {
    const { email, user } = await createUser('CLIENT');
    const agent = await loggedInAgent(email);
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    await prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
  });

  it('rotates the refresh token on every refresh', async () => {
    const { email } = await createUser('CLIENT');
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ identifier: email, password: PASSWORD });
    const first = cookieValue(login, AUTH.refreshCookie)!;
    const refreshed = await agent.post('/api/auth/refresh');
    expect(refreshed.status).toBe(200);
    const second = cookieValue(refreshed, AUTH.refreshCookie)!;
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
    expect((await agent.get('/api/auth/me')).status).toBe(200);
  });

  it('detects refresh-token reuse and revokes the whole token family', async () => {
    const { email, user } = await createUser('CLIENT');
    const login = await request(app).post('/api/auth/login').send({ identifier: email, password: PASSWORD });
    const stolen = cookieValue(login, AUTH.refreshCookie)!;
    // Legitimate rotation …
    const ok = await request(app).post('/api/auth/refresh').set('Cookie', `${AUTH.refreshCookie}=${stolen}`);
    expect(ok.status).toBe(200);
    const legit = cookieValue(ok, AUTH.refreshCookie)!;
    // … the original token was revoked long ago (outside the concurrency grace window):
    await prisma.refreshToken.updateMany({ where: { tokenHash: sha256(stolen) }, data: { revokedAt: new Date(Date.now() - 60_000) } });
    const replay = await request(app).post('/api/auth/refresh').set('Cookie', `${AUTH.refreshCookie}=${stolen}`);
    expect(replay.status).toBe(401);
    // the legitimate holder is logged out too, because the family is burned
    const after = await request(app).post('/api/auth/refresh').set('Cookie', `${AUTH.refreshCookie}=${legit}`);
    expect(after.status).toBe(401);
    expect((await prisma.auditLog.count({ where: { actorUserId: user.id, action: 'REFRESH_TOKEN_REUSE' } }))).toBe(1);
  });

  it('tolerates a concurrent double refresh without logging the user out', async () => {
    const { email } = await createUser('CLIENT');
    const login = await request(app).post('/api/auth/login').send({ identifier: email, password: PASSWORD });
    const token = cookieValue(login, AUTH.refreshCookie)!;
    const a = await request(app).post('/api/auth/refresh').set('Cookie', `${AUTH.refreshCookie}=${token}`);
    const b = await request(app).post('/api/auth/refresh').set('Cookie', `${AUTH.refreshCookie}=${token}`); // same cookie, moments later
    expect(a.status).toBe(200);
    expect(b.status).toBe(409);
    expect(b.body.error.code).toBe('REFRESH_RACE');
    // the winner's session is still valid
    const next = cookieValue(a, AUTH.refreshCookie)!;
    expect((await request(app).post('/api/auth/refresh').set('Cookie', `${AUTH.refreshCookie}=${next}`)).status).toBe(200);
  });

  it('logout revokes the session', async () => {
    const { email } = await createUser('CLIENT');
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ identifier: email, password: PASSWORD });
    const refresh = cookieValue(login, AUTH.refreshCookie)!;
    expect((await agent.post('/api/auth/logout')).status).toBe(200);
    const res = await request(app).post('/api/auth/refresh').set('Cookie', `${AUTH.refreshCookie}=${refresh}`);
    expect(res.status).toBe(401);
  });
});

describe('password reset', () => {
  it('answers identically for unknown emails and sends nothing', async () => {
    const before = outbox.length;
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@test.local' });
    expect(res.status).toBe(200);
    expect(outbox.length).toBe(before);
  });

  it('emails a single-use link and resets the password', async () => {
    const { email } = await createUser('CLIENT');
    const before = outbox.length;
    expect((await request(app).post('/api/auth/forgot-password').send({ email })).status).toBe(200);
    expect(outbox.length).toBe(before + 1);
    const token = /token=([\w-]+)/.exec(outbox.at(-1)!.text)![1]!;

    const weak = await request(app).post('/api/auth/reset-password').send({ token, password: 'short1' });
    expect(weak.status).toBe(400);

    const newPassword = 'Brand-New-Pass-77';
    expect((await request(app).post('/api/auth/reset-password').send({ token, password: newPassword })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ identifier: email, password: PASSWORD })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ identifier: email, password: newPassword })).status).toBe(200);
    // single use
    const again = await request(app).post('/api/auth/reset-password').send({ token, password: 'Another-Pass-88' });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('rejects expired tokens and signs out existing sessions after a reset', async () => {
    const { email, user } = await createUser('CLIENT');
    const agent = await loggedInAgent(email);
    await request(app).post('/api/auth/forgot-password').send({ email });
    const token = /token=([\w-]+)/.exec(outbox.at(-1)!.text)![1]!;
    await prisma.passwordResetToken.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'Valid-Pass-123' })).status).toBe(400);

    await request(app).post('/api/auth/forgot-password').send({ email });
    const fresh = /token=([\w-]+)/.exec(outbox.at(-1)!.text)![1]!;
    expect((await request(app).post('/api/auth/reset-password').send({ token: fresh, password: 'Valid-Pass-123' })).status).toBe(200);
    // the old browser session can no longer refresh
    expect((await agent.post('/api/auth/refresh')).status).toBe(401);
  });
});

describe('change password & profile', () => {
  it('requires the correct current password and keeps this device signed in', async () => {
    const { email } = await createUser('TRAINER');
    const agent = await loggedInAgent(email);
    const bad = await agent.post('/api/auth/change-password').send({ currentPassword: 'wrong-wrong-1', newPassword: 'Fresh-Pass-4567' });
    expect(bad.status).toBe(400);
    const same = await agent.post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: PASSWORD });
    expect(same.status).toBe(400);
    const ok = await agent.post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'Fresh-Pass-4567' });
    expect(ok.status).toBe(200);
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ identifier: email, password: 'Fresh-Pass-4567' })).status).toBe(200);
  });

  it('updates the profile with validation', async () => {
    const { email } = await createUser('CLIENT');
    const agent = await loggedInAgent(email);
    const bad = await agent.patch('/api/users/me').send({ firstName: '', lastName: 'X' });
    expect(bad.status).toBe(400);
    const ok = await agent.patch('/api/users/me').send({ firstName: 'Asha', lastName: 'Verma', phone: '+91 98765 43210' });
    expect(ok.status).toBe(200);
    expect(ok.body.user).toMatchObject({ firstName: 'Asha', lastName: 'Verma', phone: '+91 98765 43210' });
  });
});

describe('username sign-in (role-scoped)', () => {
  it('lets three roles share one username and password, each signing in through its own role', async () => {
    const u = '9606773589', pw = '9606773589';
    await createUser('SUPER_ADMIN', { username: u, password: pw });
    await createUser('TRAINER', { username: u, password: pw });
    await createUser('CLIENT', { username: u, password: pw });
    for (const role of ['SUPER_ADMIN', 'TRAINER', 'CLIENT'] as const) {
      const res = await request(app).post('/api/auth/login').send({ identifier: u, password: pw, role });
      expect(res.status, role).toBe(200);
      expect(res.body.user.role).toBe(role);
    }
  });

  it('rejects the right password under the wrong role, and a username without a role', async () => {
    await createUser('TRAINER', { username: 'coach.only', password: PASSWORD });
    const wrongRole = await request(app).post('/api/auth/login').send({ identifier: 'coach.only', password: PASSWORD, role: 'CLIENT' });
    expect(wrongRole.status).toBe(401);
    expect(wrongRole.body.error.code).toBe('INVALID_CREDENTIALS');
    const noRole = await request(app).post('/api/auth/login').send({ identifier: 'coach.only', password: PASSWORD });
    expect(noRole.status).toBe(400);
    expect(noRole.body.error.details.role).toBeDefined();
  });

  it('still allows email sign-in, and an email under the wrong role is refused', async () => {
    const { email } = await createUser('CLIENT');
    expect((await request(app).post('/api/auth/login').send({ identifier: email, password: PASSWORD })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ identifier: email, password: PASSWORD, role: 'CLIENT' })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ identifier: email, password: PASSWORD, role: 'SUPER_ADMIN' })).status).toBe(401);
  });

  it('usernames are unique within a role', async () => {
    await createUser('CLIENT', { username: 'dup-name' });
    await expect(createUser('CLIENT', { username: 'dup-name' })).rejects.toThrow();
  });
});

describe('request hardening', () => {
  it('blocks state-changing requests from a foreign Origin (CSRF)', async () => {
    const { email } = await createUser('CLIENT');
    const res = await request(app).post('/api/auth/login').set('Origin', 'https://evil.example').send({ identifier: email, password: PASSWORD });
    expect(res.status).toBe(403);
  });

  it('returns JSON errors for malformed bodies and unknown routes', async () => {
    const bad = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('BAD_JSON');
    const missing = await request(app).get('/api/nope');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });

  it('sends security headers and disables caching', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
