/**
 * Body-composition and nutrition maths. Pure functions, no I/O — shared by the API (authoritative) and the web (live preview).
 *
 * IMPORTANT: everything here is an ESTIMATE used for coaching. Body-fat from tape measurements (US Navy method) is
 * typically within a few percentage points but is NOT a clinical measurement, and the targets are starting points
 * for a trainer to review — not medical advice.
 */
import { NUTRITION_DEFAULTS } from './defaults';

export type Sex = 'MALE' | 'FEMALE' | 'OTHER';
export type Goal = 'FAT_LOSS' | 'RECOMPOSITION' | 'MUSCLE_BUILDING';
export type Activity = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE';
export type Experience = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export interface NutritionSettings {
  calorieAdjustPct: Record<Goal, number>;
  proteinPerKg: Record<Goal, number>;
  fatPct: Record<Goal, number>;
  fiberPer1000Kcal: number;
  waterMlPerKg: number;
  activityMultiplier: Record<Activity, number>;
  calorieAdjustRange: [number, number];
  proteinPerKgRange: [number, number];
  fatPctRange: [number, number];
}

export const DEFAULT_NUTRITION_SETTINGS: NutritionSettings = {
  calorieAdjustPct: { ...NUTRITION_DEFAULTS.calorieAdjustPct },
  proteinPerKg: { ...NUTRITION_DEFAULTS.proteinPerKg },
  fatPct: { ...NUTRITION_DEFAULTS.fatPct },
  fiberPer1000Kcal: NUTRITION_DEFAULTS.fiberPer1000Kcal,
  waterMlPerKg: NUTRITION_DEFAULTS.waterMlPerKg,
  activityMultiplier: { ...NUTRITION_DEFAULTS.activityMultiplier },
  calorieAdjustRange: [...NUTRITION_DEFAULTS.calorieAdjustRange] as [number, number],
  proteinPerKgRange: [...NUTRITION_DEFAULTS.proteinPerKgRange] as [number, number],
  fatPctRange: [...NUTRITION_DEFAULTS.fatPctRange] as [number, number],
};

const clamp = (v: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, v));
const round = (v: number, d = 0) => Math.round(v * 10 ** d) / 10 ** d;

// ───────────────────────── assessment
export interface AssessmentInput {
  sex: Sex; ageYears: number; heightCm: number; weightKg: number;
  waistCm?: number | null; neckCm?: number | null; hipCm?: number | null; activityLevel: Activity;
}
export interface AssessmentResult {
  bmi: number; bmiCategory: string; bodyFatPct: number | null; fatMassKg: number | null; leanMassKg: number | null;
  bmr: number; maintenanceKcal: number; isEstimate: true; method: 'US_NAVY' | null; notes: string[];
}

export const bmi = (weightKg: number, heightCm: number) => weightKg / (heightCm / 100) ** 2;
export const bmiCategory = (v: number) => (v < 18.5 ? 'Underweight' : v < 25 ? 'Healthy range' : v < 30 ? 'Overweight' : 'Obese');

/** US Navy circumference method (cm). Returns null when the measurements can't produce a valid number. */
export function navyBodyFat(i: { sex: Sex; heightCm: number; waistCm?: number | null; neckCm?: number | null; hipCm?: number | null }): number | null {
  const { heightCm: h, waistCm: w, neckCm: n, hipCm: hip } = i;
  if (!w || !n || !h) return null;
  let v: number;
  if (i.sex === 'FEMALE') {
    if (!hip || w + hip - n <= 0) return null;
    v = 495 / (1.29579 - 0.35004 * Math.log10(w + hip - n) + 0.221 * Math.log10(h)) - 450;
  } else {
    if (w - n <= 0) return null;
    v = 495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(h)) - 450;
  }
  return Number.isFinite(v) && v > 2 && v < 65 ? round(v, 1) : null;
}

/** Mifflin–St Jeor. `OTHER` uses the midpoint of the male/female constants. */
export function mifflinBmr(sex: Sex, weightKg: number, heightCm: number, ageYears: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return base + (sex === 'MALE' ? 5 : sex === 'FEMALE' ? -161 : -78);
}

