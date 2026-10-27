-- Visitors' guys. pixels is a 12×12 drawing, row by row, over the alphabet ".lpdk".
CREATE TABLE guys (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	pixels TEXT NOT NULL CHECK (length(pixels) = 144 AND pixels NOT GLOB '*[^.lpdk]*'),
	canon TEXT NOT NULL,
	source TEXT NOT NULL DEFAULT 'drawn' CHECK (source IN ('drawn', 'random')),
	status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'pending', 'hidden')),
	ip_hash TEXT NOT NULL,
	created_at INTEGER NOT NULL
);

CREATE INDEX guys_status_id ON guys (status, id);
CREATE INDEX guys_canon ON guys (canon);
CREATE INDEX guys_poster_time ON guys (ip_hash, created_at);

-- Switches for moderation, plus a running count so nobody has to COUNT(*) the table.
CREATE TABLE settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL
);

INSERT INTO settings (key, value) VALUES
	('posting_off', '0'),
	('approval_required', '0'),
	('visible_count', '0');
