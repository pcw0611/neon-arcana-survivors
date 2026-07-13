import { getD1 } from "../../../db";
import { ensureLeaderboardSchema } from "../../../db/leaderboard";

type SubmittedScore = {
  player?: unknown;
  kills?: unknown;
  level?: unknown;
  duration?: unknown;
  victory?: unknown;
  bosses?: unknown;
};

async function topScores(database: D1Database) {
  const result = await database.prepare(
    `SELECT id, player, score, kills, level, duration, victory, created_at AS createdAt
     FROM leaderboard_scores
     ORDER BY score DESC, duration DESC, created_at ASC
     LIMIT 10`,
  ).all();
  return result.results;
}

function integer(value: unknown, min: number, max: number): number {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : min;
}

export async function GET() {
  try {
    const database = getD1();
    await ensureLeaderboardSchema(database);
    return Response.json({ scores: await topScores(database) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Leaderboard unavailable" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SubmittedScore;
    const player = String(body.player ?? "")
      .trim()
      .replace(/[^\p{L}\p{N}_\- ]/gu, "")
      .slice(0, 12);
    if (player.length < 2) {
      return Response.json({ error: "Nickname must be 2-12 characters" }, { status: 400 });
    }

    const kills = integer(body.kills, 0, 1000000);
    const level = integer(body.level, 1, 10000);
    const duration = integer(body.duration, 0, 86400);
    const bosses = integer(body.bosses, 0, 10000);
    const victory = body.victory === true;
    const score = kills * 10 + level * 120 + duration * 4 + bosses * 1000 + (victory ? 2500 : 0);
    const database = getD1();
    await ensureLeaderboardSchema(database);
    const insert = await database.prepare(
      `INSERT INTO leaderboard_scores (player, score, kills, level, duration, victory)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING id`,
    ).bind(player, score, kills, level, duration, victory ? 1 : 0).first<{ id: number }>();
    const rank = await database.prepare(
      `SELECT COUNT(*) + 1 AS rank FROM leaderboard_scores
       WHERE score > ? OR (score = ? AND id < ?)`,
    ).bind(score, score, insert?.id ?? 0).first<{ rank: number }>();

    return Response.json({ score, rank: rank?.rank ?? null, scores: await topScores(database) }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Score submission failed" },
      { status: 500 },
    );
  }
}
