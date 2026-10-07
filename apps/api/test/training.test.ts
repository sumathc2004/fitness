import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@gym/database';
import { app, assign, createUser, loggedInAgent, resetDb } from './helpers';

type U = Awaited<ReturnType<typeof createUser>>;
let admin: U, trainer: U, otherTrainer: U, client: U, otherClient: U;
let adminA: Awaited<ReturnType<typeof loggedInAgent>>, trainerA: typeof adminA, otherTrainerA: typeof adminA, clientA: typeof adminA, otherClientA: typeof adminA;

beforeAll(async () => {
  await resetDb();
  admin = await createUser('SUPER_ADMIN');
  trainer = await createUser('TRAINER', { firstName: 'Tara', lastName: 'Coach' });
  otherTrainer = await createUser('TRAINER');
  client = await createUser('CLIENT', { firstName: 'Sam', lastName: 'Strong' });
  otherClient = await createUser('CLIENT');
  await assign(trainer.trainerId!, client.clientId!);
  await assign(otherTrainer.trainerId!, otherClient.clientId!);
  adminA = await loggedInAgent(admin.email);
  trainerA = await loggedInAgent(trainer.email);
  otherTrainerA = await loggedInAgent(otherTrainer.email);
  clientA = await loggedInAgent(client.email);
  otherClientA = await loggedInAgent(otherClient.email);
});

const glb = () => { const b = Buffer.alloc(40); b.writeUInt32LE(0x46546c67, 0); b.writeUInt32LE(2, 4); b.writeUInt32LE(40, 8); return b; };
const today = () => new Date().toISOString().slice(0, 10);

describe('trainers & clients', () => {
  it('admin creates a trainer; trainers cannot', async () => {
    const body = { email: 'newtrainer@test.local', password: 'Trainer-Pass-123', firstName: 'Nia', lastName: 'Fit', specialties: ['Strength'], maxClients: 2 };
    expect((await trainerA.post('/api/trainers').send(body)).status).toBe(403);
    const res = await adminA.post('/api/trainers').send(body);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Nia Fit', clients: 0, maxClients: 2, specialties: ['Strength'] });
    expect((await adminA.post('/api/trainers').send(body)).status).toBe(409); // duplicate email
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  it('a trainer creates a client who is auto-assigned to them, and can sign in', async () => {
    const res = await trainerA.post('/api/clients').send({ email: 'newclient@test.local', password: 'Client-Pass-123', firstName: 'Kai', lastName: 'New', sex: 'MALE', heightCm: 180, weightKg: 82, goal: 'FAT_LOSS' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ firstName: 'Kai', trainerId: trainer.trainerId, profile: { goal: 'FAT_LOSS', heightCm: 180 } });
    expect(res.body.qrCode).toMatch(/^GYM-/);
    expect((await request(app).post('/api/auth/login').send({ identifier: 'newclient@test.local', password: 'Client-Pass-123' })).status).toBe(200);
    const w = await prisma.bodyMeasurement.findFirst({ where: { clientId: res.body.id } });
    expect(w?.weightKg).toBe(82);
  });

  it('lists are scoped: trainers see only their clients, clients cannot list', async () => {
    const mine = await trainerA.get('/api/clients');
    expect(mine.status).toBe(200);
    const names = mine.body.items.map((c: { name: string }) => c.name);
    expect(names).toContain('Sam Strong');
    expect(mine.body.items.every((c: { trainerId: string }) => c.trainerId === trainer.trainerId)).toBe(true);
    expect((await clientA.get('/api/clients')).status).toBe(403);
    const all = await adminA.get('/api/clients?pageSize=100');
    expect(all.body.total).toBeGreaterThan(mine.body.total);
    const search = await adminA.get('/api/clients?q=Strong');
    expect(search.body.items.map((c: { name: string }) => c.name)).toEqual(['Sam Strong']);
  });

  it('client detail respects ownership and hides staff notes from the client', async () => {
    expect((await otherTrainerA.get(`/api/clients/${client.clientId}`)).status).toBe(404);
    expect((await clientA.get(`/api/clients/${otherClient.clientId}`)).status).toBe(403);
    expect((await trainerA.put(`/api/clients/${client.clientId}/notes`).send({ notes: 'Sensitive: knee surgery 2024' })).status).toBe(200);
    const asTrainer = await trainerA.get(`/api/clients/${client.clientId}`);
    expect(asTrainer.body.notes).toBe('Sensitive: knee surgery 2024');
    const asClient = await clientA.get(`/api/clients/${client.clientId}`);
    expect(asClient.status).toBe(200);
    expect(asClient.body.notes).toBeNull();
  });

  it('admin reassigns a client; capacity is enforced', async () => {
    const t = await adminA.post('/api/trainers').send({ email: 'cap@test.local', password: 'Trainer-Pass-123', firstName: 'Cap', lastName: 'One', maxClients: 1 });
    const first = await adminA.put(`/api/clients/${client.clientId}/trainer`).send({ trainerId: t.body.id });
    expect(first.status).toBe(200);
    expect(first.body.trainerId).toBe(t.body.id);
    expect((await trainerA.get(`/api/clients/${client.clientId}`)).status).toBe(404); // old trainer lost access
    const full = await adminA.put(`/api/clients/${otherClient.clientId}/trainer`).send({ trainerId: t.body.id });
    expect(full.status).toBe(409);
    await adminA.put(`/api/clients/${client.clientId}/trainer`).send({ trainerId: trainer.trainerId }); // restore
  });

  it('a trainer can reset their own client’s password, not someone else’s', async () => {
    const ok = await trainerA.post(`/api/users/${client.user.id}/password`).send({ password: 'Reset-By-Coach-9' });
    expect(ok.status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ identifier: client.email, password: 'Reset-By-Coach-9' })).status).toBe(200);
    expect((await otherTrainerA.post(`/api/users/${client.user.id}/password`).send({ password: 'Reset-By-Coach-9' })).status).toBe(404);
    expect((await clientA.post(`/api/users/${otherClient.user.id}/password`).send({ password: 'Reset-By-Coach-9' })).status).toBe(403);
    clientA = await loggedInAgent(client.email, 'Reset-By-Coach-9');
  });
});

