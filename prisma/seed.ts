/**
 * Database seed.
 *
 *   npm run db:seed        → roles, exercise library, food library, first Super Admin (from .env)
 *   npm run db:seed:demo   → the above + demo trainers/clients/activity (DEVELOPMENT ONLY — refuses to run in production)
 */
import path from 'node:path';
import dotenv from 'dotenv';
import { hash } from '@node-rs/argon2';
import { NUTRITION_DEFAULTS, ROLE_NAMES, ROLE_PERMISSIONS, type RoleName } from '@gym/config';
import { Prisma, prisma } from '@gym/database';
import { EXERCISES } from './data/exercises';
import { FOODS } from './data/foods';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DAY = 86_400_000;
const utcDay = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const daysAgo = (n: number) => new Date(utcDay().getTime() - n * DAY);
const at = (day: Date, hour: number, minute = 0) => new Date(day.getTime() + hour * 3_600_000 + minute * 60_000);

// ───────────────────────────── base seed
async function seedRoles() {
  for (const name of ROLE_NAMES) {
    await prisma.role.upsert({
      where: { name },
      update: { permissions: [...ROLE_PERMISSIONS[name]] },
      create: { name, description: { SUPER_ADMIN: 'Owns the whole gym', TRAINER: 'Manages assigned clients', CLIENT: 'Follows a personal plan' }[name], permissions: [...ROLE_PERMISSIONS[name]] },
    });
  }
  console.log('✓ roles');
}

async function seedExercises() {
  for (const e of EXERCISES) {
    const data = {
      name: e.name, category: e.category, difficulty: e.difficulty, description: e.description,
      equipment: e.equipment, primaryMuscles: e.primaryMuscles, secondaryMuscles: e.secondaryMuscles,
      instructions: e.instructions, commonMistakes: e.commonMistakes,
    };
    await prisma.exercise.upsert({ where: { slug: e.slug }, update: {}, create: { slug: e.slug, ...data } });
  }
  console.log(`✓ ${EXERCISES.length} exercises`);
}

async function seedFoods() {
  let added = 0;
  for (const f of FOODS) {
    if (await prisma.foodItem.findFirst({ where: { name: f.name, isCustom: false } })) continue;
    await prisma.foodItem.create({
      data: { name: f.name, category: f.category, cuisine: f.cuisine, servings: { create: f.servings.map((s) => ({ ...s })) } },
    });
    added++;
  }
  console.log(`✓ foods (${added} added, ${FOODS.length - added} already present)`);
}

async function seedMemberships() {
  const plans = [
    { name: 'Basic', price: 1999, durationDays: 30, description: 'Gym floor access and workout tracking', features: ['Gym floor access', 'Workout tracking'] },
    { name: 'Pro', price: 3999, durationDays: 30, description: 'Everything in Basic plus classes and nutrition', features: ['Everything in Basic', 'Unlimited classes', 'Nutrition plans'] },
    { name: 'Elite', price: 6999, durationDays: 30, description: 'Personal training and 24/7 access', features: ['Everything in Pro', 'Personal trainer', '24/7 access'] },
  ];
  for (const p of plans) {
    if (!(await prisma.membership.findFirst({ where: { name: p.name } }))) await prisma.membership.create({ data: p });
  }
  console.log('✓ membership plans');
}

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@gym.local').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!12345';
  const username = process.env.SEED_ADMIN_USERNAME?.trim().toLowerCase() || undefined;
  const name = (process.env.SEED_ADMIN_NAME ?? 'Gym Owner').split(' ');
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return console.log(`✓ super admin already exists (${email})`);
  await prisma.user.create({
    data: { email, username, passwordHash: await hash(password), firstName: name[0] ?? 'Gym', lastName: name.slice(1).join(' ') || 'Owner', roleId: role.id, emailVerifiedAt: new Date() },
  });
  console.log(`✓ super admin created: ${email}`);
  if (process.env.NODE_ENV === 'production') console.log('  ⚠ change this password immediately after first login');
}

