import type { Request } from 'express';
import PDFDocument from 'pdfkit';
import { prisma } from '@gym/database';
import { estimate1RM } from '@gym/config';
import { isoDate, ratio } from '../lib/dates';
import { badRequest } from '../lib/errors';
import { assertCanAccessClient } from './access.service';

const r1 = (n: number) => Math.round(n * 10) / 10;
const pct = (r: number | null) => (r == null ? null : Math.round(r * 100));

export async function monthlyReport(req: Request, clientId: string, month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw badRequest('Month must look like 2026-09');
  await assertCanAccessClient(req, clientId);
  const from = new Date(`${month}-01T00:00:00.000Z`);
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  const rangeDate = { gte: from, lt: to };

  const [client, measurements, assessments, workouts, sessions, diet, attendance, water, sleep, sets, review] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, select: { user: { select: { firstName: true, lastName: true } }, bodyProfile: { select: { goal: true } } } }),
    prisma.bodyMeasurement.findMany({ where: { clientId, measuredAt: rangeDate }, orderBy: { measuredAt: 'asc' } }),
    prisma.bodyCompositionAssessment.findMany({ where: { clientId, assessedAt: rangeDate }, orderBy: { assessedAt: 'asc' } }),
    prisma.workout.findMany({ where: { clientId, isTemplate: false, status: { not: 'DRAFT' }, scheduledDate: rangeDate }, select: { status: true } }),
    prisma.workoutSession.count({ where: { clientId, status: 'COMPLETED', startedAt: rangeDate } }),
    prisma.dietLog.findMany({ where: { clientId, date: rangeDate }, select: { status: true } }),
    prisma.attendance.findMany({ where: { clientId, date: rangeDate }, select: { status: true } }),
    prisma.waterLog.findMany({ where: { clientId, date: rangeDate }, select: { date: true, amountMl: true } }),
    prisma.sleepLog.findMany({ where: { clientId, date: rangeDate }, select: { hours: true } }),
    prisma.workoutSet.findMany({
      where: { session: { clientId, startedAt: rangeDate }, skipped: false, reps: { gt: 0 }, weightKg: { gt: 0 } },
      select: { reps: true, weightKg: true, workoutExercise: { select: { customName: true, exercise: { select: { name: true } } } } },
    }),
    prisma.progressRecord.findUnique({ where: { clientId_period_periodStart: { clientId, period: 'MONTHLY', periodStart: from } } }),
  ]);
  if (!client) throw badRequest('Client not found');

  const weights = measurements.filter((m) => m.weightKg != null);
  const waists = measurements.filter((m) => m.waistCm != null);
  const bf = assessments.filter((a) => a.bodyFatPct != null);
  const lean = assessments.filter((a) => a.leanMassKg != null);
  const best = new Map<string, number>();
  for (const s of sets) {
    const n = s.workoutExercise.exercise?.name ?? s.workoutExercise.customName ?? 'Exercise';
    best.set(n, Math.max(best.get(n) ?? 0, estimate1RM(s.weightKg!, s.reps!)));
  }
  const waterDays = new Set(water.map((w) => isoDate(w.date))).size;

  const data = {
    month, clientId, clientName: `${client.user.firstName} ${client.user.lastName}`, goal: client.bodyProfile?.goal ?? null,
    body: {
      startWeightKg: weights[0]?.weightKg ?? null, endWeightKg: weights.at(-1)?.weightKg ?? null,
      weightChangeKg: weights.length > 1 ? r1(weights.at(-1)!.weightKg! - weights[0]!.weightKg!) : null,
      waistChangeCm: waists.length > 1 ? r1(waists.at(-1)!.waistCm! - waists[0]!.waistCm!) : null,
      estimatedBodyFatChangePct: bf.length > 1 ? r1(bf.at(-1)!.bodyFatPct! - bf[0]!.bodyFatPct!) : null,
      leanMassChangeKg: lean.length > 1 ? r1(lean.at(-1)!.leanMassKg! - lean[0]!.leanMassKg!) : null,
    },
    training: { planned: workouts.length, completed: workouts.filter((w) => w.status === 'COMPLETED').length, sessions, compliancePct: pct(ratio(workouts.filter((w) => w.status === 'COMPLETED').length, workouts.length)) },
    nutrition: { mealsPlanned: diet.length, mealsCompleted: diet.filter((d) => d.status === 'COMPLETED').length, compliancePct: pct(ratio(diet.filter((d) => d.status === 'COMPLETED').length, diet.length)) },
    attendance: { present: attendance.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length, absent: attendance.filter((a) => a.status === 'ABSENT').length, leave: attendance.filter((a) => a.status === 'LEAVE').length },
    habits: { avgWaterMl: waterDays ? Math.round(water.reduce((t, w) => t + w.amountMl, 0) / waterDays) : null, avgSleepHours: sleep.length ? r1(sleep.reduce((t, s) => t + s.hours, 0) / sleep.length) : null },
    strength: [...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([exercise, e1rm]) => ({ exercise, estimatedOneRepMaxKg: r1(e1rm) })),
    trainerComment: review?.trainerComment ?? null,
    reviewedAt: review?.reviewedAt?.toISOString() ?? null,
  };

  // Cache the numbers on the monthly ProgressRecord without touching the trainer's comment.
  await prisma.progressRecord.upsert({
    where: { clientId_period_periodStart: { clientId, period: 'MONTHLY', periodStart: from } },
    update: { weightChangeKg: data.body.weightChangeKg, bodyFatChangePct: data.body.estimatedBodyFatChangePct, leanMassChangeKg: data.body.leanMassChangeKg, waistChangeCm: data.body.waistChangeCm, workoutCompliance: data.training.compliancePct, dietCompliance: data.nutrition.compliancePct },
    create: { clientId, period: 'MONTHLY', periodStart: from, periodEnd: new Date(to.getTime() - 86_400_000), weightChangeKg: data.body.weightChangeKg, bodyFatChangePct: data.body.estimatedBodyFatChangePct, leanMassChangeKg: data.body.leanMassChangeKg, waistChangeCm: data.body.waistChangeCm, workoutCompliance: data.training.compliancePct, dietCompliance: data.nutrition.compliancePct },
  });
  return data;
}

