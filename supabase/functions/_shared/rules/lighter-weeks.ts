/** At most one lighter week in any 4 weeks, the coach's included. */
export const LIGHTER_WEEK_MIN_GAP_DAYS = 28;
/** An exercise with no new rep record for 3 weeks is stale. */
export const STALE_RECORD_DAYS = 21;

const DAY_MS = 86_400_000;
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Dates are local calendar dates (D66), so day counts go through UTC midnights and never see a DST shift.
function dayNumber(date: string): number {
  const parts = LOCAL_DATE.exec(date);
  const ms =
    parts === null ? NaN : Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  // Date.UTC rolls 2026-02-30 over into March, so only a date that round-trips is real.
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== date) {
    throw new RangeError(`not a YYYY-MM-DD date: ${date}`);
  }
  return ms / DAY_MS;
}

/** True when no existing lighter week starts within 28 days of `weekStart`, on either side. */
export function lighterWeekAllowed(
  weekStart: string,
  lighterWeekStarts: readonly string[],
): boolean {
  const week = dayNumber(weekStart);
  return lighterWeekStarts.every(
    (start) => Math.abs(dayNumber(start) - week) >= LIGHTER_WEEK_MIN_GAP_DAYS,
  );
}

/**
 * Rule 4: half or more of the plan's distinct exercises have no rep record in the 21 days before
 * `weekStart`, and a lighter week is allowed. `lastRecordOn` maps a slug to the local date of its
 * latest `rep_records.achieved_at`; a slug with no entry, or null, was never logged and is not stale.
 */
export function lighterWeekDue(input: {
  weekStart: string;
  planExerciseSlugs: readonly string[];
  lastRecordOn: Readonly<Record<string, string | null>>;
  lighterWeekStarts: readonly string[];
}): boolean {
  const slugs = [...new Set(input.planExerciseSlugs)];
  if (slugs.length === 0) return false;
  if (!lighterWeekAllowed(input.weekStart, input.lighterWeekStarts)) return false;

  const week = dayNumber(input.weekStart);
  const stale = slugs.filter((slug) => {
    const last = input.lastRecordOn[slug];
    return last !== undefined && last !== null && week - dayNumber(last) > STALE_RECORD_DAYS;
  });
  return stale.length * 2 >= slugs.length;
}

/** Sets during a lighter week: half, rounded down, at least 1. Default pending the owner's answer (#16). */
export function lighterWeekSets(sets: number): number {
  return Math.max(1, Math.floor(sets / 2));
}
