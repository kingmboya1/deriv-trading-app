"use client";

import { useState, useEffect, useRef } from "react";

interface BotEntry {
  id: string;
  name: string;
  winRate: number;
  description: string;
  strategy: string;
  createdAt: string;
}

export default function AdminPage() {
  const [password, setPassword]   = useState("");
  const [authed, setAuthed]       = useState(false);
  const [authError, setAuthError] = useState("");
  const [bots, setBots]           = useState<BotEntry[]>([]);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [success, setSuccess]     = useState("");

  // Form state
  const [name, setName]           = useState("");
  const [winRate, setWinRate]     = useState(80);
  const [description, setDesc]    = useState("");
  const [strategy, setStrategy]   = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const headers = { "x-admin-password": password, "Content-Type": "application/json" };

  const fetchBots = async (pw: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/bots", {
        headers: { "x-admin-password": pw },
      });
      if (res.status === 401) { setAuthError("Wrong password."); setAuthed(false); return; }
      const data = (await res.json()) as BotEntry[];
      setBots(data);
      setAuthed(true);
      setAuthError("");
    } catch {
      setAuthError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchBots(password);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setStrategy(String(ev.target?.result ?? ""));
    reader.readAsText(file);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSuccess("");
    if (!name.trim()) { setFormError("Bot name is required."); return; }
    if (winRate < 0 || winRate > 100) { setFormError("Win rate must be 0–100."); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/bots", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: name.trim(), winRate, description, strategy }),
      });
      if (!res.ok) { setFormError("Failed to save bot."); return; }
      setSuccess(`Bot "${name}" added successfully.`);
      setName(""); setWinRate(80); setDesc(""); setStrategy("");
      if (fileRef.current) fileRef.current.value = "";
      void fetchBots(password);
    } catch {
      setFormError("Network error.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, botName: string) => {
    if (!confirm(`Delete "${botName}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await fetch(`/api/admin/bots?id=${id}`, { method: "DELETE", headers });
      void fetchBots(password);
    } finally {
      setDeleting(null);
    }
  };

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm rounded-2xl border border-hairline bg-surface p-8 shadow-2xl">
          <h1 className="font-display text-xl font-bold text-primary">Admin Panel</h1>
          <p className="mt-1 font-sans text-sm text-muted">Enter your admin password to continue.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="mt-5 w-full rounded-lg border border-hairline bg-card px-3 py-2.5 font-mono text-sm text-primary focus:border-accent/50 focus:outline-none"
            autoFocus
          />
          {authError && <p className="mt-2 font-sans text-xs text-loss">{authError}</p>}
          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-accent py-3 font-display text-sm font-bold text-canvas transition-opacity hover:opacity-90"
          >
            Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas px-4 py-8">
      <div className="mx-auto max-w-3xl flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-primary">Admin Panel</h1>
            <p className="font-sans text-sm text-muted">Manage Free Bots available to users</p>
          </div>
          <button
            type="button"
            onClick={() => { setAuthed(false); setPassword(""); }}
            className="rounded-lg border border-hairline px-3 py-1.5 font-display text-xs font-semibold text-muted hover:text-primary"
          >
            Log out
          </button>
        </div>

        {/* Add bot form */}
        <form onSubmit={handleAdd} className="rounded-2xl border border-accent/25 bg-surface p-6 flex flex-col gap-4">
          <p className="font-display text-xs font-semibold uppercase tracking-widest text-accent">Add New Bot</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block font-display text-xs font-medium text-muted">Bot Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. MONSTER"
                className="w-full rounded-lg border border-hairline bg-card px-3 py-2 font-mono text-sm text-primary focus:border-accent/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-display text-xs font-medium text-muted">Win Rate (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={winRate}
                onChange={(e) => setWinRate(Number(e.target.value))}
                className="w-full rounded-lg border border-hairline bg-card px-3 py-2 font-mono text-sm text-primary focus:border-accent/50 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-display text-xs font-medium text-muted">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Short description"
              className="w-full rounded-lg border border-hairline bg-card px-3 py-2 font-mono text-sm text-primary focus:border-accent/50 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-display text-xs font-medium text-muted">
              Strategy File (.xml or .json)
            </label>
            <input
              type="file"
              accept=".xml,.json,.txt"
              ref={fileRef}
              onChange={handleFileChange}
              className="w-full rounded-lg border border-hairline bg-card px-3 py-2 font-sans text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent/15 file:px-3 file:py-1 file:font-display file:text-xs file:font-semibold file:text-accent"
            />
            {strategy && (
              <p className="mt-1 font-mono text-[10px] text-gain">
                ✓ File loaded ({strategy.length} chars)
              </p>
            )}
          </div>

          {/* Or paste strategy */}
          <div>
            <label className="mb-1 block font-display text-xs font-medium text-muted">
              Or paste strategy XML/JSON
            </label>
            <textarea
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              rows={4}
              placeholder="<xml>...</xml>"
              className="w-full rounded-lg border border-hairline bg-card px-3 py-2 font-mono text-xs text-primary focus:border-accent/50 focus:outline-none"
            />
          </div>

          {formError && (
            <p className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 font-sans text-xs text-loss">{formError}</p>
          )}
          {success && (
            <p className="rounded-lg border border-gain/30 bg-gain/10 px-3 py-2 font-sans text-xs text-gain">{success}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-accent py-3 font-display text-sm font-bold text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add Bot"}
          </button>
        </form>

        {/* Bot list */}
        <div className="rounded-2xl border border-hairline bg-surface p-6 flex flex-col gap-4">
          <p className="font-display text-xs font-semibold uppercase tracking-widest text-muted">
            Current Bots ({bots.length})
          </p>

          {loading ? (
            <p className="font-sans text-sm text-muted">Loading…</p>
          ) : bots.length === 0 ? (
            <p className="font-sans text-sm text-muted">No bots yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {bots.map((bot) => (
                <div
                  key={bot.id}
                  className="flex items-center justify-between rounded-xl border border-hairline bg-card px-4 py-3"
                >
                  <div>
                    <p className="font-display text-sm font-bold text-primary">{bot.name}</p>
                    <p className="font-mono text-xs text-muted">
                      Win Rate: <span className="text-accent">{bot.winRate}%</span>
                      {bot.strategy ? " · Strategy attached" : " · No strategy"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(bot.id, bot.name)}
                    disabled={deleting === bot.id}
                    className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-1.5 font-display text-xs font-semibold text-loss transition hover:bg-loss/20 disabled:opacity-50"
                  >
                    {deleting === bot.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
