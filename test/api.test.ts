import { beforeEach, describe, expect, test } from "bun:test";
import { generateGuy } from "../src/shared/generate";
import { canonical, mirror } from "../src/shared/pixels";
import { type Env, LIMITS, clearStreetCache, handleApi } from "../src/worker/api";
import { createD1 } from "../scripts/d1-sqlite";

let env: Env;

beforeEach(() => {
	env = { DB: createD1(), ASSETS: null as unknown as Fetcher, ADMIN_TOKEN: "secret", IP_SALT: "salt" };
	clearStreetCache();
});

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
	const url = new URL(`https://street.test${path}`);
	const req = new Request(url, {
		method,
		body: body === undefined ? undefined : JSON.stringify(body),
		headers: { "content-type": "application/json", "cf-connecting-ip": "1.2.3.4", ...headers },
	});
	const res = await handleApi(req, env, url);
	return { status: res.status, body: (await res.json()) as Record<string, any> };
}

const post = (pixels: string, ip = "1.2.3.4", source = "drawn") => call("POST", "/api/guys", { pixels, source }, { "cf-connecting-ip": ip });
const admin = (method: string, path: string, body?: unknown) => call(method, path, body, { authorization: "Bearer secret" });
const street = () => {
	clearStreetCache();
	return call("GET", "/api/street");
};

// distinct guys, no twins among them
const guys = (() => {
	const seen = new Set<string>();
	const list: string[] = [];
	for (let seed = 1; list.length < 200; seed++) {
		const g = generateGuy(seed);
		if (!seen.has(canonical(g))) {
			seen.add(canonical(g));
			list.push(g);
		}
	}
	return list;
})();
const ipFor = (i: number) => `10.0.${i >> 8}.${i & 255}`;

describe("posting a guy", () => {
	test("puts him on the street and counts him", async () => {
		const res = await post(guys[0]!, "1.2.3.4", "random");
		expect(res.status).toBe(201);
		expect(res.body.guy).toMatchObject({ id: 1, pixels: guys[0], source: "random" });
		const s = await street();
		expect(s.body.total).toBe(1);
		expect(s.body.maxId).toBe(1);
		expect(s.body.newest).toEqual([1]);
		expect(s.body.guys.map((g: { id: number }) => g.id)).toEqual([1]);
	});

	test("rejects broken drawings and nearly empty ones", async () => {
		expect((await post("p".repeat(10))).body.error).toBe("invalid");
		expect((await post("z".repeat(144))).body.error).toBe("invalid");
		const few = await post("p".repeat(7) + ".".repeat(137));
		expect(few.status).toBe(400);
		expect(few.body.error).toBe("too-few");
		const garbage = await handleApi(
			new Request("https://street.test/api/guys", { method: "POST", body: "{nope" }),
			env,
			new URL("https://street.test/api/guys"),
		);
		expect(garbage.status).toBe(400);
	});

	test("rejects a twin, mirrored or not", async () => {
		await post(guys[0]!);
		const same = await post(guys[0]!, "5.5.5.5");
		expect(same.status).toBe(409);
		expect(same.body).toMatchObject({ error: "duplicate", id: 1 });
		const flipped = await post(mirror(guys[0]!), "6.6.6.6");
		expect(flipped.status).toBe(409);
	});

	test("slows down one poster, but not everyone else", async () => {
		for (let i = 0; i < LIMITS.burst.count; i++) expect((await post(guys[i]!)).status).toBe(201);
		const blocked = await post(guys[50]!);
		expect(blocked.status).toBe(429);
		expect(blocked.body.error).toBe("burst");
		expect((await post(guys[51]!, "9.9.9.9")).status).toBe(201);
	});

	test("treats one IPv6 /64 as one poster", async () => {
		for (let i = 0; i < LIMITS.burst.count; i++) expect((await post(guys[i]!, `2001:db8:1:2::${i + 1}`)).status).toBe(201);
		expect((await post(guys[50]!, "2001:db8:1:2:ffff::9")).status).toBe(429);
		expect((await post(guys[51]!, "2001:db8:1:3::1")).status).toBe(201);
	});

	test("says the street is closed when posting is off", async () => {
		await admin("POST", "/api/admin/settings", { postingOff: true });
		const res = await post(guys[0]!);
		expect(res.status).toBe(503);
		expect(res.body.error).toBe("closed");
	});

	test("in approval mode, holds guys back without telling the poster", async () => {
		await admin("POST", "/api/admin/settings", { approvalRequired: true });
		const res = await post(guys[0]!);
		expect(res.status).toBe(201);
		const s = await street();
		expect(s.body.total).toBe(0);
		expect(s.body.guys).toEqual([]);
		// the author still finds their own guy
		const mine = await call("GET", "/api/guys?ids=1");
		expect(mine.body.guys.map((g: { id: number }) => g.id)).toEqual([1]);
		// and an admin can let him in
		await admin("POST", "/api/admin/guys/1", { status: "visible" });
		expect((await street()).body.total).toBe(1);
	});
});

