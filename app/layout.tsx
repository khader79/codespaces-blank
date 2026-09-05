import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";
import TenantAccessBanner from "@/components/TenantAccessBanner";

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
        <Providers><TenantAccessBanner /><div className="md:ps-64">{children}</div></Providers>
      </body>
    </html>
  );
}
