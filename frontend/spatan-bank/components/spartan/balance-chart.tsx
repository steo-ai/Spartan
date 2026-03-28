"use client"

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

const data = [
  { name: "Jan", income: 85000, expenses: 45000 },
  { name: "Feb", income: 92000, expenses: 52000 },
  { name: "Mar", income: 78000, expenses: 48000 },
  { name: "Apr", income: 105000, expenses: 55000 },
  { name: "May", income: 115000, expenses: 62000 },
  { name: "Jun", income: 150000, expenses: 45000 },
]

export function BalanceChart() {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="oklch(0.75 0.15 200)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="oklch(0.75 0.15 200)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="oklch(0.65 0.25 280)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="oklch(0.65 0.25 280)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
            tickFormatter={(value) => `${value / 1000}K`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(20, 30, 50, 0.9)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              backdropFilter: "blur(10px)",
            }}
            labelStyle={{ color: "rgba(255,255,255,0.7)" }}
            formatter={(value: number) =>
              new Intl.NumberFormat("en-KE", {
                style: "currency",
                currency: "KES",
              }).format(value)
            }
          />
          <Area
            type="monotone"
            dataKey="income"
            stroke="oklch(0.75 0.15 200)"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorIncome)"
            name="Income"
          />
          <Area
            type="monotone"
            dataKey="expenses"
            stroke="oklch(0.65 0.25 280)"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorExpenses)"
            name="Expenses"
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-spartan-cyan" />
          <span className="text-xs text-muted-foreground">Income</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-spartan-purple" />
          <span className="text-xs text-muted-foreground">Expenses</span>
        </div>
      </div>
    </div>
  )
}
