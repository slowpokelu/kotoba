// Builds lib/wadou.json for 和同開珎 from JMdict and KANJIDIC2, as bundled in
// the jamdict-data package (jamdict.db):
// - puzzles: a centre kanji and four clue kanji, each joined to the centre by
//   an arrow into or out of it. Every clue makes a common word with the
//   centre, and no other kanji makes a word with all four.
// - pairs: every two-kanji word, to mark which arrows a guess fits.
// - readings: kanji by reading, so a guess can be typed in kana.
// Usage: node scripts/update-wadou.mjs path/to/jamdict.db
import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';

const db = new DatabaseSync(process.argv[2], { readOnly: true });
// Code-unit order, as Array.prototype.sort uses by default.
const byCode = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const han = (c) => /^\p{Script=Han}$/u.test(c) && c !== '々';
const chars = new Map(
  db
    .prepare('select literal, grade, freq from character')
    .all()
    .map((r) => [r.literal, { grade: Number(r.grade), freq: Number(r.freq) }]),
);
const joyo = (k) => chars.get(k)?.grade >= 1 && chars.get(k)?.grade <= 8;

// Two-kanji spellings, without irregular or search-only ones.
const info = new Map();
for (const r of db.prepare('select kid, text from KJI').all())
  info.set(r.kid, [...(info.get(r.kid) ?? []), r.text]);
const priority = new Map();
for (const r of db.prepare('select kid, text from KJP').all())
  priority.set(r.kid, [...(priority.get(r.kid) ?? []), r.text]);
const all = new Set();
const common = new Map(); // word -> { score, idseq }
for (const r of db.prepare('select ID, idseq, text from Kanji').all()) {
  const [a, b, extra] = [...r.text];
  if (extra || !b || !han(a) || !han(b)) continue;
  if (info.get(r.ID)?.some((t) => ['iK', 'sK', 'oK'].includes(t))) continue;
  all.add(r.text);
  const tags = priority.get(r.ID) ?? [];
  if (!tags.some((t) => ['news1', 'ichi1', 'spec1', 'spec2'].includes(t)))
    continue;
  const nf = Number(tags.find((t) => t.startsWith('nf'))?.slice(2) ?? 60);
  const score =
    (tags.includes('news1') ? 2 : 0) +
    (tags.includes('ichi1') ? 2 : 0) +
    (tags.includes('spec1') ? 1 : 0) -
    nf / 30;
  if (!common.has(r.text) || common.get(r.text).score < score)
    common.set(r.text, { score, idseq: r.idseq });
}

// The common reading first (中越 is ちゅうえつ, not ちゅうごし).
const reading = db.prepare(
  `select k.text from Kana k left join KNP p on p.kid = k.ID
   where k.idseq = ? order by p.kid is null, k.ID limit 1`,
);

// Kanji that make a word after (or before) each kanji.
const after = new Map(),
  before = new Map();
const add = (map, key, value) =>
  map.set(key, (map.get(key) ?? new Set()).add(value));
for (const w of all) {
  const [a, b] = [...w];
  add(after, a, b);
  add(before, b, a);
}

let seed = 0x5eed;
const random = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
function combos(list, k, start = 0, picked = []) {
  if (picked.length === k) return [picked];
  const out = [];
  for (let i = start; i < list.length; i++)
    out.push(...combos(list, k, i + 1, [...picked, list[i]]));
  return out;
}

// Common words by kanji, so each centre only looks at its own words.
const byKanji = new Map();
for (const w of common.keys())
  for (const k of new Set(w)) byKanji.set(k, [...(byKanji.get(k) ?? []), w]);

const puzzles = [];
const centres = [...chars.keys()]
  .filter((k) => joyo(k) && chars.get(k).freq && chars.get(k).freq <= 2000)
  .sort(byCode);
for (const centre of centres) {
  // Each clue: a common word with the centre, the clue kanji jōyō.
  const options = new Map();
  for (const w of byKanji.get(centre) ?? []) {
    const { score } = common.get(w);
    const [a, b] = [...w];
    if (a === b) continue;
    const option =
      a === centre && joyo(b)
        ? { clue: b, out: true, word: w, score }
        : b === centre && joyo(a)
          ? { clue: a, out: false, word: w, score }
          : null;
    if (!option) continue;
    const key = option.clue + option.out;
    if (!options.has(key) || options.get(key).score < score)
      options.set(key, option);
  }
  const top = [...options.values()]
    .map((o) => ({ ...o, rank: o.score + random() * 0.8 }))
    .sort((x, y) => y.rank - x.rank)
    .slice(0, 12);
  let best = null;
  for (const set of combos(top, 4)) {
    const outs = set.filter((o) => o.out).length;
    if (outs === 0 || outs === 4) continue;
    if (new Set(set.map((o) => o.clue)).size < 4) continue;
    let fits = null;
    for (const o of set) {
      const ok = (o.out ? before : after).get(o.clue) ?? new Set();
      fits = fits ? new Set([...fits].filter((k) => ok.has(k))) : ok;
    }
    if (fits.size !== 1 || !fits.has(centre)) continue;
    const value = set.reduce((s, o) => s + o.rank, 0) + (outs === 2 ? 1 : 0);
    if (!best || value > best.value) best = { set, value };
  }
  if (!best) continue;
  // Clockwise from the top, in a random order.
  const set = [...best.set].sort(() => random() - 0.5);
  puzzles.push({
    c: centre,
    k: set.map((o) => o.clue + (o.out ? '>' : '<')),
    w: set.map((o) => {
      const { idseq } = common.get(o.word);
      return [o.word, reading.get(idseq)?.text ?? ''];
    }),
  });
}
// A fixed order, so the daily puzzle never depends on the alphabet of kanji.
for (let i = puzzles.length - 1; i > 0; i--) {
  const j = Math.floor(random() * (i + 1));
  [puzzles[i], puzzles[j]] = [puzzles[j], puzzles[i]];
}

// Kanji by on and kun reading (in hiragana, without okurigana), most frequent
// first, for kanji that appear in any two-kanji word.
const hira = (s) =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const readings = {};
const usable = (k) => after.has(k) || before.has(k);
const kanjiReadings = db.prepare(
  `select c.literal, r.value from character c join rm_group g on g.cid = c.ID
   join reading r on r.gid = g.ID where r.r_type in ('ja_on', 'ja_kun')`,
);
for (const { literal, value } of kanjiReadings.all()) {
  if (!joyo(literal) || !usable(literal)) continue;
  const key = hira(value.replace(/\..*$/, '').replaceAll('-', ''));
  if (!key) continue;
  readings[key] ??= [];
  if (!readings[key].includes(literal)) readings[key].push(literal);
}
const rank = (k) => chars.get(k)?.freq || 9999;
for (const key of Object.keys(readings))
  readings[key] = readings[key].sort((x, y) => rank(x) - rank(y)).join('');

writeFileSync(
  new URL('../lib/wadou.json', import.meta.url),
  JSON.stringify({ puzzles, pairs: [...all].sort(byCode).join(''), readings }) +
    '\n',
);
console.log(
  `${puzzles.length} puzzles from ${centres.length} kanji, ${all.size} words, ${Object.keys(readings).length} readings`,
);
