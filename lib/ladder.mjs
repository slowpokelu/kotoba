/* oxlint-disable typescript/no-misused-spread -- NFC kana are single code points by game design. */
// ことばのはしご: climb from one three-kana word to another, changing one kana
// at a time, every rung a real word. The par is the shortest climb through
// common words; any dictionary word may be a rung.
import { shareLink } from './routes.mjs';

export const LADDER_LENGTH = 3;
export const ladderKey = (day = '') =>
  'kotoba:v1:ladder' + (day ? ':daily:' + day : '');

// Words one kana apart, found through wildcard buckets (ね_こ …).
export function ladderGraph(words) {
  const buckets = new Map();
  const keys = (w) => {
    const k = [...w];
    return k.map((_, i) => k.map((c, j) => (i === j ? '_' : c)).join(''));
  };
  for (const w of words)
    for (const key of keys(w))
      buckets.set(key, [...(buckets.get(key) ?? []), w]);
  return (word) =>
    keys(word).flatMap((key) =>
      (buckets.get(key) ?? []).filter((w) => w !== word),
    );
}
// Shortest climb from start to goal, or null.
export function shortestPath(start, goal, neighbours) {
  const from = new Map([[start, null]]);
  const queue = [start];
  while (queue.length) {
    const word = queue.shift();
    if (word === goal) {
      const path = [];
      for (let w = goal; w; w = from.get(w)) path.unshift(w);
      return path;
    }
    for (const next of neighbours(word))
      if (!from.has(next)) {
        from.set(next, word);
        queue.push(next);
      }
  }
  return null;
}
// Distances from start, for picking a goal at a set number of rungs.
function distances(start, neighbours) {
  const seen = new Map([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    const word = queue.shift();
    for (const next of neighbours(word))
      if (!seen.has(next)) {
        seen.set(next, seen.get(word) + 1);
        queue.push(next);
      }
  }
  return seen;
}

// A start and goal from the everyday words, four or five rungs apart through
// common words. `random` decides; the day's seed makes it the same for all.
export function makeLadder(everyday, neighbours, random) {
  for (let tries = 0; tries < 200; tries++) {
    const start = everyday[Math.floor(random() * everyday.length)];
    const far = distances(start, neighbours);
    const goals = everyday.filter((w) => [4, 5].includes(far.get(w)));
    if (!goals.length) continue;
    const goal = goals[Math.floor(random() * goals.length)];
    return { start, goal, par: far.get(goal) };
  }
  return null;
}
export function seeded(text) {
  let seed = 2166136261;
  for (const c of text)
    seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const oneApart = (a, b) =>
  [...a].filter((c, i) => c !== [...b][i]).length === 1;
export function checkRung(word, round, valid) {
  const previous = round.steps.at(-1) ?? round.start;
  if ([...word].length !== LADDER_LENGTH)
    return { error: `ひらがな${LADDER_LENGTH}文字で入力してください。` };
  if (!valid.has(word))
    return { error: '辞書にない言葉です。別の言葉を試してみてください。' };
  if (word === round.start || round.steps.includes(word))
    return { error: 'その言葉はもう出ました。' };
  if (!oneApart(word, previous))
    return { error: '前の言葉から1文字だけ変えてください。' };
  return { word };
}
export const ladderOutcome = (round) =>
  round.steps.at(-1) === round.goal ? 'won' : round.gaveUp ? 'lost' : 'playing';

export function restoreLadder(raw, valid) {
  try {
    const value = JSON.parse(raw);
    const word = (w) =>
      typeof w === 'string' && [...w].length === LADDER_LENGTH && valid.has(w);
    if (
      value?.version !== 1 ||
      !word(value.start) ||
      !word(value.goal) ||
      !Number.isInteger(value.par) ||
      !Array.isArray(value.steps) ||
      value.steps.length > 60 ||
      !value.steps.every(word) ||
      !value.steps.every((w, i) =>
        oneApart(w, i ? value.steps[i - 1] : value.start),
      )
    )
      return null;
    return {
      version: 1,
      start: value.start,
      goal: value.goal,
      par: value.par,
      steps: value.steps,
      gaveUp: value.gaveUp === true,
      draft: typeof value.draft === 'string' ? value.draft.slice(0, 40) : '',
    };
  } catch {
    return null;
  }
}

// One row per rung: which kana already match the goal.
export function ladderShare(round, day = '') {
  const goal = [...round.goal];
  const won = ladderOutcome(round) === 'won';
  return (
    `ことば · はしご${day ? ' · ' + day : ''}\n${round.start} → ${round.goal}  ${won ? round.steps.length + '手' : 'X'}（最短${round.par}手）\n\n` +
    round.steps
      .map((w) => [...w].map((c, i) => (c === goal[i] ? '🟦' : '⬜')).join(''))
      .join('\n') +
    '\n\n' +
    shareLink('ladder', !day)
  );
}
