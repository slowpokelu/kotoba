// Common words → lib/common-words.json, for しりとり and the かな bee.
// Source: the kotobako-data npm package, a JMdict subset of about 23,000
// common words with spellings and parts of speech (CC BY-SA 4.0, © EDRDG).
// Usage: node scripts/update-common-words.mjs path/to/kotobako-static.json
import { readFile, writeFile } from 'node:fs/promises';

const source = process.argv[2];
if (!source) throw new Error('Pass the path to kotobako-static.json');
const data = JSON.parse(await readFile(source, 'utf8'));
const toHiragana = (s) =>
  s
    .normalize('NFKC')
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .normalize('NFC');
// Content words only: particles, conjunctions, affixes and the like make poor
// しりとり links and bee finds.
const content = new Set([
  'noun',
  'pronoun',
  'godan verb',
  'ichidan verb',
  'kuru verb',
  'transitive verb',
  'intransitive verb',
  'i-adjective',
  'na-adjective',
  'no-adjective',
  'adverb',
  'adverb (to)',
]);
const words = {};
for (const entry of data.datasets.vocab) {
  const reading = toHiragana(entry.reading ?? '');
  const length = [...reading].length;
  if (!/^[ぁ-ゖー]+$/u.test(reading) || length < 2 || length > 8) continue;
  if (!(entry.pos ?? '').split(' · ').some((p) => content.has(p))) continue;
  // The first spelling of a reading is the one shown, as in the source order.
  words[reading] ??= (entry.word ?? reading).normalize('NFKC');
}
const output = {
  updated: new Date().toISOString().slice(0, 10),
  source: 'kotobako-data ' + data.version + ' (JMdict subset)',
  license: 'CC-BY-SA-4.0',
  words,
};
await writeFile(
  new URL('../lib/common-words.json', import.meta.url),
  JSON.stringify(output),
);
console.log(`Common words: ${Object.keys(words).length} readings.`);
