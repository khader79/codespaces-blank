"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, LockKeyhole, LogIn } from "lucide-react";
import { supabase } from "@/lib/supabase";

const inputClass = "mt-2 h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [registered, setRegistered] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
    else window.location.href = "/";
    setWorking(false);
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10"><div className="w-full max-w-md rounded-2xl border border-slate-800 bg-white p-6 shadow-2xl sm:p-10"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-sm font-bold text-white">S</div><p className="mt-10 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">StoreFlow Enterprise</p><h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Welcome back</h1><p className="mt-2 text-sm text-slate-500">Sign in to manage your company and warehouses.</p>{registered && <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Your account is ready. Sign in to continue.</div>}<form onSubmit={submit} className="mt-8 space-y-5">{error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}<label className="block text-sm font-semibold text-slate-700">Business email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} autoComplete="email" placeholder="you@company.com" /></label><label className="block text-sm font-semibold text-slate-700">Password<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} autoComplete="current-password" placeholder="Your password" /></label><button disabled={working} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"><LogIn className="h-4 w-4" />{working ? "Signing in..." : "Sign in"}<ArrowRight className="h-4 w-4" /></button></form><p className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400"><LockKeyhole className="h-3.5 w-3.5" />Protected by Supabase Auth.</p><p className="mt-6 text-center text-sm text-slate-500">New to StoreFlow? <Link href="/register" className="font-semibold text-blue-600 hover:text-blue-700">Create a company account</Link></p></div></main>;
}
