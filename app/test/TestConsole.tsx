"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./test.module.css";

type NeonCheats = {
  isRunning: () => boolean;
  getState: () => Record<string, unknown> | null;
  listClasses: () => { id: string; name: string }[];
  listUpgrades: () => { id: string; name: string; max: number; tags: string[] }[];
  listRelics: () => { id: string; name: string; rarity: number }[];
  listArchetypes: () => string[];
  setLevel: (n: number) => boolean;
  setTime: (s: number) => boolean;
  addTime: (s: number) => boolean;
  setHp: (n: number) => boolean;
  heal: (n?: number) => boolean;
  godMode: (on?: boolean) => boolean;
  spawnMob: (archetype: string, count?: number) => boolean;
  spawnBossNow: () => boolean;
  killBoss: () => boolean;
  clearMobs: () => boolean;
  setClass: (id: string) => { ok: boolean; reason?: string };
  grantUpgrade: (id: string, ranks?: number) => boolean;
  addRelic: (id: string, level?: number) => boolean;
  run: (code: string) => { ok: boolean; result?: unknown; error?: string };
};

export default function TestConsole() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<Record<string, unknown> | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [upgradesList, setUpgradesList] = useState<{ id: string; name: string; max: number }[]>([]);
  const [relicsList, setRelicsList] = useState<{ id: string; name: string; rarity: number }[]>([]);
  const [archetypes, setArchetypes] = useState<string[]>([]);

  const [levelInput, setLevelInput] = useState("10");
  const [timeInput, setTimeInput] = useState("120");
  const [hpInput, setHpInput] = useState("50");
  const [mobArchetype, setMobArchetype] = useState("");
  const [mobCount, setMobCount] = useState("5");
  const [classId, setClassId] = useState("");
  const [upgradeId, setUpgradeId] = useState("");
  const [upgradeRanks, setUpgradeRanks] = useState("1");
  const [relicId, setRelicId] = useState("");
  const [relicLevel, setRelicLevel] = useState("1");
  const [jsCode, setJsCode] = useState("");
  const [jsResult, setJsResult] = useState<{ ok: boolean; text: string } | null>(null);

  const cheats = useCallback((): NeonCheats | null => {
    const win = iframeRef.current?.contentWindow as (Window & { NeonCheats?: NeonCheats }) | undefined;
    return win?.NeonCheats ?? null;
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const c = cheats();
      if (!c) { setReady(false); return; }
      setReady(true);
      setState(c.isRunning() ? c.getState() : null);
      if (classes.length === 0) setClasses(c.listClasses());
      if (upgradesList.length === 0) setUpgradesList(c.listUpgrades());
      if (relicsList.length === 0) setRelicsList(c.listRelics());
      if (archetypes.length === 0) setArchetypes(c.listArchetypes());
    }, 600);
    return () => window.clearInterval(timer);
  }, [cheats, classes.length, upgradesList.length, relicsList.length, archetypes.length]);

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/test";
  };

  const runJs = () => {
    const c = cheats();
    if (!c) return;
    const outcome = c.run(jsCode);
    setJsResult({ ok: outcome.ok, text: outcome.ok ? JSON.stringify(outcome.result, null, 2) : outcome.error || "오류" });
  };

  const running = Boolean(state);

  return (
    <div className={styles.wrap}>
      <div className={styles.gameArea}>
        <iframe ref={iframeRef} src="/game.html" title="Neon Arcana: Cyber Rift (Test)" allow="autoplay; fullscreen" />
      </div>
      <div className={styles.panel}>
        <p className={styles.eyebrow}>NEON ARCANA // TEST CONSOLE</p>
        <h1>치트 콘솔</h1>
        <div className={styles.row} style={{ marginTop: 10 }}>
          <Link className="" href="/" style={{ color: "#73eeff", fontSize: 12 }}>← 게임으로</Link>
          <button onClick={() => void logout()} style={{ marginLeft: "auto" }}>로그아웃</button>
        </div>

        {!ready && <p className={styles.warn}>게임 iframe 안에서 &quot;시작하기&quot;를 눌러 런을 시작해야 치트가 활성화됩니다.</p>}

        {state && (
          <div className={styles.stateBox}>
            {`LV ${state.level}  XP ${state.xp}/${state.nextXp}  시간 ${Math.floor(Number(state.time) / 60)}:${String(Math.floor(Number(state.time) % 60)).padStart(2, "0")}
HP ${state.hp}/${state.maxHp}  킬 ${state.kills}  보스처치 ${state.bossesKilled}
클래스 ${state.playerClass || "(미선택)"}  무적 ${state.god ? "ON" : "off"}  몹수 ${state.mobCount}`}
          </div>
        )}

        <h2>레벨 / 시간</h2>
        <div className={styles.row}>
          <input value={levelInput} onChange={(e) => setLevelInput(e.target.value)} placeholder="레벨" disabled={!running} />
          <button onClick={() => cheats()?.setLevel(Number(levelInput))} disabled={!running}>레벨 설정</button>
        </div>
        <div className={styles.row}>
          <input value={timeInput} onChange={(e) => setTimeInput(e.target.value)} placeholder="초" disabled={!running} />
          <button onClick={() => cheats()?.setTime(Number(timeInput))} disabled={!running}>시간 설정(초)</button>
        </div>
        <div className={styles.row}>
          <button onClick={() => cheats()?.addTime(60)} disabled={!running}>+60초</button>
          <button onClick={() => cheats()?.addTime(300)} disabled={!running}>+5분</button>
        </div>

        <h2>체력</h2>
        <div className={styles.row}>
          <input value={hpInput} onChange={(e) => setHpInput(e.target.value)} placeholder="HP" disabled={!running} />
          <button onClick={() => cheats()?.setHp(Number(hpInput))} disabled={!running}>HP 설정</button>
        </div>
        <div className={styles.row}>
          <button onClick={() => cheats()?.heal()} disabled={!running}>완전 회복</button>
          <button onClick={() => cheats()?.godMode(!state?.god)} disabled={!running}>{state?.god ? "무적 해제" : "무적 모드"}</button>
        </div>

        <h2>몬스터 / 보스</h2>
        <div className={styles.row}>
          <select value={mobArchetype} onChange={(e) => setMobArchetype(e.target.value)} disabled={!running}>
            <option value="">(무작위)</option>
            {archetypes.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <input value={mobCount} onChange={(e) => setMobCount(e.target.value)} placeholder="수량" style={{ maxWidth: 60 }} disabled={!running} />
          <button onClick={() => cheats()?.spawnMob(mobArchetype || archetypes[Math.floor(Math.random() * archetypes.length)], Number(mobCount))} disabled={!running}>소환</button>
        </div>
        <div className={styles.row}>
          <button onClick={() => cheats()?.spawnBossNow()} disabled={!running}>보스 즉시 소환</button>
          <button onClick={() => cheats()?.killBoss()} disabled={!running}>현재 보스 즉사</button>
          <button onClick={() => cheats()?.clearMobs()} disabled={!running}>몹 전체 제거</button>
        </div>

        <h2>클래스</h2>
        <p className={styles.note}>전직은 런당 1회만 가능(중복 적용 방지). 이미 전직했다면 새 런에서 시도.</p>
        <div className={styles.row}>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} disabled={!running}>
            <option value="">클래스 선택</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => classId && cheats()?.setClass(classId)} disabled={!running || !classId}>전직 적용</button>
        </div>

        <h2>능력 강제 부여</h2>
        <div className={styles.row}>
          <select value={upgradeId} onChange={(e) => setUpgradeId(e.target.value)} disabled={!running}>
            <option value="">능력 선택</option>
            {upgradesList.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <input value={upgradeRanks} onChange={(e) => setUpgradeRanks(e.target.value)} placeholder="랭크" style={{ maxWidth: 55 }} disabled={!running} />
          <button onClick={() => upgradeId && cheats()?.grantUpgrade(upgradeId, Number(upgradeRanks))} disabled={!running || !upgradeId}>부여</button>
        </div>

        <h2>유물 부여</h2>
        <div className={styles.row}>
          <select value={relicId} onChange={(e) => setRelicId(e.target.value)} disabled={!running}>
            <option value="">유물 선택</option>
            {relicsList.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <input value={relicLevel} onChange={(e) => setRelicLevel(e.target.value)} placeholder="LV" style={{ maxWidth: 50 }} disabled={!running} />
          <button onClick={() => relicId && cheats()?.addRelic(relicId, Number(relicLevel))} disabled={!running || !relicId}>부여</button>
        </div>

        <h2>커스텀 스크립트</h2>
        <p className={styles.note}>{"S(게임 상태 객체)를 인자로 받는 표현식을 실행합니다. 예: S.damage *= 2"}</p>
        <div className={styles.jsBox}>
          <textarea value={jsCode} onChange={(e) => setJsCode(e.target.value)} placeholder="S.damage *= 2" disabled={!running} />
        </div>
        <div className={styles.row}>
          <button onClick={runJs} disabled={!running || !jsCode}>실행</button>
        </div>
        {jsResult && <div className={jsResult.ok ? styles.result : styles.resultErr}>{jsResult.text}</div>}
      </div>
    </div>
  );
}
