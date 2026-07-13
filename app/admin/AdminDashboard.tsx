"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./admin.module.css";

type Row = {
  id: number;
  rank: number;
  player: string;
  score: number;
  kills: number;
  level: number;
  duration: number;
  victory: number;
  createdAt: string;
};

type Stats = {
  total: number;
  victories: number;
  averageScore: number;
  bestScore: number;
  latestAt: string | null;
};

const emptyStats: Stats = { total: 0, victories: 0, averageScore: 0, bestScore: 0, latestAt: null };

export default function AdminDashboard(props: { displayName: string; email: string; signOutPath: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("all");
  const [sort, setSort] = useState("score");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resetText, setResetText] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const pageCount = Math.max(1, Math.ceil(total / 25));

  const searchParams = useMemo(() => {
    return new URLSearchParams({ q: query, result, sort, page: String(page), limit: "25" }).toString();
  }, [page, query, result, sort]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/leaderboard?${searchParams}`, { signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "데이터를 불러오지 못했습니다.");
      setRows(data.rows ?? []);
      setStats({ ...emptyStats, ...(data.stats ?? {}) });
      setTotal(Number(data.total ?? 0));
      setSelected(new Set());
    } catch (cause) {
      if ((cause as Error).name !== "AbortError") setError((cause as Error).message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, revision]);

  const mutate = async (method: "DELETE" | "POST", body: object) => {
    setError("");
    const response = await fetch("/api/admin/leaderboard", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "작업을 완료하지 못했습니다.");
    setRevision((value) => value + 1);
  };

  const deleteIds = async (ids: number[]) => {
    if (!ids.length || !window.confirm(`${ids.length}개의 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    try { await mutate("DELETE", { ids }); } catch (cause) { setError((cause as Error).message); }
  };

  const resetAll = async () => {
    if (resetText !== "전체 초기화") return;
    try {
      await mutate("POST", { action: "reset", confirmation: resetText });
      setResetText("");
      setResetOpen(false);
      setPage(1);
    } catch (cause) { setError((cause as Error).message); }
  };

  const toggleAll = () => {
    setSelected((current) => current.size === rows.length
      ? new Set()
      : new Set(rows.map((row) => row.id)));
  };

  const setFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  const exportUrl = `/api/admin/leaderboard?${new URLSearchParams({ q: query, result, sort, format: "csv" })}`;
  const formatNumber = (value: number | null | undefined) => Number(value ?? 0).toLocaleString("ko-KR");
  const formatDate = (value: string | null) => value
    ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(`${value.replace(" ", "T")}Z`))
    : "기록 없음";

  return (
    <main className={styles.page}>
      <div className={styles.scanlines} aria-hidden="true" />
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>NEON ARCANA // OPERATIONS</p>
            <h1>랭킹 관리</h1>
            <p className={styles.subtitle}><span className={styles.liveDot} /> D1 데이터베이스 연결됨</p>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.userChip}><strong>{props.displayName}</strong><span>{props.email}</span></div>
            <Link className={styles.buttonGhost} href="/">게임으로</Link>
            <a className={styles.buttonGhost} href={props.signOutPath}>로그아웃</a>
          </div>
        </header>

        <section className={styles.metrics} aria-label="랭킹 요약">
          <article><span>전체 기록</span><strong>{formatNumber(stats.total)}</strong><small>누적 플레이</small></article>
          <article><span>클리어</span><strong>{formatNumber(stats.victories)}</strong><small>{stats.total ? Math.round((stats.victories / stats.total) * 100) : 0}% 성공률</small></article>
          <article><span>평균 점수</span><strong>{formatNumber(stats.averageScore)}</strong><small>최고 {formatNumber(stats.bestScore)}</small></article>
          <article><span>최근 등록</span><strong className={styles.dateMetric}>{formatDate(stats.latestAt)}</strong><small>실시간 반영</small></article>
        </section>

        <section className={styles.panel}>
          <div className={styles.toolbar}>
            <label className={styles.searchLabel}><span>닉네임 검색</span><input value={query} onChange={(event) => setFilter(setQuery, event.target.value)} placeholder="플레이어 이름" /></label>
            <label><span>결과</span><select value={result} onChange={(event) => setFilter(setResult, event.target.value)}><option value="all">전체</option><option value="victory">클리어</option><option value="defeat">실패</option></select></label>
            <label><span>정렬</span><select value={sort} onChange={(event) => setFilter(setSort, event.target.value)}><option value="score">점수순</option><option value="recent">최신순</option><option value="oldest">오래된순</option><option value="kills">킬순</option><option value="level">레벨순</option></select></label>
            <button className={styles.buttonGhost} onClick={() => setRevision((value) => value + 1)}>새로고침</button>
            <a className={styles.buttonPrimary} href={exportUrl}>CSV 내보내기</a>
          </div>

          {error && <div className={styles.error} role="alert">{error}</div>}
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th><input type="checkbox" aria-label="현재 페이지 전체 선택" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleAll} /></th><th>순위</th><th>닉네임</th><th>점수</th><th>킬</th><th>LV</th><th>생존</th><th>결과</th><th>등록시각</th><th>관리</th></tr></thead>
              <tbody>
                {rows.map((row) => <tr key={row.id}>
                  <td data-label="선택"><input type="checkbox" aria-label={`${row.player} 선택`} checked={selected.has(row.id)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next; })} /></td>
                  <td data-label="순위" className={styles.rank}>#{row.rank}</td>
                  <td data-label="닉네임"><strong>{row.player}</strong><small>ID {row.id}</small></td>
                  <td data-label="점수" className={styles.score}>{formatNumber(row.score)}</td>
                  <td data-label="킬">{formatNumber(row.kills)}</td>
                  <td data-label="LV">{row.level}</td>
                  <td data-label="생존">{Math.floor(row.duration / 60)}:{String(row.duration % 60).padStart(2, "0")}</td>
                  <td data-label="결과"><span className={row.victory ? styles.badgeWin : styles.badgeLose}>{row.victory ? "클리어" : "실패"}</span></td>
                  <td data-label="등록시각">{formatDate(row.createdAt)}</td>
                  <td data-label="관리"><button className={styles.rowDelete} onClick={() => void deleteIds([row.id])}>삭제</button></td>
                </tr>)}
              </tbody>
            </table>
            {!loading && rows.length === 0 && <div className={styles.empty}>조건에 맞는 랭킹 기록이 없습니다.</div>}
            {loading && <div className={styles.empty}>데이터를 불러오는 중…</div>}
          </div>

          <div className={styles.pagination}>
            <span>총 {formatNumber(total)}건</span>
            <div><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>이전</button><strong>{page} / {pageCount}</strong><button disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>다음</button></div>
          </div>
        </section>

        {selected.size > 0 && <aside className={styles.selectionBar}><span><strong>{selected.size}</strong>개 선택됨</span><button onClick={() => void deleteIds([...selected])}>선택 기록 삭제</button></aside>}

        <section className={styles.dangerPanel}>
          <button className={styles.dangerToggle} onClick={() => setResetOpen((value) => !value)} aria-expanded={resetOpen}>위험 구역 <span>{resetOpen ? "닫기" : "열기"}</span></button>
          {resetOpen && <div className={styles.dangerContent}><div><strong>랭킹 전체 초기화</strong><p>모든 점수 기록이 영구 삭제됩니다. 먼저 CSV 내보내기를 권장합니다.</p></div><label><span>확인을 위해 ‘전체 초기화’를 입력하세요.</span><input value={resetText} onChange={(event) => setResetText(event.target.value)} placeholder="전체 초기화" /></label><button disabled={resetText !== "전체 초기화"} onClick={() => void resetAll()}>모든 기록 삭제</button></div>}
        </section>
      </div>
    </main>
  );
}
