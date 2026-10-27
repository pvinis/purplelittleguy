import { canonical, checkPixels } from "../shared/pixels";

export interface Env {
	DB: D1Database;
	ASSETS: Fetcher;
	ADMIN_TOKEN?: string;
	IP_SALT?: string;
}

export type Status = "visible" | "pending" | "hidden";
export type PublicGuy = { id: number; pixels: string; createdAt: number; source: "drawn" | "random" };

type Row = { id: number; pixels: string; created_at: number; source: "drawn" | "random"; status: Status; ip_hash: string };

export const LIMITS = {
	street: { newest: 12, random: 24, perPoster: 2 },
	poll: 20,
	ids: 50,
	burst: { count: 6, windowMs: 10 * 60_000 },
	daily: { count: 50, windowMs: 24 * 60 * 60_000 },
	streetCacheMs: 60_000,
};

const MESSAGES = {
	invalid: "That drawing didn't come through right. Try again?",
	"too-few": "Your guy needs at least 8 squares.",
	duplicate: "That guy already lives here. Change a square or two?",
	burst: "That's a lot of guys! Take a short break and try again in a few minutes.",
	daily: "That's all the guys for today. Come back tomorrow.",
	closed: "The street is closed to new guys right now. Try again later.",
};

const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
const fail = (status: number, error: string, message: string, extra: object = {}) => json({ error, message, ...extra }, status);

const toPublic = (r: Row): PublicGuy => ({ id: r.id, pixels: r.pixels, createdAt: r.created_at, source: r.source });

const COLUMNS = "id, pixels, created_at, source, status, ip_hash";

export async function getSettings(db: D1Database) {
	const { results } = await db.prepare("SELECT key, value FROM settings").all<{ key: string; value: string }>();
	const map = Object.fromEntries(results.map((r) => [r.key, r.value]));
	return {
		postingOff: map.posting_off === "1",
		approvalRequired: map.approval_required === "1",
		visibleCount: Number(map.visible_count ?? 0),
	};
}

