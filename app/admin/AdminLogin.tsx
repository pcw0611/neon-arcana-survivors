"use client";

import { useState, type FormEvent } from "react";
import styles from "./admin.module.css";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "로그인에 실패했습니다.");
      window.location.reload();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.scanlines} aria-hidden="true" />
      <div className={styles.shell} style={{ maxWidth: 360, margin: "80px auto" }}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>NEON ARCANA // OPERATIONS</p>
            <h1>관리자 로그인</h1>
          </div>
        </header>
        <section className={styles.panel}>
          <form onSubmit={(event) => void submit(event)}>
            <label className={styles.searchLabel}>
              <span>비밀번호</span>
              <input
                type="password"
                value={password}
                autoFocus
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error && <div className={styles.error} role="alert">{error}</div>}
            <button
              className={styles.buttonPrimary}
              type="submit"
              disabled={loading || !password}
              style={{ marginTop: 12 }}
            >
              {loading ? "확인 중…" : "로그인"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
