import { Router } from 'express';
import { z } from 'zod';
import { assessmentInputSchema, assignDietSchema, calculateInputSchema, decisionSchema, dietInputSchema, dietLogInputSchema, foodInputSchema, mealLogInputSchema, nutritionSettingsSchema, profileInputSchema, saveTargetSchema } from '@gym/types';
import type { AssessmentInputDto, CalculateInput, DietInput, FoodInput, MealLogInput, SaveTargetInput } from '@gym/types';
import type { NutritionSettings } from '@gym/config';
import { authenticate, requirePermission, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import * as diets from '../services/diet.service';
import * as foods from '../services/food.service';
import * as meals from '../services/meal.service';
import * as nutrition from '../services/nutrition.service';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const today = () => new Date().toISOString().slice(0, 10);
const id = (v: unknown) => String(v);

// ─────────────────────────────────────────── /api/foods
export const foodsRouter = Router();
foodsRouter.use(authenticate);
foodsRouter.get('/', requirePermission('foods:read'), async (req, res) => {
  const q = z.object({ q: z.string().trim().max(80).optional(), category: z.string().trim().max(40).optional(), limit: z.coerce.number().int().min(1).max(200).default(60) }).parse(req.query);
  res.json(await foods.listFoods(q));
});
foodsRouter.post('/', requirePermission('foods:manage'), validate(foodInputSchema), async (req, res) => { res.status(201).json(await foods.createFood(req, req.body as FoodInput)); });
foodsRouter.get('/:id', requirePermission('foods:read'), async (req, res) => { res.json(await foods.getFood(id(req.params.id))); });
foodsRouter.put('/:id', requirePermission('foods:manage'), validate(foodInputSchema), async (req, res) => { res.json(await foods.updateFood(req, id(req.params.id), req.body as FoodInput)); });
foodsRouter.delete('/:id', requirePermission('foods:manage'), async (req, res) => { await foods.removeFood(req, id(req.params.id)); res.json({ ok: true }); });

// ─────────────────────────────────────────── /api/diets
export const dietsRouter = Router();
dietsRouter.use(authenticate);
dietsRouter.get('/', async (req, res) => {
  const q = z.object({ clientId: z.string().optional(), template: z.enum(['true', 'false']).optional().transform((v) => (v === undefined ? undefined : v === 'true')) }).parse(req.query);
  res.json({ items: await diets.listDiets(req, q) });
});
dietsRouter.post('/', requirePermission('diets:manage'), validate(dietInputSchema), async (req, res) => { res.status(201).json(await diets.createDiet(req, req.body as DietInput)); });
dietsRouter.get('/:id', async (req, res) => { res.json(await diets.getDiet(req, id(req.params.id))); });
dietsRouter.put('/:id', requirePermission('diets:manage'), validate(dietInputSchema), async (req, res) => { res.json(await diets.updateDiet(req, id(req.params.id), req.body as DietInput)); });
dietsRouter.delete('/:id', requirePermission('diets:manage'), async (req, res) => { res.json(await diets.deleteDiet(req, id(req.params.id))); });
dietsRouter.post('/:id/activate', requirePermission('diets:manage'), async (req, res) => { res.json(await diets.activateDiet(req, id(req.params.id))); });
dietsRouter.post('/:id/assign', requirePermission('diets:manage'), validate(assignDietSchema), async (req, res) => {
  const b = req.body as { clientIds: string[]; startDate: string };
  res.status(201).json({ items: await diets.assignDiet(req, id(req.params.id), b.clientIds, b.startDate) });
});

// ─────────────────────────────────────────── /api/diet-logs  and  /api/meals  (client logging)
export const dietLogsRouter = Router();
dietLogsRouter.use(authenticate);
dietLogsRouter.get('/', async (req, res) => {
  const q = z.object({ clientId: z.string().optional(), date: date.default(today) }).parse(req.query);
  res.json(await meals.getDailyNutrition(req, nutrition.resolveClientId(req, q.clientId), q.date));
});
dietLogsRouter.put('/', requirePermission('diets:log'), validate(dietLogInputSchema), async (req, res) => {
  res.json(await meals.setDietLog(req, req.body as { dietMealId: string; date: string; status: 'COMPLETED' | 'SKIPPED' | 'PENDING' }));
});

export const mealsRouter = Router();
mealsRouter.use(authenticate);
mealsRouter.get('/', async (req, res) => {
  const q = z.object({ clientId: z.string().optional(), date: date.default(today) }).parse(req.query);
  res.json(await meals.getDailyNutrition(req, nutrition.resolveClientId(req, q.clientId), q.date));
});
mealsRouter.post('/', requirePermission('diets:log'), validate(mealLogInputSchema), async (req, res) => { res.status(201).json(await meals.logCustomMeal(req, req.body as MealLogInput)); });
mealsRouter.delete('/:id', requirePermission('diets:log'), async (req, res) => { res.json(await meals.deleteCustomMeal(req, id(req.params.id))); });

// ─────────────────────────────────────────── /api/nutrition
export const nutritionRouter = Router();
nutritionRouter.use(authenticate);
nutritionRouter.get('/daily', async (req, res) => {
  const q = z.object({ clientId: z.string().optional(), date: date.default(today) }).parse(req.query);
  res.json(await meals.getDailyNutrition(req, nutrition.resolveClientId(req, q.clientId), q.date));
});
nutritionRouter.get('/settings', requirePermission('nutrition:calculate'), async (_req, res) => { res.json(await nutrition.getNutritionSettings()); });
nutritionRouter.put('/settings', requireRole('SUPER_ADMIN'), validate(nutritionSettingsSchema), async (req, res) => { res.json(await nutrition.saveNutritionSettings(req, req.body as NutritionSettings)); });
nutritionRouter.post('/calculate', requirePermission('nutrition:calculate'), validate(calculateInputSchema), async (req, res) => { res.json(await nutrition.calculate(req, req.body as CalculateInput)); });
nutritionRouter.get('/targets', requirePermission('nutrition:calculate'), async (req, res) => {
  const q = z.object({ clientId: z.string().optional() }).parse(req.query);
  res.json(await nutrition.getTargets(req, nutrition.resolveClientId(req, q.clientId)));
});
nutritionRouter.post('/targets', requirePermission('nutrition:configure'), validate(saveTargetSchema), async (req, res) => { res.status(201).json(await nutrition.saveTarget(req, req.body as SaveTargetInput)); });
nutritionRouter.post('/recommendation', requirePermission('nutrition:calculate'), validate(z.object({ clientId: z.string().optional() })), async (req, res) => {
  res.status(201).json(await nutrition.createRecommendation(req, nutrition.resolveClientId(req, (req.body as { clientId?: string }).clientId)));
});
nutritionRouter.get('/recommendation', requirePermission('nutrition:calculate'), async (req, res) => {
  const q = z.object({ clientId: z.string().optional() }).parse(req.query);
  res.json({ recommendation: await nutrition.latestRecommendation(req, nutrition.resolveClientId(req, q.clientId)) });
});
nutritionRouter.post('/recommendation/:id/decision', requirePermission('nutrition:calculate'), validate(decisionSchema), async (req, res) => {
  res.json(await nutrition.decideRecommendation(req, id(req.params.id), (req.body as { decision: 'ACCEPT' | 'TRAINER_REVIEW' | 'DISMISS' }).decision));
});

// ─────────────────────────────────────────── /api/body-analysis
export const bodyAnalysisRouter = Router();
bodyAnalysisRouter.use(authenticate);
bodyAnalysisRouter.get('/profile', async (req, res) => {
  const q = z.object({ clientId: z.string().optional() }).parse(req.query);
  res.json({ profile: await nutrition.getProfile(req, nutrition.resolveClientId(req, q.clientId)) });
});
bodyAnalysisRouter.put('/profile', requirePermission('body:manage'), validate(profileInputSchema), async (req, res) => {
  const q = z.object({ clientId: z.string() }).parse(req.query);
  res.json({ profile: await nutrition.saveProfile(req, q.clientId, req.body as Parameters<typeof nutrition.saveProfile>[2]) });
});
bodyAnalysisRouter.post('/assess', validate(assessmentInputSchema), async (req, res) => { res.status(201).json(await nutrition.runAssessment(req, req.body as AssessmentInputDto)); });
bodyAnalysisRouter.get('/assessments', async (req, res) => {
  const q = z.object({ clientId: z.string().optional() }).parse(req.query);
  res.json({ items: await nutrition.listAssessments(req, nutrition.resolveClientId(req, q.clientId)) });
});
