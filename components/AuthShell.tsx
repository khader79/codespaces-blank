"use client";

import Link from "next/link";
import { Check, LockKeyhole, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

type AuthShellProps = {
  mode: "login" | "register";
  children: React.ReactNode;
};

export default function AuthShell({ mode, children }: AuthShellProps) {
  const { t } = useI18n();
  const eyebrow = mode === "login" ? t("auth.loginEyebrow") : t("auth.registerEyebrow");
  const title = mode === "login" ? t("auth.loginTitle") : t("auth.registerTitle");
  const description = mode === "login" ? t("auth.loginDescription") : t("auth.registerDescription");

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-100 md:-ms-64 md:w-[calc(100%+16rem)]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(430px,0.9fr)_minmax(560px,1.1fr)]">
        <section className="relative isolate overflow-hidden bg-[#0c1726] px-6 py-8 text-white sm:px-10 lg:px-16 lg:py-12">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_8%,rgba(59,130,246,0.22),transparent_30%),linear-gradient(145deg,#0c1726_0%,#12243a_58%,#0b1420_100%)]" />
          <div className="absolute inset-0 -z-10 opacity-[0.12] [background-image:linear-gradient(rgba(148,163,184,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.35)_1px,transparent_1px)] [background-size:52px_52px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
          <div className="mx-auto flex h-full max-w-xl flex-col">
            <div className="flex items-center justify-between">
              <Link href="/" className="inline-flex items-center gap-3 text-white"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-sm font-bold shadow-lg shadow-black/10">S</span><span className="text-lg font-semibold tracking-tight">StoreFlow</span></Link>
              <div className="flex items-center gap-3"><LanguageSwitcher /><span className="hidden items-center gap-2 text-xs font-medium text-slate-400 sm:inline-flex"><ShieldCheck className="h-4 w-4 text-emerald-400" />{t("auth.enterpriseAccess")}</span></div>
            </div>
            <div className="mt-20 max-w-lg lg:mt-auto lg:pt-28">
              <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">{t("auth.operationalIntelligence")}</p>
              <h2 className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-[-0.03em] sm:text-5xl">{t("auth.heroTitle")}</h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-slate-300">{t("auth.heroDescription")}</p>
            </div>
            <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.07] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl lg:mb-2 lg:mt-auto">
              <div className="flex items-center justify-between border-b border-white/10 pb-4"><div className="flex items-center gap-2 text-sm font-medium text-white"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />{t("auth.infrastructureStatus")}</div><LockKeyhole className="h-4 w-4 text-slate-400" /></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">{(["tenantIsolation", "encryptedAuth", "posSync"] as const).map((key) => <div key={key} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span className="text-xs leading-5 text-slate-300">{t(`auth.${key}`)}</span></div>)}</div>
            </div>
          </div>
        </section>
        <section className="flex items-center justify-center px-5 py-12 sm:px-10 lg:px-16 lg:py-14"><div className="w-full max-w-[500px] animate-[auth-rise_500ms_ease-out_both]"><div className="mb-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">{eyebrow}</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-[2.15rem]">{title}</h1><p className="mt-3 max-w-md text-sm leading-6 text-slate-500">{description}</p></div><div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-9">{children}</div></div></section>
      </div>
    </main>
  );
}