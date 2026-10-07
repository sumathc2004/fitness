import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@gym/database';
import { assign, createUser, loggedInAgent, resetDb } from './helpers';

type U = Awaited<ReturnType<typeof createUser>>;
type A = Awaited<ReturnType<typeof loggedInAgent>>;
let admin: U, trainer: U, other: U, client: U, stranger: U;
let adminA: A, trainerA: A, otherA: A, clientA: A, strangerA: A;
const today = () => new Date().toISOString().slice(0, 10);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 1)]);

beforeAll(async () => {
  await resetDb();
  admin = await createUser('SUPER_ADMIN');
  trainer = await createUser('TRAINER');
  other = await createUser('TRAINER');
  client = await createUser('CLIENT', { firstName: 'Cleo', lastName: 'Ops' });
  stranger = await createUser('CLIENT');
  await assign(trainer.trainerId!, client.clientId!);
  await assign(other.trainerId!, stranger.clientId!);
  await prisma.client.update({ where: { id: client.clientId! }, data: { qrCode: 'GYM-TEST01' } });
  adminA = await loggedInAgent(admin.email);
  trainerA = await loggedInAgent(trainer.email);
  otherA = await loggedInAgent(other.email);
  clientA = await loggedInAgent(client.email);
  strangerA = await loggedInAgent(stranger.email);
});

describe('measurements, progress, photos', () => {
  it('records measurements, builds the summary, and respects ownership', async () => {
    expect((await clientA.post('/api/progress/measurements').send({})).status).toBe(400);
    const a = await clientA.post('/api/progress/measurements').send({ weightKg: 82, waistCm: 92, measuredAt: new Date(Date.now() - 10 * 86400000).toISOString() });
    expect(a.status).toBe(201);
    await trainerA.post(`/api/progress/measurements?clientId=${client.clientId}`).send({ weightKg: 80.5, waistCm: 90 });
    const s = (await clientA.get('/api/progress/summary')).body;
    expect(s.weight.series).toHaveLength(2);
    expect(s.weight.changeKg).toBe(-1.5);
    expect(s.bodyFat.isEstimate).toBe(true);
    expect((await otherA.post(`/api/progress/measurements?clientId=${client.clientId}`).send({ weightKg: 70 })).status).toBe(404);
    expect((await clientA.get(`/api/progress/summary?clientId=${stranger.clientId}`)).status).toBe(403);
    expect((await trainerA.get('/api/progress/summary')).status).toBe(400); // staff must choose a client
  });

  it('stores photos privately and validates they are real images', async () => {
    const bad = await clientA.post('/api/progress/photos').attach('file', Buffer.from('not an image at all, just text'), 'x.jpg');
    expect(bad.status).toBe(400);
    const ok = await clientA.post('/api/progress/photos').field('angle', 'SIDE').attach('file', PNG, 'me.png');
    expect(ok.status).toBe(201);
    const file = await clientA.get(ok.body.url);
    expect(file.status).toBe(200);
    expect((await trainerA.get(ok.body.url)).status).toBe(200);
    expect((await otherA.get(ok.body.url)).status).toBe(404);
    expect((await strangerA.get(ok.body.url)).status).toBe(403);
    expect((await clientA.get('/api/progress/photos')).body.items).toHaveLength(1);
    expect((await clientA.delete(`/api/progress/photos/${ok.body.id}`)).status).toBe(200);
  });

  it('trainer review notifies the client; clients cannot review', async () => {
    const body = { clientId: client.clientId, period: 'WEEKLY', periodStart: today(), periodEnd: today(), trainerComment: 'Great consistency' };
    expect((await clientA.post('/api/progress/review').send(body)).status).toBe(403);
    expect((await trainerA.post('/api/progress/review').send(body)).status).toBe(201);
    expect((await clientA.get(`/api/progress/review?period=WEEKLY&start=${today()}`)).body.review.trainerComment).toBe('Great consistency');
    expect(await prisma.notification.count({ where: { userId: client.user.id, type: 'PROGRESS_REVIEW' } })).toBe(1);
  });
});

