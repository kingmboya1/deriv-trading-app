import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6 py-16 text-primary">
      <div className="w-full max-w-2xl rounded-2xl border border-hairline bg-surface p-8 shadow-xl">
        <p className="mb-3 font-display text-xs font-semibold uppercase tracking-[0.3em] text-accent">
          Deriv Third-Party App
        </p>
        <h1 className="font-display text-4xl font-semibold text-primary">
          OAuth authentication scaffold is ready
        </h1>
        <p className="mt-4 font-sans text-lg text-muted">
          Start by signing in with your Deriv account to reach the protected
          dashboard.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/login"
            className="rounded-full bg-accent px-5 py-3 font-display font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            Go to login
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-hairline px-5 py-3 font-display font-semibold text-muted transition hover:border-muted/40 hover:text-primary"
          >
            Open dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
