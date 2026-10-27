import { generateGuy } from "../shared/generate";
import { COLORS, type Cell, MIN_FILLED, SIZE, emptyPixels, filledCount } from "../shared/pixels";
import { ApiError, type Guy, guyNumber } from "./api";

// The "Leave a guy" sheet: a 12×12 grid, a purple-only palette, and a Randomize button
// for anyone who'd rather not draw.

const PALETTE: [Cell, string][] = [
	["p", "purple"],
	["l", "lilac"],
	["d", "deep purple"],
	["k", "ink"],
	[".", "eraser"],
];

type Source = "drawn" | "random";

export class Editor {
	private cells: Cell[] = [...emptyPixels()] as Cell[];
	private tool: Cell = "p";
	private mirrorOn = true;
	private source: Source = "random";
	private undos: string[] = [];
	private randoms: string[] = [];
	private painting = false;
	private busy = false;
	private els: HTMLDivElement[] = [];
	private $ = <T extends HTMLElement>(sel: string) => this.sheet.querySelector<T>(sel)!;

	constructor(
		private sheet: HTMLElement,
		private submit: (pixels: string, source: Source) => Promise<Guy>,
	) {
		const pix = this.$("#pix");
		for (let i = 0; i < SIZE * SIZE; i++) {
			const c = document.createElement("div");
			c.dataset.i = String(i);
			pix.appendChild(c);
			this.els.push(c);
		}
		pix.addEventListener("pointerdown", (e) => {
			this.painting = true;
			pix.setPointerCapture(e.pointerId);
			this.snapshot();
			this.paintAt(e);
		});
		pix.addEventListener("pointermove", (e) => this.painting && this.paintAt(e));
		const stop = () => (this.painting = false);
		pix.addEventListener("pointerup", stop);
		pix.addEventListener("pointercancel", stop);

		const swatches = this.$("#swatches");
		for (const [cell, name] of PALETTE) {
			const b = document.createElement("button");
			b.type = "button";
			b.className = cell === "." ? "sw eraser" : "sw";
			if (cell !== ".") b.style.background = COLORS[cell];
			b.title = name;
			b.setAttribute("aria-label", name);
			b.setAttribute("aria-pressed", String(cell === this.tool));
			b.addEventListener("click", () => {
				this.tool = cell;
				for (const s of swatches.children) s.setAttribute("aria-pressed", String(s === b));
			});
			swatches.appendChild(b);
		}

		// Clicks and drags inside the sheet shouldn't steer the big guy.
		for (const ev of ["pointerdown", "pointermove"]) sheet.addEventListener(ev, (e) => e.stopPropagation());
		sheet.addEventListener("click", (e) => {
			const action = (e.target as HTMLElement).closest<HTMLElement>("[data-a]")?.dataset.a;
			if (action === "close") this.close();
			if (action === "random") this.randomize();
			if (action === "back") this.back();
			if (action === "undo") this.undo();
			if (action === "clear") this.clear();
			if (action === "mirror") this.toggleMirror();
			if (action === "add") void this.add();
			if (action === "copy") this.copy();
			if (action === "another") this.another();
		});
		document.addEventListener("keydown", (e) => {
			if (e.key === "Escape" && this.isOpen) this.close();
		});
	}

	get isOpen() {
		return !this.sheet.hidden;
	}

	open() {
		this.sheet.hidden = false;
		this.showDraw();
		if (!this.randoms.length) this.randomize(false);
		this.$<HTMLButtonElement>('[data-a="random"]').focus();
	}

	close() {
		this.sheet.hidden = true;
		document.querySelector<HTMLButtonElement>("#leave")?.focus();
	}

	private get pixels() {
		return this.cells.join("");
	}

	private load(pixels: string) {
		this.cells = [...pixels] as Cell[];
		this.render();
	}

