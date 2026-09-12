import { toHiragana } from 'wanakana';

// Keep a terminal nn pending so the next vowel can still form んな / んに.
// The same mapping commits nn to one ん when the player submits the word.
const inputMapping = {
  nn: 'ん',
  nna: 'んな',
  nni: 'んに',
  nnu: 'んぬ',
  nne: 'んね',
  nno: 'んの',
  nnya: 'んにゃ',
  nnyu: 'んにゅ',
  nnyo: 'んにょ',
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
  const value = convertRomaji(text).slice(0, 40);
  return {
    value,
    start: Math.min(convertRomaji(text.slice(0, start)).length, value.length),
    end: Math.min(convertRomaji(text.slice(0, end)).length, value.length),
  };
}

export function previewKana(text) {
  // A pending Latin syllable must not blank the kana already on the board.
  return /^[ぁ-ゖー]*[a-z']*$/iu.test(text)
    ? text.replace(/[a-z']+$/iu, '')
    : '';
}
