// EDICT2 → four-character kana readings. Derived data: CC BY-SA 4.0 (EDRDG).
// Run monthly, and before releasing an update. Existing answer order stays fixed.
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { answers } from '../lib/answers.mjs';
const source = process.argv[2];
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
    .filter((s) => /^[ぁ-ゖー]{4}$/u.test(s));
  for (const r of kana) readings.add(r);
  for (const form of forms) {
    if (!aliases.has(form)) aliases.set(form, new Set());
    for (const r of kana) aliases.get(form).add(r);
  }
}
const missing = answers.filter((a) => !readings.has(a.reading));
if (missing.length)
  throw new Error(
    'Curated answers absent from dictionary: ' + JSON.stringify(missing),
  );
const kanji = Object.fromEntries(
  [...aliases]
    .filter(([k, v]) => /[^ぁ-ゖァ-ヶー]/u.test(k) && v.size === 1)
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
  new URL('../lib/dictionary.json', import.meta.url),
  JSON.stringify(output),
);
console.log(
  `Dictionary: ${readings.size} readings, ${Object.keys(kanji).length} spellings; ${answers.length} curated answers verified.`,
);
