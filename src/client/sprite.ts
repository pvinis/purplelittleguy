import { COLORS, type Ink, SIZE, lowestRow } from "../shared/pixels";

// Draw a 12×12 guy onto a tiny canvas; CSS scales it up with crisp pixels.
export function spriteCanvas(pixels: string): HTMLCanvasElement {
	const cv = document.createElement("canvas");
	cv.width = cv.height = SIZE;
	paintSprite(cv, pixels);
	return cv;
}

export function paintSprite(cv: HTMLCanvasElement, pixels: string) {
	const ctx = cv.getContext("2d")!;
	ctx.clearRect(0, 0, SIZE, SIZE);
	for (let i = 0; i < pixels.length; i++) {
		const c = pixels[i] as Ink | ".";
		if (c === ".") continue;
		ctx.fillStyle = COLORS[c];
		ctx.fillRect(i % SIZE, Math.floor(i / SIZE), 1, 1);
	}
}

// Empty rows under the feet, so every guy stands on the street.
export const footGap = (pixels: string) => SIZE - 1 - Math.max(0, lowestRow(pixels));