describe('attendance', () => {
  it('QR scan checks in, then out, then refuses a third scan', async () => {
    const qr = await clientA.get('/api/attendance/my-qr');
    expect(qr.body.code).toBe('GYM-TEST01');
    const inn = await trainerA.post('/api/attendance/scan').send({ code: 'gym-test01' });
    expect(inn.body.action).toBe('CHECK_IN');
    expect((await trainerA.post('/api/attendance/scan').send({ code: 'GYM-TEST01' })).body.action).toBe('CHECK_OUT');
    expect((await trainerA.post('/api/attendance/scan').send({ code: 'GYM-TEST01' })).status).toBe(400);
    expect((await otherA.post('/api/attendance/scan').send({ code: 'GYM-TEST01' })).status).toBe(404);
    expect((await trainerA.post('/api/attendance/scan').send({ code: 'NOPE-0000' })).status).toBe(404);
    expect((await clientA.post('/api/attendance/scan').send({ code: 'GYM-TEST01' })).status).toBe(403);
  });
  it('manual marking, day view and history', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    expect((await trainerA.post('/api/attendance/mark').send({ clientId: client.clientId, date: yesterday, status: 'LEAVE' })).status).toBe(200);
    const d = (await trainerA.get(`/api/attendance/day?date=${today()}`)).body;
    expect(d.rows.map((r: { clientId: string }) => r.clientId)).toEqual([client.clientId]); // roster only
    expect(d.totals.present).toBe(1);
    const h = (await clientA.get('/api/attendance/history')).body;
    expect(h.summary).toMatchObject({ attended: 1, leave: 1 });
  });
  it('device endpoint needs the shared key', async () => {
    const res = await trainerA.post('/api/attendance/device-scan').send({ code: 'GYM-TEST01' });
    expect(res.status).toBe(401);
    expect((await clientA.post('/api/attendance/device-scan').set('x-device-key', 'guess-guess-guess').send({ code: 'GYM-TEST01' })).status).toBe(401);
  });
});

describe('habits', () => {
  it('logs water, sleep and steps for the day', async () => {
    await clientA.post('/api/habits/water').send({ amountMl: 500 });
    const w = await clientA.post('/api/habits/water').send({ amountMl: 750 });
    expect(w.body.water.totalMl).toBe(1250);
    await clientA.delete(`/api/habits/water/${w.body.water.entries[1].id}`);
    await clientA.put('/api/habits/sleep').send({ hours: 7.5, quality: 4 });
    const s = await clientA.put('/api/habits/habit').send({ habitKey: 'steps', value: 9000 });
    expect(s.body.water.totalMl).toBe(500);
    expect(s.body.sleep.hours).toBe(7.5);
    expect(s.body.habits.find((h: { key: string }) => h.key === 'steps')).toMatchObject({ completed: true, value: 9000 });
    expect((await clientA.put('/api/habits/habit').send({ habitKey: 'nope', value: 1 })).status).toBe(400);
    expect((await trainerA.post('/api/habits/water').send({ amountMl: 500 })).status).toBe(403);
    expect((await trainerA.get(`/api/habits?clientId=${client.clientId}`)).body.water.totalMl).toBe(500);
    expect((await otherA.get(`/api/habits?clientId=${client.clientId}`)).status).toBe(404);
    expect((await clientA.get('/api/habits/history')).body.items).toHaveLength(14);
  });
});

describe('messages and notifications', () => {
  it('only allows messaging within the trainer–client relationship', async () => {
    expect((await clientA.post('/api/messages').send({ recipientId: trainer.user.id, body: 'Hi coach' })).status).toBe(201);
    expect((await clientA.post('/api/messages').send({ recipientId: other.user.id, body: 'Hi' })).status).toBe(403);
    expect((await clientA.post('/api/messages').send({ recipientId: stranger.user.id, body: 'Hi' })).status).toBe(403);
    expect((await clientA.post('/api/messages').send({ recipientId: trainer.user.id, body: '   ' })).status).toBe(400);
    const convo = (await trainerA.get('/api/messages/conversations')).body.items;
    expect(convo).toHaveLength(1);
    expect(convo[0]).toMatchObject({ userId: client.user.id, unread: 1 });
    expect((await trainerA.get('/api/messages/unread-count')).body.count).toBe(1);
    const t = await trainerA.get(`/api/messages/with/${client.user.id}`);
    expect(t.body.items[0].body).toBe('Hi coach');
    expect((await trainerA.get('/api/messages/unread-count')).body.count).toBe(0);
    expect((await otherA.get(`/api/messages/with/${client.user.id}`)).status).toBe(404);
    expect((await trainerA.post('/api/messages').send({ recipientId: client.user.id, body: 'Welcome!' })).status).toBe(201);
    expect((await adminA.post('/api/messages').send({ recipientId: client.user.id, body: 'From admin' })).status).toBe(201);
    expect((await clientA.get('/api/messages/contacts')).body.items.map((c: { userId: string }) => c.userId)).toEqual([trainer.user.id]);
  });
  it('notifications list, mark read, and are private', async () => {
    const mine = (await trainerA.get('/api/notifications')).body;
    expect(mine.unread).toBeGreaterThan(0);
    await trainerA.post(`/api/notifications/${mine.items[0].id}/read`);
    expect((await trainerA.get('/api/notifications')).body.unread).toBe(mine.unread - 1);
    await otherA.post(`/api/notifications/${mine.items[0].id}/read`); // someone else's → no effect
    await trainerA.post('/api/notifications/read-all');
    expect((await trainerA.get('/api/notifications?unread=true')).body.items).toHaveLength(0);
  });
  it('reminder sweep is idempotent and only for admins', async () => {
    const w = await prisma.workout.create({ data: { name: 'Missed leg day', clientId: client.clientId, trainerId: trainer.trainerId, isTemplate: false, status: 'ASSIGNED', scheduledDate: new Date(Date.now() - 86400000 - (Date.now() % 86400000)) } });
    expect((await trainerA.post('/api/notifications/run-reminders')).status).toBe(403);
    const first = await adminA.post('/api/notifications/run-reminders');
    expect(first.body.missedWorkout).toBe(1);
    expect((await adminA.post('/api/notifications/run-reminders')).body.missedWorkout).toBe(0);
    expect(await prisma.notification.count({ where: { type: 'MISSED_WORKOUT', userId: trainer.user.id } })).toBe(1);
    await prisma.workout.delete({ where: { id: w.id } });
  });
});

