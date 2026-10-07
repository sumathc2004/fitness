import type { Request } from 'express';
import { prisma } from '@gym/database';
import type { PaymentMethod, PaymentStatus } from '@gym/database';
import { daysFromNow, isoDate, startOfMonthUTC, todayUTC } from '../lib/dates';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors';
import type { Paginated } from '@gym/types';
import { dateOnly } from '../lib/pagination';
import { audit } from './audit.service';
import { notify } from './notification.service';

const num = (d: { toString(): string } | null | undefined) => (d == null ? 0 : Number(d.toString()));
const DAY = 86_400_000;

export interface PlanInput { name: string; description?: string | null; price: number; durationDays: number; features?: string[]; isActive?: boolean }

const planDto = (p: { id: string; name: string; description: string | null; price: { toString(): string }; currency: string; durationDays: number; features: unknown; isActive: boolean }) => ({
  id: p.id, name: p.name, description: p.description, price: num(p.price), currency: p.currency, durationDays: p.durationDays,
  features: Array.isArray(p.features) ? (p.features as string[]) : [], isActive: p.isActive,
});

export async function listPlans(includeInactive: boolean) {
  const rows = await prisma.membership.findMany({ where: includeInactive ? {} : { isActive: true }, orderBy: { price: 'asc' }, include: { _count: { select: { subscriptions: { where: { status: 'ACTIVE' } } } } } });
  return rows.map((p) => ({ ...planDto(p), activeMembers: p._count.subscriptions }));
}
export async function createPlan(req: Request, i: PlanInput) {
  const p = await prisma.membership.create({ data: { name: i.name, description: i.description ?? null, price: i.price, durationDays: i.durationDays, features: i.features ?? [], isActive: i.isActive ?? true } });
  await audit(req, { action: 'MEMBERSHIP_PLAN_CREATED', entityType: 'Membership', entityId: p.id, after: { name: p.name, price: i.price } });
  return planDto(p);
}
export async function updatePlan(req: Request, id: string, i: PlanInput) {
  if (!(await prisma.membership.count({ where: { id } }))) throw notFound('Plan not found');
  const p = await prisma.membership.update({ where: { id }, data: { name: i.name, description: i.description ?? null, price: i.price, durationDays: i.durationDays, features: i.features ?? [], isActive: i.isActive ?? true } });
  await audit(req, { action: 'MEMBERSHIP_PLAN_UPDATED', entityType: 'Membership', entityId: id, after: { name: p.name, price: i.price } });
  return planDto(p);
}

// ───────────────────────── Subscriptions
const subDto = (s: { id: string; clientId: string; status: string; startDate: Date; endDate: Date; autoRenew: boolean; membership: { id: string; name: string; price: { toString(): string } }; client?: { user: { firstName: string; lastName: string } } }) => ({
  id: s.id, clientId: s.clientId, clientName: s.client ? `${s.client.user.firstName} ${s.client.user.lastName}` : undefined, status: s.status,
  startDate: isoDate(s.startDate), endDate: isoDate(s.endDate), daysLeft: Math.ceil((s.endDate.getTime() - todayUTC().getTime()) / DAY),
  membership: { id: s.membership.id, name: s.membership.name, price: num(s.membership.price) }, autoRenew: s.autoRenew,
});