type Report = Awaited<ReturnType<typeof monthlyReport>>;

export function reportPdf(r: Report): InstanceType<typeof PDFDocument> {
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Monthly report ${r.month} – ${r.clientName}` } });
  const lime = '#65a30d';
  const row = (label: string, value: string | number | null, suffix = '') => {
    doc.font('Helvetica').fontSize(11).fillColor('#444').text(label, { continued: true, width: 300 });
    doc.font('Helvetica-Bold').fillColor('#111').text(`  ${value == null ? 'No data' : `${value}${suffix}`}`);
  };
  const h = (t: string) => { doc.moveDown(0.9).font('Helvetica-Bold').fontSize(13).fillColor(lime).text(t.toUpperCase(), { characterSpacing: 1 }); doc.moveDown(0.3); };

  doc.font('Helvetica-Bold').fontSize(22).fillColor('#111').text('Monthly progress report');
  doc.font('Helvetica').fontSize(12).fillColor('#555').text(`${r.clientName} · ${r.month}${r.goal ? ` · Goal: ${r.goal.replace('_', ' ').toLowerCase()}` : ''}`);
  h('Body');
  row('Weight change', r.body.weightChangeKg, ' kg');
  row('Waist change', r.body.waistChangeCm, ' cm');
  row('Estimated body-fat change', r.body.estimatedBodyFatChangePct, ' %-pts');
  row('Estimated lean-mass change', r.body.leanMassChangeKg, ' kg');
  h('Training');
  row('Workouts completed', `${r.training.completed} of ${r.training.planned}`);
  row('Compliance', r.training.compliancePct, '%');
  h('Nutrition');
  row('Meals completed', `${r.nutrition.mealsCompleted} of ${r.nutrition.mealsPlanned}`);
  row('Compliance', r.nutrition.compliancePct, '%');
  h('Attendance & habits');
  row('Days attended', r.attendance.present);
  row('Average water', r.habits.avgWaterMl, ' ml');
  row('Average sleep', r.habits.avgSleepHours, ' h');
  if (r.strength.length) {
    h('Strength (estimated 1-rep max)');
    r.strength.forEach((s) => row(s.exercise, s.estimatedOneRepMaxKg, ' kg'));
  }
  h('Trainer comment');
  doc.font('Helvetica').fontSize(11).fillColor('#222').text(r.trainerComment ?? 'No comment yet.');
  doc.moveDown(2).fontSize(8).fillColor('#888').text('Body-fat and lean-mass figures are estimates, not a medical diagnosis. Speak to a qualified professional about health concerns.');
  return doc;
}
