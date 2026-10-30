/* oxlint-disable typescript/no-misused-spread -- Kanji outside the BMP are single code points. */
// 和同開珎: a hidden centre kanji makes a word with each of four clue kanji.
// A clue written 日< reads into the centre (日 then centre); 来> reads out of
// it (centre then 来). Clues run clockwise from the top.
import { shareLink } from './routes.mjs';

export const WADOU_LIMIT = 5;
export const wadouKey = (day = '') =>
  'kotoba:v1:wadou' + (day ? ':daily:' + day : '');

// Every two-kanji word, from the packed string in wadou.json.
export function wordSet(pairs) {
  const kanji = [...pairs],
    words = new Set();
  for (let i = 0; i + 1 < kanji.length; i += 2)
    words.add(kanji[i] + kanji[i + 1]);
  return words;
}
export const clueWord = (clue, centre) =>
  clue.endsWith('>') ? centre + [...clue][0] : [...clue][0] + centre;
// Which clues a guess makes a word with.
export const fits = (guess, puzzle, words) =>
  puzzle.k.map((clue) => words.has(clueWord(clue, guess)));

export function dailyIndex(day, count) {
  const days = Math.round(
    (Date.parse(day + 'T00:00:00Z') - Date.parse('2026-10-31T00:00:00Z')) /
      86400000,
  );
  return ((days % count) + count) % count;
}

export function wadouOutcome(round, puzzle) {
  if (round.guesses.includes(puzzle.c)) return 'won';
  return round.gaveUp || round.guesses.length >= WADOU_LIMIT
    ? 'lost'
    : 'playing';
}

// One kanji, typed directly or picked from the reading's candidates.
export function checkKanji(guess, guesses) {
  const kanji = [...guess.trim()];
  if (kanji.length !== 1 || !/\p{Script=Han}/u.test(kanji[0]))
    return { error: '漢字1文字で答えてください。' };
  if (guesses.includes(kanji[0]))
    return { error: 'その漢字はもう試しました。' };
  return { guess: kanji[0] };
}

export function restoreWadou(raw, count) {
  try {
    const value = JSON.parse(raw);
    if (
      value?.version !== 1 ||
      !Number.isInteger(value.puzzle) ||
      value.puzzle < 0 ||
      value.puzzle >= count ||
      !Array.isArray(value.guesses) ||
      value.guesses.length > WADOU_LIMIT ||
      value.guesses.some((g) => typeof g !== 'string' || [...g].length !== 1) ||
      new Set(value.guesses).size !== value.guesses.length ||
      (value.gaveUp !== undefined && typeof value.gaveUp !== 'boolean')
    )
      return null;
    return {
      version: 1,
      puzzle: value.puzzle,
      guesses: value.guesses,
      gaveUp: value.gaveUp === true,
      // Kept so the menu can tell a finished day without loading puzzles.
      solved: value.solved === true,
      draft: typeof value.draft === 'string' ? value.draft.slice(0, 20) : '',
    };
  } catch {
    return null;
  }
}

// One row per guess: which of the four clues it made a word with.
export function wadouShare(round, puzzle, words, day = '') {
  const won = wadouOutcome(round, puzzle) === 'won';
  return (
    `ことば · 和同開珎${day ? ' · ' + day : ''}  ${won ? round.guesses.length : 'X'}/${WADOU_LIMIT}\n\n` +
    round.guesses
      .map((g) =>
        fits(g, puzzle, words)
          .map((ok) => (ok ? '🟦' : '⬜'))
          .join(''),
      )
      .join('\n') +
    '\n\n' +
    shareLink('wadou', !day)
  );
}
