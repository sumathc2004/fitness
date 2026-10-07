import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@gym/database';
import { assign, createUser, loggedInAgent, resetDb } from './helpers';

type U = Awaited<ReturnType<typeof createUser>>;
type A = Awaited<ReturnType<typeof loggedInAgent>>;
let admin: U, trainer: U, other: U, client: U, stranger: U;
let adminA: A, trainerA: A, otherA: A, clientA: A, strangerA: A;
const today = () => new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  await resetDb();
  admin = await createUser('SUPER_ADMIN');
  trainer = await createUser('TRAINER');
  other = await createUser('TRAINER');
  client = await createUser('CLIENT', { firstName: 'Nia', lastName: 'Nutri' });
  stranger = await createUser('CLIENT');
  await assign(trainer.trainerId!, client.clientId!);
  await assign(other.trainerId!, stranger.clientId!);
  adminA = await loggedInAgent(admin.email);
  trainerA = await loggedInAgent(trainer.email);
  otherA = await loggedInAgent(other.email);
  clientA = await loggedInAgent(client.email);
  strangerA = await loggedInAgent(stranger.email);
});

const food = (name: string, cal: number, p: number, c: number, f: number) => ({ name, category: 'Test', servings: [{ label: '100 g', grams: 100, calories: cal, proteinG: p, carbsG: c, fatG: f, fiberG: 2, isDefault: true }] });

describe('food database', () => {
  let rice: { id: string; servings: Array<{ id: string }> };
  it('staff add foods; clients can search but not add; trainers edit only their own', async () => {
    const res = await trainerA.post('/api/foods').send(food('Test rice', 130, 2.7, 28, 0.3));
    expect(res.status).toBe(201);
    rice = res.body;
    expect(res.body.isCustom).toBe(true);
    expect((await clientA.post('/api/foods').send(food('x', 1, 1, 1, 1))).status).toBe(403);
    expect((await clientA.get('/api/foods?q=rice')).body.items.map((f: { name: string }) => f.name)).toContain('Test rice');
    expect((await otherA.put(`/api/foods/${rice.id}`).send(food('Hacked', 1, 1, 1, 1))).status).toBe(403);
    expect((await adminA.put(`/api/foods/${rice.id}`).send(food('Test rice (admin)', 130, 2.7, 28, 0.3))).status).toBe(200);
    expect((await trainerA.post('/api/foods').send({ name: 'Bad', servings: [] })).status).toBe(400);
  });
  it('removing a food hides it from search', async () => {
    const f = await trainerA.post('/api/foods').send(food('Temp food', 50, 1, 1, 1));
    await trainerA.delete(`/api/foods/${f.body.id}`);
    expect((await trainerA.get('/api/foods?q=Temp food')).body.items).toHaveLength(0);
  });
});

