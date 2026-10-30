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
    '⬛⬛⬛⬛',
    'the left board is filled in once solved',
  );
});

test('トリプル: three different words and one guess more', async () => {
  const {
    newDouble,
    doubleOutcome,
    splitKeys,
    restoreDouble,
    doubleShare,
    boardsLimit,
  } = await import('./double.mjs');
  const round = newDouble(pool, () => 0.5, 3);
  assert.equal(new Set(round.answers).size, 3, 'three different words');
  assert.equal(boardsLimit(3), 10);
  const [a, b, c] = ['がっこう', 'しんぶん', 'たいよう'];
  const playing = { ...round, answers: [a, b, c], guesses: ['かいしゃ', a] };
  assert.deepEqual(splitKeys(playing).こ, ['correct', 'absent', 'absent']);
  assert.equal(
    doubleOutcome({ ...playing, guesses: [...playing.guesses, b] }),
    'playing',
  );
  assert.equal(
    doubleOutcome({ ...playing, guesses: [...playing.guesses, b, c] }),
    'won',
  );
  const others = pool.filter((w) => ![a, b, c].includes(w));
  assert.equal(
    doubleOutcome({ ...playing, guesses: others.slice(0, 9) }),
    'playing',
    'nine guesses are not the end',
  );
  assert.equal(
    doubleOutcome({ ...playing, guesses: others.slice(0, 10) }),
    'lost',
  );
  assert.deepEqual(
    restoreDouble(JSON.stringify(playing), allValid, new Set(pool), 3),
    playing,
  );
  assert.equal(
    restoreDouble(JSON.stringify(playing), allValid, new Set(pool)),
    null,
    'a ダブル save never loads three boards',
  );
  const share = doubleShare({
    ...playing,
    guesses: [...playing.guesses, b, c],
  });
  assert.match(share, /トリプル {2}4\/10/);
  assert.equal(share.split('\n')[2].split(' ').length, 3);
});

test('かなビー: a fixed daily puzzle of 15–60 common words around a centre kana', async () => {
  const { commonWords } = await import('./word-pools.mjs');
  const bee = await import('./bee.mjs');
  const words = bee.beeWords(commonWords);
  const puzzle = bee.beePuzzle('2026-11-01', words);
  assert.deepEqual(
    bee.beePuzzle('2026-11-01', words),
    puzzle,
    'same day, same puzzle',
  );
  assert.notDeepEqual(bee.beePuzzle('2026-11-02', words), puzzle);
  assert.equal(puzzle.outer.length, 6);
  assert.ok(puzzle.answers.length >= 15 && puzzle.answers.length <= 60);
  const tiles = [puzzle.center, ...puzzle.outer];
  for (const w of puzzle.answers) {
    assert.ok(bee.tilesOf(w).has(puzzle.center), w + ' uses the centre');
    assert.ok(
      [...bee.tilesOf(w)].every((k) => tiles.includes(k)),
      w,
    );
  }
  // Small kana count as their full-size tile; ー is free.
  assert.deepEqual([...bee.tilesOf('しゃーぷ')], ['し', 'や', 'ぷ']);
  const [first] = puzzle.answers;
  assert.deepEqual(bee.checkBeeWord(first, puzzle, []).word, first);
  assert.match(bee.checkBeeWord(first, puzzle, [first]).error, /もう見つけ/);
  assert.match(bee.checkBeeWord('ああ', puzzle, []).error, /3文字以上/);
  const outside = ['ぬ', 'ぺ', 'ゑ'].find((k) => !tiles.includes(k));
  assert.match(
    bee.checkBeeWord(puzzle.center + outside + puzzle.center, puzzle, []).error,
    /7つのかなだけ/,
  );
  const noCentre = puzzle.outer.slice(0, 3).join('');
  assert.match(bee.checkBeeWord(noCentre, puzzle, []).error, /真ん中/);
  assert.equal(bee.beePoints('かかか'), 1);
  assert.equal(bee.beePoints('かきくけ'), 4);
  assert.equal(bee.beePoints('あいうえおかき'), 7 + 7, 'all seven tiles add 7');
  assert.equal(bee.beeRank(0, 100).name, 'はじめ');
  assert.equal(bee.beeRank(100, 100).name, '天才');
  const saved = { version: 1, found: [first], revealed: false, draft: 'か' };
  assert.deepEqual(bee.restoreBee(JSON.stringify(saved), puzzle), saved);
  assert.equal(
    bee.restoreBee(JSON.stringify({ ...saved, found: ['ぬぬぬ'] }), puzzle),
    null,
  );
});

