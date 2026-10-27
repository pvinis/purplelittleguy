import { type Env, getVisibleGuy, handleApi } from "./api";
import { renderCard } from "./png";

const SITE = "purplelittleguy.com";

// /g/123 is a shareable page for one guy: the normal street, with preview tags for that guy.
async function guyPage(req: Request, env: Env, url: URL, id: number): Promise<Response> {
	const page = await env.ASSETS.fetch(new Request(new URL("/", url), req));
	const guy = await getVisibleGuy(env.DB, id);
	if (!guy) return page;
	const title = `Guy #${id.toLocaleString("en-US")} lives on ${SITE}`;
	const description = "A little purple guy, drawn by a visitor. Come say hi, and leave one of your own.";
	const image = new URL(`/g/${id}.png`, url).toString();
	const meta: Record<string, string> = {
		"og:title": title,
		"og:description": description,
		"og:image": image,
		"og:url": new URL(`/g/${id}`, url).toString(),
		"twitter:card": "summary_large_image",
	};
	const rewritten = new HTMLRewriter()
		.on("title", { element: (el) => void el.setInnerContent(title) })
		.on('meta[name="description"]', { element: (el) => void el.setAttribute("content", description) })
		.on("meta[property], meta[name^='twitter:']", {
			element: (el) => {
				const key = el.getAttribute("property") ?? el.getAttribute("name") ?? "";
				if (key in meta) el.setAttribute("content", meta[key]!);
			},
		})
		.transform(page);
	// The page got longer, and not every runtime keeps the original headers, so set them explicitly.
	const headers = new Headers(page.headers);
	headers.delete("content-length");
	headers.set("content-type", "text/html; charset=utf-8");
	return new Response(rewritten.body, { status: page.status, headers });
}

async function guyCard(req: Request, env: Env, ctx: ExecutionContext, id: number): Promise<Response> {
	const cache = caches.default;
	const hit = await cache.match(req);
	if (hit) return hit;
	const guy = await getVisibleGuy(env.DB, id);
	if (!guy) return new Response("No guy lives at that number.", { status: 404 });
	const res = new Response(await renderCard(guy.pixels), {
		headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" },
	});
	ctx.waitUntil(cache.put(req, res.clone()));
	return res;
}

export default {
	async fetch(req, env, ctx) {
		const url = new URL(req.url);
		try {
			if (url.pathname.startsWith("/api/")) return await handleApi(req, env, url);
			const g = url.pathname.match(/^\/g\/(\d{1,9})(\.png)?$/);
			if (g && req.method === "GET") {
				const id = Number(g[1]);
				return g[2] ? await guyCard(req, env, ctx, id) : await guyPage(req, env, url, id);
			}
			return env.ASSETS.fetch(req);
		} catch (err) {
			console.error(err);
			return Response.json({ error: "server", message: "Something went wrong on our side. Try again in a bit." }, { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;
