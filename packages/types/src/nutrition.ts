import { z } from 'zod';
import { activityLevelSchema, experienceSchema, goalSchema, sexSchema } from './people';

export const mealTypeSchema = z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'PRE_WORKOUT', 'POST_WORKOUT', 'CUSTOM']);
export type MealType = z.infer<typeof mealTypeSchema>;
const macro = z.coerce.number().min(0).max(5000);

// ───────────────────────── foods
export const servingInputSchema = z.object({
  label: z.string().trim().min(1).max(60), grams: z.coerce.number().min(0).max(5000).nullable().optional(),
  calories: macro, proteinG: macro, carbsG: macro, fatG: macro, fiberG: macro.default(0), isDefault: z.boolean().default(false),
});
export const foodInputSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(100), category: z.string().trim().max(40).optional(), cuisine: z.string().trim().max(40).optional(), brand: z.string().trim().max(60).optional(),
  servings: z.array(servingInputSchema).min(1, 'Add at least one serving size').max(8),
});
export type FoodInput = z.infer<typeof foodInputSchema>;
export interface ServingDto { id: string; label: string; grams: number | null; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; isDefault: boolean }
export interface FoodDto { id: string; name: string; category: string | null; cuisine: string | null; brand: string | null; isCustom: boolean; servings: ServingDto[] }

// ───────────────────────── diet plans
export const dietItemInputSchema = z.object({
  foodItemId: z.string().optional(), foodServingId: z.string().optional(), customName: z.string().trim().max(100).optional(),
  quantity: z.coerce.number().min(0.1).max(50).default(1),
  calories: macro.optional(), proteinG: macro.optional(), carbsG: macro.optional(), fatG: macro.optional(), fiberG: macro.optional(),
}).refine((i) => i.foodServingId || (i.customName && i.calories !== undefined), { message: 'Pick a food serving, or enter a name and calories', path: ['foodServingId'] });
export const dietMealInputSchema = z.object({
  id: z.string().optional(), mealType: mealTypeSchema, name: z.string().trim().min(1).max(60), timeOfDay: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(), notes: z.string().trim().max(500).nullable().optional(),
  items: z.array(dietItemInputSchema).min(1, 'Add at least one food to each meal').max(25),
});
export const dietInputSchema = z.object({
  name: z.string().trim().min(2).max(80), clientId: z.string().optional(), isTemplate: z.boolean().default(false), targetId: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), notes: z.string().trim().max(1000).optional(),
  meals: z.array(dietMealInputSchema).min(1, 'Add at least one meal').max(12),
});
export type DietInput = z.infer<typeof dietInputSchema>;
export const assignDietSchema = z.object({ clientIds: z.array(z.string()).min(1).max(100), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export interface Macros { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number }
export interface DietItemDto extends Macros { id: string; name: string; quantity: number; servingLabel: string | null; foodItemId: string | null; foodServingId: string | null }
export interface DietMealDto { id: string; mealType: MealType; name: string; timeOfDay: string | null; order: number; notes: string | null; items: DietItemDto[]; totals: Macros }
export interface DietDto {
  id: string; name: string; clientId: string | null; clientName: string | null; isTemplate: boolean; status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'; startDate: string | null; notes: string | null;
  targetId: string | null; meals: DietMealDto[]; totals: Macros; createdAt: string;
}
export interface DietSummary { id: string; name: string; clientId: string | null; clientName: string | null; isTemplate: boolean; status: DietDto['status']; mealCount: number; calories: number; startDate: string | null }

// ───────────────────────── logging
export const dietLogInputSchema = z.object({ dietMealId: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), status: z.enum(['COMPLETED', 'SKIPPED', 'PENDING']) });
export const mealLogInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), mealType: mealTypeSchema, notes: z.string().trim().max(300).optional(),
  items: z.array(dietItemInputSchema).min(1).max(25),
});
export type MealLogInput = z.infer<typeof mealLogInputSchema>;

export interface DailyMealDto {
  key: string; dietMealId: string | null; mealLogId: string | null; mealType: MealType; name: string; timeOfDay: string | null;
  status: 'PENDING' | 'COMPLETED' | 'SKIPPED'; planned: Macros | null; consumed: Macros; custom: boolean;
}
export interface DailyNutritionDto { date: string; clientId: string; target: (Macros & { waterMl: number | null }) | null; consumed: Macros; planName: string | null; meals: DailyMealDto[] }

// ───────────────────────── body analysis & targets
const opt = (min: number, max: number) => z.coerce.number().min(min).max(max).nullable().optional();
export const profileInputSchema = z.object({
  sex: sexSchema, heightCm: z.coerce.number().min(100).max(250), activityLevel: activityLevelSchema, trainingExperience: experienceSchema, goal: goalSchema, injuries: z.string().trim().max(1000).optional(),
});
export const assessmentInputSchema = z.object({
  clientId: z.string().optional(), weightKg: z.coerce.number().min(25).max(350),
  heightCm: opt(100, 250), ageYears: opt(10, 100), sex: sexSchema.optional(), activityLevel: activityLevelSchema.optional(),
  waistCm: opt(40, 250), neckCm: opt(20, 80), hipCm: opt(50, 250), saveMeasurement: z.boolean().default(true),
});
export type AssessmentInputDto = z.infer<typeof assessmentInputSchema>;

