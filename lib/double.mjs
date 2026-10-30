/* oxlint-disable typescript/no-misused-spread -- NFC kana are single code points by game design. */
// ダブル (Dordle): two hidden words at once. Every guess counts on both
// boards; a solved board stops taking rows. One guess more than the usual
// eight, as Dordle does.
import { evaluate, keyboardStates } from './game.mjs';

export const DOUBLE_KEY = 'kotoba:v1:double';
export const DOUBLE_LIMIT = 9;

export function newDouble(pool, random = Math.random) {
  const first = Math.floor(random() * pool.length);
  let second = Math.floor(random() * (pool.length - 1));
  if (second >= first) second++;
  return {
    version: 1,
    answers: [pool[first], pool[second]],
    guesses: [],
    draft: '',
    gaveUp: false,
  };
}
// The guess that solved board i, as an index, or -1.
export const solvedAt = (round, i) => round.guesses.indexOf(round.answers[i]);
// The guesses that count on board i: all of them until it is solved.
export const boardGuesses = (round, i) =>
  solvedAt(round, i) < 0
    ? round.guesses
    : round.guesses.slice(0, solvedAt(round, i) + 1);
export function doubleOutcome(round) {
  if (round.answers.every((a) => round.guesses.includes(a))) return 'won';
  return round.gaveUp || round.guesses.length >= DOUBLE_LIMIT
    ? 'lost'
    : 'playing';
}
// Per kana, the state on the left and right board, for split keys.
export function splitKeys(round) {
  const [left, right] = [0, 1].map((i) =>
    keyboardStates(boardGuesses(round, i), round.answers[i], round.hints),
  );
  const keys = {};
  for (const k of new Set([...Object.keys(left), ...Object.keys(right)]))
    keys[k] = [left[k] ?? null, right[k] ?? null];
  return keys;
}

export function restoreDouble(raw, valid, answerSet) {
  try {
    const value = JSON.parse(raw);
    if (
      value?.version !== 1 ||
      !Array.isArray(value.answers) ||
      value.answers.length !== 2 ||
      value.answers[0] === value.answers[1] ||
      !value.answers.every((a) => answerSet.has(a) && [...a].length === 4) ||
      !Array.isArray(value.guesses) ||
      value.guesses.length > DOUBLE_LIMIT ||
      value.guesses.some(
        (g) => typeof g !== 'string' || [...g].length !== 4 || !valid.has(g),
      ) ||
      new Set(value.guesses).size !== value.guesses.length ||
      (value.gaveUp !== undefined && typeof value.gaveUp !== 'boolean') ||
      (value.hints !== undefined && typeof value.hints !== 'boolean')
    )
      return null;
    return {
      version: 1,
      answers: value.answers,
      guesses: value.guesses,
      gaveUp: value.gaveUp === true,
      ...(value.hints === true && value.guesses.length ? { hints: true } : {}),
      draft: typeof value.draft === 'string' ? value.draft.slice(0, 40) : '',
    };
  } catch {
    return null;
  }
}

// Rows side by side; a solved board leaves its side blank afterwards.
export function doubleShare(round) {
  const symbols = {
    correct: '🟦',
    present: '🟨',
    'near-correct': '🔷',
    'near-present': '🔶',
    absent: '⬜',
  };
  const score = doubleOutcome(round) === 'won' ? round.guesses.length : 'X';
  const rows = round.guesses.map((guess, r) =>
    [0, 1]
      .map((i) =>
        solvedAt(round, i) >= 0 && r > solvedAt(round, i)
          ? '　　　　'
          : evaluate(guess, round.answers[i], round.hints)
              .map((s) => symbols[s])
              .join(''),
      )
      .join(' '),
  );
  return (
    `ことば · ダブル  ${score}/${DOUBLE_LIMIT}${round.hints ? ' [ヒント]' : ''}\n\n` +
    rows.join('\n') +
    '\n\nhttps://slowpokelu.github.io/kotoba/'
  );
}
