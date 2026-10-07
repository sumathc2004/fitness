import type { Request } from 'express';
import { prisma } from '@gym/database';
import type { AttendanceMethod, AttendanceStatus } from '@gym/database';
import { isoDate, startOfDayUTC, todayUTC } from '../lib/dates';
import { badRequest, notFound } from '../lib/errors';
import { dateOnly } from '../lib/pagination';
import { assertCanAccessClient, visibleClientIds } from './access.service';
import { logActivity } from './audit.service';

const dto = (a: { id: string; clientId: string; date: Date; status: AttendanceStatus; method: AttendanceMethod; checkInAt: Date | null; checkOutAt: Date | null; notes: string | null }) => ({
  id: a.id, clientId: a.clientId, date: isoDate(a.date), status: a.status, method: a.method,
  checkInAt: a.checkInAt?.toISOString() ?? null, checkOutAt: a.checkOutAt?.toISOString() ?? null, notes: a.notes,
});

/** Staff mark a day (present / absent / late / leave) for a client. */
export async function mark(req: Request, input: { clientId: string; date: string; status: AttendanceStatus; notes?: string | null }) {
  await assertCanAccessClient(req, input.clientId);
  const date = dateOnly(input.date);
  const now = new Date();
  const present = input.status === 'PRESENT' || input.status === 'LATE';
  const row = await prisma.attendance.upsert({
    where: { clientId_date: { clientId: input.clientId, date } },
    update: { status: input.status, method: 'MANUAL', recordedBy: req.auth!.userId, notes: input.notes ?? null },
    create: { clientId: input.clientId, date, status: input.status, method: 'MANUAL', recordedBy: req.auth!.userId, notes: input.notes ?? null, checkInAt: present ? now : null },
  });
  return dto(row);
}

async function clientByQr(code: string) {
  const c = await prisma.client.findUnique({ where: { qrCode: code.trim().toUpperCase() }, select: { id: true, status: true, user: { select: { firstName: true, lastName: true } } } });
  if (!c) throw notFound('Unknown QR code');
  return c;
}

/** First scan of the day checks in, a later scan checks out. Used by staff scanning a client's QR and by door hardware. */
export async function checkByCode(opts: { code: string; method: AttendanceMethod; recordedBy: string | null; deviceId?: string | null; late?: boolean }, staffReq?: Request) {
  const c = await clientByQr(opts.code);
  if (c.status !== 'ACTIVE') throw badRequest('This client’s membership is not active');
  if (staffReq) await assertCanAccessClient(staffReq, c.id);
  const date = todayUTC();
  const now = new Date();
  const existing = await prisma.attendance.findUnique({ where: { clientId_date: { clientId: c.id, date } } });
  let action: 'CHECK_IN' | 'CHECK_OUT';
  let row;
  if (!existing || !existing.checkInAt) {
    action = 'CHECK_IN';
    const data = { status: (opts.late ? 'LATE' : 'PRESENT') as AttendanceStatus, method: opts.method, checkInAt: now, checkOutAt: null, recordedBy: opts.recordedBy, deviceId: opts.deviceId ?? null };
    row = existing ? await prisma.attendance.update({ where: { id: existing.id }, data }) : await prisma.attendance.create({ data: { clientId: c.id, date, ...data } });
    await logActivity({ actorUserId: opts.recordedBy, clientId: c.id, type: 'CHECKED_IN', entityType: 'Attendance', entityId: row.id });
  } else if (!existing.checkOutAt) {
    action = 'CHECK_OUT';
    row = await prisma.attendance.update({ where: { id: existing.id }, data: { checkOutAt: now } });
    await logActivity({ actorUserId: opts.recordedBy, clientId: c.id, type: 'CHECKED_OUT', entityType: 'Attendance', entityId: row.id });
  } else {
    throw badRequest('Already checked in and out today');
  }
  return { action, client: { id: c.id, name: `${c.user.firstName} ${c.user.lastName}` }, attendance: dto(row) };
}

export async function myQr(req: Request) {
  const id = req.auth!.clientId;
  if (!id) throw badRequest('Only clients have a check-in code');
  const c = await prisma.client.findUnique({ where: { id }, select: { qrCode: true } });
  return { code: c?.qrCode ?? null };
}

export async function dayView(req: Request, dateStr: string) {
  const date = dateOnly(dateStr);
  const ids = await visibleClientIds(req);
  const clients = await prisma.client.findMany({
    where: { status: 'ACTIVE', ...(ids ? { id: { in: ids } } : {}) },
    select: { id: true, qrCode: true, user: { select: { firstName: true, lastName: true } }, attendance: { where: { date } } },
    orderBy: { user: { firstName: 'asc' } },
  });
  const rows = clients.map((c) => ({ clientId: c.id, name: `${c.user.firstName} ${c.user.lastName}`, qrCode: c.qrCode, record: c.attendance[0] ? dto(c.attendance[0]) : null }));
  const count = (s: AttendanceStatus) => rows.filter((r) => r.record?.status === s).length;
  return { date: dateStr, rows, totals: { present: count('PRESENT'), late: count('LATE'), leave: count('LEAVE'), absent: count('ABSENT'), unmarked: rows.filter((r) => !r.record).length } };
}

export async function history(req: Request, clientId: string, days = 90) {
  await assertCanAccessClient(req, clientId);
  const from = new Date(startOfDayUTC().getTime() - days * 86_400_000);
  const rows = await prisma.attendance.findMany({ where: { clientId, date: { gte: from } }, orderBy: { date: 'desc' } });
  const attended = rows.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
  return { items: rows.map(dto), summary: { days, attended, absent: rows.filter((r) => r.status === 'ABSENT').length, leave: rows.filter((r) => r.status === 'LEAVE').length } };
}