export interface AssessmentDto {
  id: string | null; assessedAt: string; weightKg: number; heightCm: number; ageYears: number; sex: string; activityLevel: string;
  bmi: number; bmiCategory: string; bodyFatPct: number | null; fatMassKg: number | null; leanMassKg: number | null; bmr: number; maintenanceKcal: number;
  isEstimate: true; method: 'US_NAVY' | null; notes: string[]; waistCm: number | null; neckCm: number | null; hipCm: number | null;
}

const overrides = z.object({ calorieAdjustPct: z.coerce.number().optional(), proteinPerKg: z.coerce.number().optional(), fatPct: z.coerce.number().optional(), fiberPer1000Kcal: z.coerce.number().optional() });
export const calculateInputSchema = z.object({
  clientId: z.string().optional(), goal: goalSchema.optional(), overrides: overrides.default({}),
  weightKg: z.coerce.number().min(25).max(350).optional(), heightCm: z.coerce.number().min(100).max(250).optional(), ageYears: z.coerce.number().min(10).max(100).optional(),
  sex: sexSchema.optional(), activityLevel: activityLevelSchema.optional(), waistCm: opt(40, 250), neckCm: opt(20, 80), hipCm: opt(50, 250),
});
export type CalculateInput = z.infer<typeof calculateInputSchema>;
export interface TargetDto { id: string; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; waterMl: number | null; source: 'CALCULATED' | 'TRAINER'; isActive: boolean; effectiveFrom: string }
export interface CalculationDto {
  goal: z.infer<typeof goalSchema>; assessment: AssessmentDto;
  targets: Macros & { waterMl: number; applied: { calorieAdjustPct: number; proteinPerKg: number; fatPct: number; fiberPer1000Kcal: number }; warnings: string[] };
}
export const saveTargetSchema = z.object({
  clientId: z.string(), calories: z.coerce.number().min(800).max(8000), proteinG: z.coerce.number().min(0).max(600), carbsG: z.coerce.number().min(0).max(1200),
  fatG: z.coerce.number().min(0).max(400), fiberG: z.coerce.number().min(0).max(120), waterMl: z.coerce.number().min(500).max(8000).optional(),
  source: z.enum(['CALCULATED', 'TRAINER']).default('TRAINER'), rationale: z.record(z.unknown()).optional(),
});
export type SaveTargetInput = z.infer<typeof saveTargetSchema>;

export const nutritionSettingsSchema = z.object({
  calorieAdjustPct: z.object({ FAT_LOSS: z.number().min(-0.5).max(0.3), RECOMPOSITION: z.number().min(-0.5).max(0.3), MUSCLE_BUILDING: z.number().min(-0.5).max(0.3) }),
  proteinPerKg: z.object({ FAT_LOSS: z.number().min(0.8).max(3.5), RECOMPOSITION: z.number().min(0.8).max(3.5), MUSCLE_BUILDING: z.number().min(0.8).max(3.5) }),
  fatPct: z.object({ FAT_LOSS: z.number().min(0.15).max(0.45), RECOMPOSITION: z.number().min(0.15).max(0.45), MUSCLE_BUILDING: z.number().min(0.15).max(0.45) }),
  fiberPer1000Kcal: z.number().min(8).max(25), waterMlPerKg: z.number().min(20).max(60),
  activityMultiplier: z.object({ SEDENTARY: z.number().min(1).max(1.5), LIGHT: z.number().min(1.1).max(1.7), MODERATE: z.number().min(1.2).max(1.9), ACTIVE: z.number().min(1.4).max(2.1), VERY_ACTIVE: z.number().min(1.5).max(2.4) }),
  calorieAdjustRange: z.tuple([z.number().min(-0.6).max(0), z.number().min(0).max(0.4)]),
  proteinPerKgRange: z.tuple([z.number().min(0.5).max(2), z.number().min(2).max(4)]),
  fatPctRange: z.tuple([z.number().min(0.1).max(0.3), z.number().min(0.3).max(0.5)]),
});

export interface RecommendationDto {
  id: string | null; needsData: boolean; goal: z.infer<typeof goalSchema> | null; currentGoal: z.infer<typeof goalSchema> | null; confidence: 'LOW' | 'MEDIUM' | 'HIGH'; reasons: string[]; disclaimer: string;
  status: 'PENDING' | 'ACCEPTED' | 'TRAINER_REVIEW' | 'DISMISSED' | null; createdAt: string | null;
}
export const decisionSchema = z.object({ decision: z.enum(['ACCEPT', 'TRAINER_REVIEW', 'DISMISS']) });
