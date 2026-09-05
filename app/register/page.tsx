"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, Building2, CheckCircle2, LockKeyhole } from "lucide-react";

const inputClass = "mt-2 h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

export default function RegisterPage() {
  const [form, setForm] = useState({ companyName: "", adminFullName: "", email: "", password: "", activationCode: "" });
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [created, setCreated] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Registration failed.");
      setCreated(true);
      window.setTimeout(() => { window.location.href = "/login?registered=1"; }, 1200);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Registration failed.");
    } finally {
      setWorking(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10"><div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-800 bg-white shadow-2xl lg:grid-cols-[0.85fr_1.15fr]">
    <section className="hidden bg-slate-900 p-10 text-white lg:block"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500 font-bold">S</div><p className="mt-16 text-xs font-bold uppercase tracking-[0.2em] text-blue-300">StoreFlow Enterprise</p><h1 className="mt-4 text-4xl font-bold leading-tight">Your operation,<br />under control.</h1><p className="mt-5 max-w-xs text-sm leading-6 text-slate-300">Create an isolated workspace for your company, warehouses, inventory, and financial operations.</p><div className="mt-12 space-y-4 text-sm text-slate-300"><p className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-400" />30-day trial included</p><p className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-400" />Main warehouse provisioned automatically</p><p className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-400" />Secure company data isolation</p></div></section>
    <section className="p-6 sm:p-10"><div className="flex items-center gap-3 text-slate-900 lg:hidden"><Building2 className="h-5 w-5 text-blue-600" /><span className="font-bold">StoreFlow</span></div><div className="max-w-md"><p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-blue-600 lg:mt-0">Start your workspace</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Create your company account</h2><p className="mt-2 text-sm text-slate-500">Your 30-day trial starts immediately. No payment gateway required.</p>{created ? <div className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Your workspace is ready. Redirecting to StoreFlow...</div> : <form onSubmit={submit} className="mt-8 space-y-4">{error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}<label className="block text-sm font-semibold text-slate-700">Company name<input required value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className={inputClass} placeholder="Acme Trading Co." /></label><label className="block text-sm font-semibold text-slate-700">Admin full name<input required value={form.adminFullName} onChange={(e) => setForm({ ...form, adminFullName: e.target.value })} className={inputClass} placeholder="Your full name" /></label><label className="block text-sm font-semibold text-slate-700">Business email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} placeholder="you@company.com" /></label><label className="block text-sm font-semibold text-slate-700">Password<span className="ml-2 text-xs font-normal text-slate-400">8 characters minimum</span><input required minLength={8} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass} placeholder="Create a secure password" /></label><label className="block text-sm font-semibold text-slate-700">Activation code <span className="text-xs font-normal text-slate-400">optional</span><input value={form.activationCode} onChange={(e) => setForm({ ...form, activationCode: e.target.value })} className={inputClass} placeholder="Enter a voucher code" /></label><button disabled={working} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60">{working ? "Creating workspace..." : "Create account"}<ArrowRight className="h-4 w-4" /></button><p className="flex items-center justify-center gap-2 pt-2 text-xs text-slate-400"><LockKeyhole className="h-3.5 w-3.5" />Your credentials are encrypted by Supabase Auth.</p></form>}<p className="mt-8 text-center text-sm text-slate-500">Already have an account? <Link href="/" className="font-semibold text-blue-600 hover:text-blue-700">Open StoreFlow</Link></p></div></section>
  </div></main>;
}
