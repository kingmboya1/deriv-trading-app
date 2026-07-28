"use client";

import { useEffect, useState } from "react";

interface BotCard {
  id: string;
  name: string;
  winRate: number;
  description: string;
  createdAt: string;
}

interface LoadedBot {
  id: string;
  name: string;
  strategy: string;
}

export default function FreeBots() {
  const [bots, setBots]           = useState<BotCard[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [activeBot, setActiveBot] = useState<LoadedBot | null>(null);
  const [copied, setCopied]       = useState(false);

  useEffect(() => {
    fetch("/api/bots")
      .then((r) => r.json())
      .then((data: BotCard[]) => setBots(data))
      .catch(() => setBots([]))
      .finally(() => setLoading(false));
  }, []);

  const handleLoad = async (id: string) => {
    setLoadingId(id);
    try {
      const res  = await fetch(`/api/bots/${id}`);
      const data = (await res.json()) as LoadedBot;
      setActiveBot(data);
    } catch {
      alert("Failed to load bot. Please try again.");
    } finally {
      setLoadingId(null);
    }
  };

  const handleCopy = async () => {
    if (!activeBot?.strategy) return;
    await navigator.clipboard.writeText(activeBot.strategy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!activeBot?.strategy) return;
    const blob = new Blob([activeBot.strategy], { type: "text/xml" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${activeBot.name.replace(/\s+/g, "_")}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <p className="font-display text-xs font-semibold uppercase tracking-widest text-muted">
          Strategy Library
        </p>
        <h2 className="mt-1 font-display text-xl font-bold text-primary">Free Bots</h2>
        <p className="mt-1 font-sans text-sm text-muted">
          Click &quot;Load Bot&quot; to view and use the strategy in your Deriv bot builder.
        </p>
      </div>

      {/* Bot grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-hairline bg-surface" />
          ))}
        </div>
      ) : bots.length === 0 ? (
        <div className="rounded-2xl border border-hairline bg-surface px-6 py-12 text-center font-sans text-sm text-muted">
          No bots available yet. Check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot) => (
            <div
              key={bot.id}
              className="flex flex-col justify-between rounded-2xl border border-hairline bg-surface p-5 transition-colors hover:border-accent/30"
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-3">
                <p className="font-display text-sm font-bold uppercase tracking-wide text-primary">
                  {bot.name}
                </p>
                {/* Win rate badge */}
                <div className="flex flex-col items-center rounded-lg border border-loss/30 bg-loss/10 px-2.5 py-1 text-center">
                  <span className="font-mono text-base font-bold leading-none text-loss">
                    {bot.winRate}%
                  </span>
                  <span className="font-display text-[9px] font-semibold uppercase tracking-widest text-loss/70">
                    WIN
                  </span>
                </div>
              </div>

              {/* Win rate bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <span className="font-display text-[10px] font-semibold uppercase tracking-widest text-muted">
                    Win Rate
                  </span>
                  <span className="font-mono text-xs font-semibold text-primary">
                    {bot.winRate}.0%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-card">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${bot.winRate}%` }}
                  />
                </div>
              </div>

              {/* Load button */}
              <button
                type="button"
                onClick={() => void handleLoad(bot.id)}
                disabled={loadingId === bot.id}
                className="mt-4 w-full rounded-xl bg-loss px-4 py-2.5 font-display text-sm font-bold text-white shadow transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loadingId === bot.id ? "Loading…" : "Load bot"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Loaded bot modal */}
      {activeBot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-lg flex-col gap-4 rounded-2xl border border-hairline bg-surface p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-xs font-semibold uppercase tracking-widest text-muted">
                  Bot Loaded
                </p>
                <h3 className="mt-0.5 font-display text-lg font-bold text-primary">
                  {activeBot.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveBot(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline text-muted hover:text-primary"
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Strategy content */}
            {activeBot.strategy ? (
              <>
                <div className="max-h-48 overflow-auto rounded-xl border border-hairline bg-card p-3">
                  <pre className="whitespace-pre-wrap break-all font-mono text-[11px] text-muted">
                    {activeBot.strategy}
                  </pre>
                </div>

                {/* Instructions */}
                <div className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
                  <p className="font-display text-xs font-semibold text-accent">How to use</p>
                  <ol className="mt-1.5 list-decimal pl-4 font-sans text-xs leading-relaxed text-muted">
                    <li>Copy or download the strategy XML below</li>
                    <li>Open <strong className="text-primary">Deriv Bot Builder</strong> (bot.deriv.com)</li>
                    <li>Click <strong className="text-primary">Import</strong> and paste or upload the file</li>
                    <li>Run the bot from Deriv&apos;s platform</li>
                  </ol>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="flex-1 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2.5 font-display text-sm font-semibold text-accent transition hover:bg-accent/20"
                  >
                    {copied ? "Copied ✓" : "Copy XML"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex-1 rounded-xl bg-accent px-4 py-2.5 font-display text-sm font-bold text-canvas shadow-lg shadow-accent/20 transition-opacity hover:opacity-90"
                  >
                    Download .xml
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-hairline bg-card px-4 py-6 text-center font-sans text-sm text-muted">
                No strategy file attached to this bot yet.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
