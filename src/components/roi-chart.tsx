"use client";

import { useSyncExternalStore } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function RoiChart({
  data,
}: {
  data: { month: string; roi: number; market: number }[];
}) {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  if (!mounted) {
    return <div className="h-[290px] w-full rounded-md bg-white/5" />;
  }

  return (
    <div className="h-[290px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -18, right: 10, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="roi" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#cea85f" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#cea85f" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="market" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#8dd4ff" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#8dd4ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="month" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              background: "rgba(12, 12, 14, 0.92)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              color: "#fff",
            }}
          />
          <Area
            type="monotone"
            dataKey="market"
            stroke="#8dd4ff"
            strokeWidth={2}
            fill="url(#market)"
          />
          <Area
            type="monotone"
            dataKey="roi"
            stroke="#cea85f"
            strokeWidth={3}
            fill="url(#roi)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
