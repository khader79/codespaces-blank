"use client";

import { I18nProvider } from "@/lib/i18n";
import AuthGate from "@/components/AuthGate";
import { AuthProvider } from "@/components/AuthProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider><AuthGate><I18nProvider>{children}</I18nProvider></AuthGate></AuthProvider>;
}