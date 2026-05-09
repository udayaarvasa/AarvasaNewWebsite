import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  subtitle?: string;
  trend?: string;
  trendUp?: boolean;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  subtitle,
  trend,
  trendUp = true,
}: StatCardProps) {
  return (
    <div className="rounded-2xl border border-[#DCCDCE]/40 bg-[#F5F4F1]/80 p-5 shadow-luxury-sm transition hover:shadow-luxury">
      <div className="flex items-start justify-between">
        {Icon && (
          <div className="gold-gradient flex h-10 w-10 items-center justify-center rounded-xl text-white">
            <Icon className="h-5 w-5" />
          </div>
        )}
        {trend && (
          <span
            className={`text-xs font-semibold ${
              trendUp ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {trendUp ? "↑" : "↓"} {trend}
          </span>
        )}
      </div>
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-[#72383D]/70">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-[#50080E]">{value}</p>
      {subtitle && (
        <p className="mt-1 text-xs text-[#72383D]/60">{subtitle}</p>
      )}
    </div>
  );
}
