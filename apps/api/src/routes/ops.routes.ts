import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '@gym/database';
import { env } from '../config/env';
import { AppError, forbidden, unauthorized } from '../lib/errors';
import { pageQuery } from '../lib/pagination';
import { authenticate, requirePermission, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { visibleClientIds } from '../services/access.service';
import * as analytics from '../services/analytics.service';
import * as attendance from '../services/attendance.service';
import * as billing from '../services/billing.service';
import * as habits from '../services/habits.service';
import * as messages from '../services/message.service';
import * as progress from '../services/progress.service';
import * as reports from '../services/report.service';
import { runReminders } from '../services/jobs.service';

const id = (v: unknown) => String(v);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const today = () => new Date().toISOString().slice(0, 10);
const num = z.number().finite();
const optNum = (min: number, max: number) => z.number().min(min).max(max).nullish();

/** Clients act on themselves; staff must say which client (and are checked against their roster downstream). */
function target(req: { auth?: { role: string; clientId: string | null } }, requested?: string | null): string {
  if (req.auth!.role === 'CLIENT') {
    if (requested && requested !== req.auth!.clientId) throw forbidden();
    if (!req.auth!.clientId) throw forbidden();
    return req.auth!.clientId;
  }
  if (!requested) throw new AppError(400, 'BAD_REQUEST', 'Choose a client');
  return requested;
}
const clientQuery = z.object({ clientId: z.string().optional() });

// ─────────────────────────────────────────── /api/progress
export const progressRouter = Router();
progressRouter.use(authenticate);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } });

const measurementSchema = z.object({
  measuredAt: z.string().datetime().optional(),
  weightKg: optNum(20, 400), waistCm: optNum(30, 250), neckCm: optNum(15, 80), hipCm: optNum(40, 250),
  chestCm: optNum(40, 250), shoulderCm: optNum(50, 250), armCm: optNum(10, 90), thighCm: optNum(20, 150),
  notes: z.string().trim().max(500).nullish(),
}).refine((v) => [v.weightKg, v.waistCm, v.neckCm, v.hipCm, v.chestCm, v.shoulderCm, v.armCm, v.thighCm].some((x) => x != null), { message: 'Enter at least one measurement' });

progressRouter.get('/summary', async (req, res) => { res.json(await progress.progressSummary(req, target(req, clientQuery.parse(req.query).clientId))); });
progressRouter.get('/records', async (req, res) => { res.json({ items: await progress.personalRecords(req, target(req, clientQuery.parse(req.query).clientId)) }); });
progressRouter.get('/activity', async (req, res) => { res.json({ items: await progress.activityFeed(req, target(req, clientQuery.parse(req.query).clientId)) }); });
progressRouter.get('/measurements', async (req, res) => { res.json({ items: await progress.listMeasurements(req, target(req, clientQuery.parse(req.query).clientId)) }); });
progressRouter.post('/measurements', validate(measurementSchema), async (req, res) => {
  res.status(201).json(await progress.addMeasurement(req, target(req, clientQuery.parse(req.query).clientId), req.body as progress.MeasurementInput));
});
progressRouter.delete('/measurements/:id', async (req, res) => { await progress.deleteMeasurement(req, id(req.params.id)); res.json({ ok: true }); });

