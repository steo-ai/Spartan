"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Eye,
  EyeOff,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Receipt,
  Phone,
  CreditCard,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Download,
  RefreshCw,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { LiquidGlassCard, LiquidGlassButton } from "@/components/spartan/liquid-glass-card"
import { cn } from "@/lib/utils"
import { BalanceChart } from "@/components/spartan/balance-chart"
import { VirtualCardPreview } from "@/components/spartan/virtual-card-preview"
import { QuickActionModal } from "@/components/spartan/quick-action-modal"
import api from "@/lib/api"
import { toast } from "@/hooks/use-toast"

// Types (aligned with your backend response shapes)
interface Account {
  id: number
  account_type: string
  account_number: string
  balance: number
  is_active: boolean
  currency?: string
}

interface Transaction {
  id: number
  amount: number
  description?: string
  timestamp: string
  transaction_type?: string
  category?: string
}

interface Card {
  id: number
  masked_number?: string
  expiry_date?: string
  status?: string
  card_type?: string
}

const quickActions = [
  { id: "deposit", label: "Deposit", icon: ArrowDownLeft, color: "text-spartan-success" },
  { id: "withdraw", label: "Withdraw", icon: ArrowUpRight, color: "text-spartan-warning" },
  { id: "transfer", label: "Transfer", icon: ArrowLeftRight, color: "text-spartan-cyan" },
  { id: "bills", label: "Pay Bill", icon: Receipt, color: "text-spartan-purple" },
  { id: "airtime", label: "Airtime", icon: Phone, color: "text-spartan-gold" },
  { id: "cards", label: "Cards", icon: CreditCard, color: "text-spartan-cyan" },
]

