"use client"

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useMemo } from "react"
import { TrendingUp } from "lucide-react"
import { useTheme } from "next-themes"   // Make sure you have next-themes installed

interface Transaction {
  id: number
  amount: number | string
  timestamp: string
  transaction_type?: string
  category?: string
}

interface Props {
  transactions?: Transaction[]
}

export function BalanceChart({ transactions = [] }: Props) {
  const { theme, resolvedTheme } = useTheme()
  const currentTheme = resolvedTheme || theme || "dark"

  const isDark = currentTheme === "dark"

  const chartData = useMemo(() => {
    if (!transactions.length) return []

    const monthly = transactions.reduce((acc, tx) => {
      const date = new Date(tx.timestamp)
      const monthKey = date.toLocaleString("default", { month: "short" })

      if (!acc[monthKey]) {
        acc[monthKey] = { name: monthKey, income: 0, expenses: 0 }
      }

      const amount = Number(tx.amount) || 0

      if (amount > 0) {
        acc[monthKey].income += amount
      } else {
        acc[monthKey].expenses += Math.abs(amount)
      }

      return acc
    }, {} as Record<string, { name: string; income: number; expenses: number }>)

    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    return Object.values(monthly)
      .sort((a, b) => monthOrder.indexOf(a.name) - monthOrder.indexOf(b.name))
      .slice(-6)
  }, [transactions])

  // Theme-aware colors
  const textColor = isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.75)"
  const mutedTextColor = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)"
  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"

  const tooltipBg = isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.95)"
  const tooltipBorder = isDark ? "rgba(148, 163, 184, 0.2)" : "rgba(148, 163, 184, 0.3)"

  if (chartData.length === 0) {
    return (
      <div className="h-[280px] flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/5 dark:bg-white/5 flex items-center justify-center mb-4">
          <TrendingUp className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">No transaction data yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Your spending overview will appear here</p>
      </div>
    )
  }

  return (
    <div className="relative h-[300px] w-full pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
        >
          <defs>
            {/* Income Gradient */}
            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.05} />
            </linearGradient>

            {/* Expenses Gradient */}
            <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0.05} />
            </linearGradient>
          </defs>

          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke={gridColor}
            vertical={false}
          />

          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ 
              fill: textColor, 
              fontSize: 12,
              fontWeight: 500 
            }}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ 
              fill: textColor, 
              fontSize: 12 
            }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: tooltipBg,
              border: `1px solid ${tooltipBorder}`,
              borderRadius: "14px",
              backdropFilter: "blur(12px)",
              boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.3)",
              color: isDark ? "#e2e8f0" : "#0f172a"
            }}
            labelStyle={{ 
              color: isDark ? "#e2e8f0" : "#0f172a", 
              fontWeight: 600,
              marginBottom: "4px" 
            }}
            formatter={(value: number, name: string) => [
              new Intl.NumberFormat("en-KE", {
                style: "currency",
                currency: "KES",
                minimumFractionDigits: 0,
              }).format(value),
              name === "income" ? "Income" : "Expenses"
            ]}
          />

          <Area
            type="natural"
            dataKey="income"
            stroke="#22d3ee"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorIncome)"
            name="Income"
          />
          <Area
            type="natural"
            dataKey="expenses"
            stroke="#a855f7"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorExpenses)"
            name="Expenses"
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend - Also theme aware */}
      <div className="flex justify-center gap-8 mt-6">
        <div className="flex items-center gap-2.5">
          <div className="w-3.5 h-3.5 rounded-full bg-[#22d3ee] shadow-[0_0_8px_#22d3ee]"></div>
          <span className="text-sm font-medium text-foreground">Income</span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-3.5 h-3.5 rounded-full bg-[#a855f7] shadow-[0_0_8px_#a855f7]"></div>
          <span className="text-sm font-medium text-foreground">Expenses</span>
        </div>
      </div>
    </div>
  )
}