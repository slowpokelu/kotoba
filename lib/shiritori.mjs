/* oxlint-disable typescript/no-misused-spread -- NFC kana are single code points by game design. */
import { shareLink } from './routes.mjs';
// しりとり: each word starts with the last kana of the one before. Small kana
// count as full size (しゃ → や), a final ー is skipped (すーぱー → ぱ), and a
// word ending in ん loses. Words have at least two kana.
export const SHIRITORI_KEY = 'kotoba:v1:shiritori';
export const SHIRITORI_BEST_KEY = 'kotoba:shiritori-best';
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
export const headKana = (word) => [...word][0];
export function tailKana(word) {
  const kana = [...word];
  while (kana.length > 1 && kana.at(-1) === 'ー') kana.pop();
  return fullSize[kana.at(-1)] || kana.at(-1);
}
export const losesOnN = (word) => tailKana(word) === 'ん';

export function checkWord(word, chain, valid) {
  if (!/^[ぁ-ゖー]+$/u.test(word) || [...word].length < 2)
    return { error: '2文字以上のひらがなで答えてください。' };
  if (!valid.has(word))
    return { error: '辞書にない言葉です。別の言葉を試してみてください。' };
  const need = chain.length ? tailKana(chain.at(-1).word) : null;
  if (need && headKana(word) !== need)
    return { error: `「${need}」から始まる言葉を答えてください。` };
  if (chain.some((link) => link.word === word))
    return { error: 'その言葉はもう出ました。' };
  return { word };
}

// The computer answers from the first pool that has a word: everyday words
// first, then the whole dictionary. It never ends in ん and never repeats.
export function cpuWord(need, chain, pools, random = Math.random) {
  const used = new Set(chain.map((link) => link.word));
  for (const pool of pools) {
    const options = pool.filter(
      (w) => (!need || headKana(w) === need) && !used.has(w) && !losesOnN(w),
    );
    if (options.length) return options[Math.floor(random() * options.length)];
  }
  return null;
}

export function newShiritori(first) {
  return {
    version: 1,
    chain: [{ word: first, by: 'cpu' }],
    end: null,
    draft: '',
  };
}

// A saved round is kept only if every link follows the rules.
export function restoreShiritori(raw, valid) {
  try {
    const value = JSON.parse(raw);
    if (
      value?.version !== 1 ||
      !Array.isArray(value.chain) ||
      !value.chain.length ||
      ![null, 'n', 'gave-up', 'cpu'].includes(value.end)
    )
      return null;
    const chain = [];
    for (const link of value.chain) {
      if (!['cpu', 'you'].includes(link?.by) || typeof link.word !== 'string')
        return null;
      if (checkWord(link.word, chain, valid).error) return null;
      chain.push({ word: link.word, by: link.by });
    }
    return {
      version: 1,
      chain,
      end: value.end,
      draft: typeof value.draft === 'string' ? value.draft.slice(0, 40) : '',
    };
  } catch {
    return null;
  }
}
export const yourWords = (round) =>
  round.chain.filter((link) => link.by === 'you').length;
export const shiritoriShare = (round) =>
  `ことば · しりとり  ${yourWords(round)}語\n\n${shareLink('shiritori')}`;
