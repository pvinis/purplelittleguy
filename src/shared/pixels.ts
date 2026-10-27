// A guy is a 12×12 drawing stored as a 144-character string, row by row.
// Each character is one square: "." empty, "l" lilac, "p" purple, "d" deep purple, "k" ink.

export const SIZE = 12;
export const CELLS = SIZE * SIZE;
export const MIN_FILLED = 8;

export type Ink = "l" | "p" | "d" | "k";
export type Cell = "." | Ink;

export const COLORS: Record<Ink, string> = {
	l: "#C7A6F6",
	p: "#8D5CF0",
	d: "#5A2DB6",
	k: "#1E1530",
};

const VALID = /^[.lpdk]{144}$/;

export function isValidPixels(value: unknown): value is string {
	return typeof value === "string" && VALID.test(value);
}

export function filledCount(pixels: string): number {
	let n = 0;
	for (const c of pixels) if (c !== ".") n++;
	return n;
}

export function mirror(pixels: string): string {
	let out = "";
	for (let y = 0; y < SIZE; y++) {
		for (let x = SIZE - 1; x >= 0; x--) out += pixels[y * SIZE + x];
	}
	return out;
}

// A guy and his mirror image count as the same guy.
export function canonical(pixels: string): string {
	const m = mirror(pixels);
	return m < pixels ? m : pixels;
}

export type PixelCheck = { ok: true; pixels: string } | { ok: false; problem: "invalid" | "too-few" };

export function checkPixels(value: unknown): PixelCheck {
	if (!isValidPixels(value)) return { ok: false, problem: "invalid" };
	if (filledCount(value) < MIN_FILLED) return { ok: false, problem: "too-few" };
	return { ok: true, pixels: value };
}

export function emptyPixels(): string {
	return ".".repeat(CELLS);
}

// The lowest row with anything in it, or -1 for an empty drawing.
export function lowestRow(pixels: string): number {
	for (let y = SIZE - 1; y >= 0; y--) {
		for (let x = 0; x < SIZE; x++) if (pixels[y * SIZE + x] !== ".") return y;
	}
	return -1;
}

// Filled squares form one piece (touching sides, not just corners).
export function isConnected(pixels: string): boolean {
	const start = [...pixels].findIndex((c) => c !== ".");
	if (start < 0) return false;
	const seen = new Set([start]);
	const queue = [start];
	while (queue.length) {
		const i = queue.pop()!;
		const x = i % SIZE;
		const y = Math.floor(i / SIZE);
		const next = [x > 0 ? i - 1 : -1, x < SIZE - 1 ? i + 1 : -1, y > 0 ? i - SIZE : -1, y < SIZE - 1 ? i + SIZE : -1];
		for (const j of next) {
			if (j >= 0 && pixels[j] !== "." && !seen.has(j)) {
				seen.add(j);
				queue.push(j);
			}
		}
	}
	return seen.size === filledCount(pixels);
}