describe("the street", () => {
	test("shows at most two guys from the same poster", async () => {
		for (let i = 0; i < 5; i++) await post(guys[i]!);
		const s = await street();
		expect(s.body.guys).toHaveLength(LIMITS.street.perPoster);
		expect(s.body.total).toBe(5);
	});

	test("mixes the newest with random older guys, without repeats", async () => {
		for (let i = 0; i < 120; i++) await post(guys[i]!, ipFor(i));
		const s = await street();
		const ids: number[] = s.body.guys.map((g: { id: number }) => g.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids.length).toBe(LIMITS.street.newest + LIMITS.street.random);
		expect(s.body.newest).toEqual([120, 119, 118, 117, 116, 115, 114, 113, 112, 111, 110, 109]);
		expect(ids.some((id) => id < 120 - LIMITS.street.newest * 3)).toBe(true);
	});

	test("hands out only newer guys when polling", async () => {
		for (let i = 0; i < 4; i++) await post(guys[i]!, ipFor(i));
		const res = await call("GET", "/api/guys?after=2");
		expect(res.body.guys.map((g: { id: number }) => g.id)).toEqual([3, 4]);
	});

	test("a single guy can be looked up while visible", async () => {
		await post(guys[0]!);
		expect((await call("GET", "/api/guys/1")).status).toBe(200);
		await admin("POST", "/api/admin/guys/1", { status: "hidden" });
		expect((await call("GET", "/api/guys/1")).status).toBe(404);
	});
});

describe("admin", () => {
	test("needs the token", async () => {
		expect((await call("GET", "/api/admin/guys")).status).toBe(401);
		expect((await call("GET", "/api/admin/guys", undefined, { authorization: "Bearer nope!!" })).status).toBe(401);
		env.ADMIN_TOKEN = undefined;
		expect((await call("GET", "/api/admin/guys", undefined, { authorization: "Bearer " })).status).toBe(401);
	});

	test("hiding a guy takes him off the street and out of the count", async () => {
		await post(guys[0]!, ipFor(0));
		await post(guys[1]!, ipFor(1));
		const res = await admin("POST", "/api/admin/guys/1", { status: "hidden" });
		expect(res.body.changed).toBe(1);
		const s = await street();
		expect(s.body.total).toBe(1);
		expect(s.body.guys.map((g: { id: number }) => g.id)).toEqual([2]);
		// hiding twice doesn't count twice
		await admin("POST", "/api/admin/guys/1", { status: "hidden" });
		expect((await street()).body.total).toBe(1);
	});

	test("can hide everything from one poster at once", async () => {
		for (let i = 0; i < 3; i++) await post(guys[i]!);
		await post(guys[3]!, "8.8.8.8");
		const list = await admin("GET", "/api/admin/guys");
		const poster = list.body.guys.find((g: { id: number }) => g.id === 1).poster;
		expect((await admin("POST", `/api/admin/posters/${poster}`)).body.changed).toBe(3);
		const s = await street();
		expect(s.body.total).toBe(1);
		expect(s.body.guys.map((g: { id: number }) => g.id)).toEqual([4]);
	});

	test("lists guys newest first, filtered and paged", async () => {
		for (let i = 0; i < 5; i++) await post(guys[i]!, ipFor(i));
		await admin("POST", "/api/admin/guys/2", { status: "hidden" });
		const hidden = await admin("GET", "/api/admin/guys?status=hidden");
		expect(hidden.body.guys.map((g: { id: number }) => g.id)).toEqual([2]);
		const older = await admin("GET", "/api/admin/guys?before=3");
		expect(older.body.guys.map((g: { id: number }) => g.id)).toEqual([2, 1]);
	});

	test("recount repairs the counter", async () => {
		for (let i = 0; i < 3; i++) await post(guys[i]!, ipFor(i));
		const res = await admin("POST", "/api/admin/recount");
		expect(res.body.settings.visibleCount).toBe(3);
	});
});
