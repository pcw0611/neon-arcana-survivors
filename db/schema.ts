import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const leaderboardScores = sqliteTable(
  "leaderboard_scores",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    player: text("player").notNull(),
    score: integer("score").notNull(),
    kills: integer("kills").notNull(),
    level: integer("level").notNull(),
    duration: integer("duration").notNull(),
    victory: integer("victory", { mode: "boolean" }).notNull().default(false),
    loadoutJson: text("loadout_json"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("leaderboard_score_idx").on(table.score, table.createdAt)],
);