// ───────────────────────────── demo seed
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Behaviour = 'good' | 'okay' | 'poor' | 'ghost' | 'new';
interface DemoClient { first: string; last: string; sex: 'MALE' | 'FEMALE'; heightCm: number; weightKg: number; goal: 'FAT_LOSS' | 'RECOMPOSITION' | 'MUSCLE_BUILDING'; trainer: 0 | 1; behaviour: Behaviour; weeklyChange: number; plan: 'Basic' | 'Pro' | 'Elite' }

const DEMO_CLIENTS: DemoClient[] = [
  { first: 'Rohan', last: 'Mehta', sex: 'MALE', heightCm: 176, weightKg: 88, goal: 'FAT_LOSS', trainer: 0, behaviour: 'good', weeklyChange: -0.5, plan: 'Pro' },
  { first: 'Priya', last: 'Sharma', sex: 'FEMALE', heightCm: 163, weightKg: 58, goal: 'MUSCLE_BUILDING', trainer: 0, behaviour: 'good', weeklyChange: 0.15, plan: 'Elite' },
  { first: 'Kiran', last: 'Rao', sex: 'MALE', heightCm: 172, weightKg: 92, goal: 'FAT_LOSS', trainer: 0, behaviour: 'poor', weeklyChange: 0.1, plan: 'Basic' },
  { first: 'Ananya', last: 'Iyer', sex: 'FEMALE', heightCm: 160, weightKg: 62, goal: 'RECOMPOSITION', trainer: 0, behaviour: 'okay', weeklyChange: -0.1, plan: 'Pro' },
  { first: 'Vikram', last: 'Singh', sex: 'MALE', heightCm: 182, weightKg: 74, goal: 'MUSCLE_BUILDING', trainer: 1, behaviour: 'good', weeklyChange: 0.25, plan: 'Elite' },
  { first: 'Sneha', last: 'Reddy', sex: 'FEMALE', heightCm: 158, weightKg: 71, goal: 'FAT_LOSS', trainer: 1, behaviour: 'okay', weeklyChange: -0.35, plan: 'Pro' },
  { first: 'Arjun', last: 'Das', sex: 'MALE', heightCm: 178, weightKg: 80, goal: 'RECOMPOSITION', trainer: 1, behaviour: 'new', weeklyChange: 0, plan: 'Basic' },
  { first: 'Divya', last: 'Menon', sex: 'FEMALE', heightCm: 165, weightKg: 66, goal: 'FAT_LOSS', trainer: 1, behaviour: 'ghost', weeklyChange: 0, plan: 'Basic' },
];

const completeProb: Record<Behaviour, number> = { good: 0.92, okay: 0.62, poor: 0.2, ghost: 0.12, new: 0 };
const dietProb: Record<Behaviour, number> = { good: 0.9, okay: 0.6, poor: 0.2, ghost: 0.1, new: 0 };

const SPLIT = [
  { name: 'Push Day', exercises: ['barbell-bench-press', 'overhead-press', 'push-up', 'standing-calf-raise'] },
  { name: 'Pull Day', exercises: ['deadlift', 'bent-over-barbell-row', 'pull-up', 'dumbbell-biceps-curl'] },
  { name: 'Leg Day', exercises: ['barbell-back-squat', 'split-lunge', 'standing-calf-raise', 'forearm-plank'] },
];
const BASE_WEIGHT: Record<string, number> = { 'barbell-bench-press': 50, 'overhead-press': 30, 'deadlift': 80, 'bent-over-barbell-row': 45, 'dumbbell-biceps-curl': 10, 'barbell-back-squat': 60 };

