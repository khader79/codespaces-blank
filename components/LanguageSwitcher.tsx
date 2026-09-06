"use client";

import { useI18n, type Locale } from "@/lib/i18n";

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
      <span className="sr-only">{t("auth.language")}</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        aria-label={t("auth.language")}
      >
        <option value="en">{t("auth.english")}</option>
        <option value="ar">{t("auth.arabic")}</option>
      </select>
    </label>
  );
}