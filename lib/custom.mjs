// A puzzle made for a friend travels in its link (?w=…). Each kana becomes
// two base-36 digits, mixed with its position, so the word does not show in
// the address at a glance. It is a disguise, not a secret.
const BASE = 0x3040;
const mix = (i) => (i * 53 + 29) & 0x7f;
export const encodeWord = (word) =>
  [...word]
    .map((c, i) =>
      ((c.codePointAt(0) - BASE) ^ mix(i)).toString(36).padStart(2, '0'),
    )
    .join('');
export function decodeWord(code) {
  if (typeof code !== 'string' || !/^(?:[0-9a-z]{2}){3,6}$/.test(code))
    return '';
  let word = '';
  for (let i = 0; i < code.length / 2; i++) {
    const c = BASE + (parseInt(code.slice(i * 2, i * 2 + 2), 36) ^ mix(i));
    // Hiragana and ー only.
    if (!((c >= 0x3041 && c <= 0x3096) || c === 0x30fc)) return '';
    word += String.fromCodePoint(c);
  }
  return word;
}
