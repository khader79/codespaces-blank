"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { STORE_ID } from "@/lib/tenant";

type AccessState = { readOnly: boolean; expiresAt?: string };

export default function TenantAccessBanner() {
  const [state, setState] = useState<AccessState | null>(null);
  useEffect(() => {
    fetch(`/api/tenant/status?tenantId=${STORE_ID}`).then((response) => response.json()).then(setState).catch(() => undefined);
  }, []);
  if (!state?.readOnly) return null;
  return <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-900"><span className="inline-flex items-center gap-2"><AlertCircle className="h-4 w-4" />انتهت فترة التجربة/الاشتراك، يرجى التواصل مع الدعم الفني للتجديد</span><span className="ms-2 font-normal text-amber-800">Read-only mode is active.</span></div>;
}