progressRouter.get('/photos', async (req, res) => { res.json({ items: await progress.listPhotos(req, target(req, clientQuery.parse(req.query).clientId)) }); });
progressRouter.post('/photos', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) return next(new AppError(400, 'UPLOAD_ERROR', err.code === 'LIMIT_FILE_SIZE' ? 'Photo is larger than 8 MB' : err.message));
    next(err);
  });
}, async (req, res) => {
  if (!req.file) throw new AppError(400, 'BAD_REQUEST', 'Choose a photo');
  const meta = z.object({
    angle: z.enum(['FRONT', 'SIDE', 'BACK', 'OTHER']).default('FRONT'),
    weightKg: z.coerce.number().min(20).max(400).optional(),
    notes: z.string().trim().max(300).optional(),
    takenAt: z.string().datetime().optional(),
  }).parse(req.body);
  res.status(201).json(await progress.addPhoto(req, target(req, clientQuery.parse(req.query).clientId), req.file, meta));
});
progressRouter.get('/photos/:id/file', async (req, res) => {
  const file = await progress.photoFile(req, id(req.params.id));
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.sendFile(file, (err) => { if (err && !res.headersSent) res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Photo not found' } }); });
});
progressRouter.delete('/photos/:id', async (req, res) => { await progress.deletePhoto(req, id(req.params.id)); res.json({ ok: true }); });

progressRouter.get('/review', async (req, res) => {
  const q = z.object({ clientId: z.string().optional(), period: z.enum(['WEEKLY', 'MONTHLY']), start: day }).parse(req.query);
  res.json({ review: await progress.periodReview(req, target(req, q.clientId), q.period, q.start) });
});
progressRouter.post('/review', requireRole('SUPER_ADMIN', 'TRAINER'), validate(z.object({
  clientId: z.string(), period: z.enum(['WEEKLY', 'MONTHLY']), periodStart: day, periodEnd: day, trainerComment: z.string().trim().min(1, 'Write a comment').max(2000),
})), async (req, res) => {
  const b = req.body as { clientId: string; period: 'WEEKLY' | 'MONTHLY'; periodStart: string; periodEnd: string; trainerComment: string };
  res.status(201).json(await progress.saveReview(req, b.clientId, b));
});

// ─────────────────────────────────────────── /api/attendance
export const attendanceRouter = Router();
const deviceLimiterKey = () => env.DEVICE_API_KEY;
/** Door hardware / kiosks: authenticated with a shared device key instead of a user session. */
attendanceRouter.post('/device-scan', validate(z.object({ code: z.string().min(4).max(40), deviceId: z.string().max(60).optional(), method: z.enum(['QR', 'BIOMETRIC']).default('QR') })), async (req, res) => {
  const key = deviceLimiterKey();
  const given = req.get('x-device-key') ?? '';
  if (!key || given.length !== key.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(key))) throw unauthorized('Invalid device key');
  const b = req.body as { code: string; deviceId?: string; method: 'QR' | 'BIOMETRIC' };
  res.json(await attendance.checkByCode({ code: b.code, method: b.method, recordedBy: null, deviceId: b.deviceId ?? null }));
});
attendanceRouter.use(authenticate);
attendanceRouter.get('/my-qr', requirePermission('attendance:read-own'), async (req, res) => { res.json(await attendance.myQr(req)); });
attendanceRouter.get('/day', requirePermission('attendance:manage'), async (req, res) => { res.json(await attendance.dayView(req, z.object({ date: day.default(today) }).parse(req.query).date)); });
attendanceRouter.post('/mark', requirePermission('attendance:manage'), validate(z.object({ clientId: z.string(), date: day, status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'LEAVE']), notes: z.string().trim().max(300).nullish() })), async (req, res) => {
  res.json(await attendance.mark(req, req.body as Parameters<typeof attendance.mark>[1]));
});
attendanceRouter.post('/scan', requirePermission('attendance:manage'), validate(z.object({ code: z.string().min(4).max(40) })), async (req, res) => {
  res.json(await attendance.checkByCode({ code: (req.body as { code: string }).code, method: 'QR', recordedBy: req.auth!.userId }, req));
});
attendanceRouter.get('/history', async (req, res) => {
  const q = z.object({ clientId: z.string().optional(), days: z.coerce.number().int().min(7).max(365).default(90) }).parse(req.query);
  res.json(await attendance.history(req, target(req, q.clientId), q.days));
});