describe('exercises & 3D models', () => {
  let exId: string;
  it('trainers create exercises and may edit only their own', async () => {
    const body = { name: 'Cable Fly', category: 'STRENGTH', difficulty: 'BEGINNER', equipment: ['Cable'], primaryMuscles: ['Chest'], secondaryMuscles: [], instructions: ['Pull handles together'], commonMistakes: [] };
    const res = await trainerA.post('/api/exercises').send(body);
    expect(res.status).toBe(201);
    exId = res.body.id;
    expect(res.body.slug).toBe('cable-fly');
    expect((await trainerA.put(`/api/exercises/${exId}`).send({ ...body, name: 'Cable Fly (low)' })).status).toBe(200);
    expect((await otherTrainerA.put(`/api/exercises/${exId}`).send(body)).status).toBe(403);
    expect((await adminA.put(`/api/exercises/${exId}`).send({ ...body, name: 'Cable Fly (admin edit)' })).status).toBe(200);
    expect((await clientA.post('/api/exercises').send(body)).status).toBe(403);
    expect((await trainerA.post('/api/exercises').send({ ...body, primaryMuscles: [] })).status).toBe(400);
  });

  it('filters and hides archived exercises from clients', async () => {
    const chest = await clientA.get('/api/exercises?muscle=chest');
    expect(chest.body.items.some((e: { id: string }) => e.id === exId)).toBe(true);
    expect((await trainerA.post(`/api/exercises/${exId}/archive`)).status).toBe(200);
    expect((await clientA.get('/api/exercises?includeInactive=true')).body.items.some((e: { id: string }) => e.id === exId)).toBe(false);
    expect((await trainerA.get('/api/exercises?includeInactive=true')).body.items.some((e: { id: string }) => e.id === exId)).toBe(true);
    await trainerA.post(`/api/exercises/${exId}/restore`);
  });

  it('only admins upload 3D models, which must be real GLB files, and downloads need a login', async () => {
    expect((await trainerA.post(`/api/exercises/${exId}/3d`).attach('file', glb(), 'm.glb')).status).toBe(403);
    const fake = await adminA.post(`/api/exercises/${exId}/3d`).attach('file', Buffer.from('not a model at all, just text'), 'm.glb');
    expect(fake.status).toBe(400);
    expect(fake.body.error.code).toBe('INVALID_FILE');
    const ok = await adminA.post(`/api/exercises/${exId}/3d`).field('credit', 'Test model').attach('file', glb(), 'model.glb');
    expect(ok.status).toBe(201);
    expect(ok.body.assets).toHaveLength(1);
    expect(ok.body.assets[0]).toMatchObject({ credit: 'Test model', version: 1 });
    const url = ok.body.assets[0].url as string;
    expect((await request(app).get(url)).status).toBe(401);
    const dl = await clientA.get(url);
    expect(dl.status).toBe(200);
    expect(dl.headers['content-type']).toContain('gltf-binary');
    expect((await adminA.delete(`/api/exercises/${exId}/3d/${ok.body.assets[0].id}`)).body.assets).toHaveLength(0);
  });
});

