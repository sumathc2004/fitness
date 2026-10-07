// All calendar logic is in UTC for now. (A per-gym timezone setting arrives with Settings in a later phase.)
const DAY = 86_400_000;

export const startOfDayUTC = (d: Date = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
export const todayUTC = () => startOfDayUTC();
export const daysAgo = (n: number, from: Date = new Date()) => new Date(startOfDayUTC(from).getTime() - n * DAY);
export const daysFromNow = (n: number) => new Date(todayUTC().getTime() + n * DAY);

/** Monday 00:00 UTC of the week containing `d`. */
export function startOfWeekUTC(d: Date = new Date()) {
  const s = startOfDayUTC(d);
  const dow = (s.getUTCDay() + 6) % 7; // Mon = 0
  return new Date(s.getTime() - dow * DAY);
}

export const startOfMonthUTC = (monthOffset = 0, from: Date = new Date()) =>
  new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + monthOffset, 1));

export const monthLabel = (d: Date) => d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const ratio = (num: number, den: number): number | null => (den > 0 ? num / den : null);