export default function DashboardPage() {
  const { user } = useAuth()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState(Date.now())

  const [showBalance, setShowBalance] = useState(true)
  const [activeModal, setActiveModal] = useState<string | null>(null)

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [accRes, txRes, cardRes] = await Promise.all([
        api.accounts.getAccounts().catch(() => ({ results: [] })),
        api.transactions.getTransactions({ page_size: 100 }).catch(() => ({ results: [], count: 0 })),
        api.cards?.list?.()?.catch(() => ({ results: [] })),
      ])

      const accData = Array.isArray(accRes) ? accRes : accRes?.results || accRes?.data || []
      const txData = Array.isArray(txRes) ? txRes : txRes?.results || []
      const cardData = Array.isArray(cardRes) ? cardRes : cardRes?.results || []

      setAccounts(accData)
      setTransactions(txData)
      setCards(cardData)
    } catch (err: any) {
      console.error("Dashboard load failed:", err)
      setError(
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to load dashboard. Please try again."
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [lastRefresh])

  const handleModalClose = (success?: boolean) => {
    setActiveModal(null)
    if (success) {
      setLastRefresh(Date.now())
      toast({
        title: "Success",
        description: "Action completed. Dashboard updated.",
      })
    }
  }

  const totalBalance = accounts.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0)

  const recentTransactions = transactions.slice(0, 5)

  // ====================== REAL STATS CALCULATION ======================
  const stats = transactions.reduce(
    (acc, tx) => {
      const amount = Number(tx.amount) || 0
      const type = (tx.transaction_type || "").toLowerCase()
      const cat = (tx.category || "").toLowerCase()

      if (amount > 0) {
        acc.income += amount
      } else {
        acc.expenses += Math.abs(amount)
      }

      if (type.includes("transfer") || type.includes("transfer_out") || type.includes("transfer_in")) {
        acc.transfers += Math.abs(amount)
      }

      if (
        cat.includes("bill") ||
        cat.includes("utility") ||
        cat.includes("airtime") ||
        cat.includes("groceries") ||
        type.includes("bill") ||
        type.includes("airtime") ||
        type.includes("fee")
      ) {
        acc.bills += Math.abs(amount)
      }

      return acc
    },
    { income: 0, expenses: 0, transfers: 0, bills: 0 }
  )

  const formatCurrency = (amount: number | string = 0) => {
    const num = Number(amount)
    if (isNaN(num)) return "KES 0.00"
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
    }).format(num)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—"
    return new Date(dateString).toLocaleString("en-KE", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-spartan-cyan mx-auto mb-4"></div>
          <p className="text-lg text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <LiquidGlassCard className="p-8 text-center max-w-lg mx-auto">
          <p className="text-red-400 text-xl mb-4">Something went wrong</p>
          <p className="text-foreground mb-6">{error}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <LiquidGlassButton onClick={() => setLastRefresh(Date.now())}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </LiquidGlassButton>
            <LiquidGlassButton variant="secondary" asChild>
              <Link href="/login">Back to Login</Link>
            </LiquidGlassButton>
          </div>
        </LiquidGlassCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Total Balance Card */}
      <LiquidGlassCard className="relative overflow-hidden" variant="cyan" glow>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-foreground/70">Total Balance</p>
            <button
              onClick={() => setShowBalance(!showBalance)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              {showBalance ? <EyeOff className="h-5 w-5 text-foreground/70" /> : <Eye className="h-5 w-5 text-foreground/70" />}
            </button>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-1">
            {showBalance ? formatCurrency(totalBalance) : "KES ****"}
          </h2>
        </div>
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-spartan-cyan/20 rounded-full blur-2xl" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-spartan-purple/20 rounded-full blur-2xl" />
      </LiquidGlassCard>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {quickActions.map((action) => (
          <LiquidGlassCard
            key={action.id}
            className="p-4 text-center cursor-pointer"
            hover
            onClick={() => setActiveModal(action.id)}
          >
            <div className={cn("mx-auto w-12 h-12 rounded-xl flex items-center justify-center mb-2 bg-white/5", action.color)}>
              <action.icon className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-foreground">{action.label}</p>
          </LiquidGlassCard>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Accounts */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">My Accounts</h3>
            <Link href="/accounts" className="text-sm text-spartan-cyan hover:underline flex items-center gap-1">
              View all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {accounts.length === 0 ? (
            <LiquidGlassCard className="p-6 text-center">
              <p className="text-muted-foreground">No accounts found</p>
              <LiquidGlassButton variant="secondary" className="mt-4" asChild>
                <Link href="/accounts">Open an Account</Link>
              </LiquidGlassButton>
            </LiquidGlassCard>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <LiquidGlassCard key={account.id} className="p-4" hover>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          account.account_type === "savings"
                            ? "bg-spartan-success/20 text-spartan-success"
                            : "bg-spartan-cyan/20 text-spartan-cyan"
                        )}
                      >
                        {account.account_type === "savings" ? (
                          <TrendingUp className="h-5 w-5" />
                        ) : (
                          <CreditCard className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground capitalize">{account.account_type} Account</p>
                        <p className="text-sm text-muted-foreground">
                          {account.account_number ? `****${account.account_number.slice(-4)}` : "••••••••"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">
                        {showBalance ? formatCurrency(account.balance) : "****"}
                      </p>
                      <p className="text-xs text-muted-foreground">{account.currency ?? "KES"}</p>
                    </div>
                  </div>
                </LiquidGlassCard>
              ))}
            </div>
          )}
        </div>

        {/* Spending Chart */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Spending Overview</h3>
          <LiquidGlassCard className="p-4">
            <BalanceChart transactions={transactions} />
          </LiquidGlassCard>
        </div>
      </div>

      {/* Recent Transactions & Virtual Card */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Recent Transactions</h3>
            <Link href="/transactions" className="text-sm text-spartan-cyan hover:underline flex items-center gap-1">
              View all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {recentTransactions.length === 0 ? (
            <LiquidGlassCard className="p-6 text-center">
              <p className="text-muted-foreground">No recent transactions yet</p>
            </LiquidGlassCard>
          ) : (
            <LiquidGlassCard className="divide-y divide-white/5">
              {recentTransactions.map((tx) => (
                <div key={tx.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        tx.amount > 0 ? "bg-spartan-success/20 text-spartan-success" : "bg-spartan-error/20 text-spartan-error"
                      )}
                    >
                      {tx.amount > 0 ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{tx.description || tx.transaction_type || "Transaction"}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.timestamp)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("font-semibold", tx.amount > 0 ? "text-spartan-success" : "text-spartan-error")}>
                      {tx.amount > 0 ? "+" : ""}{formatCurrency(Math.abs(tx.amount))}
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground capitalize">
                      {tx.category || tx.transaction_type?.replace("_", " ") || "—"}
                    </span>
                  </div>
                </div>
              ))}
            </LiquidGlassCard>
          )}

          <div className="flex gap-3">
            <LiquidGlassButton variant="secondary" className="flex items-center gap-2 flex-1">
              <Download className="h-4 w-4" />
              Export CSV
            </LiquidGlassButton>
            <LiquidGlassButton variant="secondary" className="flex items-center gap-2 flex-1">
              <Download className="h-4 w-4" />
              Export PDF
            </LiquidGlassButton>
          </div>
        </div>

        {/* Virtual Card Preview */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">My Card</h3>
          {cards.length > 0 ? (
            <VirtualCardPreview card={cards[0]} />
          ) : (
            <LiquidGlassCard className="p-6 text-center">
              <p className="text-muted-foreground">No virtual card yet</p>
              <LiquidGlassButton variant="secondary" className="mt-4" asChild>
                <Link href="/cards">Generate Virtual Card</Link>
              </LiquidGlassButton>
            </LiquidGlassCard>
          )}
          <Link href="/cards">
            <LiquidGlassButton variant="secondary" className="w-full">
              Manage Cards
            </LiquidGlassButton>
          </Link>
        </div>
      </div>

      {/* Quick Stats - NOW WITH REAL DATA */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <LiquidGlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-spartan-success/20 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-spartan-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Income</p>
              <p className="font-semibold text-spartan-success">
                {formatCurrency(stats.income)}
              </p>
            </div>
          </div>
        </LiquidGlassCard>

        <LiquidGlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-spartan-error/20 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-spartan-error" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expenses</p>
              <p className="font-semibold text-spartan-error">
                {formatCurrency(stats.expenses)}
              </p>
            </div>
          </div>
        </LiquidGlassCard>

        <LiquidGlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-spartan-cyan/20 flex items-center justify-center">
              <ArrowLeftRight className="h-5 w-5 text-spartan-cyan" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Transfers</p>
              <p className="font-semibold text-foreground">
                {formatCurrency(stats.transfers)}
              </p>
            </div>
          </div>
        </LiquidGlassCard>

        <LiquidGlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-spartan-purple/20 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-spartan-purple" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bills Paid</p>
              <p className="font-semibold text-foreground">
                {formatCurrency(stats.bills)}
              </p>
            </div>
          </div>
        </LiquidGlassCard>
      </div>

        <QuickActionModal
          isOpen={!!activeModal}
          onClose={() => setActiveModal(null)}
          actionType={activeModal || ""}
          onSuccess={() => {
            setLastRefresh(Date.now())
          }}
        />
    </div>
  )
}