// The two optional lines someone can leave with their guy: a note, and who made him.

export const TEXT_MAX = { note: 60, by: 24 };

// Links are how a drawing wall turns into a spam wall, so notes can't have any.
const LINK = /https?:|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|me|ly|gg|xyz|ru|app|dev|link|site|shop|info|biz)\b/i;
// Control characters and invisible formatting (zero-width spaces, right-to-left overrides),
// except the joiner that glues emoji like 👩‍🎨 together.
const INVISIBLE = /(?!‍)[\p{Cc}\p{Cf}]/gu;

export type TextProblem = "too-long" | "link" | "invalid";
export type TextCheck = { ok: true; text: string | null } | { ok: false; problem: TextProblem };

export function cleanText(value: unknown, max: number): TextCheck {
	if (value === undefined || value === null) return { ok: true, text: null };
	if (typeof value !== "string") return { ok: false, problem: "invalid" };
	const text = value.normalize("NFC").replace(/\s+/g, " ").replace(INVISIBLE, "").trim();
	if (!text) return { ok: true, text: null };
	if (text.length > max) return { ok: false, problem: "too-long" };
	if (LINK.test(text)) return { ok: false, problem: "link" };
	return { ok: true, text };
}
