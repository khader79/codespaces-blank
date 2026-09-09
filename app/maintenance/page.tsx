import Link from "next/link";

export const metadata = { title: "Maintenance Mode" };

export default function MaintenancePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
      <div className="max-w-md">
        <p className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
          <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
          Scheduled Maintenance
        </p>
        <h1 className="mt-6 text-4xl font-bold tracking-tight">We&apos;ll be right back</h1>
        <p className="mt-4 text-slate-400">
          StoreFlow is currently undergoing scheduled maintenance to keep your retail operations fast, secure, and reliable.
          You&apos;ll automatically regain access as soon as systems are back online.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3 text-sm text-slate-500">
          <Link href="/login" className="rounded-lg border border-slate-700 px-4 py-2 font-medium transition hover:border-slate-500 hover:text-slate-200">
            Back to Login
          </Link>
        </div>
        <p className="mt-8 text-xs text-slate-600">If this persists, please contact your system administrator.</p>
      </div>
    </main>
  );
}