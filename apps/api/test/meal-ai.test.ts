import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUser, loggedInAgent, resetDb } from './helpers';

// The real Claude call is replaced; these tests cover our route, validation, mapping and error handling.
const claude = vi.hoisted(() => ({
  configured: true,
  estimate: vi.fn(),
}));
vi.mock('../src/lib/claude', async (orig) => {
  const actual = await orig<typeof import('../src/lib/claude')>();
  return { ...actual, isClaudeConfigured: () => claude.configured, estimateMeal: claude.estimate };
});

type A = Awaited<ReturnType<typeof loggedInAgent>>;
let clientA: A, trainerA: A;

beforeAll(async () => {
  await resetDb();
  const client = await createUser('CLIENT');
  const trainer = await createUser('TRAINER');
  clientA = await loggedInAgent(client.email);
  trainerA = await loggedInAgent(trainer.email);
});
beforeEach(() => { claude.configured = true; claude.estimate.mockReset(); });

describe('AI meal analysis', () => {
  it('turns free text into itemised macros with totals, clamping silly values', async () => {
    claude.estimate.mockResolvedValue({
      notFood: false,
      note: 'Assumed dal cooked with 1 tsp ghee.',
      items: [
        { name: 'Cooked white rice', portion: '1 cup (~160 g)', calories: 205.4, proteinG: 4.26, carbsG: 44.5, fatG: 0.44, fiberG: 0.6 },
        { name: 'Toor dal', portion: '1 katori (~150 g)', calories: 180, proteinG: 9, carbsG: 25, fatG: 5, fiberG: -2 },
      ],
    });
    const res = await clientA.post('/api/meals/analyze').send({ text: 'rice + dal' });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({ name: 'Cooked white rice', calories: 205, proteinG: 4.3 });
    expect(res.body.items[1].fiberG).toBe(0); // negative clamped
    expect(res.body.totals).toEqual({ calories: 385, proteinG: 13.3, carbsG: 69.5, fatG: 5.4, fiberG: 0.6 });
    expect(res.body.note).toBe('Assumed dal cooked with 1 tsp ghee.');
    // the user's words reach the model; the gym's food list is in the system prompt
    const [system, user] = claude.estimate.mock.calls[0]!;
    expect(user).toContain('rice + dal');
    expect(system).toContain('Gym food reference');
  });

  it('the analysed items can be logged as an extra meal', async () => {
    const res = await clientA.post('/api/meals').send({
      date: new Date().toISOString().slice(0, 10), mealType: 'SNACK',
      items: [{ customName: 'Cooked white rice', quantity: 1, calories: 205, proteinG: 4.3, carbsG: 44.5, fatG: 0.4, fiberG: 0.6 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.consumed.calories).toBeGreaterThanOrEqual(205);
  });

  it('rejects empty or overly long text before calling the model', async () => {
    expect((await clientA.post('/api/meals/analyze').send({ text: ' ' })).status).toBe(400);
    expect((await clientA.post('/api/meals/analyze').send({ text: 'x'.repeat(601) })).status).toBe(400);
    expect(claude.estimate).not.toHaveBeenCalled();
  });

  it('says clearly when the text is not food, the model declines, or AI is not configured', async () => {
    claude.estimate.mockResolvedValue({ notFood: true, items: [], note: '' });
    const notFood = await clientA.post('/api/meals/analyze').send({ text: 'what is the weather' });
    expect(notFood.status).toBe(422);
    expect(notFood.body.error.code).toBe('NOT_FOOD');

    const { ClaudeRefusalError } = await import('../src/lib/claude');
    claude.estimate.mockRejectedValue(new ClaudeRefusalError('declined'));
    expect((await clientA.post('/api/meals/analyze').send({ text: 'something odd' })).body.error.code).toBe('AI_DECLINED');

    claude.configured = false;
    const off = await clientA.post('/api/meals/analyze').send({ text: '2 rotis' });
    expect(off.status).toBe(503);
    expect(off.body.error.code).toBe('AI_NOT_CONFIGURED');
  });

  it('needs a login and the meal-logging permission', async () => {
    const { default: request } = await import('supertest');
    const { app } = await import('./helpers');
    expect((await request(app).post('/api/meals/analyze').send({ text: 'rice' })).status).toBe(401);
    expect((await trainerA.post('/api/meals/analyze').send({ text: 'rice' })).status).toBe(403);
  });
});
