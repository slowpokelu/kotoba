import test from 'node:test';
import assert from 'node:assert/strict';
import { answersFor, allValid, wordValid } from './word-pools.mjs';
import {
  dodge,
  evaluate,
  limitFor,
  newGame,
  outcome,
  restoreGame,
  shareText,
} from './game.mjs';
import {
  checkWord,
  cpuWord,
  newShiritori,
  restoreShiritori,
  tailKana,
} from './shiritori.mjs';

const pool = answersFor(4).map((a) => a.reading);

test('いじわる keeps every earlier score and is only solved when forced', () => {
  let game = newGame(pool[0], 'absurd');
  for (const guess of ['かいしゃ', 'おんがく', 'しんぶん', 'たいよう']) {
    const answer = dodge(game, guess, pool);
    // The new answer scores all earlier guesses exactly as shown.
    for (const g of game.guesses)
      assert.deepEqual(evaluate(g, answer), evaluate(g, game.answer), g);
    assert.notEqual(answer, guess, 'not solved while other words remain');
    game = { ...game, answer, guesses: [...game.guesses, guess] };
  }
  // With nowhere left to go, guessing the only word solves it.
  const last = newGame('がっこう', 'absurd');
  assert.equal(dodge(last, 'がっこう', ['がっこう']), 'がっこう');
  assert.equal(limitFor('absurd'), 50, 'いじわる has no practical limit');
  assert.equal(limitFor('practice'), 8);
  // Past eight guesses いじわる keeps going; only giving up ends it unsolved.
  assert.equal(outcome({ ...last, guesses: pool.slice(1, 13) }), 'playing');
  assert.equal(
    outcome({ ...last, guesses: pool.slice(1, 3), gaveUp: true }),
    'lost',
  );
  assert.match(
    shareText({ ...last, guesses: ['かいしゃ', 'がっこう'] }, ''),
    /いじわる {2}2手\n/,
  );
  const fallback = newGame(pool[0], 'absurd');
  const saved = { ...fallback, answer: pool[20], guesses: pool.slice(1, 15) };
  assert.deepEqual(
    restoreGame(JSON.stringify(saved), fallback, allValid, new Set(pool)),
    saved,
    'a 14-guess いじわる round restores',
  );
});

test('しりとり chains on the last kana, small kana full size, a final ー skipped', () => {
  assert.equal(tailKana('りんご'), 'ご');
  assert.equal(tailKana('きしゃ'), 'や');
  assert.equal(tailKana('すーぱー'), 'ぱ');
  assert.equal(tailKana('がっこう'), 'う');
  const chain = [{ word: 'りんご', by: 'cpu' }];
  assert.deepEqual(checkWord('ごりら', chain, allValid), { word: 'ごりら' });
  assert.match(checkWord('かめら', chain, allValid).error, /「ご」から始まる/);
  assert.match(checkWord('ご', chain, wordValid).error, /2文字以上/);
  // Two-kana words count, such as 飛ぶ, 犬 and 猫.
  assert.deepEqual(
    checkWord('とぶ', [{ word: 'ろうと', by: 'cpu' }], wordValid),
    { word: 'とぶ' },
  );
  for (const word of ['とぶ', 'いぬ', 'ねこ', 'とり'])
    assert.ok(wordValid.has(word), word + ' is playable');
  assert.match(checkWord('ごごごご', chain, allValid).error, /辞書にない/);
  assert.match(
    checkWord('ごりら', [...chain, { word: 'ごりら', by: 'you' }], allValid)
      .error,
    /「ら」から始まる/,
  );
  const used = [
    { word: 'ごりら', by: 'cpu' },
    { word: 'らっぱ', by: 'you' },
    { word: 'ぱんだ', by: 'cpu' },
    { word: 'だちょう', by: 'you' },
    { word: 'うさぎ', by: 'cpu' },
    { word: 'ぎんこう', by: 'you' },
    { word: 'うまごや', by: 'cpu' },
    { word: 'やまびこ', by: 'you' },
    { word: 'こうごう', by: 'cpu' },
  ];
  assert.match(
    checkWord('うさぎ', used, allValid).error,
    /もう出ました/,
    'no repeats',
  );
});

