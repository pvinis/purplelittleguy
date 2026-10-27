import { FOUNDING_FRIENDS } from "../shared/templates";
import { type Guy, api, guyNumber, mine, timeAgo } from "./api";
import { Crowd, type Resident } from "./crowd";
import { Editor } from "./editor";
import { Host } from "./guy";
import { drawHouses } from "./houses";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const shuffle = <T>(a: T[]) => a.map((v) => ({ v, k: Math.random() })).sort((x, y) => x.k - y.k).map((x) => x.v);
const touchOnly = matchMedia("(hover: none)").matches;

const stage = $("#street");
const host = new Host(stage, 24);
const crowd = new Crowd(stage, host);
const pool = new Map<string, Resident>();
let maxId = 0;
let total = 0;

const capacity = () => Math.max(6, Math.min(24, Math.floor(stage.clientWidth / 52)));
const resident = (g: Guy, extra: Partial<Resident> = {}): Resident => ({ key: `g${g.id}`, id: g.id, pixels: g.pixels, createdAt: g.createdAt, ...extra });

function setPopulation() {
	$("#pop").textContent = total === 1 ? "1 guy lives here" : `${total.toLocaleString("en-US")} guys live here`;
}

let toastTimer = 0;
function toast(text: string, ms = 5000) {
	const el = $("#toast");
	el.textContent = text;
	el.hidden = false;
	clearTimeout(toastTimer);
	toastTimer = window.setTimeout(() => (el.hidden = true), ms);
}

// A new guy arrives: make room if the street is full, drop him in, and send the big guy over.
function arrive(r: Resident, greeting = ["welcome!", "hi new guy!", "oh! a new guy", "welcome to the street"]) {
	pool.set(r.key, r);
	if (crowd.count >= capacity()) crowd.sendOneAway();
	const w = crowd.add(r, "drop", 40 + Math.random() * Math.max(0, stage.clientWidth - 128));
	crowd.greetWhenLanded(w, greeting);
	return w;
}

const editor = new Editor($("#sheet"), async (pixels, source) => {
	const guy = await api.post(pixels, source);
	mine.add(guy.id);
	total++;
	setPopulation();
	arrive(resident(guy, { mine: true }));
	return guy;
});
$("#leave").addEventListener("click", () => (editor.isOpen ? editor.close() : editor.open()));
$("#leave").addEventListener("pointerdown", (e) => e.stopPropagation());

async function start() {
	host.say(touchOnly ? "hi! tap around" : "hi! come say hi", 4000);
	const focusId = Number(location.pathname.match(/^\/g\/(\d+)/)?.[1]) || 0;
	const [street, mineGuys, focus] = await Promise.all([
		api.street().catch(() => null),
		api.byIds(mine.list().slice(0, 10)).catch(() => [] as Guy[]),
		focusId ? api.one(focusId).catch(() => null) : Promise.resolve(null),
	]);

	if (street) {
		maxId = street.maxId;
		total = street.total;
		setPopulation();
		for (const g of street.guys) pool.set(`g${g.id}`, resident(g));
	} else {
		$("#pop").textContent = "the street is quiet right now";
		toast("Can't reach the street right now. The founding friends are holding the fort.");
	}
	const mineIds = new Set(mineGuys.map((g) => g.id));
	for (const g of mineGuys) pool.set(`g${g.id}`, resident(g, { mine: true }));

	const cap = capacity();
	const placed = new Set<string>();
	const place = (r: Resident) => {
		crowd.add(r, "here");
		placed.add(r.key);
	};

	// yours first, always
	for (const g of mineGuys.slice(0, 3)) place(pool.get(`g${g.id}`)!);

	// the newest few arrive again, so the street feels alive even when nobody else is around
	const arrivals = (street?.newest ?? []).filter((id) => !mineIds.has(id) && id !== focusId).slice(0, 3);
	for (const id of arrivals) placed.add(`g${id}`);

	const others = shuffle([...pool.values()].filter((r) => !placed.has(r.key) && r.id !== focusId));
	for (const r of others.slice(0, Math.max(0, cap - placed.size - (focus ? 1 : 0)))) place(r);

	// until enough people have moved in, the founding friends fill the street
	FOUNDING_FRIENDS.forEach((pixels, i) => {
		if (placed.size + (focus ? 1 : 0) < cap) place({ key: `f${i}`, pixels, friend: true });
	});

	if (focus) {
		const r = resident(focus, { focus: true, mine: mineIds.has(focus.id) });
		setTimeout(() => arrive(r, ["oh! it's you", `hi ${guyNumber(focus.id)}!`, "there you are"]), 1200);
		toast(`This is guy ${guyNumber(focus.id)}. He moved in ${timeAgo(focus.createdAt)}.`, 7000);
	} else if (focusId) {
		toast(`No guy lives at ${guyNumber(focusId)} yet. Want to leave one?`, 7000);
	}
	arrivals.forEach((id, i) => {
		const r = pool.get(`g${id}`);
		if (r) setTimeout(() => arrive(r), (focus ? 3600 : 2400) + i * 1500);
	});
}

// Other people's new guys drop in while you watch.
let lastPoll = 0;
async function poll() {
	if (document.hidden || performance.now() - lastPoll < 15_000) return;
	lastPoll = performance.now();
	try {
		for (const g of await api.after(maxId)) {
			maxId = Math.max(maxId, g.id);
			if (pool.has(`g${g.id}`)) continue;
			total++;
			setPopulation();
			arrive(resident(g));
		}
	} catch {}
}

// Every so often someone wanders off and someone else wanders in.
function rotate() {
	const waiting = [...pool.values()].filter((r) => !crowd.has(r.key));
	if (!waiting.length) return;
	if (crowd.count >= capacity() && !crowd.sendOneAway()) return;
	crowd.add(waiting[Math.floor(Math.random() * waiting.length)]!, "enter");
}

let prev = performance.now();
function frame(now: number) {
	const dt = Math.min(0.05, Math.max(0, (now - prev) / 1000));
	prev = now;
	host.tick(now, dt);
	crowd.tick(now, dt);
	requestAnimationFrame(frame);
}

drawHouses($("#houses"), stage.clientWidth);
let resizeTimer = 0;
addEventListener("resize", () => {
	clearTimeout(resizeTimer);
	resizeTimer = window.setTimeout(() => drawHouses($("#houses"), stage.clientWidth), 150);
});
requestAnimationFrame(frame);
void start();
setInterval(poll, 45_000);
setInterval(rotate, 20_000);
document.addEventListener("visibilitychange", () => void poll());
