import { getD1 } from "../../../db";
import { ensureLeaderboardSchema } from "../../../db/leaderboard";

type SubmittedScore = {
  player?: unknown;
  kills?: unknown;
  level?: unknown;
  duration?: unknown;
  victory?: unknown;
  bosses?: unknown;
  loadout?: unknown;
};

type RunLoadout = {
  v: 1;
  upgrades: Record<string, number>;
  relics: Array<{ id: string; level: number }>;
  bosses: number;
  bossFailures: number;
};

const ALLOWED_UPGRADES = new Set([
  "power", "haste", "multishot", "pierce", "critical", "blast", "chain", "size",
  "orbit", "orbit_speed", "orbit_size", "orbit_range", "orbit_shock", "orbit_pulse",
  "saber", "saber_reach", "saber_haste", "saber_echo", "saber_guard", "speed", "magnet",
  "vital", "regen", "guard", "fortune", "relic_slot", "limit_master_projectile",
  "limit_master_saber", "limit_master_orbit", "limit_power", "limit_vital", "limit_growth",
]);
const ALLOWED_RELICS = new Set([
  "arc_cell", "blood_cap", "magnet_prism", "hunter_lens", "split_core", "orbit_gear",
  "edge_lens", "nano_shunt", "execution", "echo_chamber", "gravity_halo", "soul_battery",
  "event_horizon", "zero_edge", "phoenix", "rift_crown", "singularity", "immortal",
  "godspeed", "midas",
]);

function normalizeLoadout(value: unknown, bosses = 0): RunLoadout | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const upgrades: Record<string, number> = {};
  if (input.upgrades && typeof input.upgrades === "object" && !Array.isArray(input.upgrades)) {
    for (const [id, rank] of Object.entries(input.upgrades as Record<string, unknown>).slice(0, 40)) {
      if (ALLOWED_UPGRADES.has(id)) upgrades[id] = integer(rank, 1, 1000000);
    }
  }
  const relics: RunLoadout["relics"] = [], seenRelics = new Set<string>();
  if (Array.isArray(input.relics)) {
    for (const candidate of input.relics.slice(0, 14)) {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
      const entry = candidate as Record<string, unknown>, id = String(entry.id ?? "");
      if (!ALLOWED_RELICS.has(id) || seenRelics.has(id) || relics.length >= 7) continue;
      seenRelics.add(id); relics.push({ id, level: integer(entry.level, 1, 10000) });
    }
  }
  return {
    v: 1,
    upgrades,
    relics,
    bosses: integer(bosses || input.bosses, 0, 10000),
    bossFailures: integer(input.bossFailures, 0, 10000),
  };
}

function decodeLoadout(value: unknown): RunLoadout | null {
  if (typeof value !== "string" || !value) return null;
  try { return normalizeLoadout(JSON.parse(value)); } catch { return null; }
}

async function topScores(database: D1Database) {
  const result = await database.prepare(
    `SELECT id, player, score, kills, level, duration, victory, loadout_json AS loadoutJson, created_at AS createdAt
     FROM leaderboard_scores
     ORDER BY score DESC, duration DESC, created_at ASC
     LIMIT 100`,
  ).all<Record<string, unknown>>();
  return result.results.map((record: Record<string, unknown>) => {
    const { loadoutJson, ...row } = record;
    return { ...row, loadout: decodeLoadout(loadoutJson) };
  });
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
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return Response.json({ error: "JSON requests only" }, { status: 415 });
    }
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 16384) return Response.json({ error: "Request too large" }, { status: 413 });
    const rawBody = await request.text();
    if (rawBody.length > 16384) return Response.json({ error: "Request too large" }, { status: 413 });
    let body: SubmittedScore;
    try { body = JSON.parse(rawBody) as SubmittedScore; }
    catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
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
    const loadout = normalizeLoadout(body.loadout, bosses), loadoutJson = loadout ? JSON.stringify(loadout) : null;
    if (loadoutJson && loadoutJson.length > 8192) return Response.json({ error: "Loadout too large" }, { status: 400 });
    const database = getD1();
    await ensureLeaderboardSchema(database);
    const insert = await database.prepare(
      `INSERT INTO leaderboard_scores (player, score, kills, level, duration, victory, loadout_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
    ).bind(player, score, kills, level, duration, victory ? 1 : 0, loadoutJson).first<{ id: number }>();
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
