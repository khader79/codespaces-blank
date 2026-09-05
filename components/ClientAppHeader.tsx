"use client";

import dynamic from "next/dynamic";

const AppHeader = dynamic(() => import("@/components/AppHeader"), {
  ssr: false,
  loading: () => <div className="h-16 border-b border-slate-200/80 bg-white/80" aria-hidden="true" />,
});

export default AppHeader;
