// ===================================================================
// DAILY KEY
// A "daily key" is the UTC calendar date (YYYY-MM-DD) that identifies
// one day's challenge. Every player worldwide shares the same key at the
// same moment, which is what makes it a daily game rather than a
// per-timezone one.
// ===================================================================

// --- FORMAT RULES ---
const DAILY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// --- FUNCTIONS ---

/** Returns the daily key (UTC date) for the given moment. */
export const getDailyKey = (date: Date = new Date()): string =>
  date.toISOString().slice(0, 10);

/** Returns the daily key `offsetDays` away from `dailyKey` (negative = past). */
export const shiftDailyKey = (dailyKey: string, offsetDays: number): string => {
  const start = Date.parse(`${dailyKey}T00:00:00.000Z`);
  return getDailyKey(new Date(start + offsetDays * MS_PER_DAY));
};

/** Type guard: true when `value` is a well-formed daily key. */
export const isDailyKey = (value: unknown): value is string =>
  typeof value === 'string' &&
  DAILY_KEY_PATTERN.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
