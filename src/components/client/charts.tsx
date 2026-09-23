"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";

const nf = new Intl.NumberFormat("es-CL");
const tooltipStyle = { background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 12, fontSize: 12, color: "rgb(var(--fg))" };
const axis = { stroke: "rgb(var(--muted))", fontSize: 11, tickLine: false, axisLine: false } as const;
const PALETTE = ["rgb(var(--brand))", "rgb(var(--ok))", "rgb(var(--warn))", "rgb(var(--violet))", "rgb(var(--danger))", "rgb(var(--info))", "#64748b", "#0ea5a4", "#eab308"];

export function BarsChart({ data, x, y, unit = "", height = 240, horizontal }: { data: Record<string, unknown>[]; x: string; y: string; unit?: string; height?: number; horizontal?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ left: horizontal ? 8 : -12, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={!horizontal ? false : true} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" {...axis} tickFormatter={(v) => nf.format(v)} />
            <YAxis type="category" dataKey={x} {...axis} width={120} />
          </>
        ) : (
          <>
            <XAxis dataKey={x} {...axis} interval="preserveStartEnd" />
            <YAxis {...axis} tickFormatter={(v) => nf.format(v)} />
          </>
        )}
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgb(var(--surface-2))" }} formatter={(v: number) => [`${nf.format(v)}${unit}`, ""]} />
        <Bar dataKey={y} fill="rgb(var(--brand))" radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LinesChart({ data, x, series, height = 260 }: { data: Record<string, unknown>[]; x: string; series: { key: string; label: string }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: -8, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
        <XAxis dataKey={x} {...axis} />
        <YAxis {...axis} tickFormatter={(v) => nf.format(v)} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [nf.format(v), n]} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={PALETTE[i]} strokeWidth={2.5} dot={false} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, height = 240, money }: { data: { name: string; value: number }[]; height?: number; money?: boolean }) {
  const fmt = (v: number) => (money ? `$${nf.format(v)}` : nf.format(v));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