export function assess(i: AssessmentInput, settings: NutritionSettings = DEFAULT_NUTRITION_SETTINGS): AssessmentResult {
  const notes: string[] = [];
  const b = bmi(i.weightKg, i.heightCm);
  const bf = navyBodyFat(i);
  if (bf == null) notes.push(i.waistCm && i.neckCm ? 'Body fat could not be estimated from those measurements — please re-check them.' : 'Add waist and neck (and hip for women) to estimate body fat.');
  const fat = bf == null ? null : round((bf / 100) * i.weightKg, 1);
  const bmr = mifflinBmr(i.sex, i.weightKg, i.heightCm, i.ageYears);
  return {
    bmi: round(b, 1), bmiCategory: bmiCategory(b), bodyFatPct: bf, fatMassKg: fat, leanMassKg: fat == null ? null : round(i.weightKg - fat, 1),
    bmr: Math.round(bmr), maintenanceKcal: Math.round(bmr * settings.activityMultiplier[i.activityLevel]), isEstimate: true, method: bf == null ? null : 'US_NAVY', notes,
  };
}

// ───────────────────────── targets
export interface TargetOverrides { calorieAdjustPct?: number; proteinPerKg?: number; fatPct?: number; fiberPer1000Kcal?: number }
export interface TargetResult {
  calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; waterMl: number;
  applied: { calorieAdjustPct: number; proteinPerKg: number; fatPct: number; fiberPer1000Kcal: number };
  warnings: string[];
}

export function calculateTargets(
  i: { weightKg: number; maintenanceKcal: number; bmr: number; goal: Goal; sex: Sex },
  settings: NutritionSettings = DEFAULT_NUTRITION_SETTINGS,
  o: TargetOverrides = {},
): TargetResult {
  const adj = clamp(o.calorieAdjustPct ?? settings.calorieAdjustPct[i.goal], settings.calorieAdjustRange);
  const pkg = clamp(o.proteinPerKg ?? settings.proteinPerKg[i.goal], settings.proteinPerKgRange);
  const fatPct = clamp(o.fatPct ?? settings.fatPct[i.goal], settings.fatPctRange);
  const fiber = o.fiberPer1000Kcal ?? settings.fiberPer1000Kcal;
  const calories = Math.round(i.maintenanceKcal * (1 + adj));
  const proteinG = Math.round(i.weightKg * pkg);
  const fatG = Math.round((calories * fatPct) / 9);
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));
  const warnings: string[] = [];
  if (calories < i.bmr) warnings.push('These calories are below the estimated BMR. Keep this short-term and only under trainer supervision.');
  if (calories < (i.sex === 'MALE' ? 1500 : 1200)) warnings.push('Calories are very low. A trainer should review this plan before it is shared.');
  if (carbsG < 80) warnings.push('Carbohydrates are very low for a training plan; consider fewer deficit calories or lower fat share.');
  return {
    calories, proteinG, carbsG, fatG, fiberG: Math.round((calories / 1000) * fiber), waterMl: Math.round(i.weightKg * settings.waterMlPerKg),
    applied: { calorieAdjustPct: adj, proteinPerKg: pkg, fatPct, fiberPer1000Kcal: fiber }, warnings,
  };
}

// ───────────────────────── goal recommendation
export interface RecommendationInput {
  sex: Sex; experience: Experience; currentGoal: Goal | null; bmi: number | null; bodyFatPct: number | null;
  /** kg per week over the last ~4 weeks (negative = losing). null when there is not enough data. */
  weightTrendKgPerWeek: number | null;
  /** % change in estimated strength over the last ~4–8 weeks. null when unknown. */
  strengthTrendPct: number | null;
  weightKg: number | null;
}
export interface Recommendation {
  needsData: boolean;
  goal: Goal | null;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  reasons: string[];
  disclaimer: string;
}

const BF_BANDS = { MALE: { lean: 14, high: 24 }, FEMALE: { lean: 22, high: 32 }, OTHER: { lean: 18, high: 28 } } as const;
export const RECOMMENDATION_DISCLAIMER = 'This is coaching guidance based on estimates, not a medical diagnosis. Your trainer reviews it with you.';

