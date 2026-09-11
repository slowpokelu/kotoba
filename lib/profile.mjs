import {
  dailyAnswer,
  localDay,
  newGame,
  outcome,
  restoreGame,
  gameLength,
  PRACTICE_LENGTHS,
} from './game.mjs';

export const THEME_KEY = 'kotoba:theme';
export const themes = ['system', 'light', 'dark'];
export const gameKey = (id) => 'kotoba:v1:' + id;

function validDate(day) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day + 'T00:00:00Z')) &&
    new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) === day
  );
}

export function checkedGame(value, answers, valid) {
  if (!value || typeof value !== 'object' || typeof value.id !== 'string')
    return null;
  const daily = value.id.startsWith('daily:');
  const day = value.id.slice(6);
  const length = gameLength(value.id);
  if (!length || (daily && !validDate(day))) return null;
  const pool = answers.filter((a) => a.reading.length === length);
  if (!pool.length) return null;
  const fallback = newGame(
    daily ? dailyAnswer(day, pool).reading : pool[0].reading,
    value.id,
  );
  const restored = restoreGame(
    JSON.stringify(value),
    fallback,
    valid,
    new Set(pool.map((a) => a.reading)),
  );
  return restored === fallback ? null : restored;
}

export function readGames(storage, answers, valid) {
  const games = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith('kotoba:v1:')) continue;
    try {
      const game = checkedGame(
        JSON.parse(storage.getItem(key)),
        answers,
        valid,
      );
      if (game && key === gameKey(game.id)) games.push(game);
    } catch {
      /* Ignore one corrupt save without losing the other games. */
    }
  }
  return games;
}

export function dailyStats(games, today = localDay()) {
  const daily = new Map(
    games
      .filter(
        (g) =>
          g.id.startsWith('daily:') &&
          g.id.slice(6) <= today &&
          outcome(g) !== 'playing',
      )
      .map((g) => [g.id.slice(6), g]),
  );
  const distribution = Array(8).fill(0);
  let wins = 0,
    best = 0,
    run = 0,
    previous = '';
  const previousDay = (day) =>
    new Date(Date.parse(day + 'T00:00:00Z') - 86400000)
      .toISOString()
      .slice(0, 10);
  for (const [day, game] of [...daily].sort(([a], [b]) => a.localeCompare(b))) {
    if (outcome(game) === 'won') {
      wins++;
      distribution[game.guesses.length - 1]++;
      run = previous === previousDay(day) ? run + 1 : 1;
      best = Math.max(best, run);
    } else run = 0;
    previous = day;
  }
  let current = 0;
  let cursor = daily.has(today) ? today : previousDay(today);
  while (daily.has(cursor) && outcome(daily.get(cursor)) === 'won') {
    current++;
    cursor = previousDay(cursor);
  }
  return {
    played: daily.size,
    wins,
    rate: daily.size ? Math.round((wins / daily.size) * 100) : 0,
    current,
    best,
    distribution,
  };
}

export function parseBackup(raw, answers, valid) {
  if (typeof raw !== 'string' || raw.length > 5_000_000)
    throw new Error('invalid backup');
  const data = JSON.parse(raw);
  if (
    data?.app !== 'kotoba' ||
    data.version !== 1 ||
    !themes.includes(data.theme) ||
    (data.language !== undefined && !['ja', 'en'].includes(data.language)) ||
    (data.practiceLength !== undefined &&
      !PRACTICE_LENGTHS.includes(data.practiceLength)) ||
    !Array.isArray(data.games) ||
    data.games.length > 10000
  )
    throw new Error('invalid backup');
  const games = data.games.map((g) => checkedGame(g, answers, valid));
  if (
    games.some((g) => !g) ||
    new Set(games.map((g) => g.id)).size !== games.length
  )
    throw new Error('invalid game');
  return {
    app: 'kotoba',
    version: 1,
    theme: data.theme,
    ...(data.language ? { language: data.language } : {}),
    ...(data.practiceLength ? { practiceLength: data.practiceLength } : {}),
    games,
  };
}

export function mergeGames(existing, incoming) {
  const merged = new Map(existing.map((g) => [g.id, g]));
  for (const game of incoming) {
    const old = merged.get(game.id);
    // Never reopen or replace an already completed local daily game.
    if (
      !old ||
      (outcome(old) === 'playing' &&
        (outcome(game) !== 'playing' ||
          game.guesses.length > old.guesses.length))
    )
      merged.set(game.id, game);
  }
  return [...merged.values()];
}
