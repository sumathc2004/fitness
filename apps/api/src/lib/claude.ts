import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod/v4';

/**
 * Thin wrapper around the Anthropic SDK for the meal analyser, kept separate so tests can mock it.
 * Credentials come from the environment (ANTHROPIC_API_KEY, or ANTHROPIC_AUTH_TOKEN); see `isClaudeConfigured`.
 */

export const MEAL_MODEL = 'claude-opus-5-5';

/** What Claude returns for a free-text meal description (validated by the SDK's structured-output parser). */
export const MealEstimateSchema = z.object({
  notFood: z.boolean().describe('true when the text does not describe food or drink that was eaten'),
  items: z.array(z.object({
    name: z.string().describe('Short food name, e.g. "Cooked white rice"'),
    portion: z.string().describe('Assumed portion in everyday terms with grams/ml, e.g. "1 cup (~160 g)"'),
    calories: z.number().describe('kcal for this portion'),
    proteinG: z.number(),
    carbsG: z.number(),
    fatG: z.number(),
    fiberG: z.number(),
  })),
  note: z.string().describe('One short sentence on the main assumption made, or an empty string'),
});
export type MealEstimate = z.infer<typeof MealEstimateSchema>;

export class ClaudeRefusalError extends Error {}

export const isClaudeConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ timeout: 45_000 }));

/** One structured-output call. Throws Anthropic.APIError subclasses, or ClaudeRefusalError when the model declines. */
export async function estimateMeal(system: string, userText: string): Promise<MealEstimate> {
  const response = await getClient().beta.messages.parse({
    model: MEAL_MODEL,
    max_tokens: 16000,
    // Simple extraction: low effort keeps the reply fast for a button-click in the UI.
    output_config: { effort: 'low', format: betaZodOutputFormat(MealEstimateSchema) },
    // If a safety classifier declines, retry on a suitable fallback model inside the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    messages: [{ role: 'user', content: userText }],
  });
  if (response.stop_reason === 'refusal' || !response.parsed_output) throw new ClaudeRefusalError('The meal could not be analysed');
  return response.parsed_output;
}
