import { Database } from "bun:sqlite";
import { readFileSync, readdirSync } from "node:fs";

// Just enough of Cloudflare's D1 API, on top of bun:sqlite, to run the Worker in tests and in `bun run serve`.
class Statement {
	constructor(
		private db: Database,
		private sql: string,
		private params: unknown[] = [],
	) {}
	bind(...params: unknown[]) {
		return new Statement(this.db, this.sql, params);
	}
	// biome-ignore lint/suspicious/noExplicitAny: test shim
	private q(): any {
		return this.db.query(this.sql);
	}
	async first(column?: string) {
		const row = this.q().get(...this.params);
		if (!row) return null;
		return column ? row[column] : row;
	}
	async all() {
		return this.allSync();
	}
	async run() {
		const r = this.q().run(...this.params);
		return { success: true, meta: { changes: r.changes, last_row_id: r.lastInsertRowid } };
	}
	allSync() {
		return { results: this.q().all(...this.params), success: true, meta: {} };
	}
}

export function createD1(file = ":memory:"): D1Database {
	const db = new Database(file);
	for (const file of readdirSync("migrations").sort()) db.exec(readFileSync(`migrations/${file}`, "utf8"));
	return {
		prepare: (sql: string) => new Statement(db, sql),
		batch: async (statements: Statement[]) => db.transaction(() => statements.map((s) => s.allSync()))(),
		exec: async (sql: string) => db.exec(sql),
	} as unknown as D1Database;
}
