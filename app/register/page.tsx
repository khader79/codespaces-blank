"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import { useI18n } from "@/lib/i18n";

const inputClass = "peer h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 pt-3 text-sm text-slate-900 outline-none transition placeholder:text-transparent focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10";

export default function RegisterPage() {
  const [form, setForm] = useState({ companyName: "", adminFullName: "", email: "", password: "", activationCode: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [created, setCreated] = useState(false);
  const { t } = useI18n();

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
      setWorking(false);
    }
  }

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return <AuthShell mode="register">
    {created ? <div className="flex min-h-[360px] flex-col items-center justify-center text-center"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-7 w-7" /></span><h2 className="mt-5 text-xl font-semibold text-slate-950">{t("auth.workspaceProvisioned")}</h2><p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">{t("auth.workspaceReadyRedirect")}</p></div> : <>
      {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <Field id="company-name" label={t("auth.companyName")} value={form.companyName} onChange={(value) => update("companyName", value)} autoComplete="organization" />
        <Field id="admin-name" label={t("auth.adminFullName")} value={form.adminFullName} onChange={(value) => update("adminFullName", value)} autoComplete="name" />
        <Field id="register-email" label={t("auth.adminEmail")} type="email" value={form.email} onChange={(value) => update("email", value)} autoComplete="email" />
        <div className="relative"><input required minLength={8} id="register-password" type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => update("password", event.target.value)} className={`${inputClass} pe-12`} autoComplete="new-password" placeholder={t("auth.password")} /><label htmlFor="register-password" className="floating-label">{t("auth.password")}</label><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute end-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button><p className="mt-1.5 text-[11px] text-slate-400">{t("auth.passwordHint")}</p></div>
        <div className="relative"><input id="activation-code" value={form.activationCode} onChange={(event) => update("activationCode", event.target.value)} className={`${inputClass} pe-10`} placeholder={t("auth.activationCode")} /><label htmlFor="activation-code" className="floating-label">{t("auth.activationCode")} <span className="normal-case tracking-normal text-slate-400">({t("auth.optional")})</span></label><KeyRound className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /></div>
        <button disabled={working} className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 hover:shadow-blue-600/30 disabled:cursor-wait disabled:opacity-70">{working ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}{working ? t("auth.provisioning") : t("auth.createWorkspace")}</button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">{t("auth.alreadyHaveAccount")} <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700">{t("auth.signInShort")}</Link></p>
    </>}
  </AuthShell>;
}

function Field({ id, label, value, onChange, type = "text", autoComplete }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string }) {
  return <div className="relative"><input required id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} autoComplete={autoComplete} placeholder={label} /><label htmlFor={id} className="floating-label">{label}</label></div>;
}