// ─────────────────────────────────────────── /api/habits
export const habitsRouter = Router();
habitsRouter.use(authenticate);
habitsRouter.get('/', async (req, res) => {
  const q = z.object({ clientId: z.string().optional(), date: day.default(today) }).parse(req.query);
  res.json(await habits.daySummary(req, target(req, q.clientId), q.date));
});
habitsRouter.get('/history', async (req, res) => {
  const q = z.object({ clientId: z.string().optional(), days: z.coerce.number().int().min(3).max(60).default(14) }).parse(req.query);
  res.json({ items: await habits.habitHistory(req, target(req, q.clientId), q.days) });
});
habitsRouter.post('/water', requirePermission('habits:log'), validate(z.object({ date: day.default(today), amountMl: z.number().int().min(50).max(3000) })), async (req, res) => {
  res.status(201).json(await habits.addWater(req, req.body as { date: string; amountMl: number }));
});
habitsRouter.delete('/water/:id', requirePermission('habits:log'), async (req, res) => { res.json(await habits.removeWater(req, id(req.params.id))); });
habitsRouter.put('/sleep', requirePermission('habits:log'), validate(z.object({ date: day.default(today), hours: num.min(0.5).max(20), quality: z.number().int().min(1).max(5).nullish(), notes: z.string().trim().max(300).nullish() })), async (req, res) => {
  res.json(await habits.setSleep(req, req.body as Parameters<typeof habits.setSleep>[1]));
});
habitsRouter.put('/habit', requirePermission('habits:log'), validate(z.object({ date: day.default(today), habitKey: z.string().max(40), completed: z.boolean().optional(), value: z.number().min(0).max(200000).nullish() })), async (req, res) => {
  res.json(await habits.setHabit(req, req.body as Parameters<typeof habits.setHabit>[1]));
});

// ─────────────────────────────────────────── /api/messages
export const messagesRouter = Router();
messagesRouter.use(authenticate, requirePermission('messages:use'));
messagesRouter.get('/contacts', async (req, res) => { res.json({ items: await messages.contacts(req) }); });
messagesRouter.get('/conversations', async (req, res) => { res.json({ items: await messages.conversations(req) }); });
messagesRouter.get('/unread-count', async (req, res) => { res.json({ count: await messages.unreadCount(req) }); });
messagesRouter.get('/with/:userId', async (req, res) => { res.json({ items: await messages.thread(req, id(req.params.userId), z.object({ before: z.string().optional() }).parse(req.query).before) }); });
messagesRouter.post('/', validate(z.object({ recipientId: z.string(), body: z.string().trim().min(1, 'Type a message').max(2000) })), async (req, res) => {
  const b = req.body as { recipientId: string; body: string };
  res.status(201).json(await messages.send(req, b.recipientId, b.body));
});

// ─────────────────────────────────────────── /api/notifications
export const notificationsRouter = Router();
notificationsRouter.use(authenticate, requirePermission('notifications:use'));
notificationsRouter.get('/', async (req, res) => {
  const q = z.object({ unread: z.enum(['true']).optional(), limit: z.coerce.number().int().min(1).max(100).default(30) }).parse(req.query);
  const where = { userId: req.auth!.userId, ...(q.unread ? { readAt: null } : {}) };
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: q.limit }),
    prisma.notification.count({ where: { userId: req.auth!.userId, readAt: null } }),
  ]);
  res.json({ unread, items: items.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, read: !!n.readAt, at: n.createdAt.toISOString() })) });
});
notificationsRouter.post('/read-all', async (req, res) => { await prisma.notification.updateMany({ where: { userId: req.auth!.userId, readAt: null }, data: { readAt: new Date() } }); res.json({ ok: true }); });
notificationsRouter.post('/:id/read', async (req, res) => { await prisma.notification.updateMany({ where: { id: id(req.params.id), userId: req.auth!.userId }, data: { readAt: new Date() } }); res.json({ ok: true }); });
notificationsRouter.post('/run-reminders', requireRole('SUPER_ADMIN'), async (_req, res) => { res.json(await runReminders()); });

// ─────────────────────────────────────────── /api/memberships, /api/subscriptions, /api/payments
export const membershipsRouter = Router();
membershipsRouter.use(authenticate);
const planSchema = z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(400).nullish(), price: z.number().min(0).max(1_000_000), durationDays: z.number().int().min(1).max(3650), features: z.array(z.string().trim().min(1).max(80)).max(12).optional(), isActive: z.boolean().optional() });
membershipsRouter.get('/', async (req, res) => { res.json({ items: await billing.listPlans(req.auth!.role === 'SUPER_ADMIN') }); });
membershipsRouter.post('/', requirePermission('memberships:manage'), validate(planSchema), async (req, res) => { res.status(201).json(await billing.createPlan(req, req.body as billing.PlanInput)); });
membershipsRouter.put('/:id', requirePermission('memberships:manage'), validate(planSchema), async (req, res) => { res.json(await billing.updatePlan(req, id(req.params.id), req.body as billing.PlanInput)); });

