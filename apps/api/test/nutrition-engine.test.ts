import { describe, expect, it } from 'vitest';
import { DEFAULT_NUTRITION_SETTINGS, assess, bmi, calculateTargets, estimate1RM, navyBodyFat, recommendGoal, weightTrend } from '@gym/config';

describe('body composition (US Navy, estimated)', () => {
  it('matches the published formula for a typical man', () => {
    // 180 cm, waist 90, neck 38 → 495 / 1.0536 − 450 = 19.8 %
    const bf = navyBodyFat({ sex: 'MALE', heightCm: 180, waistCm: 90, neckCm: 38 })!;
    expect(bf).toBeCloseTo(19.8, 1);
  });
  it('needs hip for women and rejects impossible measurements', () => {
    expect(navyBodyFat({ sex: 'FEMALE', heightCm: 165, waistCm: 75, neckCm: 32 })).toBeNull();
    const f = navyBodyFat({ sex: 'FEMALE', heightCm: 165, waistCm: 75, neckCm: 32, hipCm: 100 })!;
    expect(f).toBeGreaterThan(24);
    expect(f).toBeLessThan(33);
    expect(navyBodyFat({ sex: 'MALE', heightCm: 180, waistCm: 30, neckCm: 40 })).toBeNull();
  });
  it('returns an honest, labelled assessment', () => {
    const a = assess({ sex: 'MALE', ageYears: 30, heightCm: 180, weightKg: 80, waistCm: 90, neckCm: 38, activityLevel: 'MODERATE' });
    expect(a.isEstimate).toBe(true);
    expect(a.method).toBe('US_NAVY');
    expect(a.bmi).toBeCloseTo(24.7, 1);
    expect(a.leanMassKg! + a.fatMassKg!).toBeCloseTo(80, 0);
    expect(a.bmr).toBe(Math.round(10 * 80 + 6.25 * 180 - 5 * 30 + 5));
    expect(a.maintenanceKcal).toBe(Math.round(a.bmr * 1.55));
    const noBf = assess({ sex: 'MALE', ageYears: 30, heightCm: 180, weightKg: 80, activityLevel: 'LIGHT' });
    expect(noBf.bodyFatPct).toBeNull();
    expect(noBf.notes[0]).toMatch(/waist and neck/);
  });
  it('bmi helper', () => expect(bmi(70, 175)).toBeCloseTo(22.86, 2));
});

describe('nutrition targets', () => {
  const base = { weightKg: 80, maintenanceKcal: 2600, bmr: 1800, goal: 'FAT_LOSS' as const, sex: 'MALE' as const };
  it('applies the goal defaults and macros add up to the calories', () => {
    const t = calculateTargets(base);
    expect(t.calories).toBe(Math.round(2600 * 0.8));
    expect(t.proteinG).toBe(160);
    const kcal = t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9;
    expect(Math.abs(kcal - t.calories)).toBeLessThan(15);
    expect(t.fiberG).toBe(Math.round((t.calories / 1000) * 14));
    expect(t.waterMl).toBe(2800);
  });
  it('lets a trainer override within the configured ranges (and clamps outside them)', () => {
    const t = calculateTargets(base, DEFAULT_NUTRITION_SETTINGS, { calorieAdjustPct: -0.1, proteinPerKg: 2.4, fatPct: 0.3 });
    expect(t.calories).toBe(2340);
    expect(t.proteinG).toBe(192);
    const wild = calculateTargets(base, DEFAULT_NUTRITION_SETTINGS, { calorieAdjustPct: -0.9, proteinPerKg: 9, fatPct: 0.9 });
    expect(wild.applied).toMatchObject({ calorieAdjustPct: -0.35, proteinPerKg: 3, fatPct: 0.4 });
  });
  it('warns when calories fall below BMR', () => {
    const t = calculateTargets({ ...base, maintenanceKcal: 2000 }, DEFAULT_NUTRITION_SETTINGS, { calorieAdjustPct: -0.3 });
    expect(t.warnings.some((w) => /below the estimated BMR/.test(w))).toBe(true);
  });
  it('muscle building gives a surplus', () => {
    expect(calculateTargets({ ...base, goal: 'MUSCLE_BUILDING' }).calories).toBeGreaterThan(2600);
  });
});

describe('goal recommendation engine', () => {
  const m = { sex: 'MALE' as const, experience: 'INTERMEDIATE' as const, currentGoal: null, bmi: 26, weightKg: 85, weightTrendKgPerWeek: null, strengthTrendPct: null };
  it('asks for data instead of guessing', () => {
    expect(recommendGoal({ ...m, bmi: null, bodyFatPct: null }).needsData).toBe(true);
  });
  it('high body fat → fat loss, with reasons', () => {
    const r = recommendGoal({ ...m, bodyFatPct: 28 });
    expect(r.goal).toBe('FAT_LOSS');
    expect(r.reasons[0]).toMatch(/28%/);
    expect(r.disclaimer).toMatch(/not a medical diagnosis/);
  });
  it('middle band → recomposition; lean → muscle building', () => {
    expect(recommendGoal({ ...m, bodyFatPct: 19 }).goal).toBe('RECOMPOSITION');
    expect(recommendGoal({ ...m, bodyFatPct: 11 }).goal).toBe('MUSCLE_BUILDING');
  });
  it('uses sex-specific bands', () => {
    expect(recommendGoal({ ...m, sex: 'FEMALE', bodyFatPct: 28 }).goal).toBe('RECOMPOSITION');
    expect(recommendGoal({ ...m, sex: 'FEMALE', bodyFatPct: 34 }).goal).toBe('FAT_LOSS');
  });
  it('very fast weight loss softens a fat-loss call, falling strength too', () => {
    expect(recommendGoal({ ...m, bodyFatPct: 28, weightTrendKgPerWeek: -1.2 }).goal).toBe('RECOMPOSITION');
    expect(recommendGoal({ ...m, bodyFatPct: 28, strengthTrendPct: -6 }).goal).toBe('RECOMPOSITION');
  });
  it('beginners that are only borderline lean are steered to recomposition', () => {
    expect(recommendGoal({ ...m, experience: 'BEGINNER', bodyFatPct: 13 }).goal).toBe('RECOMPOSITION');
  });
  it('falls back to BMI (low confidence) when body fat is unknown', () => {
    const r = recommendGoal({ ...m, bmi: 31, bodyFatPct: null });
    expect(r.goal).toBe('FAT_LOSS');
    expect(r.confidence).toBe('LOW');
  });
});

describe('trends', () => {
  const d = (n: number) => new Date(Date.UTC(2026, 0, 1 + n));
  it('weekly weight slope', () => {
    expect(weightTrend([{ date: d(0), weightKg: 90 }, { date: d(7), weightKg: 89 }, { date: d(14), weightKg: 88 }, { date: d(21), weightKg: 87 }])).toBe(-1);
  });
  it('needs enough points and time', () => {
    expect(weightTrend([{ date: d(0), weightKg: 90 }, { date: d(2), weightKg: 89 }])).toBeNull();
    expect(weightTrend([{ date: d(0), weightKg: 90 }, { date: d(1), weightKg: 89 }, { date: d(2), weightKg: 88 }])).toBeNull();
  });
  it('Epley 1RM', () => {
    expect(estimate1RM(100, 1)).toBe(100);
    expect(estimate1RM(100, 10)).toBeCloseTo(133.3, 1);
  });
});