describe('diet plans and daily logging', () => {
  let chicken: { id: string; servings: Array<{ id: string }> }, oats: { id: string; servings: Array<{ id: string }> };
  let templateId: string, planId: string, mealIds: string[];

  beforeAll(async () => {
    chicken = (await trainerA.post('/api/foods').send(food('Chicken T', 165, 31, 0, 3.6))).body;
    oats = (await trainerA.post('/api/foods').send(food('Oats T', 380, 13, 67, 6.5))).body;
  });

  it('computes macros from servings × quantity on the server', async () => {
    const res = await trainerA.post('/api/diets').send({
      name: 'Cut template', isTemplate: true,
      meals: [
        { mealType: 'BREAKFAST', name: 'Breakfast', timeOfDay: '08:00', items: [{ foodServingId: oats.servings[0]!.id, quantity: 0.5 }] },
        { mealType: 'LUNCH', name: 'Lunch', items: [{ foodServingId: chicken.servings[0]!.id, quantity: 1.5 }, { customName: 'Salad', calories: 40, proteinG: 2, carbsG: 6, fatG: 1 }] },
      ],
    });
    expect(res.status).toBe(201);
    templateId = res.body.id;
    expect(res.body.meals[0].totals).toMatchObject({ calories: 190, proteinG: 6.5, carbsG: 33.5 });
    expect(res.body.meals[1].totals.calories).toBe(Math.round(165 * 1.5) + 40);
    expect(res.body.totals.calories).toBe(190 + 248 + 40);
    expect((await trainerA.post('/api/diets').send({ name: 'x', isTemplate: true, meals: [{ mealType: 'LUNCH', name: 'L', items: [{ quantity: 1 }] }] })).status).toBe(400);
    expect((await clientA.post('/api/diets').send({ name: 'x', isTemplate: true, meals: [] })).status).toBe(403);
  });

  it('assigning a template activates it for the client, archives the old plan and notifies', async () => {
    const first = await trainerA.post(`/api/diets/${templateId}/assign`).send({ clientIds: [client.clientId], startDate: today() });
    expect(first.status).toBe(201);
    const second = await trainerA.post(`/api/diets/${templateId}/assign`).send({ clientIds: [client.clientId], startDate: today() });
    planId = second.body.items[0].id;
    const plans = await prisma.dietPlan.findMany({ where: { clientId: client.clientId!, isTemplate: false } });
    expect(plans.filter((p) => p.status === 'ACTIVE')).toHaveLength(1);
    expect(plans.filter((p) => p.status === 'ARCHIVED')).toHaveLength(1);
    expect((await prisma.notification.count({ where: { userId: client.user.id, type: 'DIET_ASSIGNED' } }))).toBe(2);
    expect((await trainerA.post(`/api/diets/${templateId}/assign`).send({ clientIds: [stranger.clientId], startDate: today() })).status).toBe(404);
    expect((await strangerA.get(`/api/diets/${planId}`)).status).toBe(404);
  });

  it('the client completes a planned meal, skips another, and adds an extra meal', async () => {
    const plan = (await clientA.get(`/api/diets/${planId}`)).body;
    mealIds = plan.meals.map((m: { id: string }) => m.id);
    const done = await clientA.put('/api/diet-logs').send({ dietMealId: mealIds[0], date: today(), status: 'COMPLETED' });
    expect(done.status).toBe(200);
    expect(done.body.consumed.calories).toBe(190);
    expect(done.body.meals.find((m: { dietMealId: string }) => m.dietMealId === mealIds[0])).toMatchObject({ status: 'COMPLETED' });
    const skipped = await clientA.put('/api/diet-logs').send({ dietMealId: mealIds[1], date: today(), status: 'SKIPPED' });
    expect(skipped.body.meals.find((m: { dietMealId: string }) => m.dietMealId === mealIds[1]).status).toBe('SKIPPED');
    expect(skipped.body.consumed.calories).toBe(190);

    const extra = await clientA.post('/api/meals').send({ date: today(), mealType: 'SNACK', items: [{ foodServingId: chicken.servings[0]!.id, quantity: 1 }] });
    expect(extra.status).toBe(201);
    expect(extra.body.consumed.calories).toBe(190 + 165);
    const custom = extra.body.meals.find((m: { custom: boolean }) => m.custom);
    expect(custom).toBeTruthy();
    const removed = await clientA.delete(`/api/meals/${custom.mealLogId}`);
    expect(removed.body.consumed.calories).toBe(190);

    // un-completing removes what was eaten
    const undone = await clientA.put('/api/diet-logs').send({ dietMealId: mealIds[0], date: today(), status: 'PENDING' });
    expect(undone.body.consumed.calories).toBe(0);
    await clientA.put('/api/diet-logs').send({ dietMealId: mealIds[0], date: today(), status: 'COMPLETED' });

    const types = (await prisma.activityLog.findMany({ where: { clientId: client.clientId! } })).map((a) => a.type);
    expect(types).toEqual(expect.arrayContaining(['MEAL_LOGGED', 'MEAL_SKIPPED']));
    expect((await clientA.put('/api/diet-logs').send({ dietMealId: mealIds[0], date: '2099-01-01', status: 'COMPLETED' })).status).toBe(400);
    expect((await strangerA.put('/api/diet-logs').send({ dietMealId: mealIds[0], date: today(), status: 'COMPLETED' })).status).toBe(404);
  });

  it('trainers see a client’s day; other trainers do not', async () => {
    const d = await trainerA.get(`/api/nutrition/daily?clientId=${client.clientId}&date=${today()}`);
    expect(d.status).toBe(200);
    expect(d.body.consumed.calories).toBe(190);
    expect((await otherA.get(`/api/nutrition/daily?clientId=${client.clientId}`)).status).toBe(404);
    expect((await clientA.get(`/api/nutrition/daily?clientId=${stranger.clientId}`)).status).toBe(403);
  });

  it('editing a plan in place keeps logged history for the meals that stay', async () => {
    const plan = (await trainerA.get(`/api/diets/${planId}`)).body;
    const edited = await trainerA.put(`/api/diets/${planId}`).send({
      name: plan.name, clientId: client.clientId, isTemplate: false, startDate: today(),
      meals: [
        { id: plan.meals[0].id, mealType: 'BREAKFAST', name: 'Big breakfast', items: [{ foodServingId: oats.servings[0]!.id, quantity: 1 }] },
        { mealType: 'DINNER', name: 'Dinner', items: [{ foodServingId: chicken.servings[0]!.id, quantity: 1 }] },
      ],
    });
    expect(edited.status).toBe(200);
    expect(edited.body.meals.map((m: { name: string }) => m.name)).toEqual(['Big breakfast', 'Dinner']);
    expect(edited.body.meals[0].id).toBe(plan.meals[0].id);
    expect(await prisma.dietLog.count({ where: { dietMealId: plan.meals[0].id } })).toBe(1);
    expect(await prisma.dietLog.count({ where: { dietMealId: plan.meals[1].id } })).toBe(0); // removed meal's log went with it
    expect((await trainerA.delete(`/api/diets/${planId}`)).body.archived).toBe(true); // has logs → archived, not deleted
  });
});

