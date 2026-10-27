export type Guy = { id: number; pixels: string; createdAt: number; source: "drawn" | "random" };
export type Street = { total: number; maxId: number; newest: number[]; guys: Guy[] };

export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
		readonly data: Record<string, unknown> = {},
	) {
		super(message);
	}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	let res: Response;
	try {
		res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
	} catch {
		throw new ApiError(0, "offline", "Couldn't reach the street. Check your connection and try again.");
	}
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new ApiError(res.status, data.error ?? "server", data.message ?? "Something went wrong. Try again in a bit.", data);
	return data as T;
}

export const api = {
	street: () => request<Street>("/api/street"),
	after: (id: number) => request<{ guys: Guy[] }>(`/api/guys?after=${id}`).then((r) => r.guys),
	byIds: (ids: number[]) => (ids.length ? request<{ guys: Guy[] }>(`/api/guys?ids=${ids.join(",")}`).then((r) => r.guys) : Promise.resolve([])),
	one: (id: number) => request<{ guy: Guy }>(`/api/guys/${id}`).then((r) => r.guy),
	post: (pixels: string, source: "drawn" | "random") =>
		request<{ guy: Guy }>("/api/guys", { method: "POST", body: JSON.stringify({ pixels, source }) }).then((r) => r.guy),
};

// The ids of guys you left, so "yours" survives a reload. Browser storage can be missing; that's fine.
const MINE_KEY = "plg:mine";
export const mine = {
	list(): number[] {
		try {
			const ids = JSON.parse(localStorage.getItem(MINE_KEY) ?? "[]");
			return Array.isArray(ids) ? ids.filter((n) => Number.isInteger(n)) : [];
		} catch {
			return [];
		}
	},
	add(id: number) {
		try {
			localStorage.setItem(MINE_KEY, JSON.stringify([id, ...mine.list().filter((n) => n !== id)].slice(0, 50)));
		} catch {}
	},
};

export function timeAgo(ms: number, now = Date.now()): string {
	const s = Math.max(0, Math.round((now - ms) / 1000));
	const units: [number, string][] = [
		[60 * 60 * 24 * 365, "year"],
		[60 * 60 * 24 * 30, "month"],
		[60 * 60 * 24 * 7, "week"],
		[60 * 60 * 24, "day"],
		[60 * 60, "hour"],
		[60, "minute"],
	];
	for (const [size, name] of units) {
		const n = Math.floor(s / size);
		if (n >= 1) return `${n} ${name}${n === 1 ? "" : "s"} ago`;
	}
	return "just now";
}

export const guyNumber = (id: number) => `#${id.toLocaleString("en-US")}`;
