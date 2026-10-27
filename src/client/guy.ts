// The big purple guy who lives on the street: an SVG character with a few moods,
// who follows your cursor, trips, naps, and goes to greet the little guys.

const INK = "#1E1530";
const CHEEK = "#FF8FB8";

type Look = { eyes?: string; mouth?: string; cls?: string; blink?: boolean; blush?: boolean };

function eyesSVG(t = "dot"): string {
	const dot = (x: number) => `<circle cx="${x}" cy="56" r="4.8" fill="${INK}"/><circle cx="${x + 1.6}" cy="54.3" r="1.5" fill="#fff"/>`;
	const arc = (x: number, up: boolean) =>
		`<path d="M${x - 5} ${up ? 58 : 55} Q${x} ${up ? 51.5 : 61} ${x + 5} ${up ? 58 : 55}" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/>`;
	if (t === "happy") return arc(40, true) + arc(60, true);
	if (t === "closed") return arc(40, false) + arc(60, false);
	if (t === "x") return [40, 60].map((x) => `<path d="M${x - 4} 52l8 8M${x + 4} 52l-8 8" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`).join("");
	return dot(40) + dot(60);
}

function mouthSVG(t = "smile"): string {
	const s = `fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"`;
	if (t === "o") return `<ellipse cx="50" cy="70" rx="3" ry="3.6" fill="${INK}"/>`;
	if (t === "grin") return `<path d="M43 66 Q50 78 57 66 Z" fill="${INK}"/><ellipse cx="50" cy="71.2" rx="3.2" ry="1.8" fill="${CHEEK}"/>`;
	if (t === "tongue") return `<path d="M50 69.5 q0 5 3 5 q3 0 3-5 Z" fill="${CHEEK}"/><path d="M44 67 Q50 73 56 67" ${s}/>`;
	if (t === "wobble") return `<path d="M43 69 Q46.5 65.5 50 69 T57 69" ${s}/>`;
	return `<path d="M44 67 Q50 73 56 67" ${s}/>`;
}

export function guySVG(o: Look = {}): string {
	const eyes = o.blink && (o.eyes ?? "dot") === "dot" ? `<g class="eo">${eyesSVG()}</g><g class="ec">${eyesSVG("closed")}</g>` : eyesSVG(o.eyes);
	const cheek = o.blush ? 0.9 : 0.4;
	return `<svg class="guy ${o.cls ?? ""}" viewBox="-8 -16 116 120" style="--bd:${(-Math.random() * 4).toFixed(2)}s" aria-hidden="true">
		<rect class="leg leg-l" x="33" y="84" width="11" height="18" rx="5.5" fill="#6B3DD0"/>
		<rect class="leg leg-r" x="56" y="84" width="11" height="18" rx="5.5" fill="#6B3DD0"/>
		<rect class="arm arm-l" x="6" y="58" width="12" height="22" rx="6" fill="#6B3DD0"/>
		<rect class="arm arm-r" x="82" y="58" width="12" height="22" rx="6" fill="#6B3DD0"/>
		<path d="M50 20 C77 20 87 44 87 68 C87 87 72 94 50 94 C28 94 13 87 13 68 C13 44 23 20 50 20 Z" fill="#8D5CF0"/>
		<ellipse cx="35" cy="37" rx="8" ry="4.6" fill="#fff" opacity=".22" transform="rotate(-28 35 37)"/>
		<ellipse cx="30.5" cy="65" rx="5.5" ry="3.2" fill="${CHEEK}" opacity="${cheek}"/>
		<ellipse cx="69.5" cy="65" rx="5.5" ry="3.2" fill="${CHEEK}" opacity="${cheek}"/>
		${eyes}${mouthSVG(o.mouth)}
	</svg>`;
}

type Mode = "idle" | "walk" | "sleep" | "trip" | "wave" | "pet";

const LOOKS: Record<Mode, Look> = {
	idle: { blink: true },
	walk: { cls: "walking", blink: true },
	sleep: { eyes: "closed", mouth: "o" },
	trip: { eyes: "x", mouth: "wobble" },
	wave: { eyes: "happy", mouth: "grin", cls: "waving" },
	pet: { eyes: "happy", mouth: "tongue", blush: true },
};

