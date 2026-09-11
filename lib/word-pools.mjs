import { answers } from './answers.mjs';
import { extraAnswers } from './practice-answers.mjs';
import dictionary from './dictionary.json' with { type: 'json' };
import practiceDictionary from './practice-dictionary.json' with { type: 'json' };

// The daily answer array and four-kana dictionary remain unchanged.
export const allAnswers = [...answers, ...extraAnswers];
export const allValid = new Set([
  ...dictionary.readings,
  ...practiceDictionary.readings,
]);
export const answerSet = new Set(allAnswers.map((a) => a.reading));
export const dictionaryUpdated = [
  dictionary.updated,
  practiceDictionary.updated,
]
  .sort()
  .at(-1);
const aliases = { 3: {}, 4: dictionary.aliases, 5: {}, 6: {} };
for (const [key, value] of Object.entries(practiceDictionary.aliases))
  aliases[Number(key[0])][key.slice(2)] = value;
export const aliasesFor = (length) => aliases[length];
export const answersFor = (length) =>
  allAnswers.filter((a) => a.reading.length === length);
