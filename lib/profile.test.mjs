import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { answers } from './answers.mjs';
import {
  newGame,
  dailyAnswer,
  outcome,
  restoreGame,
  shareText,
} from './game.mjs';
import { dailyStats, parseBackup, mergeGames, readGames } from './profile.mjs';
const valid = new Set(
  JSON.parse(readFileSync(new URL('./dictionary.json', import.meta.url)))
    .readings,
);
const daily = (day, win = true) => {
  const g = newGame(dailyAnswer(day, answers).reading, 'daily:' + day);
  return win ? { ...g, guesses: [g.answer] } : { ...g, gaveUp: true };
};
test('give up is a persisted loss, even without a guess', () => {
  const game = daily('2026-09-10', false);
  assert.equal(outcome(game), 'lost');
  assert.match(shareText(game, '2026-09-10'), /X\/8/);
  assert.equal(
    restoreGame(
      JSON.stringify(game),
      newGame(game.answer, game.id),
      valid,
      new Set(answers.map((a) => a.reading)),
    ).gaveUp,
    true,
  );
});
test('daily statistics deduplicate dates, ignore practice and unfinished games, and handle gaps', () => {
  const games = [
    daily('2026-09-08'),
    daily('2026-09-09'),
    daily('2026-09-09'),
    newGame('がっこう', 'practice'),
  ];
  assert.equal(dailyStats(games, '2026-09-10').current, 2);
  assert.equal(dailyStats(games, '2026-09-10').played, 2);
  assert.equal(dailyStats(games, '2026-09-11').current, 0);
  const stats = dailyStats(
    [...games, daily('2026-09-10', false)],
    '2026-09-10',
  );
  assert.equal(stats.current, 0);
  assert.equal(stats.best, 2);
  assert.equal(stats.rate, 67);
  assert.deepEqual(stats.distribution, [2, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(
    dailyStats([daily('2026-09-08'), daily('2026-09-10')], '2026-09-10').best,
    1,
  );
});
test('backup round trip validates every game; invalid imports cannot silently reset progress', () => {
  const data = {
    app: 'kotoba',
    version: 1,
    theme: 'dark',
    games: [daily('2026-09-10')],
  };
  assert.deepEqual(parseBackup(JSON.stringify(data), answers, valid), data);
  for (const bad of [
    null,
    {},
    { ...data, version: 3 },
    { ...data, games: [...data.games, ...data.games] },
    { ...data, games: [{ ...data.games[0], gaveUp: true }] },
    { ...data, games: [{ ...data.games[0], id: 'daily:2026-02-31' }] },
    { ...data, games: [{ ...data.games[0], answer: 'xxxx' }] },
  ]) {
    assert.throws(() => parseBackup(JSON.stringify(bad), answers, valid));
  }
});
test('reimporting never duplicates games or replaces a completed local result', () => {
  const local = daily('2026-09-10', false),
    incoming = daily('2026-09-10');
  assert.deepEqual(mergeGames([local], [incoming]), [local]);
  const merged = mergeGames([], [incoming]);
  assert.deepEqual(mergeGames(merged, [incoming]), merged);
  assert.deepEqual(
    mergeGames([newGame(incoming.answer, incoming.id)], [incoming]),
    [incoming],
  );
});
test('historical browser games are recovered and unrelated data is ignored', () => {
  const entries = [
    ['kotoba:v1:daily:2026-09-10', JSON.stringify(daily('2026-09-10'))],
    ['kotoba:v1:broken', '{'],
    ['unrelated', '{}'],
  ];
  const storage = {
    length: entries.length,
    key: (i) => entries[i][0],
    getItem: (key) => entries.find((e) => e[0] === key)?.[1],
  };
  assert.equal(readGames(storage, answers, valid).length, 1);
});
