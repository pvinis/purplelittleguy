-- What the poster wrote (both optional), and where they posted from.
-- Location comes from Cloudflare. The raw IP is cleared after 30 days by the daily cron; the rest stays.
ALTER TABLE guys ADD COLUMN note TEXT;
ALTER TABLE guys ADD COLUMN made_by TEXT;
ALTER TABLE guys ADD COLUMN ip TEXT;
ALTER TABLE guys ADD COLUMN country TEXT;
ALTER TABLE guys ADD COLUMN region TEXT;
ALTER TABLE guys ADD COLUMN city TEXT;
ALTER TABLE guys ADD COLUMN network TEXT;

CREATE INDEX guys_ip_time ON guys (created_at) WHERE ip IS NOT NULL;
