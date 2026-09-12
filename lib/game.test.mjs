import test from 'node:test';
import { resultCard, drawResultCard } from './share-card.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { answers } from './answers.mjs';
import { allAnswers, allValid, answersFor, aliasesFor } from './word-pools.mjs';
import {
  normalize,
  evaluate,
  keyboardStates,
  dailyAnswer,
  localDay,
  validateGuess,
  newGame,
  restoreGame,
  outcome,
  modifyLast,
  shareText,
  practiceId,
  gameLength,
} from './game.mjs';
const dictionary = JSON.parse(
  readFileSync(new URL('./dictionary.json', import.meta.url)),
);
const valid = new Set(dictionary.readings),
  answerSet = new Set(answers.map((a) => a.reading));
test('practice pools are distinct, dictionary-valid, and length-specific', () => {
  assert.equal(
    new Set(allAnswers.map((a) => a.reading)).size,
    allAnswers.length,
  );
  assert.deepEqual(
    answersFor(4),
    answers,
    'daily pool order stays exactly the same',
  );
  for (const n of [3, 4, 5, 6]) {
    const pool = answersFor(n);
    assert.ok(pool.length >= 40);
    for (const a of pool) {
      assert.equal(gameLength(practiceId(n)), n);
      assert.equal(
        validateGuess(a.reading, [], allValid, aliasesFor(n), n).guess,
        a.reading,
      );
      assert.deepEqual(
        evaluate(a.reading, a.reading),
        Array(n).fill('correct'),
      );
      assert.ok(
        validateGuess(a.reading + 'あ', [], allValid, aliasesFor(n), n).error,
      );
    }
  }
  assert.equal(
    validateGuess('高校生', [], allValid, aliasesFor(6), 6).guess,
    'こうこうせい',
  );
  assert.equal(
    validateGuess('冷蔵庫', [], allValid, aliasesFor(5), 5).guess,
    'れいぞうこ',
  );
  assert.equal(
    validateGuess('スイゾクカン', [], allValid, aliasesFor(6), 6).guess,
    'すいぞくかん',
  );
  assert.equal(
    validateGuess('桜', [], allValid, aliasesFor(3), 3).guess,
    'さくら',
  );
  assert.deepEqual(evaluate('こころ', 'こころ'), [
    'correct',
    'correct',
    'correct',
  ]);
  assert.deepEqual(evaluate('こここここ', 'かここころ'), [
    'absent',
    'correct',
    'correct',
    'correct',
    'absent',
  ]);
});
test('all curated answers are distinct four-kana dictionary entries', () => {
  assert.equal(answerSet.size, answers.length);
  assert.ok(answers.length > 400);
  for (const a of answers) {
    assert.match(a.reading, /^[ぁ-ゖー]{4}$/u);
    assert.ok(valid.has(a.reading));
  }
});
test('duplicate letters consume only remaining occurrences, exact matches first', () => {
  assert.deepEqual(evaluate('こころろ', 'ころころ'), [
    'correct',
    'present',
    'present',
    'correct',
  ]);
  assert.deepEqual(evaluate('かかかか', 'かたかな'), [
    'correct',
    'absent',
    'correct',
    'absent',
  ]);
  assert.deepEqual(evaluate('しんぶん', 'しんぶん'), Array(4).fill('correct'));
  assert.deepEqual(evaluate('あいうえ', 'かきくけ'), Array(4).fill('absent'));
});
test('kana normalization handles full/half width and decomposed voicing; small kana stay distinct', () => {
  assert.equal(normalize(' ガッコウ '), 'がっこう');
  assert.equal(normalize('ｺｰﾋｰ'), 'こーひー');
  assert.equal(normalize('か\u3099っこう'), 'がっこう');
  assert.notEqual(normalize('つ'), normalize('っ'));
});
test('validation rejects unknown, repeated, too short, or unresolved kanji without spending a turn', () => {
  assert.equal(validateGuess('ガッコウ', [], valid).guess, 'がっこう');
  assert.equal(
    validateGuess('学校', [], valid, dictionary.aliases).guess,
    'がっこう',
  );
  for (const raw of ['あ', 'あいうえお', 'abc', 'ゎゎゎゎ'])
    assert.ok(validateGuess(raw, [], valid).error);
  assert.ok(validateGuess('がっこう', ['がっこう'], valid).error);
});
test('keyboard evidence never downgrades a known exact letter', () => {
  const keys = keyboardStates(['かかかか', 'たかかか'], 'かたかな');
  assert.equal(keys['か'], 'correct');
  assert.equal(keys['た'], 'present');
});
test('daily schedule is deterministic with no repeats for a full cycle', () => {
  const found = new Set();
  for (let i = 0; i < answers.length; i++) {
    const d = new Date(Date.UTC(2026, 8, 7 + i)).toISOString().slice(0, 10);
    found.add(dailyAnswer(d, answers).reading);
  }
  assert.equal(found.size, answers.length);
  assert.deepEqual(
    dailyAnswer('2026-09-07', answers),
    dailyAnswer('2026-09-07', answers),
  );
  assert.equal(localDay(new Date(2026, 8, 7, 23, 59)), '2026-09-07');
});
test('restoring games validates the full record and handles corrupt/unavailable storage', () => {
  const fresh = newGame('がっこう', 'daily:2026-09-07');
  const good = { ...fresh, guesses: ['しんぶん'], draft: 'ひま' };
  assert.deepEqual(
    restoreGame(JSON.stringify(good), fresh, valid, answerSet),
    good,
  );
  for (const invalid of [
    'bad',
    null,
    JSON.stringify({ ...good, answer: 'しんぶん' }),
    JSON.stringify({ ...good, guesses: ['がっこう', 'しんぶん'] }),
    JSON.stringify({ ...good, guesses: ['しんぶん', 'しんぶん'] }),
  ])
    assert.deepEqual(restoreGame(invalid, fresh, valid, answerSet), fresh);
});
test('win/loss limits and spoiler-free share output', () => {
  const win = {
    ...newGame('がっこう', 'daily:2026-09-07'),
    guesses: ['しんぶん', 'がっこう'],
  };
  assert.equal(outcome(win), 'won');
  assert.ok(shareText(win, '2026-09-07').includes('2/8'));
  assert.ok(!shareText(win, '2026-09-07').includes('がっこう'));
  for (const game of [
    win,
    { ...win, id: 'practice' },
    { ...win, id: 'practice:3', answer: 'さくら', guesses: ['さくら'] },
    { ...win, guesses: [], gaveUp: true },
  ]) {
    const shared = shareText(game, '2026-09-07');
    assert.ok(shared.endsWith('\n\nhttps://slowpokelu.github.io/kotoba/'));
    assert.equal(
      shared.split('https://slowpokelu.github.io/kotoba/').length,
      2,
    );
  }
  const loss = {
    ...win,
    guesses: answers
      .filter((a) => a.reading !== 'がっこう')
      .slice(0, 8)
      .map((a) => a.reading),
  };
  assert.equal(outcome(loss), 'lost');
  assert.equal(
    outcome({ ...loss, guesses: loss.guesses.slice(0, 7) }),
    'playing',
  );
});
test('share cards cover every length and contain only public result data', () => {
  for (const length of [3, 4, 5, 6]) {
    for (const language of ['ja', 'en']) {
      for (const dark of [false, true]) {
        const game = {
          ...newGame(
            'あ'.repeat(length),
            length === 4 ? 'practice' : `practice:${length}`,
          ),
          guesses: ['あ'.repeat(length)],
        };
        const card = resultCard(game, '2026-09-12', language);
        assert.equal(card.length, length);
        assert.equal(card.score, '1/8');
        assert.deepEqual(card.rows, [Array(length).fill('correct')]);
        assert.ok(!JSON.stringify(card).includes(game.answer));
        assert.ok(card.text.endsWith('https://slowpokelu.github.io/kotoba/'));
        const fills = [],
          text = [];
        const context = {
          fillStyle: '',
          fillRect(...rect) {
            fills.push({ rect, color: this.fillStyle });
          },
          fillText(value) {
            text.push(value);
          },
        };
        const canvas = { width: 0, height: 0, getContext: () => context };
        drawResultCard(canvas, card, dark);
        assert.equal(canvas.width, 720);
        assert.equal(fills.length, length + 2);
        assert.equal(fills[2].color, dark ? '#94b0ff' : '#254cca');
        assert.ok(text.includes(card.score));
        assert.ok(!text.includes(game.answer));
        for (const {
          rect: [x, y, width, height],
        } of fills) {
          assert.ok(
            x >= 0 &&
              y >= 0 &&
              x + width <= canvas.width &&
              y + height <= canvas.height,
          );
        }
      }
    }
  }
  const empty = resultCard(
    { ...newGame('がっこう', 'daily:2026-09-12'), gaveUp: true },
    '2026-09-12',
  );
  assert.equal(empty.score, 'X/8');
  assert.deepEqual(empty.rows, []);
});
test('on-screen modifiers cycle voiced, semi-voiced and small kana', () => {
  assert.equal(modifyLast('は', 'voice'), 'ば');
  assert.equal(modifyLast('ば', 'voice'), 'ぱ');
  assert.equal(modifyLast('ぱ', 'voice'), 'は');
  assert.equal(modifyLast('がつ', 'small'), 'がっ');
  assert.equal(modifyLast('ん', 'small'), 'ん');
});