describe('workouts, assignment and sessions', () => {
  let squat: string, bench: string, templateId: string, workoutId: string, sessionId: string, wxId: string;
  const ex = (name: string, extra = {}) => ({ exerciseId: name === 'squat' ? squat : bench, sets: 3, reps: '10', restSec: 60, section: 'MAIN', technique: 'NORMAL', ...extra });

  beforeAll(async () => {
    squat = (await prisma.exercise.create({ data: { slug: 'sq-t', name: 'Squat T', primaryMuscles: ['Quads'], instructions: ['x'] } })).id;
    bench = (await prisma.exercise.create({ data: { slug: 'bp-t', name: 'Bench T', primaryMuscles: ['Chest'], instructions: ['x'] } })).id;
  });

  it('a trainer builds a template with warm-up, superset and custom exercises', async () => {
    const res = await trainerA.post('/api/workouts').send({
      name: 'Full body', isTemplate: true, notes: 'Template',
      exercises: [ex('squat', { section: 'WARMUP', sets: 2, reps: '12' }), ex('bench', { technique: 'SUPERSET', supersetGroup: 1, weightKg: 40 }), { customName: 'Farmer walk', sets: 3, reps: '30m', section: 'CARDIO' }],
    });
    expect(res.status).toBe(201);
    templateId = res.body.id;
    expect(res.body.exercises.map((e: { name: string }) => e.name)).toEqual(['Squat T', 'Bench T', 'Farmer walk']);
    expect(res.body.exercises[1]).toMatchObject({ technique: 'SUPERSET', supersetGroup: 1, weightKg: 40 });
    expect((await clientA.post('/api/workouts').send({ name: 'x', isTemplate: true, exercises: [ex('squat')] })).status).toBe(403);
    expect((await trainerA.post('/api/workouts').send({ name: 'x', isTemplate: true, exercises: [] })).status).toBe(400);
  });

  it('templates are private to their trainer, but admin templates are shared', async () => {
    expect((await otherTrainerA.get(`/api/workouts/${templateId}`)).status).toBe(404);
    const shared = await adminA.post('/api/workouts').send({ name: 'Shared basics', isTemplate: true, exercises: [ex('squat')] });
    expect(shared.status).toBe(201);
    expect((await otherTrainerA.get(`/api/workouts/${shared.body.id}`)).status).toBe(200);
    expect((await otherTrainerA.put(`/api/workouts/${shared.body.id}`).send({ name: 'hack', isTemplate: true, exercises: [ex('squat')] })).status).toBe(403);
  });

  it('assigns a template to a client, who is notified and sees it for today', async () => {
    expect((await trainerA.post(`/api/workouts/${templateId}/assign`).send({ clientIds: [otherClient.clientId], scheduledDate: today() })).status).toBe(404);
    const res = await trainerA.post(`/api/workouts/${templateId}/assign`).send({ clientIds: [client.clientId], scheduledDate: today() });
    expect(res.status).toBe(201);
    workoutId = res.body.items[0].id;
    expect(res.body.items[0]).toMatchObject({ status: 'ASSIGNED', clientName: 'Sam Strong', exerciseCount: 3 });
    const notes = await prisma.notification.findMany({ where: { userId: client.user.id, type: 'WORKOUT_ASSIGNED' } });
    expect(notes).toHaveLength(1);
    const t = await clientA.get('/api/workouts/today');
    expect(t.body.items.map((w: { id: string }) => w.id)).toContain(workoutId);
    expect((await otherClientA.get(`/api/workouts/${workoutId}`)).status).toBe(404);
  });

  it('runs a full session: start, log sets, skip an exercise, finish', async () => {
    const start = await clientA.post('/api/workout-sessions').send({ workoutId });
    expect(start.status).toBe(201);
    sessionId = start.body.id;
    wxId = start.body.exercises[1].id;
    expect(start.body.status).toBe('IN_PROGRESS');
    expect((await clientA.post('/api/workout-sessions').send({ workoutId })).body.id).toBe(sessionId); // resume, not duplicate

    const s1 = await clientA.put('/api/workout-sets').send({ sessionId, workoutExerciseId: wxId, setNumber: 1, reps: 10, weightKg: 42.5, rpe: 7 });
    expect(s1.status).toBe(200);
    expect(s1.body.sets.find((x: { setNumber: number }) => x.setNumber === 1)).toMatchObject({ reps: 10, weightKg: 42.5, completed: true });
    await clientA.put('/api/workout-sets').send({ sessionId, workoutExerciseId: wxId, setNumber: 2, reps: 9, weightKg: 42.5 });
    await clientA.put('/api/workout-sets').send({ sessionId, workoutExerciseId: wxId, setNumber: 3, reps: 8, weightKg: 42.5 });
    expect((await prisma.activityLog.count({ where: { clientId: client.clientId!, type: 'EXERCISE_COMPLETED' } }))).toBe(1);

    const skipped = await clientA.post(`/api/workout-sessions/${sessionId}/skip-exercise`).send({ workoutExerciseId: start.body.exercises[2].id });
    expect(skipped.body.sets.filter((x: { skipped: boolean }) => x.skipped)).toHaveLength(3);

    // someone else's session cannot be touched
    expect((await otherClientA.put('/api/workout-sets').send({ sessionId, workoutExerciseId: wxId, setNumber: 1, reps: 1 })).status).toBe(404);

    const fin = await clientA.post(`/api/workout-sessions/${sessionId}/finish`).send({ perceivedExertion: 8, notes: 'Felt strong' });
    expect(fin.status).toBe(200);
    expect(fin.body).toMatchObject({ status: 'COMPLETED', perceivedExertion: 8 });
    expect((await prisma.workout.findUnique({ where: { id: workoutId } }))?.status).toBe('COMPLETED');
    expect((await clientA.put('/api/workout-sets').send({ sessionId, workoutExerciseId: wxId, setNumber: 4, reps: 5 })).status).toBe(409);
    const types = (await prisma.activityLog.findMany({ where: { clientId: client.clientId! } })).map((a) => a.type);
    expect(types).toEqual(expect.arrayContaining(['WORKOUT_STARTED', 'EXERCISE_COMPLETED', 'EXERCISE_SKIPPED', 'WORKOUT_COMPLETED']));
  });

  it('shows previous performance in the next session and lists history for the trainer', async () => {
    const next = await trainerA.post(`/api/workouts/${templateId}/assign`).send({ clientIds: [client.clientId], scheduledDate: today() });
    const s = await clientA.post('/api/workout-sessions').send({ workoutId: next.body.items[0].id });
    const prev = s.body.previous.find((p: { exerciseId: string }) => p.exerciseId === bench);
    expect(prev.sets).toEqual([{ setNumber: 1, reps: 10, weightKg: 42.5 }, { setNumber: 2, reps: 9, weightKg: 42.5 }, { setNumber: 3, reps: 8, weightKg: 42.5 }]);
    const history = await trainerA.get(`/api/workout-sessions?clientId=${client.clientId}`);
    expect(history.status).toBe(200);
    const done = history.body.items.find((h: { id: string }) => h.id === sessionId);
    expect(done).toMatchObject({ setsDone: 3, volumeKg: Math.round(10 * 42.5 + 9 * 42.5 + 8 * 42.5) });
    expect((await otherTrainerA.get(`/api/workout-sessions?clientId=${client.clientId}`)).status).toBe(404);
  });

  it('refuses to edit or delete a workout that already has logged sessions', async () => {
    const e = await trainerA.put(`/api/workouts/${workoutId}`).send({ name: 'Changed', clientId: client.clientId, isTemplate: false, scheduledDate: today(), exercises: [ex('squat')] });
    expect(e.status).toBe(409);
    expect(e.body.error.code).toBe('WORKOUT_HAS_LOGS');
    expect((await trainerA.delete(`/api/workouts/${workoutId}`)).status).toBe(409);
    const dup = await trainerA.post(`/api/workouts/${workoutId}/duplicate`);
    expect(dup.status).toBe(201);
    expect(dup.body.name).toContain('(copy)');
  });
});
