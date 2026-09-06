import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import Providers from "@/components/providers";
import TenantAccessBanner from "@/components/TenantAccessBanner";
import AppFrame from "@/components/AppFrame";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StoreFlow",
  description: "AI-powered retail management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning>
        <Providers><TenantAccessBanner /><AppFrame><Suspense fallback={<RouteLoading />}>{children}</Suspense></AppFrame></Providers>
      </body>
    </html>
  );
}

function RouteLoading() {
  return <div className="min-h-screen animate-pulse bg-slate-50 p-6" aria-label="Loading"><div className="mx-auto max-w-6xl space-y-6"><div className="h-8 w-48 rounded bg-slate-200" /><div className="grid gap-4 sm:grid-cols-3"><div className="h-28 rounded-xl bg-white" /><div className="h-28 rounded-xl bg-white" /><div className="h-28 rounded-xl bg-white" /></div><div className="h-72 rounded-xl bg-white" /></div></div>;
}