export async function hashIp(ip: string, salt: string): Promise<string> {
	// IPv6 users usually own a whole /64, so treat it as one poster.
	const key = ip.includes(":") ? ip.split(":").slice(0, 4).join(":") : ip;
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}|${key}`));
	return [...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- the street ----

let streetCache: { at: number; body: string } | null = null;
export function clearStreetCache() {
	streetCache = null;
}

export async function buildStreet(db: D1Database, random = Math.random) {
	const { street } = LIMITS;
	const settings = await getSettings(db);
	const { results: newestRows } = await db
		.prepare(`SELECT ${COLUMNS} FROM guys WHERE status = 'visible' ORDER BY id DESC LIMIT ?`)
		.bind(street.newest * 3)
		.all<Row>();
	const maxId = newestRows[0]?.id ?? 0;

	const perPoster = new Map<string, number>();
	const picked = new Map<number, Row>();
	const take = (r: Row) => {
		const n = perPoster.get(r.ip_hash) ?? 0;
		if (picked.has(r.id) || n >= street.perPoster) return false;
		perPoster.set(r.ip_hash, n + 1);
		picked.set(r.id, r);
		return true;
	};

	let newest = 0;
	const rest: Row[] = [];
	for (const r of newestRows) {
		if (newest < street.newest && take(r)) newest++;
		else rest.push(r);
	}

	// Random picks by id range, so we never scan the whole table.
	const oldest = newestRows[newestRows.length - 1]?.id ?? 0;
	if (oldest > 1) {
		const probes = Array.from({ length: street.random * 2 }, () => 1 + Math.floor(random() * (oldest - 1)));
		const stmt = db.prepare(`SELECT ${COLUMNS} FROM guys WHERE status = 'visible' AND id >= ? ORDER BY id LIMIT 1`);
		const found = (await db.batch<Row>(probes.map((p) => stmt.bind(p)))).flatMap((r) => r.results);
		rest.push(...found);
	}
	// drawn guys first, so the street feels hand-made
	const keyed = rest.map((r) => ({ r, key: (r.source === "random" ? 1 : 0) + random() }));
	keyed.sort((a, b) => a.key - b.key);
	let extra = 0;
	for (const { r } of keyed) if (extra < street.random && take(r)) extra++;

	const guys = [...picked.values()].map(toPublic);
	return { total: settings.visibleCount, maxId, newest: guys.slice(0, newest).map((g) => g.id), guys };
}

// ---- posting ----

async function postGuy(req: Request, env: Env): Promise<Response> {
	const db = env.DB;
	const settings = await getSettings(db);
	if (settings.postingOff) return fail(503, "closed", MESSAGES.closed);

	let body: { pixels?: unknown; source?: unknown };
	try {
		body = await req.json();
	} catch {
		return fail(400, "invalid", MESSAGES.invalid);
	}
	const check = checkPixels(body.pixels);
	if (!check.ok) return fail(400, check.problem, MESSAGES[check.problem]);
	const pixels = check.pixels;
	const source = body.source === "random" ? "random" : "drawn";

	const ip = req.headers.get("cf-connecting-ip") ?? "local";
	const ipHash = await hashIp(ip, env.IP_SALT ?? "dev-salt");
	const now = Date.now();
	const { burst, daily } = LIMITS;
	const counts = await db
		.prepare("SELECT SUM(created_at > ?) AS burst, COUNT(*) AS daily FROM guys WHERE ip_hash = ? AND created_at > ?")
		.bind(now - burst.windowMs, ipHash, now - daily.windowMs)
		.first<{ burst: number | null; daily: number }>();
	if ((counts?.daily ?? 0) >= daily.count) return fail(429, "daily", MESSAGES.daily);
	if ((counts?.burst ?? 0) >= burst.count) return fail(429, "burst", MESSAGES.burst);

	const canon = canonical(pixels);
	const twin = await db.prepare("SELECT id FROM guys WHERE canon = ? AND status != 'hidden' LIMIT 1").bind(canon).first<{ id: number }>();
	if (twin) return fail(409, "duplicate", MESSAGES.duplicate, { id: twin.id });

	// In approval mode the poster can't tell: they get the same answer and still see their guy.
	const status: Status = settings.approvalRequired ? "pending" : "visible";
	const [inserted] = await db.batch<Row>([
		db
			.prepare(`INSERT INTO guys (pixels, canon, source, status, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING ${COLUMNS}`)
			.bind(pixels, canon, source, status, ipHash, now),
		db.prepare("UPDATE settings SET value = CAST(value AS INTEGER) + 1 WHERE key = 'visible_count' AND ? = 'visible'").bind(status),
	]);
	const row = inserted!.results[0]!;
	return json({ guy: toPublic(row) }, 201);
}

// ---- admin ----

function isAdmin(req: Request, env: Env): boolean {
	const token = env.ADMIN_TOKEN;
	const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
	if (!token || given.length !== token.length) return false;
	let diff = 0;
	for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ given.charCodeAt(i);
	return diff === 0;
}

async function setStatus(db: D1Database, where: string, params: unknown[], status: Status) {
	// Keep the visible counter right: count what changes before changing it.
	const before = await db
		.prepare(`SELECT SUM(status = 'visible') AS visible, COUNT(*) AS n FROM guys WHERE ${where} AND status != ?`)
		.bind(...params, status)
		.first<{ visible: number | null; n: number }>();
	const delta = status === "visible" ? (before?.n ?? 0) - (before?.visible ?? 0) : -(before?.visible ?? 0);
	await db.batch([
		db.prepare(`UPDATE guys SET status = ? WHERE ${where}`).bind(status, ...params),
		db.prepare("UPDATE settings SET value = CAST(value AS INTEGER) + ? WHERE key = 'visible_count'").bind(delta),
	]);
	clearStreetCache();
	return before?.n ?? 0;
}

async function admin(req: Request, env: Env, path: string, url: URL): Promise<Response> {
	if (!isAdmin(req, env)) return fail(401, "unauthorized", "Wrong or missing admin token.");
	const db = env.DB;

	if (path === "/api/admin/guys" && req.method === "GET") {
		const before = Number(url.searchParams.get("before")) || Number.MAX_SAFE_INTEGER;
		const status = url.searchParams.get("status");
		const filter = status === "visible" || status === "pending" || status === "hidden" ? "AND status = ?" : "";
		const stmt = db.prepare(`SELECT ${COLUMNS} FROM guys WHERE id < ? ${filter} ORDER BY id DESC LIMIT 100`);
		const { results } = await (filter ? stmt.bind(before, status) : stmt.bind(before)).all<Row>();
		return json({ settings: await getSettings(db), guys: results.map((r) => ({ ...toPublic(r), status: r.status, poster: r.ip_hash })) });
	}

	const one = path.match(/^\/api\/admin\/guys\/(\d+)$/);
	if (one && req.method === "POST") {
		const { status } = await req.json<{ status?: Status }>();
		if (status !== "visible" && status !== "hidden" && status !== "pending") return fail(400, "invalid", "Status must be visible, pending or hidden.");
		const changed = await setStatus(db, "id = ?", [Number(one[1])], status);
		return json({ changed });
	}

	const poster = path.match(/^\/api\/admin\/posters\/([0-9a-f]{16})$/);
	if (poster && req.method === "POST") {
		const changed = await setStatus(db, "ip_hash = ?", [poster[1]], "hidden");
		return json({ changed });
	}

	if (path === "/api/admin/settings" && req.method === "POST") {
		const body = await req.json<{ postingOff?: boolean; approvalRequired?: boolean }>();
		const updates = [];
		if (typeof body.postingOff === "boolean") updates.push(db.prepare("UPDATE settings SET value = ? WHERE key = 'posting_off'").bind(body.postingOff ? "1" : "0"));
		if (typeof body.approvalRequired === "boolean") updates.push(db.prepare("UPDATE settings SET value = ? WHERE key = 'approval_required'").bind(body.approvalRequired ? "1" : "0"));
		if (updates.length) await db.batch(updates);
		return json({ settings: await getSettings(db) });
	}

	if (path === "/api/admin/recount" && req.method === "POST") {
		await db.prepare("UPDATE settings SET value = (SELECT COUNT(*) FROM guys WHERE status = 'visible') WHERE key = 'visible_count'").run();
		return json({ settings: await getSettings(db) });
	}

	return fail(404, "not-found", "No such admin action.");
}

// ---- router ----

export async function getVisibleGuy(db: D1Database, id: number): Promise<PublicGuy | null> {
	const row = await db.prepare(`SELECT ${COLUMNS} FROM guys WHERE id = ? AND status = 'visible'`).bind(id).first<Row>();
	return row ? toPublic(row) : null;
}

export async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
	const path = url.pathname.replace(/\/+$/, "");
	const db = env.DB;

	if (path.startsWith("/api/admin/")) return admin(req, env, path, url);

	if (path === "/api/street" && req.method === "GET") {
		const now = Date.now();
		if (!streetCache || now - streetCache.at > LIMITS.streetCacheMs) {
			streetCache = { at: now, body: JSON.stringify(await buildStreet(db)) };
		}
		return new Response(streetCache.body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=30" } });
	}

	if (path === "/api/guys" && req.method === "POST") return postGuy(req, env);

	if (path === "/api/guys" && req.method === "GET") {
		const ids = url.searchParams.get("ids");
		if (ids !== null) {
			// Your own guys, whatever their status, so held-back guys still show up for their author.
			const list = [...new Set(ids.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, LIMITS.ids);
			if (!list.length) return json({ guys: [] });
			const { results } = await db
				.prepare(`SELECT ${COLUMNS} FROM guys WHERE id IN (${list.map(() => "?").join(",")})`)
				.bind(...list)
				.all<Row>();
			return json({ guys: results.map(toPublic) });
		}
		const after = Number(url.searchParams.get("after")) || 0;
		const { results } = await db
			.prepare(`SELECT ${COLUMNS} FROM guys WHERE status = 'visible' AND id > ? ORDER BY id LIMIT ?`)
			.bind(after, LIMITS.poll)
			.all<Row>();
		return json({ guys: results.map(toPublic) });
	}

	const one = path.match(/^\/api\/guys\/(\d+)$/);
	if (one && req.method === "GET") {
		const guy = await getVisibleGuy(db, Number(one[1]));
		return guy ? json({ guy }) : fail(404, "not-found", "No guy lives at that number.");
	}

	return fail(404, "not-found", "Nothing here.");
}
