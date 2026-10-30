# ことば · Kotoba

[Play](https://slowpokelu.github.io/kotoba/)

A Japanese word puzzle with eight guesses. One four-kana word a day, plus unlimited practice with three, four, five or six kana.

More games from the menu, each at its own address:

- ダブル and トリプル (`/double/`, `/triple/`): two or three words at once as in Dordle, with a daily puzzle and practice (`…/practice/`).
- かなビー (`/bee/`): a daily Spelling Bee with seven kana.
- いじわる (`/sneaky/`): an Absurdle-style puzzle whose answer dodges every guess until you corner it.
- 和同開珎 (`/wadou/`): find the kanji that makes a word with four clue kanji, read along the arrows. A daily puzzle and practice; type the kanji or a reading in kana.
- ことばのはしご (`/ladder/`): change one kana at a time from the start word to the goal, every rung a word. Daily and practice, with a par.
- しりとり (`/shiritori/`): against the computer, with no time limit, or two players taking turns on one device.

問題を作る in the menu turns any dictionary word into a link (`/?w=…`) that plays it as a ことば round, for sending to friends.

和同開珎's puzzles come from `node scripts/update-wadou.mjs path/to/jamdict.db` (JMdict and KANJIDIC2 from the jamdict-data package, © EDRDG, CC BY-SA 4.0). Each centre kanji is checked to be the only one that makes a word with all four clues.

The menu checks off today's finished puzzles. The build copies `index.html` into each address folder so GitHub Pages serves them.

- Japanese and English interface.
- Optional near hints: outlines kana that differ only by 濁点, 半濁点 or size (き/ぎ, つ/っ/づ), in the same spot or elsewhere. Each round keeps the mode it had at its first guess.
- Light, dark and system themes.
- Automatic romaji-to-hiragana input, Japanese IME and on-screen kana keyboard.
- Daily statistics saved in your browser.
- Optional hard mode: every guess must be a possible answer (✓ kana stay, ● kana move, − kana are out). Shared results are tagged `[ハード]` / `[ヒント]`.
- Installable to the home screen and playable offline after the first visit.
- JSON export/import for progress and preferences. No accounts or cloud saves.

## Development

Requires Node.js 22.13 or newer.

```sh
npm ci
npm run dev:pages
```

```sh
npm test
npm run build:pages
npm run preview:pages
```

GitHub Actions builds and publishes `out/` to Pages on pushes to `main`. For forks, update `base` in `vite.pages.config.ts` to match the repository path, and enable GitHub Actions in Settings → Pages.

The Pages entry point reuses the same React game as the original hosted app. The `dev` and `build` scripts are for that original hosting integration; use the `:pages` scripts for standalone development.

## Your records

Progress is local to each browser and site address. To move it, use Settings → Export on the old site, then Settings → Import on the new one. Imports keep completed local daily results when dates overlap.

Daily puzzles follow your local date. Players on the same date get the same word. Practice does not affect daily statistics.

Each practice length keeps its own saved round. The length choice and all rounds are included in backups. Small kana and ー each count as one tile.

## Input

Romaji converts while you type; no Japanese keyboard is required. Incomplete syllables stay editable, and submitting commits a trailing `n` to ん. Use `n'` before a vowel to separate ん, `x` or `l` for small kana, and `-` for ー. Native Japanese IME composition is left alone: confirm it first, then press Enter again to submit. Kana conversion uses [WanaKana](https://wanakana.com/) (MIT).

## Dictionary

Accepted readings are derived from [JMdict / EDICT](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project), © EDRDG, under [CC BY-SA 4.0](https://www.edrdg.org/edrdg/licence.html). The data is filtered and converted to three-to-six-kana readings, plus a list of about 19,000 common words (two to eight kana) used by しりとり. See `public/dictionary-license.txt` for attribution and the game’s help panel for details.

`node scripts/update-dictionary.mjs /path/to/edict2.gz --practice` regenerates only the additional 3/5/6-kana dictionary and verifies its curated reading/spelling pairs. Keep `lib/answers.mjs` in its original order to preserve the daily schedule.

`node scripts/update-common-words.mjs /path/to/kotobako-static.json` regenerates `lib/common-words.json` from the [kotobako-data](https://www.npmjs.com/package/kotobako-data) package, a JMdict subset of common words with spellings and parts of speech (CC BY-SA 4.0).
