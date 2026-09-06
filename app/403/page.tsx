"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/components/AuthProvider";
import { defaultWorkspace } from "@/lib/rbac";

export default function ForbiddenPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-white"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">403</p><h1 className="mt-3 text-3xl font-bold">{t("forbiddenTitle" as never)}</h1><p className="mt-3 max-w-md text-slate-300">{t("forbiddenDescription" as never)}</p><Link className="mt-8 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950" href={defaultWorkspace(user?.role)}>{t("returnToWorkspace" as never)}</Link></div></main>;
}