// A quick local server that runs the real Worker against SQLite, for when wrangler isn't handy.
//   bun run serve            empty street
//   bun run serve --seed 40  40 random guys from 40 pretend visitors
import { generateGuy } from "../src/shared/generate";
import type { Env } from "../src/worker/api";
import worker from "../src/worker/index";
import { createD1 } from "./d1-sqlite";

Object.assign(globalThis, { caches: { default: { match: async () => undefined, put: async () => {} } } });

async function asset(req: Request): Promise<Response> {
	let path = new URL(req.url).pathname;
	if (path === "/") path = "/index.html";
	if (path === "/admin") path = "/admin.html";
	const f = Bun.file(`public${path}`);
	return (await f.exists()) ? new Response(f) : new Response("Not found", { status: 404 });
}

const env: Env = {
	DB: createD1(),
	ASSETS: { fetch: asset } as unknown as Fetcher,
	ADMIN_TOKEN: "local-admin-token",
	IP_SALT: "local-salt",
};
const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;
const port = Number(process.env.PORT ?? 8787);
const server = Bun.serve({ port, fetch: (req) => worker.fetch(req as never, env, ctx) });

const seedAt = process.argv.indexOf("--seed");
const seed = seedAt > 0 ? Number(process.argv[seedAt + 1] ?? 20) : 0;
for (let i = 0; i < seed; i++) {
	await server.fetch(
		new Request(`http://localhost:${port}/api/guys`, {
			method: "POST",
			headers: { "content-type": "application/json", "cf-connecting-ip": `10.1.${i >> 8}.${i & 255}` },
			body: JSON.stringify({ pixels: generateGuy(i + 1), source: "random" }),
		}),
	);
}
console.log(`street open at http://localhost:${port} with ${seed} guys. Admin token: local-admin-token`);
