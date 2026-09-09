import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";

export type Tone = "blue" | "violet" | "amber" | "emerald" | "red" | "slate" | "indigo";

export const toneText: Record<Tone, string> = {
  blue: "text-blue-700",
  violet: "text-violet-700",
  amber: "text-amber-700",
  emerald: "text-emerald-700",
  red: "text-red-700",
  slate: "text-slate-700",
  indigo: "text-indigo-700",
};

export const toneBg: Record<Tone, string> = {
  blue: "bg-blue-50",
  violet: "bg-violet-50",
  amber: "bg-amber-50",
  emerald: "bg-emerald-50",
  red: "bg-red-50",
  slate: "bg-slate-100",
  indigo: "bg-indigo-50",
};

export const toneBorder: Record<Tone, string> = {
  blue: "border-blue-200",
  violet: "border-violet-200",
  amber: "border-amber-200",
  emerald: "border-emerald-200",
  red: "border-red-200",
  slate: "border-slate-200",
  indigo: "border-indigo-200",
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className = "",
  noPad = false,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  noPad?: boolean;
}) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h2 className="text-base font-bold text-slate-950">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={noPad ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export function Pill({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${toneBg[tone]} ${toneText[tone]}`}>
      {children}
    </span>
  );
}

export function Sparkline({
  points,
  stroke = "#3b82f6",
  height = 36,
}: {
  points: number[];
  stroke?: string;
  height?: number;
}) {
  if (points.length === 0) return <div className="h-9" />;
  const width = 120;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const step = width / (points.length - 1 || 1);
  const coords = points.map((value, index) => {
    const x = index * step;
    const y = height - 3 - ((value - min) / span) * (height - 8);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const gradientId = `spark-${stroke.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity={0.35} />
          <stop offset="1" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r={2.5} fill={stroke} />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "blue",
  points,
  trend,
}: {
  label: string;
  value: string | number;
  sub?: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  points?: number[];
  trend?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneBg[tone]} ${toneText[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
        {trend && (
          <span className={`inline-flex items-center gap-1 text-xs font-bold ${trend.startsWith("-") ? "text-red-600" : "text-emerald-600"}`}>
            {trend}
          </span>
        )}
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
      {points && points.length > 0 && (
        <div className="mt-3 opacity-80 group-hover:opacity-100">
          <Sparkline
            points={points}
            stroke={tone === "emerald" ? "#10b981" : tone === "amber" ? "#f59e0b" : tone === "violet" ? "#8b5cf6" : "#3b82f6"}
          />
        </div>
      )}
      {sub && <p className="mt-2 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-4 text-sm font-bold text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-400">{description}</p>}
    </div>
  );
}

export function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}