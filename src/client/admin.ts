import { guyNumber, timeAgo } from "./api";
import { spriteCanvas } from "./sprite";

type AdminGuy = { id: number; pixels: string; createdAt: number; source: string; status: "visible" | "pending" | "hidden"; poster: string };
type Settings = { postingOff: boolean; approvalRequired: boolean; visibleCount: number };

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const TOKEN_KEY = "plg:admin-token";
let token = "";
let oldest = 0;

try {
	token = localStorage.getItem(TOKEN_KEY) ?? "";
} catch {}
$<HTMLInputElement>("#token").value = token;

async function call<T>(path: string, body?: object): Promise<T> {
	const res = await fetch(path, {
		method: body ? "POST" : "GET",
		headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
		body: body ? JSON.stringify(body) : undefined,
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.message ?? `Request failed (${res.status}).`);
	return data as T;
}

const say = (text: string) => ($("#msg").textContent = text);

function showSettings(s: Settings) {
	$<HTMLInputElement>("#postingOff").checked = s.postingOff;
	$<HTMLInputElement>("#approvalRequired").checked = s.approvalRequired;
	$("#stat").textContent = `${s.visibleCount.toLocaleString("en-US")} visible`;
}

function card(g: AdminGuy): HTMLLIElement {
	const li = document.createElement("li");
	li.dataset.status = g.status;
	li.append(spriteCanvas(g.pixels));
	const meta = document.createElement("span");
	meta.className = "meta";
	meta.textContent = `${guyNumber(g.id)} · ${g.status} · ${g.source} · ${timeAgo(g.createdAt)} · poster ${g.poster.slice(0, 6)}`;
	const row = document.createElement("div");
	row.className = "row";
	const button = (label: string, run: () => Promise<unknown>) => {
		const b = document.createElement("button");
		b.type = "button";
		b.className = "btn small";
		b.textContent = label;
		b.addEventListener("click", () => run().then(() => load(true), (e: Error) => say(e.message)));
		row.append(b);
	};
	if (g.status !== "hidden") button("Hide", () => call(`/api/admin/guys/${g.id}`, { status: "hidden" }));
	if (g.status !== "visible") button(g.status === "pending" ? "Approve" : "Show", () => call(`/api/admin/guys/${g.id}`, { status: "visible" }));
	button("Hide all by poster", () => call(`/api/admin/posters/${g.poster}`, {}));
	li.append(meta, row);
	return li;
}

async function load(reset: boolean) {
	try {
		if (reset) oldest = 0;
		const status = $<HTMLSelectElement>("#filter").value;
		const params = new URLSearchParams();
		if (oldest) params.set("before", String(oldest));
		if (status) params.set("status", status);
		const data = await call<{ settings: Settings; guys: AdminGuy[] }>(`/api/admin/guys?${params}`);
		showSettings(data.settings);
		if (reset) $("#grid").replaceChildren();
		$("#grid").append(...data.guys.map(card));
		oldest = data.guys[data.guys.length - 1]?.id ?? oldest;
		$("#more").hidden = data.guys.length < 100;
		$("#controls").hidden = false;
		say(data.guys.length || !reset ? "" : "No guys here.");
	} catch (e) {
		say((e as Error).message);
	}
}

$("#login").addEventListener("submit", (e) => {
	e.preventDefault();
	token = $<HTMLInputElement>("#token").value.trim();
	try {
		localStorage.setItem(TOKEN_KEY, token);
	} catch {}
	void load(true);
});
for (const id of ["postingOff", "approvalRequired"] as const) {
	$(`#${id}`).addEventListener("change", (e) => {
		const checked = (e.target as HTMLInputElement).checked;
		call<{ settings: Settings }>("/api/admin/settings", { [id]: checked }).then((d) => showSettings(d.settings), (err: Error) => say(err.message));
	});
}
$("#filter").addEventListener("change", () => void load(true));
$("#more").addEventListener("click", () => void load(false));
$("#recount").addEventListener("click", () => call<{ settings: Settings }>("/api/admin/recount", {}).then((d) => showSettings(d.settings), (e: Error) => say(e.message)));
if (token) void load(true);
