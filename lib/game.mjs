/* oxlint-disable typescript/no-misused-spread -- NFC kana are single code points by game design. */
export const LENGTH = 4;
export const PRACTICE_LENGTHS = [3, 4, 5, 6];
export const PRACTICE_LENGTH_KEY = 'kotoba:practice-length';
export const practiceId = (length) =>
  length === 4 ? 'practice' : `practice:${length}`;
export const gameLength = (id) =>
  id === 'practice' || id.startsWith('daily:')
    ? 4
    : /^practice:[356]$/.test(id)
      ? Number(id.slice(-1))
      : null;
export function savedPracticeLength(storage) {
  try {
    const value = Number(storage.getItem(PRACTICE_LENGTH_KEY));
    return PRACTICE_LENGTHS.includes(value) ? value : 4;
  } catch {
    return 4;
  }
}
export const LIMIT = 8;
export const VERSION = 1;
export const marks = { correct: '✓', present: '●', absent: '−' };
export const labels = {
  correct: '位置も一致',
  present: '別の位置',
  absent: '含まれない',
};
export function normalize(text) {
  return text
    .trim()
    .normalize('NFKC')
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .normalize('NFC');
}
export function evaluate(guess, answer) {
  const letters = [...guess],
    target = [...answer],
    result = letters.map(() => 'absent'),
    remaining = new Map();
  letters.forEach((letter, i) => {
    if (letter === target[i]) result[i] = 'correct';
    else remaining.set(target[i], (remaining.get(target[i]) || 0) + 1);
  });
  letters.forEach((letter, i) => {
    if (result[i] !== 'correct' && (remaining.get(letter) || 0) > 0) {
      result[i] = 'present';
      remaining.set(letter, remaining.get(letter) - 1);
    }
  });
  return result;
}
export function keyboardStates(guesses, answer) {
  const rank = { absent: 1, present: 2, correct: 3 },
    states = {};
  for (const guess of guesses)
    evaluate(guess, answer).forEach((status, i) => {
      const letter = [...guess][i];
      if (!states[letter] || rank[status] > rank[states[letter]])
        states[letter] = status;
    });
  return states;
}
export function localDay(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
export function dailyAnswer(day, answers) {
  // A fixed permutation gives every answer one turn before the cycle repeats.
  let seed = 0x14b19;
  const shuffled = [...answers];
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const dayIndex = Math.round(
    (Date.parse(day + 'T00:00:00Z') - Date.parse('2026-09-07T00:00:00Z')) /
      86400000,
  );
  return shuffled[
    ((dayIndex % shuffled.length) + shuffled.length) % shuffled.length
  ];
}
export function resolveGuess(raw, aliases = {}) {
  const normalized = normalize(raw);
  return aliases[normalized] || normalized;
}
export function validateGuess(
  raw,
  guesses,
  valid,
  aliases = {},
  length = LENGTH,
) {
  const guess = resolveGuess(raw, aliases);
  if (!/^[ぁ-ゖー]*$/u.test(guess))
    return { error: '読みをひらがなで入力してください。' };
  if ([...guess].length !== length)
    return { error: `ひらがな${length}文字で入力してください。` };
  if (!valid.has(guess))
    return { error: '辞書にない言葉です。別の言葉を試してみてください。' };
  if (guesses.includes(guess)) return { error: 'その言葉はもう試しました。' };
  return { guess };
}
export function newGame(answer, id) {
  return {
    version: VERSION,
    id,
    answer,
    guesses: [],
    draft: '',
    gaveUp: false,
  };
}
export function outcome(game) {
  return game.guesses.includes(game.answer)
    ? 'won'
    : game.gaveUp || game.guesses.length >= LIMIT
      ? 'lost'
      : 'playing';
}
export function restoreGame(raw, fallback, valid, answerSet) {
  try {
    const value = JSON.parse(raw);
    const length = gameLength(fallback.id);
    if (
      !length ||
      value.version !== VERSION ||
      value.id !== fallback.id ||
      (value.gaveUp !== undefined && typeof value.gaveUp !== 'boolean') ||
      !answerSet.has(value.answer) ||
      [...value.answer].length !== length ||
      (fallback.id.startsWith('daily:') && value.answer !== fallback.answer) ||
      !Array.isArray(value.guesses) ||
      value.guesses.length > LIMIT ||
      value.guesses.some(
        (g) =>
          typeof g !== 'string' || [...g].length !== length || !valid.has(g),
      ) ||
      new Set(value.guesses).size !== value.guesses.length ||
      (value.guesses.includes(value.answer) &&
        (value.guesses.at(-1) !== value.answer || value.gaveUp))
    )
      return fallback;
    return {
      version: VERSION,
      id: value.id,
      answer: value.answer,
      guesses: value.guesses,
      gaveUp: value.gaveUp === true,
      draft: typeof value.draft === 'string' ? value.draft.slice(0, 40) : '',
    };
  } catch {
    return fallback;
  }
}
export function modifyLast(text, kind) {
  const chars = [...normalize(text)],
    last = chars.at(-1);
  if (!last) return text;
  const groups =
    kind === 'voice'
      ? [
          'かが',
          'きぎ',
          'くぐ',
          'けげ',
          'こご',
          'さざ',
          'しじ',
          'すず',
          'せぜ',
          'そぞ',
          'ただ',
          'ちぢ',
          'つづ',
          'てで',
          'とど',
          'はばぱ',
          'ひびぴ',
          'ふぶぷ',
          'へべぺ',
          'ほぼぽ',
          'うゔ',
        ]
      : [
          'あぁ',
          'いぃ',
          'うぅ',
          'えぇ',
          'おぉ',
          'やゃ',
          'ゆゅ',
          'よょ',
          'つっ',
          'わゎ',
        ];
  const group = groups.find((g) => g.includes(last));
  if (!group) return text;
  chars[chars.length - 1] = group[(group.indexOf(last) + 1) % group.length];
  return chars.join('');
}
export function shareText(game, day) {
  const score = outcome(game) === 'won' ? game.guesses.length : 'X';
  const symbols = { correct: '🟦', present: '🟨', absent: '⬜' };
  return (
    `ことば · ${game.id.startsWith('daily:') ? day : `練習 · ${gameLength(game.id)}文字`}  ${score}/${LIMIT}\n\n` +
    game.guesses
      .map((g) =>
        evaluate(g, game.answer)
          .map((s) => symbols[s])
          .join(''),
      )
      .join('\n') +
    '\n\nhttps://slowpokelu.github.io/kotoba/'
  );
}
