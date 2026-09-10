# ことば · Kotoba

[Play](https://slowpokelu.github.io/kotoba/)

A Japanese word puzzle: four kana, eight guesses. One word a day, plus unlimited practice.

- Japanese and English interface.
- Light, dark and system themes.
- Japanese IME and on-screen kana keyboard.
- Daily statistics saved in your browser.
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

## Dictionary

Accepted readings are derived from [JMdict / EDICT](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project), © EDRDG, under [CC BY-SA 4.0](https://www.edrdg.org/edrdg/licence.html). The data is filtered and converted to four-kana readings. See `public/dictionary-license.txt` for attribution and the game’s help panel for details.
