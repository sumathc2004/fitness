// ───────────────────────── Nutrition engine defaults (trainer-configurable per client; Phase 3)
// These are *starting points* drawn from commonly used sports-nutrition guidance, not medical advice.
export const NUTRITION_DEFAULTS = {
  /** Fraction of maintenance calories added/removed per goal. */
  calorieAdjustPct: { FAT_LOSS: -0.2, RECOMPOSITION: -0.05, MUSCLE_BUILDING: 0.1 },
  /** Allowed trainer overrides (UI clamps to these). */
  calorieAdjustRange: [-0.35, 0.25],
  /** Protein grams per kg of body weight, by goal. */
  proteinPerKg: { FAT_LOSS: 2.0, RECOMPOSITION: 2.0, MUSCLE_BUILDING: 1.8 },
  proteinPerKgRange: [1.2, 3.0],
  /** Share of total calories coming from fat. */
  fatPct: { FAT_LOSS: 0.27, RECOMPOSITION: 0.28, MUSCLE_BUILDING: 0.25 },
  fatPctRange: [0.2, 0.4],
  /** Grams of fibre per 1000 kcal. */
  fiberPer1000Kcal: 14,
  /** Millilitres of water per kg of body weight. */
  waterMlPerKg: 35,
  /** Activity multipliers applied to BMR to estimate maintenance calories. */
  activityMultiplier: { SEDENTARY: 1.2, LIGHT: 1.375, MODERATE: 1.55, ACTIVE: 1.725, VERY_ACTIVE: 1.9 },
} as const;

