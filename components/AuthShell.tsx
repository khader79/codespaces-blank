"use client";

import Link from "next/link";
import { ArrowUpRight, BarChart3, ShieldCheck, Sparkles } from "lucide-react";
import { AUTH_METRICS } from "@/config/auth";
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
    <main className="relative min-h-screen overflow-hidden bg-[#f4f7fb] md:-ms-64 md:w-[calc(100%+16rem)]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(420px,0.92fr)_minmax(560px,1.08fr)]">
        <section className="relative isolate overflow-hidden bg-[#101827] px-6 py-8 text-white sm:px-10 lg:px-14 lg:py-12">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_12%,rgba(47,117,255,0.3),transparent_34%),linear-gradient(135deg,#101827_0%,#16233b_52%,#0d1522_100%)]" />
          <div className="absolute inset-0 -z-10 opacity-[0.14] [background-image:linear-gradient(rgba(148,163,184,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.35)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
          <div className="mx-auto flex h-full max-w-xl flex-col">
            <div className="flex items-center justify-between">
              <Link href="/" className="inline-flex items-center gap-3 text-white"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-sm font-bold shadow-lg shadow-black/10">S</span><span className="text-lg font-semibold tracking-tight">StoreFlow</span></Link>
              <div className="flex items-center gap-3"><LanguageSwitcher /><span className="hidden items-center gap-2 text-xs font-medium text-slate-400 sm:inline-flex"><ShieldCheck className="h-4 w-4 text-emerald-400" />{t("auth.enterpriseAccess")}</span></div>
            </div>
            <div className="mt-14 max-w-lg lg:mt-auto lg:pt-24">
              <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300"><Sparkles className="h-4 w-4" />{t("auth.operationalIntelligence")}</div>
              <h2 className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-[-0.03em] sm:text-5xl">{t("auth.heroTitle")}</h2>
              <p className="mt-6 max-w-md text-sm leading-7 text-slate-300">{t("auth.heroDescription")}</p>
            </div>
            <div className="mt-12 grid grid-cols-3 gap-3 border-t border-white/10 pt-6 lg:mb-2 lg:mt-auto">{AUTH_METRICS.map((metric) => <div key={metric.key}><p className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{metric.value}</p><p className="mt-1 max-w-[100px] text-[11px] leading-4 text-slate-400">{t(`auth.${metric.key}`)}</p></div>)}</div>
            <div className="mt-8 hidden items-center gap-3 text-xs text-slate-400 sm:flex"><BarChart3 className="h-4 w-4 text-blue-300" />{t("auth.heroFooter")}<ArrowUpRight className="h-4 w-4 text-slate-500" /></div>
          </div>
        </section>
        <section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-16 lg:py-14"><div className="w-full max-w-[500px] animate-[auth-rise_500ms_ease-out_both]"><div className="mb-8 flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">{eyebrow}</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-[2.15rem]">{title}</h1><p className="mt-3 max-w-md text-sm leading-6 text-slate-500">{description}</p></div><span className="hidden shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500 shadow-sm sm:inline-flex">{mode === "login" ? t("auth.secureSignIn") : t("auth.freeWorkspace")}</span></div><div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8">{children}</div></div></section>
      </div>
    </main>
  );
}