const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)]!;
export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const touchOnly = matchMedia("(hover: none)").matches;

export function particle(stage: HTMLElement, cls: string, text: string, x: number, bottom: number, dx: number, delay = 0) {
	const s = document.createElement("span");
	s.className = `pt ${cls}`;
	s.textContent = text;
	s.style.left = `${x}px`;
	s.style.bottom = `${bottom}px`;
	s.style.setProperty("--dx", `${dx}px`);
	s.style.animationDelay = `${delay}ms`;
	stage.appendChild(s);
	s.addEventListener("animationend", () => s.remove());
}

// Someone the big guy can walk over to: anything with a current center x.
export type Visit = { centerX: () => number; gone: () => boolean; text: string[]; onArrive?: () => void };

export class Host {
	readonly el: HTMLDivElement;
	private flip: HTMLDivElement;
	private bubble: HTMLDivElement;
	private x = 0;
	private target = 0;
	private face = 1;
	private mode: Mode = "idle";
	private start = 0;
	private until = 0;
	private last = performance.now() + 2500;
	private lastTrip = performance.now();
	private lastZ = 0;
	private shown = "";
	private visits: Visit[] = [];
	private visitStart = 0;
	private bubbleTimer = 0;
	private readonly sleepAfter = touchOnly ? 15_000 : 5_000;

