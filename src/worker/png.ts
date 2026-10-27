import { COLORS, type Ink, SIZE, lowestRow } from "../shared/pixels";

// A tiny PNG encoder (8-bit indexed color), so share images need no extra packages.

const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c >>> 0;
	}
	return t;
})();

function crc32(bytes: Uint8Array): number {
	let c = 0xffffffff;
	for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
	const out = new Uint8Array(12 + data.length);
	const view = new DataView(out.buffer);
	view.setUint32(0, data.length);
	for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
	out.set(data, 8);
	view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
	return out;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([data]).stream().pipeThrough(new CompressionStream("deflate"));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export async function encodeIndexedPng(width: number, height: number, palette: string[], indices: Uint8Array): Promise<Uint8Array> {
	const header = new Uint8Array(13);
	const hv = new DataView(header.buffer);
	hv.setUint32(0, width);
	hv.setUint32(4, height);
	header.set([8, 3, 0, 0, 0], 8); // 8-bit, indexed, deflate, no filter, no interlace

	const raw = new Uint8Array((width + 1) * height);
	for (let y = 0; y < height; y++) raw.set(indices.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);

	const parts = [
		new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", header),
		chunk("PLTE", new Uint8Array(palette.flatMap(hex))),
		chunk("IDAT", await deflate(raw)),
		chunk("IEND", new Uint8Array()),
	];
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let offset = 0;
	for (const p of parts) {
		out.set(p, offset);
		offset += p.length;
	}
	return out;
}

// A 1200×630 share card: the guy standing on the street.
export const CARD = { width: 1200, height: 630, scale: 30, floor: 130 };
const PALETTE = ["#E8EEE3", "#CDD8C3", COLORS.l, COLORS.p, COLORS.d, COLORS.k];
const INDEX: Record<Ink, number> = { l: 2, p: 3, d: 4, k: 5 };

export function renderCard(pixels: string): Promise<Uint8Array> {
	const { width, height, scale, floor } = CARD;
	const img = new Uint8Array(width * height);
	img.fill(1, (height - floor) * width);
	const size = SIZE * scale;
	const left = Math.round((width - size) / 2);
	const feet = height - floor + 18; // feet sink a little into the street
	const top = feet - (lowestRow(pixels) + 1) * scale;
	for (let i = 0; i < pixels.length; i++) {
		const c = pixels[i] as Ink | ".";
		if (c === ".") continue;
		const x0 = left + (i % SIZE) * scale;
		const y0 = top + Math.floor(i / SIZE) * scale;
		for (let y = Math.max(0, y0); y < Math.min(height, y0 + scale); y++) img.fill(INDEX[c], y * width + x0, y * width + x0 + scale);
	}
	return encodeIndexedPng(width, height, PALETTE, img);
}
