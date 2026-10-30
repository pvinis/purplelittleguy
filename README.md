# purple little guy

A little purple guy lives at [purplelittleguy.com](https://purplelittleguy.com). He follows your cursor, trips sometimes, naps when you leave him alone, and says hi to the neighbors: tiny 12×12 pixel guys that visitors draw (or randomize) and leave on his street.

## How it works

- **The page** is plain TypeScript, bundled with `bun build` into `public/assets`. No framework.
- **The Worker** (`src/worker`) serves the page from [Workers static assets](https://developers.cloudflare.com/workers/static-assets/) and a small JSON API. Guys live in [D1](https://developers.cloudflare.com/d1/) (SQLite).
- **A guy** is a 144-character string, 12 rows of 12 squares, over the alphabet `.lpdk` (empty, lilac, purple, deep purple, ink).
- **Randomize** (`src/shared/generate.ts`) builds guys from parts (a body shape, eyes, a mouth, legs, at most one extra like a hat or antenna) on the left half and mirrors them. Every random guy has to pass the rules in `isGoodGuy`, and the tests check 10,000 seeds.

### What the street shows

The street shows about one guy per 52px of screen width, up to 24: your own guys first (their ids are kept in the browser), the newest few dropping in again with a welcome, then random older ones. The Worker builds that selection about once a minute and keeps a running count, so a visit never scans the whole table. Every 45 seconds the page asks for guys newer than the last one it saw, but only while the tab is visible, and every 20 seconds someone walks off and someone else walks on.

### Sharing

Every guy has a page at `/g/<number>` with a preview image at `/g/<number>.png`, drawn by a tiny PNG encoder in the Worker.

## API

| Route | What it does |
| --- | --- |
| `GET /api/street` | The guys to put on the street, the newest ids, and the total count |
| `GET /api/guys?after=<id>` | Visible guys newer than `id` (for polling) |
| `GET /api/guys?ids=1,2,3` | Specific guys, whatever their status (your own guys) |
| `GET /api/guys/<id>` | One visible guy |
| `POST /api/guys` | `{ pixels, source }` leaves a new guy |

## Keeping it nice

Anonymous drawing walls attract rude drawings, so there's a small admin page at `/admin`, protected by the `ADMIN_TOKEN` secret.

- **Hide** a guy, or **hide everything** from one poster at once. Posters are a salted hash of their IP; an IPv6 /64 counts as one poster.
- **Posting off** closes the street to new guys.
- **New guys need approval** holds new guys back until you approve them. Posters can't tell: they still see their own guy.

The API also has some limits built in:
- A guy needs at least 8 filled squares.
- An exact twin of a guy who already lives there is rejected, and his mirror image counts as a twin.
- Each poster can leave 6 guys per 10 minutes and 50 per day.
- The street shows at most 2 guys from the same poster.

## Develop

Needs [mise](https://mise.jdx.dev) (or [bun](https://bun.sh) 1.x and Node 24).

```sh
mise install
bun install
bun test               # randomizer, pixels, share images, and the API against SQLite
bun run serve --seed 40  # quick local street on http://localhost:8787 with 40 random guys
```

`bun run serve` runs the real Worker code on bun with SQLite standing in for D1. To use Cloudflare's own local runtime instead:

```sh
cp .dev.vars.example .dev.vars
bun run dev
```

The admin token for local development is `local-admin-token`.

## Deploy to Cloudflare

1. Log in: `bunx wrangler login`
2. Create the database: `bunx wrangler d1 create purplelittleguy`, then put the `database_id` it prints into `wrangler.jsonc`.
3. Set the secrets:
   ```sh
   bunx wrangler secret put ADMIN_TOKEN   # a long random string, for /admin
   bunx wrangler secret put IP_SALT       # another long random string
   ```
4. Deploy: `bun run deploy`. It builds the page, applies the database migrations, deploys the Worker, and attaches `purplelittleguy.com` (the `routes` entry in `wrangler.jsonc`). Cloudflare creates the domain's DNS record and certificate itself, so the zone only needs to be active in the same Cloudflare account, with no other record on the bare domain.

   It also deploys a second, tiny Worker (`wrangler.www.jsonc`) on `www.purplelittleguy.com` that redirects to the bare domain. It's separate because the main Worker never sees requests for static files.

Static files don't count as Worker requests, but the API does. On the free plan that's 100,000 requests a day, and each open tab makes about 80 per hour while visible.
