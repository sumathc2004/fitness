import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@gym/database';
import { assign, createUser, loggedInAgent, resetDb } from './helpers';

const today = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };
const ago = (n: number) => new Date(today().getTime() - n * 86_400_000);

let admin: Awaited<ReturnType<typeof createUser>>;
let trainer: Awaited<ReturnType<typeof createUser>>;
let strong: Awaited<ReturnType<typeof createUser>>;
let slipping: Awaited<ReturnType<typeof createUser>>;
let stranger: Awaited<ReturnType<typeof createUser>>;

beforeAll(async () => {
  await resetDb();
  admin = await createUser('SUPER_ADMIN');
  trainer = await createUser('TRAINER', { firstName: 'Tara', lastName: 'Coach' });
  strong = await createUser('CLIENT', { firstName: 'Sam', lastName: 'Strong', joinedDaysAgo: 60 });
  slipping = await createUser('CLIENT', { firstName: 'Kiran', lastName: 'Rao', joinedDaysAgo: 60 });
  stranger = await createUser('CLIENT', { firstName: 'Other', lastName: 'Trainer', joinedDaysAgo: 60 });
  const otherTrainer = await createUser('TRAINER');
  await assign(trainer.trainerId!, strong.clientId!);
  await assign(trainer.trainerId!, slipping.clientId!);
  await assign(otherTrainer.trainerId!, stranger.clientId!);

  // Strong client: 4 workouts planned in the last 2 weeks, all done, activity yesterday, 3 of 3 meals done.
  for (const off of [1, 4, 7, 10]) {
    await prisma.workout.create({ data: { name: 'Push', trainerId: trainer.trainerId!, clientId: strong.clientId!, scheduledDate: ago(off), status: 'COMPLETED' } });
  }
  await prisma.activityLog.create({ data: { clientId: strong.clientId!, type: 'WORKOUT_COMPLETED', createdAt: new Date(Date.now() - 20 * 3_600_000) } });
  const plan = await prisma.dietPlan.create({ data: { name: 'Plan', trainerId: trainer.trainerId!, clientId: strong.clientId!, status: 'ACTIVE', meals: { create: [{ mealType: 'BREAKFAST', name: 'Breakfast' }] } }, include: { meals: true } });
  for (const off of [1, 2, 3, 4]) await prisma.dietLog.create({ data: { clientId: strong.clientId!, dietMealId: plan.meals[0]!.id, date: ago(off), status: 'COMPLETED' } });

  // Slipping client: 4 planned, 0 done (all in the past), no activity for 10 days.
  for (const off of [2, 4, 6, 8]) {
    await prisma.workout.create({ data: { name: 'Pull', trainerId: trainer.trainerId!, clientId: slipping.clientId!, scheduledDate: ago(off), status: 'ASSIGNED' } });
  }
  await prisma.activityLog.create({ data: { clientId: slipping.clientId!, type: 'MEAL_LOGGED', createdAt: new Date(Date.now() - 10 * 86_400_000) } });

  // Today's workout for the strong client + nutrition for the client dashboard.
  const ex = await prisma.exercise.create({ data: { slug: 'squat-t', name: 'Squat', primaryMuscles: ['Quads'], instructions: ['x'] } });
  await prisma.workout.create({
    data: { name: 'Leg Day', trainerId: trainer.trainerId!, clientId: strong.clientId!, scheduledDate: today(), status: 'ASSIGNED', exercises: { create: [{ exerciseId: ex.id, sets: 4, reps: '8', restSec: 90, order: 0 }] } },
  });
  await prisma.nutritionTarget.create({ data: { clientId: strong.clientId!, calories: 2500, proteinG: 150, carbsG: 290, fatG: 75, fiberG: 35, waterMl: 3000 } });
  await prisma.mealLog.create({ data: { clientId: strong.clientId!, date: today(), mealType: 'LUNCH', items: { create: [{ customName: 'Rice & chicken', calories: 700, proteinG: 45, carbsG: 80, fatG: 12, fiberG: 4 }] } } });
  await prisma.waterLog.create({ data: { clientId: strong.clientId!, date: today(), amountMl: 1200 } });
  await prisma.bodyMeasurement.createMany({ data: [{ clientId: strong.clientId!, weightKg: 80, measuredAt: ago(20) }, { clientId: strong.clientId!, weightKg: 78.5, measuredAt: ago(2) }] });
  await prisma.payment.create({ data: { clientId: strong.clientId!, amount: 3999, status: 'PAID', paidAt: new Date() } });
});