export function recommendGoal(i: RecommendationInput): Recommendation {
  const reasons: string[] = [];
  if (i.bodyFatPct == null && i.bmi == null) {
    return { needsData: true, goal: null, confidence: 'LOW', reasons: ['Complete a body analysis (height, weight, waist and neck) to get a recommendation.'], disclaimer: RECOMMENDATION_DISCLAIMER };
  }
  const band = BF_BANDS[i.sex];
  let goal: Goal;
  let confidence: Recommendation['confidence'] = i.bodyFatPct != null ? 'MEDIUM' : 'LOW';

  if (i.bodyFatPct != null) {
    if (i.bodyFatPct >= band.high) {
      goal = 'FAT_LOSS';
      reasons.push(`Estimated body fat (${i.bodyFatPct}%) is above the ${band.high}% mark where reducing fat first usually pays off most.`);
    } else if (i.bodyFatPct <= band.lean) {
      goal = 'MUSCLE_BUILDING';
      reasons.push(`Estimated body fat (${i.bodyFatPct}%) is already lean (under ${band.lean}%), so a small calorie surplus can build muscle without much fat gain.`);
    } else {
      goal = 'RECOMPOSITION';
      reasons.push(`Estimated body fat (${i.bodyFatPct}%) is in the middle range — a good place to lose fat and gain muscle together.`);
    }
  } else {
    const b = i.bmi!;
    goal = b >= 28 ? 'FAT_LOSS' : b < 20 ? 'MUSCLE_BUILDING' : 'RECOMPOSITION';
    reasons.push(`Based on BMI (${round(b, 1)}) only — add waist and neck measurements for a better estimate.`);
  }

  // Training status
  if (i.experience === 'BEGINNER') {
    reasons.push('Beginners respond quickly to resistance training, which favours recomposition.');
    if (goal === 'MUSCLE_BUILDING' && i.bodyFatPct != null && i.bodyFatPct > band.lean - 2) goal = 'RECOMPOSITION';
  } else if (i.experience === 'ADVANCED' && goal === 'RECOMPOSITION') {
    reasons.push('Advanced lifters usually progress faster by focusing on one direction at a time.');
  }

  // Weight trend
  if (i.weightTrendKgPerWeek != null && i.weightKg) {
    const pctPerWeek = (i.weightTrendKgPerWeek / i.weightKg) * 100;
    if (pctPerWeek <= -1) {
      reasons.push(`Weight is falling quickly (${round(i.weightTrendKgPerWeek, 2)} kg/week) — protect muscle and avoid cutting harder.`);
      if (goal === 'FAT_LOSS') goal = 'RECOMPOSITION';
      if (i.bodyFatPct != null && i.bodyFatPct <= band.lean) goal = 'MUSCLE_BUILDING';
    } else if (pctPerWeek >= 0.5 && goal !== 'MUSCLE_BUILDING') {
      reasons.push(`Weight is rising (${round(i.weightTrendKgPerWeek, 2)} kg/week) while the goal is not to gain.`);
      if (i.bodyFatPct != null && i.bodyFatPct >= band.high) goal = 'FAT_LOSS';
    } else {
      reasons.push(`Weight trend is stable (${round(i.weightTrendKgPerWeek, 2)} kg/week).`);
    }
    confidence = confidence === 'LOW' ? 'LOW' : 'HIGH';
  }

  // Strength trend
  if (i.strengthTrendPct != null) {
    if (i.strengthTrendPct >= 3) reasons.push(`Strength is improving (+${round(i.strengthTrendPct, 1)}%), a sign the current training is working.`);
    else if (i.strengthTrendPct <= -3) { reasons.push(`Strength has dropped (${round(i.strengthTrendPct, 1)}%) — avoid a larger deficit.`); if (goal === 'FAT_LOSS') goal = 'RECOMPOSITION'; }
    else reasons.push('Strength is steady.');
  }

  if (i.currentGoal && i.currentGoal === goal) reasons.push('This matches the current goal — no change needed.');
  return { needsData: false, goal, confidence, reasons, disclaimer: RECOMMENDATION_DISCLAIMER };
}

/** Rough weekly weight trend (least-squares slope) from dated weigh-ins; null with fewer than 3 points over ≥ 7 days. */
export function weightTrend(points: Array<{ date: Date; weightKg: number }>): number | null {
  if (points.length < 3) return null;
  const sorted = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());
  const span = (sorted[sorted.length - 1]!.date.getTime() - sorted[0]!.date.getTime()) / 86_400_000;
  if (span < 7) return null;
  const t0 = sorted[0]!.date.getTime();
  const xs = sorted.map((p) => (p.date.getTime() - t0) / (7 * 86_400_000));
  const ys = sorted.map((p) => p.weightKg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  return den === 0 ? null : round(xs.reduce((s, x, k) => s + (x - mx) * (ys[k]! - my), 0) / den, 2);
}

/** Epley estimated one-rep max. */
export const estimate1RM = (weightKg: number, reps: number) => (reps <= 1 ? weightKg : weightKg * (1 + reps / 30));
