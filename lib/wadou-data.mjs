// 和同開珎's puzzles and word list, loaded only when the game opens.
import data from './wadou.json' with { type: 'json' };
import { wordSet } from './wadou.mjs';

export const puzzles = data.puzzles;
export const words = wordSet(data.pairs);
export const readings = data.readings;
