'use client';

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SeriesPoint } from '@gym/types';

const axis = { stroke: 'hsl(215 10% 40%)', fontSize: 12, tickLine: false, axisLine: false } as const;

function TooltipBox({ active, payload, label, fmt }: { active?: boolean; payload?: Array<{ value: number }>; label?: string; fmt: (n: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-elevated/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-display text-sm font-semibold">{fmt(payload[0]!.value)}</p>
    </div>
  );
}

export function GrowthAreaChart({ data, color = 'hsl(var(--chart-1))', fmt = (n: number) => String(n), id = 'g' }: { data: SeriesPoint[]; color?: string; fmt?: (n: number) => string; id?: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="hsl(0 0% 100% / 0.05)" />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} allowDecimals={false} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
        <Tooltip cursor={{ stroke: 'hsl(0 0% 100% / 0.12)' }} content={<TooltipBox fmt={fmt} />} />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill={`url(#grad-${id})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SimpleBarChart({ data, color = 'hsl(var(--chart-2))', fmt = (n: number) => String(n) }: { data: SeriesPoint[]; color?: string; fmt?: (n: number) => string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="hsl(0 0% 100% / 0.05)" />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} allowDecimals={false} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
        <Tooltip cursor={{ fill: 'hsl(0 0% 100% / 0.04)' }} content={<TooltipBox fmt={fmt} />} />
        <Bar dataKey="value" fill={color} radius={[6, 6, 2, 2]} maxBarSize={38} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function WeightLineChart({ data }: { data: Array<{ date: string; weightKg: number }> }) {
  const rows = data.map((d) => ({ label: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), value: d.weightKg }));
  const min = Math.floor(Math.min(...rows.map((r) => r.value)) - 1);
  const max = Math.ceil(Math.max(...rows.map((r) => r.value)) + 1);
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="hsl(0 0% 100% / 0.05)" />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} domain={[min, max]} />
        <Tooltip content={<TooltipBox fmt={(n) => `${n} kg`} />} />
        <Line type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" strokeWidth={2.5} isAnimationActive={false} dot={{ r: 3, fill: 'hsl(var(--background))', stroke: 'hsl(var(--chart-1))', strokeWidth: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
