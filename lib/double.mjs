/* oxlint-disable typescript/no-misused-spread -- NFC kana are single code points by game design. */
// ダブル (Dordle) and トリプル: two or three hidden words at once. Every guess
// counts on every board; a solved board stops taking rows. Each extra board
// adds one guess to the usual eight, as Dordle does.
import { evaluate, keyboardStates } from './game.mjs';

export const DOUBLE_KEY = 'kotoba:v1:double';
export const TRIPLE_KEY = 'kotoba:v1:triple';
export const boardsKey = (boards) => (boards === 3 ? TRIPLE_KEY : DOUBLE_KEY);
export const boardsLimit = (boards) => 7 + boards;
export const DOUBLE_LIMIT = boardsLimit(2);

export function newDouble(pool, random = Math.random, boards = 2) {
  const left = [...pool];
  const answers = Array.from(
    { length: boards },
    () => left.splice(Math.floor(random() * left.length), 1)[0],
  );
  return { version: 1, answers, guesses: [], draft: '', gaveUp: false };
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
  return round.gaveUp ||
    round.guesses.length >= boardsLimit(round.answers.length)
    ? 'lost'
    : 'playing';
}
// Per kana, its state on each board, for split keys.
export function splitKeys(round) {
  const boards = round.answers.map((answer, i) =>
    keyboardStates(boardGuesses(round, i), answer, round.hints),
  );
  const keys = {};
  for (const k of new Set(boards.flatMap(Object.keys)))
    keys[k] = boards.map((states) => states[k] ?? null);
  return keys;
}

export function restoreDouble(raw, valid, answerSet, boards = 2) {
  try {
    const value = JSON.parse(raw);
    if (
      value?.version !== 1 ||
      !Array.isArray(value.answers) ||
      value.answers.length !== boards ||
      new Set(value.answers).size !== boards ||
      !value.answers.every((a) => answerSet.has(a) && [...a].length === 4) ||
      !Array.isArray(value.guesses) ||
      value.guesses.length > boardsLimit(boards) ||
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
  const boards = round.answers.length;
  const score = doubleOutcome(round) === 'won' ? round.guesses.length : 'X';
  const rows = round.guesses.map((guess, r) =>
    round.answers
      .map((answer, i) =>
        solvedAt(round, i) >= 0 && r > solvedAt(round, i)
          ? '　　　　'
          : evaluate(guess, answer, round.hints)
              .map((s) => symbols[s])
              .join(''),
      )
      .join(' '),
  );
  return (
    `ことば · ${boards === 3 ? 'トリプル' : 'ダブル'}  ${score}/${boardsLimit(boards)}${round.hints ? ' [ヒント]' : ''}\n\n` +
    rows.join('\n') +
    '\n\nhttps://slowpokelu.github.io/kotoba/'
  );
}
