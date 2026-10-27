import { type Cell, SIZE, filledCount, isConnected, lowestRow, mirror } from "./pixels";
import { FOUNDING_FRIENDS } from "./templates";

// Random guys are built from parts (body, eyes, mouth, legs, one optional extra),
// drawn on the left half and mirrored, so they read as characters instead of noise.

export function rng(seed: number): () => number {
	let a = seed | 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

type Scheme = { body: Cell; legs: Cell; eyes: Cell; pupil: Cell | null; mouth: Cell; accent: Cell; highlight: Cell | null };

const SCHEMES: [number, Scheme][] = [
	[0.6, { body: "p", legs: "d", eyes: "k", pupil: null, mouth: "k", accent: "l", highlight: "l" }],
	[0.2, { body: "l", legs: "p", eyes: "k", pupil: null, mouth: "d", accent: "p", highlight: null }],
	[0.2, { body: "d", legs: "p", eyes: "l", pupil: "k", mouth: "l", accent: "l", highlight: "p" }],
];

type Shape = "round" | "tall" | "wide" | "pear" | "square" | "ghost";

const SHAPES: Record<Shape, { hw: number[]; h: number[] }> = {
	round: { hw: [3, 4, 5], h: [5, 6, 7, 8] },
	tall: { hw: [3], h: [7, 8] },
	wide: { hw: [5], h: [4, 5, 6] },
	pear: { hw: [4, 5], h: [6, 7, 8] },
	square: { hw: [3, 4], h: [5, 6, 7] },
	ghost: { hw: [3, 4], h: [6, 7, 8] },
};

// Half-width of the body for each row, top to bottom.
function profile(shape: Shape, hw: number, h: number): number[] {
	return Array.from({ length: h }, (_, i) => {
		const last = i === h - 1;
		let w = hw;
		if (shape === "round" || shape === "tall" || shape === "ghost") w = i === 0 ? hw - 2 : i === 1 || (last && shape !== "ghost") ? hw - 1 : hw;
		if (shape === "wide") w = i === 0 ? hw - 2 : last ? hw - 1 : hw;
		if (shape === "pear") w = Math.round(hw - 2 + (2 * i) / (h - 1));
		if (shape === "square") w = i === 0 ? hw - 1 : hw;
		return Math.max(1, w);
	});
}

export type GeneratedGuy = { pixels: string; body: Cell; eyes: number[]; mouth: number[] };

function build(r: () => number): GeneratedGuy {
	const pickOne = <T>(a: T[]): T => a[Math.floor(r() * a.length)]!;
	const weighted = <T>(items: [number, T][]): T => {
		let x = r();
		for (const [w, item] of items) if ((x -= w) < 0) return item;
		return items[items.length - 1]![1];
	};

	const grid: Cell[] = Array(SIZE * SIZE).fill(".");
	const at = (x: number, y: number) => grid[y * SIZE + x]!;
	const set = (x: number, y: number, c: Cell) => {
		grid[y * SIZE + x] = c;
		grid[y * SIZE + (SIZE - 1 - x)] = c;
	};

	const scheme = weighted(SCHEMES);
	const shape = pickOne(Object.keys(SHAPES) as Shape[]);
	const hw = pickOne(SHAPES[shape].hw);
	const h = pickOne(SHAPES[shape].h);
	const legLen = shape === "ghost" ? 0 : r() < 0.5 ? 1 : 2;
	const bottom = shape === "ghost" ? SIZE - 2 : SIZE - 1 - legLen;
	const top = bottom - h + 1;
	const widths = profile(shape, hw, h);
	const widthAt = (y: number) => (y >= top && y <= bottom ? widths[y - top]! : 0);

	// body
	for (let y = top; y <= bottom; y++) for (let k = 0; k < widthAt(y); k++) set(5 - k, y, scheme.body);
	if (shape === "ghost") {
		const phase = r() < 0.5 ? 0 : 1;
		for (let k = 0; k < widthAt(bottom); k++) if (k % 2 === phase) set(5 - k, SIZE - 1, scheme.body);
	}

	// eyes, a little above the middle so the forehead is big
	const eyeRow = top + Math.round(h * (0.35 + r() * 0.15));
	const eyeH = r() < 0.35 ? 2 : 1;
	const eyeW = hw >= 4 && r() < 0.25 ? 2 : 1;
	const inner = 5 - (hw >= 4 && r() < 0.4 ? 2 : 1);
	const eyes: number[] = [];
	for (let y = eyeRow; y < eyeRow + eyeH; y++) {
		for (let x = inner - eyeW + 1; x <= inner; x++) {
			set(x, y, scheme.eyes);
			eyes.push(y * SIZE + x, y * SIZE + (SIZE - 1 - x));
		}
	}
	if (scheme.pupil && eyeW === 2 && eyeH === 2) set(inner, eyeRow + 1, scheme.pupil);

	// cheeks on some guys, just below and outside the eyes
	if (scheme.body !== "l" && r() < 0.3) {
		const x = inner - eyeW;
		const y = eyeRow + eyeH;
		if (x >= 0 && y < bottom && at(x, y) === scheme.body) set(x, y, scheme.accent);
	}

	// mouth, small and centered
	const mouth: number[] = [];
	if (r() < 0.6) {
		const m = eyeRow + eyeH + (r() < 0.3 ? 1 : 0);
		if (m <= bottom - 1) {
			set(5, m, scheme.mouth);
			mouth.push(m * SIZE + 5, m * SIZE + 6);
		}
	}

	// legs
	if (legLen > 0) {
		const wb = widthAt(bottom);
		const j = wb >= 2 ? 1 + Math.floor(r() * (wb - 1)) : 0;
		for (let y = bottom + 1; y < SIZE; y++) set(5 - j, y, scheme.legs);
		if (legLen === 2 && j < 5 && r() < 0.3) set(4 - j, SIZE - 1, scheme.legs);
	}

	// one extra at most
	const extra = r();
	if (extra < 0.15 && top >= 2) {
		grid[(top - 1) * SIZE + 6] = scheme.legs; // antenna, on one side only
		grid[(top - 2) * SIZE + 6] = scheme.accent;
	} else if (extra < 0.3 && top >= 2) {
		set(5, top - 1, scheme.accent); // party hat
		set(4, top - 1, scheme.accent);
		set(5, top - 2, scheme.accent);
	} else if (extra < 0.42 && top >= 1) {
		set(6 - widthAt(top), top - 1, scheme.body); // ears
	} else if (extra < 0.52) {
		const y = Math.min(eyeRow + 1, bottom);
		const x = 5 - widthAt(y);
		if (x >= 0) for (let k = 0; k < 3 && y - k >= 0; k++) set(x, y - k, scheme.legs); // arms up
	} else if (extra < 0.62 && scheme.body !== "l") {
		for (let y = bottom - 2; y <= bottom - 1; y++) {
			for (const x of [4, 5]) if (at(x, y) === scheme.body) set(x, y, scheme.accent); // belly
		}
	}

	// a few spots, mirrored, on some guys
	if (r() < 0.4) {
		const spots = 1 + Math.floor(r() * 3);
		for (let n = 0, tries = 0; n < spots && tries < 30; tries++) {
			const x = Math.floor(r() * 6);
			const y = top + 1 + Math.floor(r() * Math.max(1, h - 2));
			const i = y * SIZE + x;
			if (at(x, y) === scheme.body && neighbors(i).every((j) => j >= 0 && grid[j] !== ".")) {
				set(x, y, scheme.accent);
				n++;
			}
		}
	}

	// one highlight near the top left, the only deliberate asymmetry
	if (scheme.highlight) {
		const y = top + 1 + (h > 6 && r() < 0.5 ? 1 : 0);
		const x = 6 - widthAt(y) + 1;
		if (x <= 5 && at(x, y) === scheme.body) grid[y * SIZE + x] = scheme.highlight;
	}

	return { pixels: grid.join(""), body: scheme.body, eyes, mouth };
}

const neighbors = (i: number) => {
	const x = i % SIZE;
	const y = Math.floor(i / SIZE);
	return [x > 0 ? i - 1 : -1, x < SIZE - 1 ? i + 1 : -1, y > 0 ? i - SIZE : -1, y < SIZE - 1 ? i + SIZE : -1];
};

const around = (i: number) => {
	const x = i % SIZE;
	const y = Math.floor(i / SIZE);
	const out: number[] = [];
	for (let dy = -1; dy <= 1; dy++) {
		for (let dx = -1; dx <= 1; dx++) {
			if ((dx || dy) && x + dx >= 0 && x + dx < SIZE && y + dy >= 0 && y + dy < SIZE) out.push((y + dy) * SIZE + x + dx);
		}
	}
	return out;
};

// Face parts must stand apart: no squares of their own color touching them, or they melt into a blob.
const standsApart = (pixels: string, part: number[]) => {
	const own = new Set(part);
	return part.every((i) => around(i).every((j) => own.has(j) || pixels[j] !== pixels[i]));
};

// The rules every random guy has to pass.
export function isGoodGuy(guy: GeneratedGuy): boolean {
	const { pixels, eyes, body } = guy;
	const filled = filledCount(pixels);
	if (filled < 20 || filled > 90) return false;
	if (!isConnected(pixels)) return false;
	if (lowestRow(pixels) !== SIZE - 1) return false;
	// nearly symmetric
	const m = mirror(pixels);
	let diff = 0;
	for (let i = 0; i < pixels.length; i++) if (pixels[i] !== m[i]) diff++;
	if (diff > 6) return false;
	// eyes exist, differ from the body, and sit inside it
	if (eyes.length < 2) return false;
	for (const i of eyes) {
		if (pixels[i] === body || pixels[i] === ".") return false;
		if (neighbors(i).some((j) => j < 0 || pixels[j] === ".")) return false;
	}
	if (!standsApart(pixels, eyes) || !standsApart(pixels, guy.mouth)) return false;
	// ink never sits on the outline, where it would vanish against a dark page
	for (let i = 0; i < pixels.length; i++) {
		if (pixels[i] === "k" && neighbors(i).some((j) => j < 0 || pixels[j] === ".")) return false;
	}
	return true;
}

export function generateDetailed(seed: number): GeneratedGuy | null {
	const r = rng(seed);
	for (let attempt = 0; attempt < 40; attempt++) {
		const guy = build(r);
		if (isGoodGuy(guy)) return guy;
	}
	return null;
}

export function generateGuy(seed: number = Math.floor(Math.random() * 2 ** 31)): string {
	return generateDetailed(seed)?.pixels ?? FOUNDING_FRIENDS[Math.abs(seed) % FOUNDING_FRIENDS.length]!;
}
