import test from 'node:test';
import assert from 'node:assert/strict';
import { convertRomaji, convertInput, previewKana } from './kana-input.mjs';

const typeWord = (word) => {
  let value = '';
  for (const letter of word) value = convertRomaji(value + letter);
  return convertRomaji(value, true);
};

test('pasted and incrementally typed romaji use the same kana', () => {
  for (const [word, kana] of [
    ['gakkou', 'がっこう'],
    ['shinbun', 'しんぶん'],
    ['shimbun', 'しんぶん'],
    ['tempura', 'てんぷら'],
    ['shinnbunn', 'しんぶん'],
    ['konnichiha', 'こんにちは'],
    ['konnnichiha', 'こんにちは'],
    ["kan'i", 'かんい'],
    ['nyanko', 'にゃんこ'],
    ['matcha', 'まっちゃ'],
    ['kyuukei', 'きゅうけい'],
    ['syasin', 'しゃしん'],
    ['shashin', 'しゃしん'],
    ['si', 'し'],
    ['ti', 'ち'],
    ['xtu', 'っ'],
    ['ltsu', 'っ'],
    ['xya', 'ゃ'],
    ['su-pa-', 'すーぱー'],
    ['ＧＡＫＫＯＵ', 'がっこう'],
  ]) {
    assert.equal(convertRomaji(word, true), kana, word + ' pasted');
    assert.equal(typeWord(word), kana, word + ' typed');
  }
});

test('unfinished syllables stay editable and do not erase the tile preview', () => {
  for (const draft of ['あk', 'あsh', 'あky', 'あn', 'あnn']) {
    assert.equal(convertRomaji(draft), draft);
    assert.equal(previewKana(draft), 'あ');
  }
  assert.equal(convertRomaji('しんぶn', true), 'しんぶん');
  assert.equal(convertRomaji('しんぶnn', true), 'しんぶん');
  assert.equal(convertRomaji('あq', true), 'あq');
  assert.equal(previewKana('学校'), '');
});

test('Japanese input, kanji aliases and long vowel marks are preserved', () => {
  assert.equal(convertRomaji('ｶﾞｯｺｳ'), 'がっこう');
  assert.equal(convertRomaji('スーパー'), 'すーぱー');
  assert.equal(convertRomaji('学校'), '学校');
  assert.equal(convertRomaji('がkkoう'), 'がっこう');
});

test('conversion maps insertion and selection positions without trimming spaces', () => {
  assert.deepEqual(convertInput('かshaく', 4), {
    value: 'かしゃく',
    start: 3,
    end: 3,
  });
  assert.deepEqual(convertInput('あshiう', 1, 4), {
    value: 'あしう',
    start: 1,
    end: 2,
  });
  assert.deepEqual(convertInput('ka '), { value: 'か ', start: 2, end: 2 });
  assert.equal(convertInput('a'.repeat(80)).value.length, 40);
});
