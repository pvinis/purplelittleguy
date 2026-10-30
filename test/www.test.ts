import { expect, test } from "bun:test";
import www from "../src/worker/www";

test("www sends you to the bare domain, keeping the path", () => {
	for (const [from, to] of [
		["https://www.purplelittleguy.com/", "https://purplelittleguy.com/"],
		["http://www.purplelittleguy.com/g/12?ref=x", "https://purplelittleguy.com/g/12?ref=x"],
		["https://www.purplelittleguy.com:8443/admin", "https://purplelittleguy.com/admin"],
	]) {
		const res = www.fetch(new Request(from!));
		expect(res.status).toBe(301);
		expect(res.headers.get("location")).toBe(to!);
	}
});
