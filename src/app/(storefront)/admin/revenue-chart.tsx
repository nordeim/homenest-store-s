"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatMoney } from "@/lib/money";

export type RevenuePoint = { date: string; revenue: number };

/**
 * Revenue area chart for the admin dashboard. Receives a server-computed,
 * serializable array of { date label, revenue cents } points for the last 14
 * days and renders the terracotta-orange gradient area chart.
 */
export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <div className="w-full" role="img" aria-label="Revenue for the last 14 days">
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="adminRevenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#d96e26" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#d96e26" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval={1}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value: number) => `$${Math.round(value / 100).toLocaleString("en-US")}`}
          />
          <Tooltip formatter={(value: unknown) => formatMoney(Number(value ?? 0))} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#d96e26"
            strokeWidth={2}
            fill="url(#adminRevenueFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