describe('memberships, subscriptions, payments', () => {
  let planId: string;
  it('admin manages plans; others cannot', async () => {
    const body = { name: 'Gold', price: 2500, durationDays: 30, features: ['Gym access', 'Diet plan'] };
    expect((await trainerA.post('/api/memberships').send(body)).status).toBe(403);
    const p = await adminA.post('/api/memberships').send(body);
    expect(p.status).toBe(201);
    planId = p.body.id;
    expect((await adminA.post('/api/memberships').send({ ...body, price: -1 })).status).toBe(400);
    expect((await clientA.get('/api/memberships')).body.items.map((x: { name: string }) => x.name)).toContain('Gold');
  });
  it('assigning a plan creates the subscription + invoice and replaces the old one', async () => {
    const a = await adminA.post('/api/subscriptions').send({ clientId: client.clientId, membershipId: planId, method: 'UPI' });
    expect(a.status).toBe(201);
    expect(a.body.subscription.daysLeft).toBeGreaterThanOrEqual(29);
    await adminA.post('/api/subscriptions').send({ clientId: client.clientId, membershipId: planId, markPaid: false });
    const mine = (await clientA.get('/api/subscriptions/mine')).body;
    expect(mine.current.membership.name).toBe('Gold');
    expect(mine.subscriptions.filter((s: { status: string }) => s.status === 'ACTIVE')).toHaveLength(1);
    expect(mine.payments).toHaveLength(2);
    expect(new Set(mine.payments.map((p: { invoiceNo: string }) => p.invoiceNo)).size).toBe(2);
    expect((await trainerA.post('/api/subscriptions').send({ clientId: client.clientId, membershipId: planId })).status).toBe(403);
  });
  it('payments: admin-only ledger, status changes are audited, summary adds up', async () => {
    expect((await trainerA.get('/api/payments')).status).toBe(403);
    expect((await clientA.get('/api/payments')).status).toBe(403);
    const list = (await adminA.get('/api/payments?status=PENDING')).body;
    expect(list.total).toBe(1);
    const paid = await adminA.post(`/api/payments/${list.items[0].id}/status`).send({ status: 'PAID' });
    expect(paid.body.paidAt).toBeTruthy();
    expect(await prisma.auditLog.count({ where: { action: 'PAYMENT_STATUS_CHANGED' } })).toBe(1);
    const sum = (await adminA.get('/api/payments/summary')).body;
    expect(sum.revenueThisMonth).toBe(5000);
    expect(sum.pendingCount).toBe(0);
    expect(sum.activeMemberships).toBe(1);
    expect((await adminA.post('/api/payments').send({ clientId: client.clientId, amount: 300, method: 'CASH', notes: 'Locker fee' })).status).toBe(201);
  });
});

describe('analytics and reports', () => {
  it('analytics are role-scoped', async () => {
    const a = (await adminA.get('/api/analytics/admin')).body;
    expect(a.revenueByMonth).toHaveLength(6);
    expect(a.revenueByMonth.at(-1).revenue).toBe(5300);
    expect((await trainerA.get('/api/analytics/admin')).status).toBe(403);
    const t = (await trainerA.get('/api/analytics/trainer')).body;
    expect(t.clients).toBe(1);
    expect(t.perClient[0].name).toBe('Cleo Ops');
    expect((await adminA.get('/api/analytics/trainer')).status).toBe(403);
  });
  it('monthly report: JSON + PDF, scoped to the right people', async () => {
    const month = today().slice(0, 7);
    await prisma.bodyMeasurement.create({ data: { clientId: client.clientId!, weightKg: 90, measuredAt: new Date(`${month}-01T00:00:00.000Z`) } });
    const r = await clientA.get(`/api/reports/monthly?month=${month}`);
    expect(r.status).toBe(200);
    expect(r.body.clientName).toBe('Cleo Ops');
    expect(r.body.body.weightChangeKg).toBe(-9.5);
    expect(r.body.attendance.present).toBe(1);
    expect((await clientA.get('/api/reports/monthly?month=2026-13')).status).toBe(400);
    expect((await otherA.get(`/api/reports/monthly?clientId=${client.clientId}&month=${month}`)).status).toBe(404);
    const pdf = await trainerA.get(`/api/reports/monthly.pdf?clientId=${client.clientId}&month=${month}`).buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on('data', (d: Buffer) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
  });
});