test('every game has an address, and today/practice where it has both', async () => {
  const { parseRoute, routePath, ROUTE_PATHS } = await import('./routes.mjs');
  assert.deepEqual(parseRoute('/kotoba/'), {
    game: 'kotoba',
    practice: false,
    base: '/kotoba/',
  });
  assert.deepEqual(parseRoute('/kotoba/double/practice/'), {
    game: 'double',
    practice: true,
    base: '/kotoba/',
  });
  assert.equal(parseRoute('/kotoba/sneaky').game, 'absurd');
  assert.equal(
    parseRoute('/kotoba/bee/practice/').practice,
    false,
    'かなビー has no practice',
  );
  for (const path of ROUTE_PATHS) {
    const { game, practice } = parseRoute('/kotoba/' + path);
    assert.equal(routePath('/kotoba/', game, practice), '/kotoba/' + path);
  }
  assert.equal(new Set(ROUTE_PATHS).size, 12);
});

test("today's ダブル and トリプル: fixed per day, no word shared", async () => {
  const { dailyAnswers } = await import('./double.mjs');
  const exclude = [pool[0]];
  const two = dailyAnswers('2026-10-30', pool, 2, exclude);
  const three = dailyAnswers('2026-10-30', pool, 3, exclude);
  assert.deepEqual(two, dailyAnswers('2026-10-30', pool, 2, exclude));
  assert.equal(new Set([...two, ...three, ...exclude]).size, 6);
  assert.notDeepEqual(two, dailyAnswers('2026-10-31', pool, 2, exclude));
});

test('和同開珎: the centre is the only kanji that fits all four clues', async () => {
  const W = await import('./wadou.mjs');
  const { puzzles, words, readings } = await import('./wadou-data.mjs');
  assert.ok(puzzles.length > 1000, 'about three years of daily puzzles');
  const kanji = new Set([...words].flatMap((w) => [...w]));
  // A sample keeps the test quick; the generator checks every puzzle.
  for (const puzzle of puzzles.filter((_, i) => i % 50 === 0)) {
    assert.equal(puzzle.k.length, 4);
    assert.ok(W.fits(puzzle.c, puzzle, words).every(Boolean));
    const others = [...kanji].filter(
      (k) => k !== puzzle.c && W.fits(k, puzzle, words).every(Boolean),
    );
    assert.deepEqual(others, [], puzzle.c + ' has a rival');
    for (const [word] of puzzle.w) assert.ok(words.has(word));
  }
  // 暗: 暗号 明暗 暗殺 暗黙.
  const anki = { c: '暗', k: ['号>', '明<', '殺>', '黙>'], w: [] };
  assert.equal(W.clueWord('明<', '暗'), '明暗');
  assert.equal(W.clueWord('号>', '暗'), '暗号');
  assert.deepEqual(W.fits('本', anki, words), [false, false, false, false]);
  assert.ok(readings['ほん'].includes('本'), 'kana find kanji');
  assert.equal(W.checkKanji('日本', []).error, '漢字1文字で答えてください。');
  assert.equal(W.checkKanji('ほん', []).error, '漢字1文字で答えてください。');
  assert.equal(W.checkKanji('本', ['本']).error, 'その漢字はもう試しました。');
  const round = { version: 1, puzzle: 0, guesses: ['本', '暗'], gaveUp: false };
  assert.equal(W.wadouOutcome(round, anki), 'won');
  assert.equal(
    W.wadouOutcome({ ...round, guesses: ['一', '二', '三', '四', '五'] }, anki),
    'lost',
  );
  assert.match(
    W.wadouShare(round, anki, words, '2026-11-01'),
    /^ことば · 和同開珎 · 2026-11-01 {2}2\/5\n\n⬜⬜⬜⬜\n🟦🟦🟦🟦\n\nhttps:\/\/slowpokelu\.github\.io\/kotoba\/wadou\/$/,
  );
  assert.deepEqual(
    W.restoreWadou(JSON.stringify({ ...round, solved: true }), puzzles.length),
    { ...round, solved: true, draft: '' },
  );
  assert.equal(
    W.restoreWadou(JSON.stringify({ ...round, puzzle: 99999 }), puzzles.length),
    null,
  );
  assert.equal(W.dailyIndex('2026-10-31', 10), 0);
  assert.equal(W.dailyIndex('2026-11-11', 10), 1);
});