export async function assignMembership(req: Request, input: { clientId: string; membershipId: string; startDate?: string; amountPaid?: number; method?: PaymentMethod; notes?: string | null; markPaid?: boolean }) {
  const [client, plan] = await Promise.all([
    prisma.client.findUnique({ where: { id: input.clientId }, select: { id: true, userId: true } }),
    prisma.membership.findUnique({ where: { id: input.membershipId } }),
  ]);
  if (!client) throw notFound('Client not found');
  if (!plan || !plan.isActive) throw badRequest('That plan is not available');
  const start = input.startDate ? dateOnly(input.startDate) : todayUTC();
  const end = new Date(start.getTime() + plan.durationDays * DAY);
  const result = await prisma.$transaction(async (tx) => {
    await tx.subscription.updateMany({ where: { clientId: client.id, status: 'ACTIVE' }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    const sub = await tx.subscription.create({ data: { clientId: client.id, membershipId: plan.id, startDate: start, endDate: end, status: 'ACTIVE' }, include: { membership: true } });
    const paid = input.markPaid !== false;
    const count = await tx.payment.count();
    const pay = await tx.payment.create({
      data: {
        clientId: client.id, subscriptionId: sub.id, amount: input.amountPaid ?? plan.price, currency: plan.currency,
        status: paid ? 'PAID' : 'PENDING', method: input.method ?? 'CASH', paidAt: paid ? new Date() : null, dueDate: paid ? null : start,
        invoiceNo: `INV-${new Date().getUTCFullYear()}-${String(count + 1).padStart(5, '0')}`, notes: input.notes ?? null,
      },
    });
    await tx.client.update({ where: { id: client.id }, data: { status: 'ACTIVE' } });
    return { sub, pay };
  });
  await audit(req, { action: 'MEMBERSHIP_ASSIGNED', entityType: 'Subscription', entityId: result.sub.id, after: { clientId: client.id, plan: plan.name, endDate: isoDate(end) } });
  await notify({ userId: client.userId, type: 'SYSTEM', title: `Your ${plan.name} membership is active`, body: `Valid until ${isoDate(end)}.` });
  return { subscription: subDto(result.sub), paymentId: result.pay.id };
}

export async function listSubscriptions(filter: { status?: string; expiringInDays?: number }) {
  const rows = await prisma.subscription.findMany({
    where: {
      ...(filter.status ? { status: filter.status as 'ACTIVE' } : {}),
      ...(filter.expiringInDays != null ? { status: 'ACTIVE', endDate: { lte: daysFromNow(filter.expiringInDays) } } : {}),
    },
    orderBy: { endDate: 'asc' }, take: 300, include: { membership: true, client: { select: { user: { select: { firstName: true, lastName: true } } } } },
  });
  return rows.map(subDto);
}

export async function cancelSubscription(req: Request, id: string) {
  const s = await prisma.subscription.findUnique({ where: { id } });
  if (!s) throw notFound('Subscription not found');
  if (s.status === 'CANCELLED') throw conflict('Already cancelled');
  await prisma.subscription.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
  await audit(req, { action: 'SUBSCRIPTION_CANCELLED', entityType: 'Subscription', entityId: id });
}

export async function clientBilling(req: Request, clientId: string) {
  if (req.auth!.role === 'CLIENT' && req.auth!.clientId !== clientId) throw forbidden();
  const [subs, pays] = await Promise.all([
    prisma.subscription.findMany({ where: { clientId }, orderBy: { startDate: 'desc' }, include: { membership: true } }),
    prisma.payment.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);
  const current = subs.find((s) => s.status === 'ACTIVE' && s.endDate >= todayUTC()) ?? null;
  return { current: current ? subDto(current) : null, subscriptions: subs.map(subDto), payments: pays.map(paymentDto) };
}

// ───────────────────────── Payments
type PaymentRow = { id: string; clientId: string; subscriptionId: string | null; invoiceNo: string | null; amount: { toString(): string }; currency: string; status: PaymentStatus; method: PaymentMethod; dueDate: Date | null; paidAt: Date | null; notes: string | null; createdAt: Date; client?: { user: { firstName: string; lastName: string } } };
const paymentDto = (p: PaymentRow) => ({
  id: p.id, clientId: p.clientId, clientName: p.client ? `${p.client.user.firstName} ${p.client.user.lastName}` : undefined,
  invoiceNo: p.invoiceNo, amount: num(p.amount), currency: p.currency, status: p.status, method: p.method,
  dueDate: p.dueDate ? isoDate(p.dueDate) : null, paidAt: p.paidAt?.toISOString() ?? null, notes: p.notes, createdAt: p.createdAt.toISOString(),
});

export async function listPayments(q: { page: number; pageSize: number; status?: PaymentStatus; clientId?: string }): Promise<Paginated<ReturnType<typeof paymentDto>>> {
  const where = { ...(q.status ? { status: q.status } : {}), ...(q.clientId ? { clientId: q.clientId } : {}) };
  const [total, rows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { client: { select: { user: { select: { firstName: true, lastName: true } } } } } }),
  ]);
  return { items: rows.map(paymentDto), page: q.page, pageSize: q.pageSize, total };
}

export async function recordPayment(req: Request, input: { clientId: string; amount: number; method: PaymentMethod; status?: PaymentStatus; dueDate?: string | null; notes?: string | null }) {
  if (!(await prisma.client.count({ where: { id: input.clientId } }))) throw notFound('Client not found');
  const status = input.status ?? 'PAID';
  const count = await prisma.payment.count();
  const p = await prisma.payment.create({
    data: { clientId: input.clientId, amount: input.amount, method: input.method, status, paidAt: status === 'PAID' ? new Date() : null, dueDate: input.dueDate ? dateOnly(input.dueDate) : null, notes: input.notes ?? null, invoiceNo: `INV-${new Date().getUTCFullYear()}-${String(count + 1).padStart(5, '0')}` },
  });
  await audit(req, { action: 'PAYMENT_RECORDED', entityType: 'Payment', entityId: p.id, after: { amount: input.amount, status } });
  return paymentDto(p);
}

export async function setPaymentStatus(req: Request, id: string, status: PaymentStatus) {
  const p = await prisma.payment.findUnique({ where: { id } });
  if (!p) throw notFound('Payment not found');
  const updated = await prisma.payment.update({ where: { id }, data: { status, paidAt: status === 'PAID' ? (p.paidAt ?? new Date()) : p.paidAt } });
  await audit(req, { action: 'PAYMENT_STATUS_CHANGED', entityType: 'Payment', entityId: id, before: { status: p.status }, after: { status } });
  return paymentDto(updated);
}

export async function billingSummary() {
  const monthStart = startOfMonthUTC();
  const prev = startOfMonthUTC(-1);
  const [paidThis, paidPrev, pending, expiring, active] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'PAID', paidAt: { gte: monthStart } } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'PAID', paidAt: { gte: prev, lt: monthStart } } }),
    prisma.payment.aggregate({ _sum: { amount: true }, _count: true, where: { status: 'PENDING' } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', endDate: { gte: todayUTC(), lte: daysFromNow(14) } } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', endDate: { gte: todayUTC() } } }),
  ]);
  return { revenueThisMonth: num(paidThis._sum.amount), revenueLastMonth: num(paidPrev._sum.amount), pendingAmount: num(pending._sum.amount), pendingCount: pending._count, expiringIn14Days: expiring, activeMemberships: active };
}