describe('admin dashboard', () => {
  it('summarises the gym from real data', async () => {
    const res = await (await loggedInAgent(admin.email)).get('/api/admin/dashboard');
    expect(res.status).toBe(200);
    const d = res.body;
    expect(d.totals).toMatchObject({ clients: 3, activeClients: 3, trainers: 2 });
    expect(d.revenue.thisMonth).toBe(3999);
    expect(d.growth.clients).toHaveLength(6);
    expect(d.growth.revenue.at(-1).value).toBe(3999);
    // 4 of 8 planned workouts in the last 30 days were completed; diet has 4/4
    // planned in the last 30 days: Sam 4 done + today's assigned workout, Kiran 4 assigned → 4 of 9 completed
    expect(d.rates.workoutCompletion).toBeCloseTo(4 / 9, 2);
    expect(d.rates.dietCompliance).toBe(1);
  });

  it('flags the slipping client as needing attention with readable reasons', async () => {
    const res = await (await loggedInAgent(admin.email)).get('/api/admin/dashboard');
    const kiran = res.body.attention.find((a: { name: string }) => a.name === 'Kiran Rao');
    expect(kiran.level).toBe('ATTENTION');
    expect(kiran.reasons.join(' | ')).toMatch(/missed workouts/);
    expect(kiran.reasons.join(' | ')).toMatch(/No activity for 10 days/);
    expect(res.body.attention.some((a: { name: string }) => a.name === 'Sam Strong')).toBe(false);
  });

  it('reports trainer performance', async () => {
    const res = await (await loggedInAgent(admin.email)).get('/api/admin/dashboard');
    const tara = res.body.trainerPerformance.find((t: { name: string }) => t.name === 'Tara Coach');
    expect(tara).toMatchObject({ clients: 2, needAttention: 1 });
  });
});

describe('trainer dashboard is scoped to the trainer’s own clients', () => {
  it('shows only assigned clients, today’s schedule and attention', async () => {
    const res = await (await loggedInAgent(trainer.email)).get('/api/trainers/dashboard');
    expect(res.status).toBe(200);
    const d = res.body;
    expect(d.totals).toMatchObject({ assignedClients: 2, activeClients: 2, needAttention: 1, workoutsToday: 1 });
    expect(d.todaysSchedule[0]).toMatchObject({ name: 'Leg Day', clientName: 'Sam Strong', exerciseCount: 1 });
    const names = [...d.attention.map((a: { name: string }) => a.name), ...d.clientProgress.map((c: { name: string }) => c.name)];
    expect(names).not.toContain('Other Trainer');
    const sam = d.clientProgress.find((c: { name: string }) => c.name === 'Sam Strong');
    expect(sam.weightChangeKg).toBe(-1.5);
  });
});

describe('client dashboard', () => {
  it('returns the client’s own plan, nutrition and habits', async () => {
    const res = await (await loggedInAgent(strong.email)).get('/api/clients/dashboard');
    expect(res.status).toBe(200);
    const d = res.body;
    expect(d.greetingName).toBe('Sam');
    expect(d.todaysWorkout).toMatchObject({ name: 'Leg Day' });
    expect(d.todaysWorkout.exercises[0]).toMatchObject({ name: 'Squat', sets: 4, reps: '8', restSec: 90 });
    expect(d.nutrition.target).toMatchObject({ calories: 2500, proteinG: 150 });
    expect(d.nutrition.consumed).toMatchObject({ calories: 700, proteinG: 45 });
    expect(d.habits.waterMl).toBe(1200);
    expect(d.weightSeries.map((w: { weightKg: number }) => w.weightKg)).toEqual([80, 78.5]);
    expect(d.streakDays).toBeGreaterThanOrEqual(1);
  });

  it('shows honest empty states instead of invented numbers', async () => {
    const res = await (await loggedInAgent(stranger.email)).get('/api/clients/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.todaysWorkout).toBeNull();
    expect(res.body.nutrition.target).toBeNull();
    expect(res.body.nutrition.consumed.calories).toBe(0);
    expect(res.body.habits.sleepHours).toBeNull();
    expect(res.body.weightSeries).toEqual([]);
  });
});
