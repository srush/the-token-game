CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  player TEXT NOT NULL,
  level INTEGER NOT NULL,
  definition TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  score INTEGER,
  complete INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS runs_ip_time ON runs(ip_hash, started_at);
CREATE INDEX IF NOT EXISTS runs_expiry ON runs(started_at);
CREATE TABLE IF NOT EXISTS scores (
  player TEXT NOT NULL,
  level INTEGER NOT NULL,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (player, level)
);
CREATE INDEX IF NOT EXISTS scores_ranking ON scores(level, score DESC, created_at ASC);
