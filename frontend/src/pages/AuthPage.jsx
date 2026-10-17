import React, { useState } from "react";
import { api, setSession } from "../api.js";

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const data = await api(path, { method: "POST", body: form });
      setSession(data.token, data.user);
      onLogin(data.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand big"><span className="brand-mark">▣</span> MicroShop</div>
        <p className="dim">
          This login round-trips: browser → gateway → <b>auth-service</b>.
          If either is down, you can't get past this screen.
        </p>
        <div className="mode-switch">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Log in</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Create account</button>
        </div>
        {mode === "register" && (
          <input placeholder="Your name" value={form.name} onChange={set("name")} />
        )}
        <input placeholder="Email" type="email" value={form.email} onChange={set("email")} />
        <input placeholder="Password" type="password" value={form.password} onChange={set("password")}
               onKeyDown={(e) => e.key === "Enter" && submit()} />
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy} onClick={submit}>
          {busy ? "Contacting auth-service…" : mode === "login" ? "Log in" : "Create account"}
        </button>
        <p className="dim small">Accounts live in auth-service memory - restarting that container wipes them. That's a feature: it teaches you why state needs volumes.</p>
      </div>
    </div>
  );
}
