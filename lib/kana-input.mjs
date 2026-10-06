import { toHiragana } from 'wanakana';

// Two n presses finish one ん. Keep this mapping terminal so it does not
// wait for another letter or reuse the second n in the next syllable.
const inputMapping = {
  nn: 'ん',
  tcha: 'っちゃ',
  tchi: 'っち',
  tchu: 'っちゅ',
  tche: 'っちぇ',
  tcho: 'っちょ',
};

export function convertRomaji(text, commit = false) {
  return toHiragana(text.normalize('NFKC').replace(/m(?=[bp])/giu, 'n'), {
    IMEMode: !commit,
    convertLongVowelMark: false,
    customKanaMapping: inputMapping,
  }).normalize('NFC');
}

export function convertInput(text, start = text.length, end = start) {
  // WanaKana only keeps an unfinished syllable pending at the end of the text,
  // so "かn|く" would become かんく before the vowel arrives. Convert up to the
  // caret (plus any romaji touching it) on its own, so typing mid-word works
  // like typing at the end. Submitting or leaving the field commits the rest.
  let split = start;
  while (split < text.length && /[a-z'ａ-ｚＡ-Ｚ]/iu.test(text[split])) split++;
  const value = (
    convertRomaji(text.slice(0, split)) + convertRomaji(text.slice(split))
  ).slice(0, 40);
  return {
    value,
    start: Math.min(convertRomaji(text.slice(0, start)).length, value.length),
    end: Math.min(convertRomaji(text.slice(0, end)).length, value.length),
  };
}

export function previewKana(text) {
  // A pending Latin syllable, at the end or mid-word, must not blank the kana
  // already on the board.
  const kana = text.replace(/[a-z']+/giu, '');
  return /^[ぁ-ゖー]*$/u.test(kana) ? kana : '';
}