test('ことばのはしご: one kana per rung, a par through common words', async () => {
  const L = await import('./ladder.mjs');
  const { commonWords, answersFor, wordValid } =
    await import('./word-pools.mjs');
  const three = (w) => [...w].length === 3;
  const graph = L.ladderGraph(Object.keys(commonWords).filter(three));
  assert.ok(graph('さくら').every((w) => three(w) && w !== 'さくら'));
  const ends = answersFor(3)
    .map((a) => a.reading)
    .filter((w) => w in commonWords);
  const a = L.makeLadder(ends, graph, L.seeded('ladder:2026-11-01'));
  const b = L.makeLadder(ends, graph, L.seeded('ladder:2026-11-01'));
  assert.deepEqual(a, b, 'the same ladder for everyone on a day');
  assert.ok([4, 5].includes(a.par));
  const path = L.shortestPath(a.start, a.goal, graph);
  assert.equal(path.length - 1, a.par);
  const round = { start: a.start, goal: a.goal, par: a.par, steps: [] };
  assert.deepEqual(L.checkRung(path[1], round, wordValid), { word: path[1] });
  assert.match(
    L.checkRung(path[2], round, wordValid).error,
    /1文字だけ|もう出ました|辞書/,
  );
  assert.equal(
    L.checkRung(a.start, round, wordValid).error,
    'その言葉はもう出ました。',
  );
  const done = { ...round, version: 1, steps: path.slice(1), gaveUp: false };
  assert.equal(L.ladderOutcome(done), 'won');
  assert.deepEqual(L.restoreLadder(JSON.stringify(done), wordValid), {
    ...done,
    draft: '',
  });
  assert.equal(
    L.restoreLadder(JSON.stringify({ ...done, steps: [path[2]] }), wordValid),
    null,
    'every saved rung is one kana from the last',
  );
  const share = L.ladderShare(done, '2026-11-01');
  assert.ok(
    share.includes(`${a.start} → ${a.goal}  ${a.par}手（最短${a.par}手）`),
  );
  assert.ok(share.split('\n').includes('🟦🟦🟦'));
});

test("a friend's puzzle travels in its link", async () => {
  const { encodeWord, decodeWord } = await import('./custom.mjs');
  const G = await import('./game.mjs');
  for (const word of ['ねこぜ', 'がっこう', 'らーめん', 'しゃしんか'])
    assert.equal(decodeWord(encodeWord(word)), word);
  assert.ok(!encodeWord('がっこう').includes('が'));
  for (const bad of ['', 'zz', 'zzzzzz', 'ABCDEF', '0h350k1', null])
    assert.equal(decodeWord(bad), '');
  const code = encodeWord('がっこう');
  const id = 'custom:' + code;
  assert.equal(G.gameLength(id), 4);
  const game = { ...G.newGame('がっこう', id), guesses: ['がっこう'] };
  const shared = G.shareText(game, '2026-11-01');
  assert.ok(shared.startsWith('ことば · 友だちの問題 · 4文字  1/8'));
  assert.ok(shared.endsWith('https://slowpokelu.github.io/kotoba/?w=' + code));
});

test('ふたりでしりとり: players take turns after the prompt', async () => {
  const S = await import('./shiritori.mjs');
  const round = S.newShiritori('りんご');
  assert.equal(S.duoTurn(round), 'p1');
  const next = {
    ...round,
    chain: [...round.chain, { word: 'ごりら', by: 'p1' }],
  };
  assert.equal(S.duoTurn(next), 'p2');
  assert.deepEqual(
    S.restoreShiritori(JSON.stringify(next), allValid).chain,
    next.chain,
  );
  assert.match(S.shiritoriShare(next), /^ことば · ふたりでしりとり {2}1語/);
  assert.match(S.shiritoriShare(round), /^ことば · しりとり {2}0語/);
});