describe('body analysis, calculator, targets and recommendation', () => {
  it('needs the missing details and says exactly which', async () => {
    const res = await clientA.post('/api/body-analysis/assess').send({ weightKg: 80, heightCm: 180, sex: 'MALE' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.ageYears).toBeDefined();
  });

  it('runs an estimated assessment (US Navy), stores history and a measurement', async () => {
    await prisma.client.update({ where: { id: client.clientId! }, data: { dateOfBirth: new Date('1994-03-01T00:00:00Z') } });
    const res = await clientA.post('/api/body-analysis/assess').send({ weightKg: 80, heightCm: 180, sex: 'MALE', activityLevel: 'MODERATE', waistCm: 90, neckCm: 38 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ isEstimate: true, method: 'US_NAVY' });
    expect(res.body.bodyFatPct).toBeCloseTo(19.8, 1);
    expect(res.body.leanMassKg + res.body.fatMassKg).toBeCloseTo(80, 0);
    const list = await trainerA.get(`/api/body-analysis/assessments?clientId=${client.clientId}`);
    expect(list.body.items).toHaveLength(1);
    expect(await prisma.bodyMeasurement.count({ where: { clientId: client.clientId!, weightKg: 80 } })).toBe(1);
    expect((await otherA.get(`/api/body-analysis/assessments?clientId=${client.clientId}`)).status).toBe(404);
  });

  it('calculates targets, honours trainer overrides within the allowed ranges', async () => {
    await prisma.bodyProfile.upsert({ where: { clientId: client.clientId! }, update: {}, create: { clientId: client.clientId!, sex: 'MALE', heightCm: 180, goal: 'FAT_LOSS', activityLevel: 'MODERATE', trainingExperience: 'INTERMEDIATE' } });
    const base = await trainerA.post('/api/nutrition/calculate').send({ clientId: client.clientId });
    expect(base.status).toBe(200);
    expect(base.body.goal).toBe('FAT_LOSS');
    expect(base.body.targets.calories).toBe(Math.round(base.body.assessment.maintenanceKcal * 0.8));
    expect(base.body.targets.proteinG).toBe(160);
    const tweaked = await trainerA.post('/api/nutrition/calculate').send({ clientId: client.clientId, goal: 'MUSCLE_BUILDING', overrides: { proteinPerKg: 9 } });
    expect(tweaked.body.targets.applied.proteinPerKg).toBe(3); // clamped to the configured maximum
    expect(tweaked.body.targets.calories).toBeGreaterThan(base.body.assessment.maintenanceKcal);
    const own = await clientA.post('/api/nutrition/calculate').send({});
    expect(own.status).toBe(200);
    expect((await clientA.post('/api/nutrition/calculate').send({ clientId: stranger.clientId })).status).toBe(403);
  });

  it('trainers save the final plan (clients cannot), the client is told and sees it on their day', async () => {
    const payload = { clientId: client.clientId, calories: 2300, proteinG: 160, carbsG: 250, fatG: 70, fiberG: 32, waterMl: 3000, source: 'TRAINER' };
    expect((await clientA.post('/api/nutrition/targets').send(payload)).status).toBe(403);
    expect((await otherA.post('/api/nutrition/targets').send(payload)).status).toBe(404);
    expect((await trainerA.post('/api/nutrition/targets').send(payload)).status).toBe(201);
    const second = await trainerA.post('/api/nutrition/targets').send({ ...payload, calories: 2200 });
    expect(second.body.isActive).toBe(true);
    const t = await clientA.get('/api/nutrition/targets');
    expect(t.body.active.calories).toBe(2200);
    expect(t.body.history.filter((x: { isActive: boolean }) => x.isActive)).toHaveLength(1);
    expect((await clientA.get(`/api/nutrition/daily?date=${today()}`)).body.target.calories).toBe(2200);
    expect(await prisma.notification.count({ where: { userId: client.user.id, title: { contains: 'nutrition targets' } } })).toBe(2);
    expect((await trainerA.post('/api/nutrition/targets').send({ ...payload, calories: 100 })).status).toBe(400);
  });

  it('settings: only admins change the ranges, and the change affects calculations', async () => {
    const cur = (await trainerA.get('/api/nutrition/settings')).body;
    expect((await trainerA.put('/api/nutrition/settings').send(cur)).status).toBe(403);
    const changed = { ...cur, calorieAdjustPct: { ...cur.calorieAdjustPct, FAT_LOSS: -0.1 } };
    expect((await adminA.put('/api/nutrition/settings').send(changed)).status).toBe(200);
    const calc = await trainerA.post('/api/nutrition/calculate').send({ clientId: client.clientId, goal: 'FAT_LOSS' });
    expect(calc.body.targets.calories).toBe(Math.round(calc.body.assessment.maintenanceKcal * 0.9));
    expect((await adminA.put('/api/nutrition/settings').send({ ...cur, fiberPer1000Kcal: 99 })).status).toBe(400);
    expect((await prisma.auditLog.count({ where: { action: 'NUTRITION_SETTINGS_UPDATED' } }))).toBe(1);
    await adminA.put('/api/nutrition/settings').send(cur);
  });

  it('recommendation: asks for data first, then explains its reasoning; accept updates the goal, review pings the trainer', async () => {
    const empty = await strangerA.post('/api/nutrition/recommendation').send({});
    expect(empty.status).toBe(201);
    expect(empty.body.needsData).toBe(true);

    const rec = await clientA.post('/api/nutrition/recommendation').send({});
    expect(rec.status).toBe(201);
    expect(rec.body.needsData).toBe(false);
    expect(rec.body.goal).toBe('RECOMPOSITION'); // 19.8 % body fat is mid-range
    expect(rec.body.reasons.join(' ')).toMatch(/19\.8%/);
    expect(rec.body.disclaimer).toMatch(/not a medical diagnosis/);

    const review = await clientA.post(`/api/nutrition/recommendation/${rec.body.id}/decision`).send({ decision: 'TRAINER_REVIEW' });
    expect(review.body.status).toBe('TRAINER_REVIEW');
    expect(await prisma.notification.count({ where: { userId: trainer.user.id, type: 'PROGRESS_REVIEW' } })).toBe(1);

    const accepted = await trainerA.post(`/api/nutrition/recommendation/${rec.body.id}/decision`).send({ decision: 'ACCEPT' });
    expect(accepted.body.status).toBe('ACCEPTED');
    expect((await prisma.bodyProfile.findUnique({ where: { clientId: client.clientId! } }))?.goal).toBe('RECOMPOSITION');
    expect((await trainerA.post(`/api/nutrition/recommendation/${rec.body.id}/decision`).send({ decision: 'DISMISS' })).status).toBe(409);
    const latest = await clientA.get('/api/nutrition/recommendation');
    expect(latest.body.recommendation.status).toBe('ACCEPTED');
  });
});
