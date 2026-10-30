/* oxlint-disable typescript/no-misused-spread -- NFC kana are single code points by game design. */
// かなビー (Spelling Bee): make common words from seven kana; every word uses
// the centre one. Small kana count as their full-size tile (しゃ uses し and
// や) and ー is always allowed. One puzzle a day, the same for everyone.
export const beeKey = (day) => 'kotoba:v1:bee:' + day;
const fullSize = {
  ぁ: 'あ',
  ぃ: 'い',
  ぅ: 'う',
  ぇ: 'え',
  ぉ: 'お',
  っ: 'つ',
  ゃ: 'や',
  ゅ: 'ゆ',
  ょ: 'よ',
  ゎ: 'わ',
};
export const tilesOf = (word) =>
  new Set([...word].filter((k) => k !== 'ー').map((k) => fullSize[k] || k));
export const beeWords = (commonWords) =>
  Object.keys(commonWords).filter(
    (w) => [...w].length >= 3 && /^[ぁ-ゖー]+$/u.test(w),
  );

// Words a set of tiles allows, given the centre tile.
const allowed = (words, tiles, center) =>
  words.filter((w) => {
    const used = tilesOf(w);
    return used.has(center) && [...used].every((k) => tiles.includes(k));
  });

// A deterministic puzzle per day: a seed word with six or seven different
// tiles, filled up to seven with common kana, kept when it allows 15–60 words.
export function beePuzzle(day, words) {
  let seed =
    [...day].reduce(
      (h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619),
      2166136261,
    ) >>> 0;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const seeds = words.filter(
    (w) => tilesOf(w).size >= 6 && tilesOf(w).size <= 7,
  );
  const frequency = {};
  for (const w of words)
    for (const k of tilesOf(w)) frequency[k] = (frequency[k] || 0) + 1;
  const common = Object.keys(frequency)
    .sort((a, b) => frequency[b] - frequency[a])
    .slice(0, 15);
  let fallback = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const tiles = [...tilesOf(seeds[Math.floor(random() * seeds.length)])];
    while (tiles.length < 7) {
      const k = common[Math.floor(random() * common.length)];
      if (!tiles.includes(k)) tiles.push(k);
    }
    const center = tiles[Math.floor(random() * tiles.length)];
    const answers = allowed(words, tiles, center);
    const puzzle = {
      center,
      outer: tiles.filter((k) => k !== center),
      answers,
    };
    if (answers.length >= 15 && answers.length <= 60) return puzzle;
    if (!fallback || answers.length > fallback.answers.length)
      fallback = puzzle;
  }
  return fallback;
}

// 3 kana: 1 point; longer: one per kana; all seven tiles: 7 more.
export const beePoints = (word) =>
  ([...word].length === 3 ? 1 : [...word].length) +
  (tilesOf(word).size === 7 ? 7 : 0);
export const beeTotal = (words) => words.reduce((n, w) => n + beePoints(w), 0);

export function checkBeeWord(word, puzzle, found) {
  const tiles = [puzzle.center, ...puzzle.outer];
  if (!/^[ぁ-ゖー]+$/u.test(word) || [...word].length < 3)
    return { error: '3文字以上のひらがなで答えてください。' };
  if (![...tilesOf(word)].every((k) => tiles.includes(k)))
    return { error: '使えるのは7つのかなだけです。' };
  if (!tilesOf(word).has(puzzle.center))
    return { error: `真ん中の「${puzzle.center}」を使ってください。` };
  if (found.includes(word)) return { error: 'もう見つけました。' };
  if (!puzzle.answers.includes(word))
    return { error: 'よく使う言葉の一覧にありません。' };
  return { word, points: beePoints(word), all: tilesOf(word).size === 7 };
}

// Ranks by share of the day's total points.
export const BEE_RANKS = [
  [0, 'はじめ'],
  [0.05, '見習い'],
  [0.15, 'まずまず'],
  [0.3, 'いい感じ'],
  [0.5, 'すごい'],
  [0.7, '達人'],
  [1, '天才'],
];
export function beeRank(points, total) {
  const share = total ? points / total : 0;
  let index = 0;
  BEE_RANKS.forEach(([min], i) => {
    if (share >= min) index = i;
  });
  return { index, name: String(BEE_RANKS[index][1]) };
}

export function restoreBee(raw, puzzle) {
  try {
    const value = JSON.parse(raw);
    if (
      value?.version !== 1 ||
      !Array.isArray(value.found) ||
      value.found.some((w) => !puzzle.answers.includes(w)) ||
      new Set(value.found).size !== value.found.length ||
      typeof value.revealed !== 'boolean'
    )
      return null;
    return {
      version: 1,
      found: value.found,
      revealed: value.revealed,
      draft: typeof value.draft === 'string' ? value.draft.slice(0, 40) : '',
    };
  } catch {
    return null;
  }
}