	constructor(
		private stage: HTMLElement,
		private bottom: number,
	) {
		this.el = document.createElement("div");
		this.el.className = "host";
		this.el.tabIndex = 0;
		this.el.setAttribute("role", "button");
		this.el.setAttribute("aria-label", "The purple guy. Press to pet him.");
		this.el.innerHTML = '<div class="shadow"></div><div class="bubble" hidden></div><div class="host-flip"></div>';
		stage.appendChild(this.el);
		this.flip = this.el.querySelector(".host-flip")!;
		this.bubble = this.el.querySelector(".bubble")!;
		this.x = this.target = this.clamp((stage.clientWidth - this.width) / 2);

		stage.addEventListener("pointermove", (e) => this.poke(e));
		stage.addEventListener("pointerdown", (e) => this.poke(e));
		this.el.addEventListener("pointerdown", (e) => {
			e.stopPropagation();
			this.pet();
		});
		this.el.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				this.pet();
			}
		});
	}

	get width() {
		return this.el.offsetWidth;
	}
	get centerX() {
		return this.x + this.width / 2;
	}
	get asleep() {
		return this.mode === "sleep";
	}

	private clamp(v: number) {
		return Math.max(8, Math.min(this.stage.clientWidth - this.width - 8, v));
	}

	private setMode(m: Mode, ms = 0) {
		this.mode = m;
		this.start = performance.now();
		this.until = ms ? this.start + ms : 0;
	}

	say(text: string, ms = 1800) {
		this.bubble.textContent = text;
		this.bubble.hidden = false;
		this.placeBubble();
		clearTimeout(this.bubbleTimer);
		this.bubbleTimer = window.setTimeout(() => (this.bubble.hidden = true), ms);
	}

	sayIfQuiet(text: string, ms?: number) {
		if (this.bubble.hidden) this.say(text, ms);
	}

	private placeBubble() {
		const W = this.stage.clientWidth;
		this.bubble.classList.toggle("al", this.x < 70);
		this.bubble.classList.toggle("ar", this.x >= 70 && this.x > W - this.width - 70);
	}

	private wake() {
		if (this.mode !== "sleep") return;
		this.setMode("idle");
		this.say(pick(["oh! hi.", "you came back", "hello hello", "*yawn* hi"]), 1500);
	}

	private poke(e: PointerEvent) {
		this.last = performance.now();
		this.wake();
		if (this.visits.length) return; // busy saying hi to someone
		const r = this.stage.getBoundingClientRect();
		this.target = this.clamp(e.clientX - r.left - this.width / 2);
	}

	private pet() {
		this.last = performance.now();
		if (this.mode === "trip") return;
		this.setMode("pet", 1300);
		this.say(pick(["hehe", "that tickles", "again?", "i like that", "oh! ♥"]), 1400);
		for (let i = 0; i < 3; i++) {
			particle(this.stage, "heart", "♥", this.x + this.width * (0.25 + Math.random() * 0.5), this.bottom + 90, (Math.random() - 0.5) * 50, i * 110);
		}
	}

	// Walk over to someone and say hi. Visits queue up, so a crowd of arrivals gets greeted one by one.
	visit(v: Visit) {
		if (this.visits.length >= 4) return;
		this.visits.push(v);
		this.last = performance.now();
		if (this.visits.length === 1) this.visitStart = performance.now();
		this.wake();
	}

	tick(now: number, dt: number) {
		const visit = this.visits[0];
		if (visit && (visit.gone() || now - this.visitStart > 6000)) {
			this.visits.shift();
			this.visitStart = now;
		} else if (visit) {
			// stop beside them, on the side he's coming from, instead of standing on top of them
			const cx = visit.centerX();
			const gap = this.width / 2 + 16;
			const beside = (side: number) => this.clamp(cx + side * gap - this.width / 2);
			const side = this.centerX < cx ? -1 : 1;
			// near an edge there may be no room on that side, so use the other one
			this.target = Math.abs(beside(side) + this.width / 2 - cx) >= gap - 1 ? beside(side) : beside(-side);
			this.last = now;
		}
		this.target = this.clamp(this.target);
		if (this.until && now > this.until) this.setMode("idle");

		if (this.mode === "idle" || this.mode === "walk") {
			const dx = this.target - this.x;
			if (Math.abs(dx) > 3) {
				if (this.mode !== "walk") this.setMode("walk");
				this.face = dx > 0 ? 1 : -1;
				this.x += this.face * Math.min(Math.abs(dx), (visit ? 230 : 150) * dt);
				if (!visit && Math.abs(dx) > 60 && now - this.lastTrip > 7000 && Math.random() < dt * 0.25) this.trip(now);
			} else {
				if (this.mode === "walk") this.setMode("idle");
				const v = this.visits[0];
				if (v) {
					this.visits.shift();
					this.visitStart = now;
					this.setMode("wave", 1500);
					this.say(pick(v.text));
					v.onArrive?.();
				}
			}
			if (this.mode === "idle" && !this.visits.length && now - this.last > this.sleepAfter) {
				this.setMode("sleep");
				this.bubble.hidden = true;
			}
		}
		if (this.mode === "sleep" && now - this.lastZ > 1100) {
			this.lastZ = now;
			particle(this.stage, "z", pick(["z", "Z", "z"]), this.x + this.width * 0.74, this.bottom + 92, 16 + Math.random() * 12);
		}
		this.draw(now);
	}

	private trip(now: number) {
		this.lastTrip = now;
		this.setMode("trip", 1250);
		this.say(pick(["oof", "whoops", "i meant to do that"]), 1300);
		for (let i = 0; i < 4; i++) {
			particle(this.stage, "dust", "", this.x + this.width / 2 + this.face * (34 + i * 6), this.bottom - 2, this.face * (6 + i * 5), i * 40);
		}
	}

	private draw(now: number) {
		let bob = 0;
		let rot = 0;
		let sx = 1;
		let sy = 1;
		const t = now - this.start;
		if (this.mode === "walk" && !reduceMotion) bob = -Math.abs(Math.sin((now / 1000) * 9.2)) * 5;
		if (this.mode === "trip") rot = t < 200 ? (t / 200) * 84 : t < 880 ? 84 : Math.max(0, 84 * (1 - (t - 880) / 340));
		if (this.mode === "sleep") {
			sx = 1.05;
			sy = 0.93;
		}
		if (this.mode === "pet" && !reduceMotion) {
			sy = 1 + Math.sin((t / 1000) * 20) * 0.05 * Math.max(0, 1 - t / 1000);
			sx = 2 - sy;
		}
		this.el.style.transform = `translateX(${this.x}px)`;
		this.flip.style.transform = `translateY(${bob}px) scale(${sx * this.face}, ${sy}) rotate(${rot}deg)`;
		if (this.shown !== this.mode) {
			this.shown = this.mode;
			this.flip.innerHTML = guySVG(LOOKS[this.mode]);
		}
		if (!this.bubble.hidden) this.placeBubble();
	}
}
