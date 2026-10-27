import { describe, expect, test } from "bun:test";
import { inflateSync } from "node:zlib";
import { CARD, renderCard } from "../src/worker/png";
import { FOUNDING_FRIENDS } from "../src/shared/templates";

function decode(png: Uint8Array) {
	const view = new DataView(png.buffer, png.byteOffset);
	let offset = 8;
	const idat: Uint8Array[] = [];
	let width = 0;
	let height = 0;
	while (offset < png.length) {
		const length = view.getUint32(offset);
		const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
		const data = png.subarray(offset + 8, offset + 8 + length);
		if (type === "IHDR") {
			width = new DataView(data.buffer, data.byteOffset).getUint32(0);
			height = new DataView(data.buffer, data.byteOffset).getUint32(4);
		}
		if (type === "IDAT") idat.push(data);
		offset += 12 + length;
	}
	const raw = inflateSync(Buffer.concat(idat));
	return { width, height, at: (x: number, y: number) => raw[y * (width + 1) + 1 + x] };
}

describe("share card", () => {
	test("is a 1200×630 PNG with the guy standing on the street", async () => {
		const png = await renderCard(FOUNDING_FRIENDS[0]!);
		expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		const img = decode(png);
		expect(img.width).toBe(CARD.width);
		expect(img.height).toBe(CARD.height);
		expect(img.at(5, 5)).toBe(0); // sky
		expect(img.at(5, CARD.height - 5)).toBe(1); // street
		// the middle of the guy's body is purple (palette index 3)
		const left = (CARD.width - 12 * CARD.scale) / 2;
		const feet = CARD.height - CARD.floor + 18;
		const top = feet - 11 * CARD.scale;
		expect(img.at(left + 6 * CARD.scale, top + 6 * CARD.scale)).toBe(3);
	});
});
