import { guyNumber, timeAgo } from "./api";
import { type Host, particle, reduceMotion } from "./guy";
import { footGap, spriteCanvas } from "./sprite";

// Everyone on the street besides the big guy: visitors' guys and the founding friends.
export type Resident = { key: string; pixels: string; id?: number; createdAt?: number; mine?: boolean; friend?: boolean; focus?: boolean };

type Walker = {
	r: Resident;
	el: HTMLDivElement;
	cv: HTMLCanvasElement;
	tag: HTMLSpanElement;
	gap: number;
	bottom: number;
	x: number;
	y: number;
	vy: number;
	dir: number;
	speed: number;
	phase: number;
	pause: number;
	hiCool: number;
	state: "drop" | "in" | "out" | "here";
	infoUntil: number;
	greet?: string[];
};

const SPRITE = 48;
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)]!;

export function describe(r: Resident): string {
	if (r.friend) return "founding friend";
	const when = r.createdAt ? ` · ${timeAgo(r.createdAt)}` : "";
	return `${r.mine ? "yours · " : ""}${guyNumber(r.id ?? 0)}${when}`;
}

const defaultTag = (r: Resident) => (r.mine ? "yours" : r.focus && r.id ? guyNumber(r.id) : "");

export class Crowd {
	private walkers: Walker[] = [];

	constructor(
		private stage: HTMLElement,
		private host: Host,
		private ground = { base: 52, depth: 58 },
	) {}

	get count() {
		return this.walkers.filter((w) => w.state !== "out").length;
	}

	has(key: string) {
		return this.walkers.some((w) => w.r.key === key && w.state !== "out");
	}

	find(key: string) {
		return this.walkers.find((w) => w.r.key === key);
	}

	// how: "here" stands somewhere on the street, "drop" falls from the sky, "enter" walks in from a side.
	add(r: Resident, how: "here" | "drop" | "enter", at?: number): Walker {
		const W = this.stage.clientWidth;
		const depth = r.mine || r.focus ? 0.05 : Math.random();
		const el = document.createElement("div");
		el.className = "walker";
		const tag = document.createElement("span");
		tag.className = "tag";
		const cv = spriteCanvas(r.pixels);
		el.append(tag, cv);
		el.setAttribute("aria-hidden", "true");
		const bottom = this.ground.base + depth * this.ground.depth;
		el.style.bottom = `${bottom}px`;
		el.style.zIndex = String(10 + Math.round((1 - depth) * 80));
		this.stage.appendChild(el);

		const fromLeft = Math.random() < 0.5;
		const w: Walker = {
			r,
			el,
			cv,
			tag,
			gap: footGap(r.pixels) * (SPRITE / 12),
			bottom,
			x: how === "enter" ? (fromLeft ? -SPRITE - 4 : W + 4) : (at ?? 4 + Math.random() * Math.max(0, W - SPRITE - 8)),
			y: how === "drop" ? -this.stage.clientHeight : 0,
			vy: 0,
			dir: how === "enter" ? (fromLeft ? 1 : -1) : Math.random() < 0.5 ? -1 : 1,
			speed: 16 + Math.random() * 26,
			phase: Math.random() * 6,
			pause: how === "here" && Math.random() < 0.3 ? Math.random() * 2 : 0,
			hiCool: 0,
			state: how === "here" ? "here" : how === "drop" ? "drop" : "in",
			infoUntil: 0,
		};
		this.setTag(w, defaultTag(r));
		el.addEventListener("pointerdown", (e) => {
			e.stopPropagation();
			this.showInfo(w, describe(w.r), 4000);
			this.host.visit({ centerX: () => w.x + SPRITE / 2, gone: () => !this.walkers.includes(w), text: ["hi!", "hello there", "oh, hi!", "nice to see you"] });
		});
		this.walkers.push(w);
		return w;
	}

	// The big guy goes over to say hi once this guy has landed.
	greetWhenLanded(w: Walker, text: string[]) {
		if (w.state === "drop") w.greet = text;
		else this.greet(w, text);
	}

	private greet(w: Walker, text: string[]) {
		this.host.visit({ centerX: () => w.x + SPRITE / 2, gone: () => !this.walkers.includes(w) || w.state === "out", text });
	}

	setTag(w: Walker, text: string) {
		w.tag.textContent = text;
		w.tag.hidden = !text;
	}

	showInfo(w: Walker, text: string, ms: number) {
		this.setTag(w, text);
		w.infoUntil = performance.now() + ms;
	}

	// Someone walks off the street to make room. Never yours, never the one you came to see.
	sendOneAway(): boolean {
		const candidates = this.walkers.filter((w) => w.state === "here" && !w.r.mine && !w.r.focus);
		const friends = candidates.filter((w) => w.r.friend);
		const w = pick(friends.length ? friends : candidates);
		if (!w) return false;
		w.state = "out";
		w.dir = w.x < this.stage.clientWidth / 2 ? -1 : 1;
		return true;
	}

	tick(now: number, dt: number) {
		const W = this.stage.clientWidth;
		const hx = this.host.centerX;
		const hostUp = !this.host.asleep;
		for (const w of [...this.walkers]) {
			let moving = false;
			if (w.state === "drop") {
				w.vy += 1500 * dt;
				w.y += w.vy * dt;
				if (w.y >= 0) {
					w.y = 0;
					if (w.vy > 260) w.vy *= -0.35;
					else {
						w.vy = 0;
						w.state = "here";
						if (w.greet) this.greet(w, w.greet);
					}
				}
			} else if (w.state === "in" || w.state === "out") {
				w.x += w.dir * 60 * dt;
				moving = true;
				if (w.state === "in" && w.x >= 4 && w.x <= W - SPRITE - 4) w.state = "here";
				if (w.state === "out" && (w.x < -SPRITE - 8 || w.x > W + 8)) {
					w.el.remove();
					this.walkers.splice(this.walkers.indexOf(w), 1);
					continue;
				}
			} else if (w.pause > 0) {
				w.pause -= dt;
			} else {
				w.x += w.dir * w.speed * dt;
				moving = true;
				if (w.x < 4) {
					w.x = 4;
					w.dir = 1;
				}
				if (w.x > W - SPRITE - 4) {
					w.x = W - SPRITE - 4;
					w.dir = -1;
				}
				if (Math.random() < dt * 0.12) {
					w.pause = 0.6 + Math.random() * 1.8;
					if (Math.random() < 0.5) w.dir *= -1;
				}
			}
			if (moving) w.phase += dt * Math.max(w.speed, 30) * 0.28;

			// bumping into the big guy
			if (hostUp && w.state === "here" && Math.abs(w.x + SPRITE / 2 - hx) < 34 && now > w.hiCool) {
				w.hiCool = now + 8000;
				w.pause = 1.3;
				w.dir = hx > w.x + SPRITE / 2 ? 1 : -1;
				particle(this.stage, "hi", pick(["hi", "hey", "hi!", "oh hi"]), w.x + 12, w.bottom + 52, w.dir * 6);
				if (Math.random() < 0.5) this.host.sayIfQuiet(pick(["hi!", "hey neighbor", "hello!", "oh, hi"]), 1100);
			}

			if (w.infoUntil && now > w.infoUntil) {
				w.infoUntil = 0;
				this.setTag(w, defaultTag(w.r));
			}

			const bob = !moving || reduceMotion ? 0 : -Math.abs(Math.sin(w.phase)) * 3;
			w.el.style.transform = `translate(${w.x}px, ${w.y + bob + w.gap}px)`;
			w.cv.style.transform = `scaleX(${w.dir})`;
		}
	}
}
