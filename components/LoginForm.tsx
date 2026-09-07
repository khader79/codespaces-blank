"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, LogIn, LoaderCircle } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { defaultWorkspace, normalizeRole } from "@/lib/rbac";

const inputClass = "peer h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 pt-3 text-sm text-slate-900 outline-none transition placeholder:text-transparent focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10";

export default function LoginForm() {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRegistered(params.get("registered") === "1");
    if (window.localStorage.getItem("storeflow-remember-email")) setEmail(window.localStorage.getItem("storeflow-email") ?? "");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError(t("auth.requiredFields"));
      return;
    }
    setWorking(true);
    setError(null);
    if (remember) {
      window.localStorage.setItem("storeflow-remember-email", "1");
      window.localStorage.setItem("storeflow-email", email);
    } else {
      window.localStorage.removeItem("storeflow-remember-email");
      window.localStorage.removeItem("storeflow-email");
    }
    const signInResult = await signIn(email, password);
    if (typeof signInResult === "string") {
      setError(t("auth.signInError"));
      setWorking(false);
    } else {
      const role = normalizeRole(signInResult.role);
      const next = new URLSearchParams(window.location.search).get("next");
      const destination = role === "SUPER_ADMIN"
        ? "/super-admin"
        : next?.startsWith("/") ? next : defaultWorkspace(signInResult.role);
      window.location.href = destination;
    }
  }

  return <AuthShell mode="login">
    {registered && <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-5 text-emerald-800">{t("auth.workspaceReady")}</div>}
    {error && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">{error}</div>}
    <form onSubmit={submit} className="space-y-5">
      <FloatingField id="login-email" label={t("auth.identifier")} value={email} onChange={setEmail} autoComplete="username" />
      <div className="relative"><input id="login-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className={`${inputClass} pe-12`} autoComplete="current-password" placeholder={t("auth.password")} /><label htmlFor="login-password" className="floating-label">{t("auth.password")}</label><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute end-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
      <div className="flex items-center justify-between gap-3"><label className="flex items-center gap-2 text-xs font-medium text-slate-500"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />{t("auth.rememberMe")}</label><a href="mailto:support@storeflow.com?subject=Password%20reset%20request" className="text-xs font-semibold text-blue-600 transition hover:text-blue-700">{t("auth.forgotPassword")}</a></div>
      <button disabled={working} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 hover:shadow-blue-600/30 disabled:cursor-wait disabled:opacity-70">{working ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}{working ? t("auth.authenticating") : t("auth.signIn")}{!working && <ArrowRight className="h-4 w-4" />}</button>
    </form>
    <div className="mt-7 flex items-center justify-center gap-2 text-xs text-slate-400"><LockKeyhole className="h-3.5 w-3.5" />{t("auth.protectedBy")}</div>
    <p className="mt-6 text-center text-sm text-slate-500">{t("auth.newToStoreFlow")} <Link href="/register" className="font-semibold text-blue-600 hover:text-blue-700">{t("auth.registerCompany")}</Link></p>
  </AuthShell>;
}

function FloatingField({ id, label, value, onChange, type = "text", autoComplete }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string }) {
  return <div className="relative"><input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} autoComplete={autoComplete} placeholder={label} /><label htmlFor={id} className="floating-label">{label}</label></div>;
}