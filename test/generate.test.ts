import { describe, expect, test } from "bun:test";
import { generateDetailed, generateGuy, isGoodGuy } from "../src/shared/generate";
import { canonical, checkPixels } from "../src/shared/pixels";

describe("randomize", () => {
	test("10,000 seeds all make a good guy without falling back", () => {
		for (let seed = 0; seed < 10_000; seed++) {
			const guy = generateDetailed(seed);
			expect(guy).not.toBeNull();
			expect(isGoodGuy(guy!)).toBe(true);
			expect(checkPixels(guy!.pixels).ok).toBe(true);
		}
	});

	test("the same seed makes the same guy", () => {
		expect(generateGuy(1234)).toBe(generateGuy(1234));
	});

	test("guys are varied", () => {
		const seen = new Set<string>();
		for (let seed = 0; seed < 2000; seed++) seen.add(canonical(generateGuy(seed)));
		expect(seen.size).toBeGreaterThan(1900);
	});
});
