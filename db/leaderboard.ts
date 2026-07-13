export const CREATE_LEADERBOARD_TABLE = `CREATE TABLE IF NOT EXISTS leaderboard_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player TEXT NOT NULL,
  score INTEGER NOT NULL,
  kills INTEGER NOT NULL,
  level INTEGER NOT NULL,
  duration INTEGER NOT NULL,
  victory INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

export const CREATE_LEADERBOARD_INDEX = `CREATE INDEX IF NOT EXISTS leaderboard_score_idx
  ON leaderboard_scores (score DESC, created_at ASC)`;

export async function ensureLeaderboardSchema(database: D1Database) {
  await database.batch([
    database.prepare(CREATE_LEADERBOARD_TABLE),
    database.prepare(CREATE_LEADERBOARD_INDEX),
  ]);
}