	private render() {
		this.cells.forEach((c, i) => (this.els[i]!.style.background = c === "." ? "" : COLORS[c]));
		this.$<HTMLButtonElement>('[data-a="undo"]').disabled = !this.undos.length;
		this.$<HTMLButtonElement>('[data-a="back"]').disabled = this.randoms.length < 2;
		this.message("");
	}

	private message(text: string) {
		this.$("#sheetMsg").textContent = text;
	}

	private snapshot() {
		this.undos.push(this.pixels);
		if (this.undos.length > 40) this.undos.shift();
	}

	private randomize(remember = true) {
		if (remember) this.snapshot();
		const pixels = generateGuy();
		this.randoms.push(pixels);
		if (this.randoms.length > 40) this.randoms.shift();
		this.source = "random";
		this.load(pixels);
	}

	// The random guy before this one; often the one people wanted.
	private back() {
		if (this.randoms.length < 2) return;
		this.snapshot();
		this.randoms.pop();
		this.source = "random";
		this.load(this.randoms[this.randoms.length - 1]!);
	}

	private undo() {
		const pixels = this.undos.pop();
		if (pixels) this.load(pixels);
	}

	private clear() {
		this.snapshot();
		this.source = "drawn";
		this.load(emptyPixels());
	}

	private toggleMirror() {
		this.mirrorOn = !this.mirrorOn;
		this.$('[data-a="mirror"]').setAttribute("aria-pressed", String(this.mirrorOn));
	}

	private paintAt(e: PointerEvent) {
		const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
		if (!el?.dataset.i || el.parentElement?.id !== "pix") return;
		const i = Number(el.dataset.i);
		const x = i % SIZE;
		const y = Math.floor(i / SIZE);
		const targets = this.mirrorOn ? [i, y * SIZE + (SIZE - 1 - x)] : [i];
		for (const t of targets) this.cells[t] = this.tool;
		this.source = "drawn";
		this.render();
	}

	private async add() {
		if (this.busy) return;
		const pixels = this.pixels;
		if (filledCount(pixels) < MIN_FILLED) return this.message(`Your guy needs at least ${MIN_FILLED} squares.`);
		const button = this.$<HTMLButtonElement>('[data-a="add"]');
		this.busy = true;
		button.disabled = true;
		button.textContent = "Moving in…";
		try {
			this.showDone(await this.submit(pixels, this.source));
		} catch (err) {
			const duplicate = err instanceof ApiError && err.code === "duplicate";
			if (duplicate && this.source === "random") {
				this.randomize();
				this.message("That exact guy already lives here, so here's a fresh one.");
			} else if (duplicate && typeof err.data.id === "number") {
				this.message(`That guy already lives here (${guyNumber(err.data.id)}). Change a square or two?`);
			} else {
				this.message(err instanceof Error ? err.message : "Something went wrong. Try again in a bit.");
			}
		} finally {
			this.busy = false;
			button.disabled = false;
			button.textContent = "Add him to the street";
		}
	}

	private showDraw() {
		this.$("#sheetDraw").hidden = false;
		this.$("#sheetDone").hidden = true;
	}

	private showDone(guy: Guy) {
		this.$("#sheetDraw").hidden = true;
		this.$("#sheetDone").hidden = false;
		this.$("#doneTitle").textContent = `Guy ${guyNumber(guy.id)} moved in!`;
		const link = this.$<HTMLInputElement>("#shareLink");
		link.value = `${location.origin}/g/${guy.id}`;
		this.$('[data-a="copy"]').textContent = "Copy";
		this.$<HTMLButtonElement>('#sheetDone [data-a="close"].primary').focus();
	}

	private copy() {
		const link = this.$<HTMLInputElement>("#shareLink");
		const button = this.$('[data-a="copy"]');
		navigator.clipboard?.writeText(link.value).then(
			() => (button.textContent = "Copied"),
			() => link.select(),
		) ?? link.select();
	}

	private another() {
		this.undos = [];
		this.randomize(false);
		this.showDraw();
	}
}
