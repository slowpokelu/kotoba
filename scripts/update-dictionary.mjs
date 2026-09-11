// EDICT2 → kana readings. --practice updates only the new 3/5/6-kana pools.
// Run monthly, and before releasing an update. Existing answer order stays fixed.
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { answers } from '../lib/answers.mjs';
import { extraAnswers } from '../lib/practice-answers.mjs';
const practice = process.argv.includes('--practice');
const lengths = practice ? [3, 5, 6] : [4];
const source = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const compressed = source
  ? await readFile(source)
  : new Uint8Array(
      await (
        await fetch('https://www.edrdg.org/pub/Nihongo/edict2.gz')
      ).arrayBuffer(),
    );
const data = new TextDecoder('euc-jp').decode(gunzipSync(compressed));
const normalize = (s) =>
  s
    .normalize('NFKC')
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .normalize('NFC');
const readings = new Set();
const aliases = new Map();
for (const line of data.split('\n')) {
  const head = line.split(' /')[0];
  const bracket = head.match(/\[([^\]]+)\]/);
  const forms = (bracket ? head.split(' [')[0] : head)
    .split(';')
    .map((s) => s.replace(/\([^)]*\)/g, ''));
  const kana = (bracket ? bracket[1].split(';') : forms)
    .map((s) => normalize(s.replace(/\([^)]*\)/g, '')))
    .filter((s) => /^[ぁ-ゖー]+$/u.test(s) && lengths.includes(s.length));
  for (const r of kana) readings.add(r);
  for (const form of forms) {
    for (const r of kana) {
      const key = practice ? `${r.length}:${form}` : form;
      if (!aliases.has(key)) aliases.set(key, new Set());
      aliases.get(key).add(r);
    }
  }
}
const curated = practice ? extraAnswers : answers;
const missing = curated.filter(
  (a) =>
    !readings.has(a.reading) ||
    (practice &&
      a.reading !== normalize(a.spelling) &&
      !aliases.get(`${a.reading.length}:${a.spelling}`)?.has(a.reading)),
);
if (missing.length)
  throw new Error(
    'Curated answers absent from dictionary: ' + JSON.stringify(missing),
  );
const kanji = Object.fromEntries(
  [...aliases]
    .filter(
      ([k, v]) =>
        /[^ぁ-ゖァ-ヶー]/u.test(practice ? k.slice(2) : k) && v.size === 1,
    )
    .map(([k, v]) => [k, [...v][0]]),
);
const output = {
  updated: new Date().toISOString().slice(0, 10),
  source: 'https://www.edrdg.org/pub/Nihongo/edict2.gz',
  license: 'CC-BY-SA-4.0',
  readings: [...readings].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
  aliases: kanji,
};
await writeFile(
  new URL(
    practice ? '../lib/practice-dictionary.json' : '../lib/dictionary.json',
    import.meta.url,
  ),
  JSON.stringify(output),
);
console.log(
  `Dictionary: ${readings.size} readings, ${Object.keys(kanji).length} spellings; ${curated.length} curated answers verified.`,
);
