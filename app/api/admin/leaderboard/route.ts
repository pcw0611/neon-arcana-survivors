import { authorizeAdminRequest, requireSameOrigin } from "../../../admin-auth";
import { getD1 } from "../../../../db";
import { ensureLeaderboardSchema } from "../../../../db/leaderboard";

const NO_STORE = { "Cache-Control": "no-store" };
const SORTS: Record<string, string> = {
  score: "score DESC, duration DESC, createdAt ASC",
  recent: "createdAt DESC",
  oldest: "createdAt ASC",
  kills: "kills DESC, score DESC",
  level: "level DESC, score DESC",
};

type CsvRow = {
  id: number;
  player: string;
  score: number;
  kills: number;
  level: number;
  duration: number;
  victory: number;
  createdAt: string;
};

function queryParts(url: URL) {
  const filters: string[] = [];
  const bindings: Array<string | number> = [];
  const search = (url.searchParams.get("q") ?? "").trim().slice(0, 40);
  const result = url.searchParams.get("result") ?? "all";

  if (search) {
    filters.push("player LIKE ? ESCAPE '\\'");
    bindings.push(`%${search.replace(/[\\%_]/g, "\\$&")}%`);
  }
  if (result === "victory") filters.push("victory = 1");
  if (result === "defeat") filters.push("victory = 0");

  return {
    bindings,
    where: filters.length ? `WHERE ${filters.join(" AND ")}` : "",
  };
}

function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

async function listResponse(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const database = getD1();
  await ensureLeaderboardSchema(database);
  const { where, bindings } = queryParts(url);
  const sort = SORTS[url.searchParams.get("sort") ?? "score"] ?? SORTS.score;

  if (url.searchParams.get("format") === "csv") {
    const result = await database.prepare(
      `SELECT id, player, score, kills, level, duration, victory, created_at AS createdAt
       FROM leaderboard_scores ${where}
       ORDER BY ${sort}
       LIMIT 10000`,
    ).bind(...bindings).all<Record<string, unknown>>();
    const header = ["ID", "닉네임", "점수", "킬", "레벨", "생존(초)", "결과", "등록시각"];
    const lines = (result.results as unknown as CsvRow[]).map((row) => [
      row.id,
      row.player,
      row.score,
      row.kills,
      row.level,
      row.duration,
      Number(row.victory) === 1 ? "클리어" : "실패",
      row.createdAt,
    ].map(csvCell).join(","));
    return new Response(`\uFEFF${header.map(csvCell).join(",")}\r\n${lines.join("\r\n")}`, {
      headers: {
        ...NO_STORE,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="neon-arcana-ranking-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  const page = Math.max(1, Math.floor(Number(url.searchParams.get("page")) || 1));
  const limit = Math.min(100, Math.max(10, Math.floor(Number(url.searchParams.get("limit")) || 25)));
  const offset = (page - 1) * limit;
  const [rows, filteredCount, stats] = await Promise.all([
    database.prepare(
      `WITH ranked AS (
         SELECT id, player, score, kills, level, duration, victory,
                created_at AS createdAt,
                ROW_NUMBER() OVER (ORDER BY score DESC, duration DESC, created_at ASC) AS rank
         FROM leaderboard_scores
       )
       SELECT * FROM ranked ${where}
       ORDER BY ${sort}
       LIMIT ? OFFSET ?`,
    ).bind(...bindings, limit, offset).all(),
    database.prepare(`SELECT COUNT(*) AS total FROM leaderboard_scores ${where}`)
      .bind(...bindings).first<{ total: number }>(),
    database.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN victory = 1 THEN 1 ELSE 0 END) AS victories,
              ROUND(AVG(score)) AS averageScore,
              MAX(score) AS bestScore,
              MAX(created_at) AS latestAt
       FROM leaderboard_scores`,
    ).first(),
  ]);

  return Response.json({
    rows: rows.results,
    page,
    limit,
    total: Number(filteredCount?.total ?? 0),
    stats: stats ?? { total: 0, victories: 0, averageScore: 0, bestScore: 0, latestAt: null },
  }, { headers: NO_STORE });
}

export async function GET(request: Request) {
  const denied = authorizeAdminRequest(request);
  if (denied) return denied;
  try {
    return await listResponse(request);
  } catch {
    return Response.json({ error: "랭킹 데이터를 불러오지 못했습니다." }, { status: 500, headers: NO_STORE });
  }
}

export async function DELETE(request: Request) {
  const denied = authorizeAdminRequest(request) ?? requireSameOrigin(request);
  if (denied) return denied;
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "JSON 요청만 허용됩니다." }, { status: 415, headers: NO_STORE });
  }
  try {
    const body = await request.json() as { ids?: unknown };
    const ids = Array.isArray(body.ids)
      ? [...new Set(body.ids.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, 100)
      : [];
    if (!ids.length) {
      return Response.json({ error: "삭제할 기록을 선택해주세요." }, { status: 400, headers: NO_STORE });
    }
    const database = getD1();
    await ensureLeaderboardSchema(database);
    const placeholders = ids.map(() => "?").join(",");
    const result = await database.prepare(`DELETE FROM leaderboard_scores WHERE id IN (${placeholders})`)
      .bind(...ids).run();
    return Response.json({ deleted: result.meta.changes ?? 0 }, { headers: NO_STORE });
  } catch {
    return Response.json({ error: "기록을 삭제하지 못했습니다." }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request: Request) {
  const denied = authorizeAdminRequest(request) ?? requireSameOrigin(request);
  if (denied) return denied;
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "JSON 요청만 허용됩니다." }, { status: 415, headers: NO_STORE });
  }
  try {
    const body = await request.json() as { action?: unknown; confirmation?: unknown };
    if (body.action !== "reset" || body.confirmation !== "전체 초기화") {
      return Response.json({ error: "초기화 확인 문구가 일치하지 않습니다." }, { status: 400, headers: NO_STORE });
    }
    const database = getD1();
    await ensureLeaderboardSchema(database);
    const result = await database.prepare("DELETE FROM leaderboard_scores").run();
    return Response.json({ deleted: result.meta.changes ?? 0 }, { headers: NO_STORE });
  } catch {
    return Response.json({ error: "랭킹을 초기화하지 못했습니다." }, { status: 500, headers: NO_STORE });
  }
}
