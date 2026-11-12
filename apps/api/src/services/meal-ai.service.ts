import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@gym/database';
import type { AnalysedMealItem, MealAnalysisDto } from '@gym/types';
import { AppError, tooMany } from '../lib/errors';
import { ClaudeRefusalError, estimateMeal, isClaudeConfigured } from '../lib/claude';
import { logger } from '../lib/logger';

/**
 * "Tell us what you ate" → itemised calories and macros, estimated by Claude.
 * The gym's own food database is given as a reference so known foods match the numbers used everywhere else.
 * Nothing is saved here: the client reviews the items and then logs them as an extra meal.
 */


const r1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, max: number) => (Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0);

const INSTRUCTIONS = `You estimate the nutrition of a meal for a gym's fitness app. A client describes, in their own words, what they ate.

For each distinct food or drink, give the portion you assumed and the calories, protein, carbohydrate, fat and fibre for that portion.
- Use the client's quantities. When a quantity is missing, assume one typical serving and say so in the portion.
- Clients are mostly in India: assume home-style Indian preparation unless they say otherwise (1 roti/chapati ≈ 40 g, 1 katori ≈ 150 g, 1 bowl of rice ≈ 1 cup cooked ≈ 160 g, 1 glass ≈ 250 ml).
- When a food matches the gym's reference list below, use its values (scaled to the portion) so numbers stay consistent across the app.
- Split combined dishes into their parts when the client lists them ("rice and dal" → two items); keep a single named dish as one item.
- Calories as whole numbers; grams to one decimal place.
- If the text is not about food or drink the client consumed, set notFood to true and return no items.
- Use the note for the single most important assumption (e.g. cooking oil, portion size), or leave it empty. Give no medical or dietary advice.`;

async function referenceTable(): Promise<string> {
  const foods = await prisma.foodItem.findMany({
    where: { isActive: true, isCustom: false },
    include: { servings: { where: { isDefault: true }, take: 1 } },
    orderBy: { name: 'asc' },
    take: 200,
  });
  return foods
    .filter((f) => f.servings[0])
    .map((f) => { const s = f.servings[0]!; return `${f.name} | ${s.label} | ${Math.round(s.calories)} kcal | P ${s.proteinG} | C ${s.carbsG} | F ${s.fatG} | fibre ${s.fiberG}`; })
    .join('\n');
}

export async function analyseMealText(text: string): Promise<MealAnalysisDto> {
  if (!isClaudeConfigured()) throw new AppError(503, 'AI_NOT_CONFIGURED', 'AI meal analysis isn’t set up on this server yet. Ask the gym to add an Anthropic API key.');

  const reference = await referenceTable();
  const system = `${INSTRUCTIONS}\n\nGym food reference (name | serving | kcal | protein g | carbs g | fat g | fibre g):\n${reference || '(none)'}`;

  let estimate;
  try {
    estimate = await estimateMeal(system, `What I ate:\n${text}`);
  } catch (err) {
    if (err instanceof ClaudeRefusalError) throw new AppError(422, 'AI_DECLINED', 'That couldn’t be analysed. Describe the foods you ate, e.g. “2 rotis, a bowl of dal”.');
    if (err instanceof Anthropic.RateLimitError) throw tooMany();
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      logger.error({ status: err.status }, 'Anthropic credentials rejected');
      throw new AppError(503, 'AI_NOT_CONFIGURED', 'AI meal analysis is not available right now.');
    }
    if (err instanceof Anthropic.APIError) {
      logger.error({ status: err.status, message: err.message }, 'Anthropic API error');
      throw new AppError(502, 'AI_UNAVAILABLE', 'The AI service is busy. Please try again in a moment.');
    }
    throw err;
  }

  if (estimate.notFood || estimate.items.length === 0) throw new AppError(422, 'NOT_FOOD', 'We couldn’t find any food in that. Try something like “2 idlis with sambar and a cup of tea”.');

  // Model output is an estimate; keep it inside the same bounds the meal log accepts.
  const items: AnalysedMealItem[] = estimate.items.slice(0, 25).map((i) => ({
    name: i.name.trim().slice(0, 100) || 'Food',
    portion: i.portion.trim().slice(0, 120),
    calories: Math.round(clamp(i.calories, 5000)),
    proteinG: r1(clamp(i.proteinG, 1000)), carbsG: r1(clamp(i.carbsG, 1000)), fatG: r1(clamp(i.fatG, 1000)), fiberG: r1(clamp(i.fiberG, 500)),
  }));
  const sum = (k: keyof MealAnalysisDto['totals']) => items.reduce((t, i) => t + i[k], 0);
  return {
    items,
    totals: { calories: Math.round(sum('calories')), proteinG: r1(sum('proteinG')), carbsG: r1(sum('carbsG')), fatG: r1(sum('fatG')), fiberG: r1(sum('fiberG')) },
    note: estimate.note.trim() || null,
  };
}