test('the computer prefers everyday words, never ends in ん and can be cornered', () => {
  const everyday = ['りんご', 'りんかい'];
  const all = ['りんご', 'りんかい', 'りかい', 'りょうりん'];
  const chain = [{ word: 'かなり', by: 'you' }];
  assert.equal(
    cpuWord('り', chain, [everyday, all], () => 0),
    'りんご',
  );
  assert.equal(
    cpuWord(
      'り',
      [...chain, { word: 'りんご', by: 'cpu' }],
      [everyday, all],
      () => 0,
    ),
    'りんかい',
  );
  // Only ん endings or used words left in the first pool: fall back.
  assert.equal(
    cpuWord(
      'り',
      [
        { word: 'りんご', by: 'cpu' },
        { word: 'りんかい', by: 'cpu' },
      ],
      [everyday, all],
      () => 0,
    ),
    'りかい',
  );
  assert.equal(cpuWord('ぬ', chain, [everyday, all]), null);
});

test('a saved しりとり round is kept only if every link follows the rules', () => {
  const round = newShiritori('りんご');
  const good = {
    ...round,
    chain: [...round.chain, { word: 'ごりら', by: 'you' }],
    draft: 'ら',
  };
  assert.deepEqual(restoreShiritori(JSON.stringify(good), allValid), good);
  for (const bad of [
    'oops',
    JSON.stringify({ ...good, chain: [] }),
    JSON.stringify({ ...good, end: 'won' }),
    JSON.stringify({
      ...good,
      chain: [...good.chain, { word: 'かめら', by: 'cpu' }],
    }),
    JSON.stringify({ ...good, chain: [{ word: 'りんご', by: 'robot' }] }),
  ])
    assert.equal(restoreShiritori(bad, allValid), null, bad);
});

test('ダブル counts every guess on both boards until each is solved', async () => {
  const {
    newDouble,
    doubleOutcome,
    solvedAt,
    boardGuesses,
    splitKeys,
    restoreDouble,
    doubleShare,
    DOUBLE_LIMIT,
  } = await import('./double.mjs');
  const round = newDouble(pool, () => 0.5);
  assert.notEqual(round.answers[0], round.answers[1], 'two different words');
  const [a, b] = ['がっこう', 'しんぶん'];
  const playing = { ...round, answers: [a, b], guesses: ['かいしゃ', a] };
  assert.equal(solvedAt(playing, 0), 1);
  assert.equal(solvedAt(playing, 1), -1);
  assert.equal(doubleOutcome(playing), 'playing');
  const later = { ...playing, guesses: [...playing.guesses, 'たいよう'] };
  assert.deepEqual(
    boardGuesses(later, 0),
    ['かいしゃ', a],
    'a solved board stops',
  );
  assert.equal(boardGuesses(later, 1).length, 3);
  assert.equal(
    doubleOutcome({ ...later, guesses: [...later.guesses, b] }),
    'won',
  );
  assert.equal(
    doubleOutcome({
      ...playing,
      guesses: pool.filter((w) => w !== b).slice(0, DOUBLE_LIMIT),
    }),
    'lost',
  );
  // Split keys: こ is ✓ on the left board (がっこう) and absent on the right.
  assert.deepEqual(splitKeys(later).こ, ['correct', 'absent']);
  assert.deepEqual(
    restoreDouble(JSON.stringify(later), allValid, new Set(pool)),
    later,
  );
  assert.equal(
    restoreDouble(
      JSON.stringify({ ...later, answers: [a, a] }),
      allValid,
      new Set(pool),
    ),
    null,
    'the two words must differ',
  );
  const share = doubleShare({ ...later, guesses: [...later.guesses, b] });
  assert.match(share, /ダブル {2}4\/9/);
  assert.equal(
    share.split('\n')[4].split(' ')[0],
    '　　　　',
    'the left board is blank once solved',
  );
});
