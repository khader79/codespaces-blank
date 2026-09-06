"use client";

import { usePathname } from "next/navigation";

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div className={pathname.startsWith("/super-admin") ? "" : "md:ps-64"}>{children}</div>;
}