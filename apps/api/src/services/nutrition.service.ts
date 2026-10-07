import type { Request } from 'express';
import { DEFAULT_NUTRITION_SETTINGS, assess, calculateTargets, estimate1RM, recommendGoal, weightTrend, type Goal, type NutritionSettings } from '@gym/config';
import { Prisma, prisma } from '@gym/database';
import type { AssessmentDto, AssessmentInputDto, CalculateInput, CalculationDto, RecommendationDto, SaveTargetInput, TargetDto } from '@gym/types';
import { nutritionSettingsSchema } from '@gym/types';
import { AppError, badRequest, forbidden, notFound } from '../lib/errors';
import { daysAgo } from '../lib/dates';
import { assertCanAccessClient } from './access.service';
import { audit, logActivity } from './audit.service';
import { clientUserIdOf, notify, trainerUserIdsOf } from './notification.service';

// ───────────────────────────────────────────────────────── settings (admin-configurable)
export async function getNutritionSettings(): Promise<NutritionSettings> {
  const row = await prisma.gymSetting.findUnique({ where: { key: 'nutrition' } });
  const parsed = row ? nutritionSettingsSchema.safeParse(row.value) : null;
  return parsed?.success ? (parsed.data as NutritionSettings) : DEFAULT_NUTRITION_SETTINGS;
}

export async function saveNutritionSettings(req: Request, input: NutritionSettings): Promise<NutritionSettings> {
  const before = await getNutritionSettings();
  await prisma.gymSetting.upsert({ where: { key: 'nutrition' }, update: { value: input as unknown as Prisma.InputJsonValue, updatedById: req.auth!.userId }, create: { key: 'nutrition', value: input as unknown as Prisma.InputJsonValue, updatedById: req.auth!.userId } });
  await audit(req, { action: 'NUTRITION_SETTINGS_UPDATED', entityType: 'GymSetting', entityId: 'nutrition', before: before as unknown as Prisma.InputJsonValue, after: input as unknown as Prisma.InputJsonValue });
  return input;
}

// ───────────────────────────────────────────────────────── client context
const ageOf = (dob: Date | null) => (dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 86_400_000)) : null);

/** Resolves which client the request is about and checks access. Clients can only ever mean themselves. */
export function resolveClientId(req: Request, requested?: string | null): string {
  if (req.auth!.role === 'CLIENT') {
    if (!req.auth!.clientId) throw forbidden();
    if (requested && requested !== req.auth!.clientId) throw forbidden();
    return req.auth!.clientId;
  }
  if (!requested) throw badRequest('Choose a client', { clientId: ['Required'] });
  return requested;
}

async function context(req: Request, clientId: string) {
  await assertCanAccessClient(req, clientId);
  const c = await prisma.client.findUnique({
    where: { id: clientId },
    select: { dateOfBirth: true, bodyProfile: true, measurements: { orderBy: { measuredAt: 'desc' }, take: 40, select: { measuredAt: true, weightKg: true, waistCm: true, neckCm: true, hipCm: true } } },
  });
  if (!c) throw notFound('Client not found');
  const first = <K extends 'weightKg' | 'waistCm' | 'neckCm' | 'hipCm'>(k: K) => c.measurements.find((m) => m[k] != null)?.[k] ?? null;
  return { profile: c.bodyProfile, dob: c.dateOfBirth, measurements: c.measurements, latest: { weightKg: first('weightKg'), waistCm: first('waistCm'), neckCm: first('neckCm'), hipCm: first('hipCm') } };
}

// ───────────────────────────────────────────────────────── body analysis
export async function getProfile(req: Request, clientId: string) {
  await assertCanAccessClient(req, clientId);
  return prisma.bodyProfile.findUnique({ where: { clientId } });
}

export async function saveProfile(req: Request, clientId: string, p: { sex: 'MALE' | 'FEMALE' | 'OTHER'; heightCm: number; activityLevel: string; trainingExperience: string; goal: Goal; injuries?: string }) {
  await assertCanAccessClient(req, clientId);
  const data = { sex: p.sex, heightCm: p.heightCm, activityLevel: p.activityLevel as never, trainingExperience: p.trainingExperience as never, goal: p.goal, injuries: p.injuries ?? null };
  const out = await prisma.bodyProfile.upsert({ where: { clientId }, update: data, create: { clientId, ...data } });
  await audit(req, { action: 'BODY_PROFILE_UPDATED', entityType: 'Client', entityId: clientId });
  return out;
}

