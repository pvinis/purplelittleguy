import { describe, expect, test } from "bun:test";
import { canonical, checkPixels, emptyPixels, filledCount, isConnected, lowestRow, mirror } from "../src/shared/pixels";
import { FOUNDING_FRIENDS } from "../src/shared/templates";

const one = (i: number, c = "p") => {
	const a = [...emptyPixels()];
	a[i] = c;
	return a.join("");
};

describe("pixels", () => {
	test("founding friends are valid guys", () => {
		for (const f of FOUNDING_FRIENDS) expect(checkPixels(f).ok).toBe(true);
	});

	test("rejects the wrong length or unknown colors", () => {
		expect(checkPixels("p".repeat(143))).toEqual({ ok: false, problem: "invalid" });
		expect(checkPixels("x".repeat(144))).toEqual({ ok: false, problem: "invalid" });
		expect(checkPixels(42)).toEqual({ ok: false, problem: "invalid" });
	});

	test("needs at least 8 filled squares", () => {
		expect(checkPixels("p".repeat(7) + ".".repeat(137))).toEqual({ ok: false, problem: "too-few" });
		expect(checkPixels("p".repeat(8) + ".".repeat(136)).ok).toBe(true);
	});

	test("mirror flips each row, and a guy and his mirror share a canonical form", () => {
		expect(mirror(one(0))).toBe(one(11));
		expect(mirror(mirror(FOUNDING_FRIENDS[1]!))).toBe(FOUNDING_FRIENDS[1]!);
		expect(canonical(one(0))).toBe(canonical(one(11)));
	});

	test("counts, finds the feet, and checks connectedness", () => {
		expect(filledCount(FOUNDING_FRIENDS[0]!)).toBe(68);
		expect(lowestRow(FOUNDING_FRIENDS[0]!)).toBe(10);
		expect(lowestRow(emptyPixels())).toBe(-1);
		expect(isConnected(FOUNDING_FRIENDS[0]!)).toBe(true);
		const two = [...one(0)];
		two[2] = "p";
		expect(isConnected(two.join(""))).toBe(false);
	});
});
