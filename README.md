# The Token Game

A mobile-first pattern game in plain JavaScript, HTML, and CSS. No framework, install step, or build tool is needed to play it from a static web host.

[Play The Token Game](https://srush.github.io/the-token-game/)

Pushes to `main` run the tests and deploy `dist-game/` using `.github/workflows/pages.yml`. No dependencies or secrets are needed by the static build.

## Run locally

With Node 22.18 or newer:

```sh
node scripts/serve-game.js
```

Open http://127.0.0.1:5173/. The server exposes only `game/`, not the backup or backend source. The home screen offers Easy (the original shorter boards) and Hard (eight rows in regular play). Home choices use plain dot grids. The tutorial always uses the small three-row grid, regardless of mode. The tutorial appears automatically only on the first visit, then finishing, timing out, or skipping returns to the home screen. Later visits open the home screen, and either grid starts regular play directly. This is remembered in browser storage; existing players with saved scores also skip onboarding. Tap the four-dot home icon to switch modes. The tutorial includes a link explaining tokenization and a skip button.

```sh
node --test game-tests/*.test.js
node scripts/build-game.js
```

Upload the **contents** of `dist-game/` to any static host. It includes `index.html`, CSS, native JavaScript modules, and the validated level catalog. Serve over HTTP(S); native modules do not work by double-clicking a `file://` page. Scores are stored only in this browser. The game makes no leaderboard requests.

## How it plays

- Read each row left to right. Pairs never cross row boundaries.
- Tap the first tile of the most frequent adjacent pair. All non-overlapping occurrences merge, left to right, across the board.
- Frequency includes overlapping occurrences, as in byte-pair encoding. For example, five identical tiles contain four adjacent pairs but produce two merges.
- New tokens retain every original dot and can be merged again. The board shows only the current tokens; the full tree appears at the end.
- Finish five merge rules per regular round before the timer expires. The tutorial keeps its two-rule introduction. The tutorial clock starts on the first board tap; other clocks start when the board appears. Time is represented only by a shrinking bar. On timeout the board shakes and turns red, followed by a red × on the results; reduced-motion mode keeps the color feedback without shaking. The clock continues while a leaderboard or another tab is open.
- Wrong taps only shake every occurrence of the chosen pair red (both tiles, including overlapping matches). Correct answers are not revealed during play. Results pair each mistaken choice (cross) with the correct choice (check). On timeout, the derivation trees show the completed solution; dashed green token outlines mark unfinished merges. These revealed merges never add to your score.
- Scoring: 100 per merged occurrence, minus 75 per miss, plus 500 for finishing and 10 per full second left. Scores never go below zero. Timeouts retain partial scores locally but do not qualify for the global board.
- The results show a derivation tree for each distinct final token type, once regardless of its frequency on the board. Each root shows the final colored token; its two children show the tokens that were merged to create it, recursively down to the original single-color tokens. These are vocabulary derivations, not a tree over board positions or snapshots of moves. The play screen shows the time bar, numeric score, board, and remaining-merge dots, without time or score labels. Continue through unlimited freshly generated boards; results offer a new level even after a timeout. Difficulty rises initially, then stays capped while boards keep changing. There are no replay buttons or name fields.
- Sound is opt-in. Keyboard buttons, screen-reader feedback, and reduced motion are supported.

`game/engine.js` is shared with the backend. `game/app.js` controls the UI; `game/style.css` controls its appearance. `game/levels.js` contains validated difficulty templates; `game/generator.js` generates a fresh board on every level start by randomly recoloring and swapping cells, accepting only changes that preserve the full solution constraints, then shuffling rows and colors. This bounded method avoids slow rejection loops. Run `node scripts/generate-levels.js` to reproduce the base templates. Every offered move has a unique most-common pair; the initial frequency lead is at least three. Levels deliberately end after a validated number of rules, rather than forcing arbitrary choices once frequencies tie. Change the game version and use a fresh leaderboard if changing the catalog, to separate incompatible scoring rules. Random boards are ranked by difficulty level, so individual layouts and available merge points can vary.

## Leaderboard

Easy and Hard have separate local rankings across all completed boards; the tutorial is excluded and there is no level selector. Earlier scores count as Easy. The leaderboard is local-only and saves scores automatically in browser storage, with dates rather than player names. No account, name entry, or network connection is needed. The earlier Cloudflare Worker + D1 integration is retained in `leaderboard/` for future use, but the game does not call it, even if a URL is configured in `game/config.js`.

## Local blog backup

In the original development workspace (excluded from this repository), the TypeScript blog project is backed up at `backups/tokenizer-blog-2026-10-15.tar.gz`, with a SHA-256 checksum alongside it. Every archived file was checked against its original after saving. The archive includes sources, tests, package manifests, and its built static page; dependencies and Git metadata are excluded. To restore without touching this game:

```sh
mkdir -p restored-blog
tar -xzf backups/tokenizer-blog-2026-10-15.tar.gz -C restored-blog
```

The original `src/` and `tests/` also remain in place for reference. The original tests can still be run with `node --experimental-strip-types --test tests/*.test.ts`. The game has no dependencies.
