import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-white">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <p className="mb-3 text-sm uppercase tracking-[0.3em] text-sky-400">
          Deriv Third-Party App
        </p>
        <h1 className="text-4xl font-semibold">OAuth authentication scaffold is ready</h1>
        <p className="mt-4 text-lg text-slate-300">
          Start by signing in with your Deriv account to reach the protected
          dashboard.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/login"
            className="rounded-full bg-sky-500 px-5 py-3 font-medium text-white transition hover:bg-sky-400"
          >
            Go to login
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-slate-700 px-5 py-3 font-medium text-slate-200 transition hover:border-slate-500"
          >
            Open dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
