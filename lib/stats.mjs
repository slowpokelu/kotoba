// Statistics for every game, from the rounds saved in this browser. Daily
// games count finished days; a loss, a give-up or a skipped day ends the
// streak.
import { beeTotal } from './bee.mjs';
import { boardsKey, boardsLimit, doubleOutcome } from './double.mjs';
import { ladderOutcome } from './ladder.mjs';
import { WADOU_LIMIT } from './wadou.mjs';

export const ABSURD_PLAYED_KEY = 'kotoba:absurd-played';
export const SHIRITORI_PLAYED_KEY = 'kotoba:shiritori-played';

const previousDay = (day) =>
  new Date(Date.parse(day + 'T00:00:00Z') - 86400000)
    .toISOString()
    .slice(0, 10);

// `days`: finished days as day → { won, guesses }. `size` is the number of
// rows in the guess distribution.
export function streakStats(days, today, size) {
  const distribution = Array(size).fill(0);
  let wins = 0,
    best = 0,
    run = 0,
    previous = '';
  for (const [day, { won, guesses }] of [...days].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (won) {
      wins++;
      if (guesses >= 1 && guesses <= size) distribution[guesses - 1]++;
      run = previous === previousDay(day) ? run + 1 : 1;
      best = Math.max(best, run);
    } else run = 0;
    previous = day;
  }
  let current = 0;
  let cursor = days.has(today) ? today : previousDay(today);
  while (days.get(cursor)?.won) {
    current++;
    cursor = previousDay(cursor);
  }
  return {
    played: days.size,
    wins,
    rate: days.size ? Math.round((wins / days.size) * 100) : 0,
    current,
    best,
    distribution,
    // Today's row in the distribution, when today is solved.
    todayGuesses: days.get(today)?.won ? days.get(today).guesses : 0,
  };
}

// Saved daily rounds whose keys are `prefix` + a date, up to today.
export function savedDays(storage, prefix, today) {
  const days = new Map();
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    const day = key?.startsWith(prefix) ? key.slice(prefix.length) : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > today) continue;
    try {
      days.set(day, JSON.parse(storage.getItem(key)));
    } catch {
      /* Skip one unreadable round. */
    }
  }
  return days;
}
// Finished days only, each read by `result` into { won, guesses } or null.
function finished(days, result) {
  const out = new Map();
  for (const [day, round] of days)
    try {
      const value = result(round);
      if (value) out.set(day, value);
    } catch {
      /* Skip one malformed round. */
    }
  return out;
}

export function multiStats(storage, boards, today) {
  const days = savedDays(storage, boardsKey(boards) + ':daily:', today);
  return streakStats(
    finished(days, (round) => {
      const state = doubleOutcome(round);
      return state === 'playing'
        ? null
        : { won: state === 'won', guesses: round.guesses.length };
    }),
    today,
    boardsLimit(boards),
  );
}

export function wadouStats(storage, today) {
  const days = savedDays(storage, 'kotoba:v1:wadou:daily:', today);
  return streakStats(
    finished(days, (round) =>
      round.solved || round.gaveUp || round.guesses.length >= WADOU_LIMIT
        ? { won: round.solved === true, guesses: round.guesses.length }
        : null,
    ),
    today,
    WADOU_LIMIT,
  );
}

// Plus how often a finished ladder came in under, on or over par.
export function ladderStats(storage, today) {
  const days = savedDays(storage, 'kotoba:v1:ladder:daily:', today);
  const par = { under: 0, on: 0, over: 0 };
  const done = finished(days, (round) => {
    const state = ladderOutcome(round);
    if (state === 'playing') return null;
    if (state === 'won') {
      const steps = round.steps.length;
      par[steps < round.par ? 'under' : steps === round.par ? 'on' : 'over']++;
    }
    return { won: state === 'won', guesses: round.steps.length };
  });
  return { ...streakStats(done, today, 0), par };
}

export function beeStats(storage, today) {
  const days = [...savedDays(storage, 'kotoba:v1:bee:', today)].filter(
    ([, round]) => Array.isArray(round?.found) && round.found.length,
  );
  const points = days.map(([, round]) => beeTotal(round.found));
  return {
    played: days.length,
    best: Math.max(0, ...points),
    words: days.reduce((sum, [, round]) => sum + round.found.length, 0),
    today: beeTotal(days.find(([day]) => day === today)?.[1].found ?? []),
  };
}
// いじわる and しりとり count their finished rounds.
export function countPlay(storage, key) {
  try {
    storage.setItem(key, String((Number(storage.getItem(key)) || 0) + 1));
  } catch {
    /* The count stays as it was. */
  }
}