export const subscriptionsRouter = Router();
subscriptionsRouter.use(authenticate);
subscriptionsRouter.get('/', requirePermission('memberships:manage'), async (req, res) => {
  const q = z.object({ status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED', 'PAUSED', 'PENDING']).optional(), expiringInDays: z.coerce.number().int().min(1).max(365).optional() }).parse(req.query);
  res.json({ items: await billing.listSubscriptions(q) });
});
subscriptionsRouter.post('/', requirePermission('memberships:manage'), validate(z.object({ clientId: z.string(), membershipId: z.string(), startDate: day.optional(), amountPaid: z.number().min(0).optional(), method: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'ONLINE', 'OTHER']).optional(), markPaid: z.boolean().optional(), notes: z.string().trim().max(300).nullish() })), async (req, res) => {
  res.status(201).json(await billing.assignMembership(req, req.body as Parameters<typeof billing.assignMembership>[1]));
});
subscriptionsRouter.post('/:id/cancel', requirePermission('memberships:manage'), async (req, res) => { await billing.cancelSubscription(req, id(req.params.id)); res.json({ ok: true }); });
subscriptionsRouter.get('/mine', requireRole('CLIENT'), async (req, res) => { res.json(await billing.clientBilling(req, req.auth!.clientId!)); });
subscriptionsRouter.get('/client/:clientId', requirePermission('memberships:manage'), async (req, res) => { res.json(await billing.clientBilling(req, id(req.params.clientId))); });

export const paymentsRouter = Router();
paymentsRouter.use(authenticate);
paymentsRouter.get('/summary', requirePermission('payments:manage'), async (_req, res) => { res.json(await billing.billingSummary()); });
paymentsRouter.get('/', requirePermission('payments:manage'), async (req, res) => {
  const q = pageQuery.extend({ status: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']).optional(), clientId: z.string().optional() }).parse(req.query);
  res.json(await billing.listPayments(q));
});
paymentsRouter.post('/', requirePermission('payments:manage'), validate(z.object({ clientId: z.string(), amount: z.number().positive().max(1_000_000), method: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'ONLINE', 'OTHER']), status: z.enum(['PENDING', 'PAID']).optional(), dueDate: day.nullish(), notes: z.string().trim().max(300).nullish() })), async (req, res) => {
  res.status(201).json(await billing.recordPayment(req, req.body as Parameters<typeof billing.recordPayment>[1]));
});
paymentsRouter.post('/:id/status', requirePermission('payments:manage'), validate(z.object({ status: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']) })), async (req, res) => {
  res.json(await billing.setPaymentStatus(req, id(req.params.id), (req.body as { status: 'PAID' }).status));
});

// ─────────────────────────────────────────── /api/analytics, /api/reports
export const analyticsRouter = Router();
analyticsRouter.use(authenticate);
analyticsRouter.get('/admin', requirePermission('analytics:read-all'), async (_req, res) => { res.json(await analytics.adminAnalytics()); });
analyticsRouter.get('/trainer', requireRole('TRAINER'), async (req, res) => { res.json(await analytics.trainerAnalytics(req.auth!.trainerId!)); });

export const reportsRouter = Router();
reportsRouter.use(authenticate);
const reportQuery = z.object({ clientId: z.string().optional(), month: z.string().regex(/^\d{4}-\d{2}$/).default(() => today().slice(0, 7)) });
reportsRouter.get('/monthly', async (req, res) => {
  const q = reportQuery.parse(req.query);
  res.json(await reports.monthlyReport(req, target(req, q.clientId), q.month));
});
reportsRouter.get('/monthly.pdf', async (req, res) => {
  const q = reportQuery.parse(req.query);
  const r = await reports.monthlyReport(req, target(req, q.clientId), q.month);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="report-${r.clientName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${r.month}.pdf"`);
  const doc = reports.reportPdf(r);
  doc.pipe(res);
  doc.end();
});
reportsRouter.get('/clients', requireRole('SUPER_ADMIN', 'TRAINER'), async (req, res) => {
  const ids = await visibleClientIds(req);
  res.json({ items: await prisma.client.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, user: { select: { firstName: true, lastName: true } } }, orderBy: { user: { firstName: 'asc' } } }).then((rows) => rows.map((c) => ({ id: c.id, name: `${c.user.firstName} ${c.user.lastName}` }))) });
});