const toAssessmentDto = (r: ReturnType<typeof assess>, i: { id: string | null; at: Date; weightKg: number; heightCm: number; ageYears: number; sex: string; activity: string; waistCm: number | null; neckCm: number | null; hipCm: number | null }): AssessmentDto => ({
  id: i.id, assessedAt: i.at.toISOString(), weightKg: i.weightKg, heightCm: i.heightCm, ageYears: i.ageYears, sex: i.sex, activityLevel: i.activity,
  bmi: r.bmi, bmiCategory: r.bmiCategory, bodyFatPct: r.bodyFatPct, fatMassKg: r.fatMassKg, leanMassKg: r.leanMassKg, bmr: r.bmr, maintenanceKcal: r.maintenanceKcal,
  isEstimate: true, method: r.method, notes: r.notes, waistCm: i.waistCm, neckCm: i.neckCm, hipCm: i.hipCm,
});

interface Overrides { weightKg?: number | null; heightCm?: number | null; ageYears?: number | null; sex?: 'MALE' | 'FEMALE' | 'OTHER'; activityLevel?: 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE'; waistCm?: number | null; neckCm?: number | null; hipCm?: number | null }

async function buildInputs(req: Request, clientId: string, o: Overrides) {
  const ctx = await context(req, clientId);
  const weightKg = o.weightKg ?? ctx.latest.weightKg;
  const heightCm = o.heightCm ?? ctx.profile?.heightCm;
  const ageYears = o.ageYears ?? ageOf(ctx.dob);
  const sex = o.sex ?? ctx.profile?.sex;
  const activityLevel = o.activityLevel ?? ctx.profile?.activityLevel ?? 'MODERATE';
  const missing: Record<string, string[]> = {};
  if (!weightKg) missing.weightKg = ['Weight is required'];
  if (!heightCm) missing.heightCm = ['Height is required'];
  if (!ageYears) missing.ageYears = ['Add date of birth to the profile, or enter an age'];
  if (!sex) missing.sex = ['Sex is required'];
  if (Object.keys(missing).length) throw badRequest('Some details are missing for this calculation', missing);
  return {
    ctx, weightKg: weightKg!, heightCm: heightCm!, ageYears: ageYears!, sex: sex!, activityLevel,
    waistCm: o.waistCm ?? ctx.latest.waistCm, neckCm: o.neckCm ?? ctx.latest.neckCm, hipCm: o.hipCm ?? ctx.latest.hipCm,
  };
}

export async function runAssessment(req: Request, input: AssessmentInputDto): Promise<AssessmentDto> {
  const clientId = resolveClientId(req, input.clientId);
  const x = await buildInputs(req, clientId, input);
  const settings = await getNutritionSettings();
  const result = assess({ sex: x.sex, ageYears: x.ageYears, heightCm: x.heightCm, weightKg: x.weightKg, waistCm: x.waistCm, neckCm: x.neckCm, hipCm: x.hipCm, activityLevel: x.activityLevel }, settings);
  const now = new Date();
  let measurementId: string | null = null;
  if (input.saveMeasurement) {
    const m = await prisma.bodyMeasurement.create({ data: { clientId, weightKg: x.weightKg, waistCm: x.waistCm, neckCm: x.neckCm, hipCm: x.hipCm, recordedBy: req.auth!.userId, measuredAt: now } });
    measurementId = m.id;
  }
  const row = await prisma.bodyCompositionAssessment.create({
    data: {
      clientId, measurementId, assessedAt: now, method: result.method ?? 'BMI_ONLY', isEstimate: true, createdById: req.auth!.userId,
      inputs: { sex: x.sex, ageYears: x.ageYears, heightCm: x.heightCm, weightKg: x.weightKg, waistCm: x.waistCm, neckCm: x.neckCm, hipCm: x.hipCm, activityLevel: x.activityLevel },
      bmi: result.bmi, bodyFatPct: result.bodyFatPct, fatMassKg: result.fatMassKg, leanMassKg: result.leanMassKg, bmr: result.bmr, maintenanceKcal: result.maintenanceKcal,
    },
  });
  await logActivity({ actorUserId: req.auth!.userId, clientId, type: 'ASSESSMENT_CREATED', entityType: 'BodyCompositionAssessment', entityId: row.id });
  if (input.saveMeasurement) await logActivity({ actorUserId: req.auth!.userId, clientId, type: 'WEIGHT_UPDATED', entityType: 'BodyMeasurement', entityId: measurementId ?? undefined });
  return toAssessmentDto(result, { id: row.id, at: now, weightKg: x.weightKg, heightCm: x.heightCm, ageYears: x.ageYears, sex: x.sex, activity: x.activityLevel, waistCm: x.waistCm, neckCm: x.neckCm, hipCm: x.hipCm });
}

export async function listAssessments(req: Request, clientId: string): Promise<AssessmentDto[]> {
  await assertCanAccessClient(req, clientId);
  const rows = await prisma.bodyCompositionAssessment.findMany({ where: { clientId }, orderBy: { assessedAt: 'desc' }, take: 60 });
  return rows.map((r) => {
    const i = r.inputs as Record<string, number | string | null>;
    return {
      id: r.id, assessedAt: r.assessedAt.toISOString(), weightKg: Number(i.weightKg), heightCm: Number(i.heightCm), ageYears: Number(i.ageYears), sex: String(i.sex), activityLevel: String(i.activityLevel),
      bmi: r.bmi ?? 0, bmiCategory: '', bodyFatPct: r.bodyFatPct, fatMassKg: r.fatMassKg, leanMassKg: r.leanMassKg, bmr: r.bmr ?? 0, maintenanceKcal: r.maintenanceKcal ?? 0,
      isEstimate: true as const, method: r.bodyFatPct == null ? null : ('US_NAVY' as const), notes: [], waistCm: (i.waistCm as number | null) ?? null, neckCm: (i.neckCm as number | null) ?? null, hipCm: (i.hipCm as number | null) ?? null,
    };
  });
}

// ───────────────────────────────────────────────────────── calculator
export async function calculate(req: Request, input: CalculateInput): Promise<CalculationDto & { settings: NutritionSettings }> {
  const clientId = resolveClientId(req, input.clientId);
  const x = await buildInputs(req, clientId, input);
  const settings = await getNutritionSettings();
  const goal: Goal = input.goal ?? x.ctx.profile?.goal ?? 'RECOMPOSITION';
  const result = assess({ sex: x.sex, ageYears: x.ageYears, heightCm: x.heightCm, weightKg: x.weightKg, waistCm: x.waistCm, neckCm: x.neckCm, hipCm: x.hipCm, activityLevel: x.activityLevel }, settings);
  const t = calculateTargets({ weightKg: x.weightKg, maintenanceKcal: result.maintenanceKcal, bmr: result.bmr, goal, sex: x.sex }, settings, input.overrides);
  return {
    goal, settings,
    assessment: toAssessmentDto(result, { id: null, at: new Date(), weightKg: x.weightKg, heightCm: x.heightCm, ageYears: x.ageYears, sex: x.sex, activity: x.activityLevel, waistCm: x.waistCm, neckCm: x.neckCm, hipCm: x.hipCm }),
    targets: { calories: t.calories, proteinG: t.proteinG, carbsG: t.carbsG, fatG: t.fatG, fiberG: t.fiberG, waterMl: t.waterMl, applied: t.applied, warnings: t.warnings },
  };
}

const toTargetDto = (t: Prisma.NutritionTargetGetPayload<object>): TargetDto => ({ id: t.id, calories: t.calories, proteinG: t.proteinG, carbsG: t.carbsG, fatG: t.fatG, fiberG: t.fiberG, waterMl: t.waterMl, source: t.source, isActive: t.isActive, effectiveFrom: t.effectiveFrom.toISOString() });

export async function saveTarget(req: Request, input: SaveTargetInput): Promise<TargetDto> {
  await assertCanAccessClient(req, input.clientId);
  const created = await prisma.$transaction(async (tx) => {
    await tx.nutritionTarget.updateMany({ where: { clientId: input.clientId, isActive: true }, data: { isActive: false } });
    return tx.nutritionTarget.create({
      data: { clientId: input.clientId, trainerId: req.auth!.trainerId, calories: input.calories, proteinG: input.proteinG, carbsG: input.carbsG, fatG: input.fatG, fiberG: input.fiberG, waterMl: input.waterMl, source: input.source, rationale: (input.rationale ?? undefined) as Prisma.InputJsonValue | undefined },
    });
  });
  await audit(req, { action: 'NUTRITION_TARGET_SAVED', entityType: 'Client', entityId: input.clientId, after: { calories: input.calories, proteinG: input.proteinG, source: input.source } });
  const uid = await clientUserIdOf(input.clientId);
  if (uid) await notify({ userId: uid, type: 'DIET_ASSIGNED', title: 'Your nutrition targets were updated', body: `${input.calories} kcal · ${input.proteinG} g protein`, data: { clientId: input.clientId } });
  return toTargetDto(created);
}

export async function getTargets(req: Request, clientId: string) {
  await assertCanAccessClient(req, clientId);
  const rows = await prisma.nutritionTarget.findMany({ where: { clientId }, orderBy: { effectiveFrom: 'desc' }, take: 20 });
  const items = rows.map(toTargetDto);
  return { active: items.find((t) => t.isActive) ?? null, history: items };
}

// ───────────────────────────────────────────────────────── recommendation
async function strengthTrendPct(clientId: string): Promise<number | null> {
  const from = daysAgo(56), mid = daysAgo(28);
  const sets = await prisma.workoutSet.findMany({
    where: { skipped: false, weightKg: { gt: 0 }, reps: { gt: 0 }, completedAt: { gte: from }, session: { clientId }, workoutExercise: { exerciseId: { not: null } } },
    select: { weightKg: true, reps: true, completedAt: true, workoutExercise: { select: { exerciseId: true } } },
  });
  const best = new Map<string, { recent: number; prior: number }>();
  for (const s of sets) {
    const id = s.workoutExercise.exerciseId!;
    const e = estimate1RM(s.weightKg!, s.reps!);
    const cur = best.get(id) ?? { recent: 0, prior: 0 };
    if (s.completedAt! >= mid) cur.recent = Math.max(cur.recent, e); else cur.prior = Math.max(cur.prior, e);
    best.set(id, cur);
  }
  const changes = [...best.values()].filter((b) => b.recent > 0 && b.prior > 0).map((b) => ((b.recent - b.prior) / b.prior) * 100);
  return changes.length >= 1 ? Math.round((changes.reduce((a, b) => a + b, 0) / changes.length) * 10) / 10 : null;
}

const toRecDto = (r: { id: string; recommendedGoal: Goal; reasons: Prisma.JsonValue; inputs: Prisma.JsonValue; status: 'PENDING' | 'ACCEPTED' | 'TRAINER_REVIEW' | 'DISMISSED'; createdAt: Date }, currentGoal: Goal | null): RecommendationDto => {
  const meta = (r.inputs ?? {}) as { confidence?: 'LOW' | 'MEDIUM' | 'HIGH'; disclaimer?: string };
  return { id: r.id, needsData: false, goal: r.recommendedGoal, currentGoal, confidence: meta.confidence ?? 'MEDIUM', reasons: (r.reasons as string[]) ?? [], disclaimer: meta.disclaimer ?? '', status: r.status, createdAt: r.createdAt.toISOString() };
};

export async function createRecommendation(req: Request, clientId: string): Promise<RecommendationDto> {
  const ctx = await context(req, clientId);
  const last = await prisma.bodyCompositionAssessment.findFirst({ where: { clientId }, orderBy: { assessedAt: 'desc' } });
  const weight = ctx.latest.weightKg ?? (last?.inputs as { weightKg?: number } | null)?.weightKg ?? null;
  const height = ctx.profile?.heightCm ?? null;
  const points = ctx.measurements.filter((m) => m.weightKg != null && m.measuredAt >= daysAgo(35)).map((m) => ({ date: m.measuredAt, weightKg: m.weightKg! }));
  const rec = recommendGoal({
    sex: ctx.profile?.sex ?? 'MALE', experience: ctx.profile?.trainingExperience ?? 'BEGINNER', currentGoal: ctx.profile?.goal ?? null,
    bmi: weight && height ? Math.round((weight / (height / 100) ** 2) * 10) / 10 : last?.bmi ?? null, bodyFatPct: last?.bodyFatPct ?? null,
    weightTrendKgPerWeek: weightTrend(points), strengthTrendPct: await strengthTrendPct(clientId), weightKg: weight,
  });
  if (rec.needsData || !rec.goal) return { id: null, needsData: true, goal: null, currentGoal: ctx.profile?.goal ?? null, confidence: 'LOW', reasons: rec.reasons, disclaimer: rec.disclaimer, status: null, createdAt: null };
  const row = await prisma.nutritionRecommendation.create({
    data: { clientId, recommendedGoal: rec.goal, reasons: rec.reasons, inputs: { confidence: rec.confidence, disclaimer: rec.disclaimer, bodyFatPct: last?.bodyFatPct ?? null, weight } },
  });
  return toRecDto(row, ctx.profile?.goal ?? null);
}

export async function latestRecommendation(req: Request, clientId: string): Promise<RecommendationDto | null> {
  await assertCanAccessClient(req, clientId);
  const [row, profile] = await Promise.all([
    prisma.nutritionRecommendation.findFirst({ where: { clientId }, orderBy: { createdAt: 'desc' } }),
    prisma.bodyProfile.findUnique({ where: { clientId }, select: { goal: true } }),
  ]);
  return row ? toRecDto(row, profile?.goal ?? null) : null;
}

export async function decideRecommendation(req: Request, id: string, decision: 'ACCEPT' | 'TRAINER_REVIEW' | 'DISMISS'): Promise<RecommendationDto> {
  const rec = await prisma.nutritionRecommendation.findUnique({ where: { id } });
  if (!rec) throw notFound('Recommendation not found');
  await assertCanAccessClient(req, rec.clientId);
  if (rec.status !== 'PENDING' && rec.status !== 'TRAINER_REVIEW') throw new AppError(409, 'ALREADY_DECIDED', 'This recommendation was already answered');
  const status = decision === 'ACCEPT' ? 'ACCEPTED' : decision === 'DISMISS' ? 'DISMISSED' : 'TRAINER_REVIEW';
  const updated = await prisma.nutritionRecommendation.update({ where: { id }, data: { status, decidedById: req.auth!.userId, decidedAt: new Date() } });
  if (decision === 'ACCEPT') await prisma.bodyProfile.update({ where: { clientId: rec.clientId }, data: { goal: rec.recommendedGoal } }).catch(() => undefined);
  const byClient = req.auth!.role === 'CLIENT';
  const label = rec.recommendedGoal.replace('_', ' ').toLowerCase();
  if (byClient) {
    for (const uid of await trainerUserIdsOf(rec.clientId)) {
      await notify({ userId: uid, type: 'PROGRESS_REVIEW', title: decision === 'TRAINER_REVIEW' ? 'A client asked you to review their goal' : 'A client accepted a goal recommendation', body: `Recommended direction: ${label}`, data: { clientId: rec.clientId } });
    }
  } else if (decision === 'ACCEPT') {
    const uid = await clientUserIdOf(rec.clientId);
    if (uid) await notify({ userId: uid, type: 'PROGRESS_REVIEW', title: 'Your goal was updated', body: `New direction: ${label}`, data: { clientId: rec.clientId } });
  }
  await audit(req, { action: `RECOMMENDATION_${status}`, entityType: 'NutritionRecommendation', entityId: id });
  const profile = await prisma.bodyProfile.findUnique({ where: { clientId: rec.clientId }, select: { goal: true } });
  return toRecDto(updated, profile?.goal ?? null);
}
