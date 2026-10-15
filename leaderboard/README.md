# Global leaderboard integration

Status: retained for future use; not deployed and no longer connected to the game. The active game is local-only. The setup below describes the previous integration; restoring frontend API calls is also required before enabling it. The game is a static site. A separate Cloudflare Worker provides four small JSON endpoints backed by D1 (SQLite). The browser contains only the public Worker URL, never an account token or database credential.

Cloudflare offers free quotas for both [Workers](https://developers.cloudflare.com/workers/platform/pricing/) and [D1](https://developers.cloudflare.com/d1/platform/pricing/). This is suitable for a small game; check current quotas before deployment. Use the free plan if you want requests to stop at free limits rather than incur usage charges.

## Connect it

Use your own Cloudflare account. From this directory, with Node and npm available:

```sh
npx wrangler login
npx wrangler d1 create the-token-game
```

Paste the returned database ID into `wrangler.jsonc`. Set `ALLOWED_ORIGIN` to the exact origin of your static game, such as `https://your-game.pages.dev` (no trailing slash or path). The supplied localhost origin is for development only.

```sh
npx wrangler d1 execute the-token-game --remote --file=schema.sql
npx wrangler deploy
```

Set `LEADERBOARD_URL` in `../game/config.js` to the returned Worker HTTPS URL. Rebuild with `node ../scripts/build-game.js`, then upload `dist-game/` to your static host. The game and Worker can be on different hosts; allowed-origin CORS is handled by the Worker. Deploying this backend is an account-level action and has intentionally not been performed here.

For local integration testing, initialize the local database and start Wrangler:

```sh
npx wrangler d1 execute the-token-game --local --file=schema.sql
npx wrangler dev
```

Temporarily configure `LEADERBOARD_URL` to Wrangler's local URL and leave `ALLOWED_ORIGIN` at `http://127.0.0.1:5173`. Reset the URL before distributing a disconnected build.

## API and validation

- `POST /start`: `{level, version, player}` generates a random validated board on the server, stores that exact definition, and returns it with an unpredictable run ID and server timestamp. Only levels 1–11 are ranked; the tutorial is local. Starts are limited to 60 per hour per hashed IP.
- `POST /finish`: `{runId, moves}` replays row/column clicks against the stored board for that run, checking every chosen pair and counting merges and mistakes. The server derives the score using its own elapsed time, with a three-second finish-delivery allowance but no bonus for that allowance. This happens immediately when the game ends, before the player enters a name. A repeat finish returns the original result.
- `POST /publish`: `{runId, name}` publishes a completed run once. Names are limited to 18 characters and are escaped by the frontend. One best score per browser player ID, per level, is retained.
- `GET /scores?level=1`: retrieves the top 20 scores, ordered by score then submission time.

D1 queries are parameterized. Publishing uses an atomic batch. Unpublished/finished runs expire after one day; cleanup occurs on new starts. Published best scores remain. The client does not send an authoritative score. A network error leaves the game playable and its score locally saved.

This is a casual leaderboard, not cheat-proof competition: determined users can automate legal moves or create new browser identities. CORS is not authentication. The replay and timing checks prevent simple fabricated-score submissions, not bots. Add identity, abuse protection, and verified play sessions if the game later offers prizes. Random boards share a leaderboard within their difficulty level; layouts and potential merge points vary. Game version 2 requires the `runs.definition` column in the supplied schema. For an older database, add it with `ALTER TABLE runs ADD COLUMN definition TEXT;`, clear old runs/scores, and deploy frontend and backend together. Changing scoring rules requires a new version and a fresh or migrated leaderboard.

## Verification

Run from the project root:

```sh
node --test game-tests/*.test.js
```

The backend tests execute the actual SQL against an in-memory SQLite database through a small D1-compatible adapter. They cover run creation, invalid moves, server-derived scoring, best-score persistence, duplicate publishing, origin enforcement, and late/incomplete runs. These do not replace a deployment smoke test against Cloudflare itself.