function estimateTarget(c: DemoClient) {
  // Mifflin–St Jeor + the same defaults the Phase 3 engine will use.
  const age = 30;
  const bmr = 10 * c.weightKg + 6.25 * c.heightCm - 5 * age + (c.sex === 'MALE' ? 5 : -161);
  const maintenance = bmr * NUTRITION_DEFAULTS.activityMultiplier.MODERATE;
  const calories = Math.round(maintenance * (1 + NUTRITION_DEFAULTS.calorieAdjustPct[c.goal]));
  const proteinG = Math.round(c.weightKg * NUTRITION_DEFAULTS.proteinPerKg[c.goal]);
  const fatG = Math.round((calories * NUTRITION_DEFAULTS.fatPct[c.goal]) / 9);
  const carbsG = Math.round((calories - proteinG * 4 - fatG * 9) / 4);
  return { calories, proteinG, fatG, carbsG, fiberG: Math.round((calories / 1000) * NUTRITION_DEFAULTS.fiberPer1000Kcal), waterMl: Math.round(c.weightKg * NUTRITION_DEFAULTS.waterMlPerKg), bmr, maintenance };
}

async function seedDemo() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed demo data in production.');
  if (await prisma.user.findUnique({ where: { email: 'aarav.trainer@gym.local' } })) {
    return console.log('• demo data already present (run `npm run db:reset` first to recreate it)');
  }
  const rand = rng(20261007);
  const password = await hash(process.env.SEED_DEMO_PASSWORD ?? 'Demo@12345!');
  const roles = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.name, r.id])) as Record<RoleName, string>;
  const exercises = new Map((await prisma.exercise.findMany()).map((e) => [e.slug, e]));
  const foods = await prisma.foodItem.findMany({ include: { servings: true } });
  const food = (name: string) => foods.find((f) => f.name.startsWith(name))!;
  const memberships = Object.fromEntries((await prisma.membership.findMany()).map((m) => [m.name, m]));
  const admin = await prisma.user.findFirstOrThrow({ where: { role: { name: 'SUPER_ADMIN' } } });

  // trainers
  const trainers = [];
  for (const t of [
    { first: 'Aarav', last: 'Kapoor', email: 'aarav.trainer@gym.local', username: process.env.SEED_DEMO_USERNAME, specialties: ['Strength', 'Fat loss'] },
    { first: 'Meera', last: 'Nair', email: 'meera.trainer@gym.local', specialties: ['Hypertrophy', 'Mobility'] },
  ]) {
    trainers.push(
      await prisma.trainer.create({
        data: {
          specialties: t.specialties, hiredAt: daysAgo(400), bio: `${t.first} coaches strength and body composition.`,
          user: { create: { email: t.email, username: t.username?.trim().toLowerCase() || undefined, passwordHash: password, firstName: t.first, lastName: t.last, roleId: roles.TRAINER, emailVerifiedAt: new Date() } },
        },
        include: { user: true },
      }),
    );
  }

  const login: string[] = [];
  for (const [idx, c] of DEMO_CLIENTS.entries()) {
    const isNew = c.behaviour === 'new';
    const joinedDaysAgo = isNew ? 3 : 30 + Math.floor(rand() * 150);
    const joinedAt = daysAgo(joinedDaysAgo);
    const email = `${c.first.toLowerCase()}.${c.last.toLowerCase()}@gym.local`;
    const trainer = trainers[c.trainer]!;
    const tgt = estimateTarget(c);

    const client = await prisma.client.create({
      data: {
        joinedAt, createdAt: joinedAt, dateOfBirth: new Date(Date.UTC(1994, idx, 12)), qrCode: `GYM-${1000 + idx}`,
        user: { create: { email, username: idx === 1 ? process.env.SEED_DEMO_USERNAME?.trim().toLowerCase() || undefined : undefined, passwordHash: password, firstName: c.first, lastName: c.last, phone: `+91 98${String(10000000 + idx * 1234567).slice(0, 8)}`, roleId: roles.CLIENT, emailVerifiedAt: joinedAt, createdAt: joinedAt } },
        trainers: { create: { trainerId: trainer.id, assignedAt: joinedAt } },
        bodyProfile: { create: { sex: c.sex, heightCm: c.heightCm, goal: c.goal, activityLevel: 'MODERATE', trainingExperience: c.behaviour === 'good' ? 'INTERMEDIATE' : 'BEGINNER' } },
        nutritionTargets: { create: { trainerId: trainer.id, calories: tgt.calories, proteinG: tgt.proteinG, carbsG: tgt.carbsG, fatG: tgt.fatG, fiberG: tgt.fiberG, waterMl: tgt.waterMl, source: 'CALCULATED', effectiveFrom: joinedAt, rationale: { bmr: Math.round(tgt.bmr), maintenance: Math.round(tgt.maintenance), goal: c.goal } } },
      },
    });
    login.push(`${email}`);

    // weekly weigh-ins (6 weeks, or just the first one for the new client)
    const weeks = isNew ? 1 : 7;
    await prisma.bodyMeasurement.createMany({
      data: Array.from({ length: weeks }, (_, k) => {
        const w = weeks - 1 - k;
        return { clientId: client.id, measuredAt: at(daysAgo(w * 7 + 1), 7, 30), weightKg: Math.round((c.weightKg - c.weeklyChange * (weeks - 1 - w) + (rand() - 0.5) * 0.4) * 10) / 10, waistCm: Math.round((c.sex === 'MALE' ? 90 : 78) - c.weeklyChange * 0.8 * (weeks - 1 - w)), recordedBy: trainer.userId };
      }),
    });

    // active diet plan (4 meals built from the food library)
    const mealSpec: Array<{ type: 'BREAKFAST' | 'LUNCH' | 'SNACK' | 'DINNER'; name: string; time: string; items: Array<[string, number]> }> = [
      { type: 'BREAKFAST', name: 'Breakfast', time: '08:00', items: [['Oats', 1], ['Banana', 1], ['Egg, whole', 2]] },
      { type: 'LUNCH', name: 'Lunch', time: '13:00', items: [['White rice', 1.5], ['Chicken breast', 1.5], ['Spinach', 1]] },
      { type: 'SNACK', name: 'Snack', time: '17:00', items: [['Curd', 1], ['Almonds', 1]] },
      { type: 'DINNER', name: 'Dinner', time: '20:30', items: [['Roti', 3], ['Dal', 1], ['Paneer', 1]] },
    ];
    const plan = await prisma.dietPlan.create({
      data: {
        name: `${c.first}'s ${c.goal.replace('_', ' ').toLowerCase()} plan`, trainerId: trainer.id, clientId: client.id, status: 'ACTIVE', startDate: joinedAt,
        meals: {
          create: mealSpec.map((m, order) => ({
            mealType: m.type, name: m.name, order, timeOfDay: m.time,
            items: {
              create: m.items.map(([n, q]) => {
                const f = food(n); const sv = f.servings.find((s) => s.isDefault) ?? f.servings[0]!;
                return { foodItemId: f.id, foodServingId: sv.id, quantity: q, calories: Math.round(sv.calories * q), proteinG: +(sv.proteinG * q).toFixed(1), carbsG: +(sv.carbsG * q).toFixed(1), fatG: +(sv.fatG * q).toFixed(1), fiberG: +(sv.fiberG * q).toFixed(1) };
              }),
            },
          })),
        },
      },
      include: { meals: { include: { items: true } } },
    });

    const acts: Prisma.ActivityLogCreateManyInput[] = [];
    const attendance: Prisma.AttendanceCreateManyInput[] = [];
    const dietLogs: Prisma.DietLogCreateManyInput[] = [];
    const cutoff = c.behaviour === 'poor' ? 9 : c.behaviour === 'ghost' ? 11 : -1; // days since which they've gone quiet
    const act = (type: Prisma.ActivityLogCreateManyInput['type'], when: Date, entityType?: string, entityId?: string) =>
      acts.push({ actorUserId: undefined, clientId: client.id, type, entityType, entityId, createdAt: when });

    // workouts every other day: 21 days back → 3 days ahead (so "today" always has one)
    let n = 0;
    if (!isNew || true) {
      for (let off = isNew ? 0 : 21; off >= -3; off -= 1) {
        if (off % 2 !== 0) continue;
        const day = daysAgo(off);
        if (isNew && off > 0) continue;
        const tpl = SPLIT[n++ % SPLIT.length]!;
        const past = off > 0;
        const quiet = cutoff >= 0 && off < cutoff;
        const done = past && !quiet && rand() < completeProb[c.behaviour];
        const status = done ? 'COMPLETED' : past ? (rand() < 0.5 ? 'SKIPPED' : 'ASSIGNED') : 'ASSIGNED';
        const workout = await prisma.workout.create({
          data: {
            name: tpl.name, trainerId: trainer.id, clientId: client.id, scheduledDate: day, status, estimatedMin: 55, createdAt: daysAgo(off + 2),
            exercises: {
              create: tpl.exercises.map((slug, order) => ({
                exerciseId: exercises.get(slug)!.id, order, section: 'MAIN', sets: slug === 'forearm-plank' ? 3 : 4, reps: slug === 'forearm-plank' ? '45s' : slug === 'pull-up' ? '6-8' : '10',
                weightKg: BASE_WEIGHT[slug] ? BASE_WEIGHT[slug]! + Math.round(c.weightKg / 20) : null, restSec: slug === 'deadlift' || slug === 'barbell-back-squat' ? 120 : 60,
              })),
            },
          },
          include: { exercises: true },
        });
        if (done) {
          const start = at(day, 17 + Math.floor(rand() * 3), Math.floor(rand() * 50));
          const session = await prisma.workoutSession.create({ data: { workoutId: workout.id, clientId: client.id, status: 'COMPLETED', startedAt: start, completedAt: new Date(start.getTime() + 52 * 60_000), perceivedExertion: 6 + Math.floor(rand() * 3) } });
          await prisma.workoutSet.createMany({
            data: workout.exercises.flatMap((we) =>
              Array.from({ length: we.sets }, (_, i) => ({ sessionId: session.id, workoutExerciseId: we.id, setNumber: i + 1, targetReps: parseInt(we.reps) || 10, reps: (parseInt(we.reps) || 10) - (i === we.sets - 1 ? 1 : 0), weightKg: we.weightKg, completedAt: new Date(start.getTime() + (i + 1) * 4 * 60_000) })),
            ),
          });
          act('WORKOUT_STARTED', start, 'WorkoutSession', session.id);
          act('EXERCISE_COMPLETED', new Date(start.getTime() + 20 * 60_000), 'WorkoutSession', session.id);
          act('WORKOUT_COMPLETED', new Date(start.getTime() + 52 * 60_000), 'WorkoutSession', session.id);
          attendance.push({ clientId: client.id, date: day, status: rand() < 0.15 ? 'LATE' : 'PRESENT', method: rand() < 0.5 ? 'QR' : 'MANUAL', checkInAt: new Date(start.getTime() - 8 * 60_000), checkOutAt: new Date(start.getTime() + 60 * 60_000) });
          act('CHECKED_IN', new Date(start.getTime() - 8 * 60_000));
        }
      }
    }

    // diet adherence for the last 14 days (today only if they're active)
    if (!isNew) {
      for (let off = 14; off >= 0; off--) {
        for (const meal of plan.meals) {
          const quiet = cutoff >= 0 && off < cutoff;
          const past = off > 0;
          const completed = !quiet && rand() < dietProb[c.behaviour] && (past || meal.order < 2);
          const status = completed ? 'COMPLETED' : past ? (rand() < 0.5 ? 'SKIPPED' : 'PENDING') : 'PENDING';
          dietLogs.push({ clientId: client.id, dietMealId: meal.id, date: daysAgo(off), status, loggedAt: completed ? at(daysAgo(off), 8 + meal.order * 4) : undefined });
          if (completed) act('MEAL_LOGGED', at(daysAgo(off), 8 + meal.order * 4, 15), 'DietMeal', meal.id);
          if (status === 'SKIPPED') act('MEAL_SKIPPED', at(daysAgo(off), 12 + meal.order * 3), 'DietMeal', meal.id);
        }
      }
    }

    // today's logged meals (so the client dashboard shows real consumed totals) + water + sleep
    if (!isNew && c.behaviour !== 'ghost' && c.behaviour !== 'poor') {
      for (const meal of plan.meals.slice(0, c.behaviour === 'good' ? 3 : 2)) {
        await prisma.mealLog.create({
          data: {
            clientId: client.id, date: daysAgo(0), mealType: meal.mealType, dietMealId: meal.id, status: 'COMPLETED',
            items: { create: meal.items.map((i) => ({ foodItemId: i.foodItemId, foodServingId: i.foodServingId, quantity: i.quantity, calories: i.calories, proteinG: i.proteinG, carbsG: i.carbsG, fatG: i.fatG, fiberG: i.fiberG })) },
          },
        });
      }
      await prisma.waterLog.createMany({ data: [{ clientId: client.id, date: daysAgo(0), amountMl: 500 }, { clientId: client.id, date: daysAgo(0), amountMl: 750 }] });
      await prisma.sleepLog.create({ data: { clientId: client.id, date: daysAgo(0), hours: 6 + Math.round(rand() * 20) / 10, quality: 3 + Math.floor(rand() * 3) } });
      act('WATER_LOGGED', at(daysAgo(0), 9));
    }

    if (acts.length) await prisma.activityLog.createMany({ data: acts });
    if (attendance.length) await prisma.attendance.createMany({ data: attendance, skipDuplicates: true });
    if (dietLogs.length) await prisma.dietLog.createMany({ data: dietLogs, skipDuplicates: true });

    // membership + payment history (drives revenue charts)
    const m = memberships[c.plan]!;
    const startOffset = [5, 12, 20, 27, 3, 40, 2, 33][idx]!;
    const sub = await prisma.subscription.create({
      data: { clientId: client.id, membershipId: m.id, status: 'ACTIVE', startDate: daysAgo(startOffset), endDate: daysAgo(startOffset - 30), autoRenew: idx % 2 === 0 },
    });
    const monthsActive = Math.min(6, Math.max(1, Math.floor(joinedDaysAgo / 30)));
    for (let k = 0; k < monthsActive; k++) {
      const paidAt = at(daysAgo(startOffset + k * 30), 11);
      await prisma.payment.create({
        data: { clientId: client.id, subscriptionId: k === 0 ? sub.id : null, amount: m.price, status: 'PAID', method: (['UPI', 'CARD', 'CASH'] as const)[(idx + k) % 3]!, paidAt, createdAt: paidAt, invoiceNo: `INV-${new Date().getUTCFullYear()}-${String(idx + 1).padStart(2, '0')}${k}` },
      });
    }

    // a trainer note / message for some clients
    if (idx % 2 === 0 || c.behaviour === 'poor') {
      await prisma.message.create({
        data: {
          conversationKey: [trainer.userId, (await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).userId].sort().join(':'),
          senderId: trainer.userId, recipientId: (await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).userId,
          body: c.behaviour === 'poor' ? "Hey! I noticed you've missed a few sessions — everything okay? Let's reset the plan this week." : `Great work this week, ${c.first}! Keep the protein up and we'll review your numbers on Friday.`,
          readAt: idx === 0 ? daysAgo(0) : null, createdAt: at(daysAgo(1), 18),
        },
      });
    }
  }

  await prisma.auditLog.create({ data: { actorUserId: admin.id, action: 'DEMO_SEED', entityType: 'System', after: { trainers: 2, clients: DEMO_CLIENTS.length } } });
  const pw = process.env.SEED_DEMO_PASSWORD ?? 'Demo@12345!';
  console.log('✓ demo data created\n');
  console.log('  Demo logins (password for all: ' + pw + ')');
  const u = process.env.SEED_DEMO_USERNAME;
  if (u) console.log(`    username ${u} + that password works for: Super Admin, trainer Aarav, client Priya (pick the role on the login page)`);
  console.log('    trainers : aarav.trainer@gym.local · meera.trainer@gym.local');
  console.log('    clients  : ' + login.slice(0, 3).join(' · ') + ' …');
}

async function main() {
  await seedRoles();
  await seedExercises();
  await seedFoods();
  await seedMemberships();
  await seedAdmin();
  if (process.argv.includes('--demo')) await seedDemo();
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
