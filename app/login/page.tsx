"use client";

import { useState } from "react";

export default function LoginPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Login failed.");
      }
      window.location.href = "/";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="page" style={{ paddingTop: "18vh" }}>
      <h1 className="page-title" style={{ textAlign: "center" }}>
        Hypnosis Logger
      </h1>
      <p className="page-sub" style={{ textAlign: "center" }}>
        Enter your access code.
      </p>
      <input
        className="search-input"
        type="password"
        inputMode="text"
        autoFocus
        value={code}
        placeholder="Access code"
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <button className="btn btn-primary" onClick={submit} disabled={busy || !code}>
        {busy ? "…" : "Enter"}
      </button>
      {error && <p className="error-text">{error}</p>}
    </main>
  );
}
