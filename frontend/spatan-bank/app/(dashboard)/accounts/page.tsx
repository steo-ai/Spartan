"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Eye,
  EyeOff,
  Plus,
  TrendingUp,
  Wallet,
  Loader2,
  Copy,
  Check,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { LiquidGlassCard, LiquidGlassButton } from "@/components/spartan/liquid-glass-card"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "@/hooks/use-toast"

// Import the QuickActionModal
import { QuickActionModal } from "@/components/spartan/quick-action-modal"

interface Account {
  id: number
  account_type: string
  account_number: string
  balance: number
  is_active: boolean
  created_at?: string
}

interface Transaction {
  id: number
  amount: number
  description?: string
  timestamp: string
  transaction_type?: string
}

export default function AccountsPage() {
  const { refreshData } = useAuth()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactionsMap, setTransactionsMap] = useState<Record<number, Transaction[]>>({})
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState(Date.now())

  const [showBalances, setShowBalances] = useState(true)
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  // Quick Action Modal state
  const [activeModal, setActiveModal] = useState<"deposit" | "withdraw" | null>(null)
  const [modalAccountId, setModalAccountId] = useState<number | null>(null)

  // Memoized load function
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const accRes = await api.accounts.getAccounts()

      let processedAccounts: Account[] = []

      if (Array.isArray(accRes)) {
        processedAccounts = accRes
      } else if (accRes?.results && Array.isArray(accRes.results)) {
        processedAccounts = accRes.results
      } else if (accRes?.data && Array.isArray(accRes.data)) {
        processedAccounts = accRes.data
      }

      console.log("[AccountsPage] Loaded accounts:", processedAccounts.length)

      setAccounts(processedAccounts)

      if (processedAccounts.length === 0) {
        setTransactionsMap({})
        return
      }

      // Load recent transactions for each account
      const txPromises = processedAccounts.map(async (acc) => {
        try {
          const data = await api.accounts.getMiniStatement?.(acc.id, 30, 5)
          const txs = data?.transactions ?? data?.results ?? data ?? []
          return { accountId: acc.id, transactions: txs }
        } catch (err) {
          console.warn(`Mini-statement failed for account ${acc.id}:`, err)
          return { accountId: acc.id, transactions: [] }
        }
      })

      const txResults = await Promise.all(txPromises)
      const newMap: Record<number, Transaction[]> = {}
      txResults.forEach(({ accountId, transactions }) => {
        newMap[accountId] = transactions
      })

      setTransactionsMap(newMap)
    } catch (err: any) {
      console.error("[AccountsPage] Load failed:", err)
      const msg = err.message || "Failed to load accounts"
      setError(msg)
      toast({
        variant: "destructive",
        title: "Loading Error",
        description: msg,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData, lastRefresh])

  const handleOpenNewAccount = async (accountType: "savings" | "checking" | "loan" = "savings") => {
    setCreating(true)
    try {
      await api.accounts.openAccount({ account_type: accountType })

      toast({
        title: "Account Created",
        description: `Your ${accountType} account has been opened successfully.`,
      })

      await new Promise((resolve) => setTimeout(resolve, 800))
      await loadData()
      if (refreshData) await refreshData()
      setTimeout(() => setLastRefresh(Date.now()), 2000)
    } catch (err: any) {
      const msg = err.message || "Could not create account"
      toast({
        variant: "destructive",
        title: "Failed to create account",
        description: msg,
      })
    } finally {
      setCreating(false)
    }
  }

  const copyAccountNumber = async (accountId: number, accountNumber: string) => {
    try {
      await navigator.clipboard.writeText(accountNumber)
      setCopiedId(accountId)
      setTimeout(() => setCopiedId(null), 2200)
      toast({ description: "Account number copied to clipboard" })
    } catch (err) {
      console.error("Clipboard copy failed:", err)
    }
  }

  // Open Quick Action Modal for Deposit or Withdraw
  const openQuickAction = (type: "deposit" | "withdraw", accountId: number) => {
    setModalAccountId(accountId)
    setActiveModal(type)
  }

  const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance || 0), 0)

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
    }).format(amount)

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—"
    return new Date(dateString).toLocaleDateString("en-KE", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-spartan-cyan" />
          <p className="text-lg text-muted-foreground">Loading your accounts...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <LiquidGlassCard className="p-8 text-center max-w-lg mx-auto">
          <p className="text-red-400 text-xl mb-4">Something went wrong</p>
          <p className="text-foreground mb-6">{error}</p>
          <LiquidGlassButton onClick={loadData}>Try Again</LiquidGlassButton>
        </LiquidGlassCard>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Accounts</h1>
          <p className="text-muted-foreground">Manage all your Spartan Bank accounts</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBalances(!showBalances)}
            className="p-2.5 hover:bg-white/10 rounded-lg transition-colors"
            aria-label={showBalances ? "Hide balances" : "Show balances"}
          >
            {showBalances ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
          </button>

          <LiquidGlassButton
            variant="primary"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => handleOpenNewAccount("savings")}
            disabled={creating}
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Open Savings
          </LiquidGlassButton>
        </div>
      </div>

      {/* Total Balance Card */}
      {accounts.length > 0 && (
        <LiquidGlassCard variant="cyan" glow className="relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-1">
            <div>
              <p className="text-sm text-foreground/80">Total Balance</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mt-1">
                {showBalances ? formatCurrency(totalBalance) : "KES ****"}
              </h2>
            </div>
          </div>
        </LiquidGlassCard>
      )}

      {/* Accounts Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {accounts.length === 0 ? (
          <LiquidGlassCard className="p-10 text-center col-span-full">
            <Wallet className="h-14 w-14 mx-auto mb-5 text-muted-foreground opacity-80" />
            <h3 className="text-xl font-medium mb-3">No accounts yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Open your first account to start managing your finances with Spartan Bank.
            </p>
            <LiquidGlassButton
              variant="primary"
              className="flex items-center gap-2 mx-auto"
              onClick={() => handleOpenNewAccount("savings")}
              disabled={creating}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Open First Account
            </LiquidGlassButton>
          </LiquidGlassCard>
        ) : (
          accounts.map((account) => {
            const recentTx = transactionsMap[account.id] || []

            return (
              <LiquidGlassCard
                key={account.id}
                className={cn(
                  "cursor-pointer transition-all duration-200",
                  selectedAccount === account.id && "ring-2 ring-offset-2 ring-offset-background ring-spartan-cyan scale-[1.02]"
                )}
                hover
                onClick={() => setSelectedAccount(selectedAccount === account.id ? null : account.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                        account.account_type === "savings"
                          ? "bg-green-500/15 text-green-400"
                          : "bg-cyan-500/15 text-cyan-400"
                      )}
                    >
                      {account.account_type === "savings" ? (
                        <TrendingUp className="h-6 w-6" />
                      ) : (
                        <Wallet className="h-6 w-6" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground capitalize">
                        {account.account_type} Account
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-sm text-muted-foreground font-mono">
                          {account.account_number}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            copyAccountNumber(account.id, account.account_number)
                          }}
                          className="p-1 hover:bg-white/10 rounded transition-colors"
                          aria-label="Copy account number"
                        >
                          {copiedId === account.id ? (
                            <Check className="h-3.5 w-3.5 text-green-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 text-xs rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
                    Active
                  </span>
                </div>

                <div className="mb-5">
                  <p className="text-sm text-muted-foreground">Available Balance</p>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1">
                    {showBalances ? formatCurrency(account.balance) : "KES ****"}
                  </p>
                </div>

                {/* Action Buttons - Connected to QuickActionModal */}
                <div className="flex gap-3 mb-5">
                  <LiquidGlassButton 
                    variant="secondary" 
                    size="sm" 
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      openQuickAction("deposit", account.id)
                    }}
                  >
                    Deposit
                  </LiquidGlassButton>
                  <LiquidGlassButton 
                    variant="secondary" 
                    size="sm" 
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      openQuickAction("withdraw", account.id)
                    }}
                  >
                    Withdraw
                  </LiquidGlassButton>
                </div>

                {selectedAccount === account.id && recentTx.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <h4 className="text-sm font-medium mb-3">Recent Transactions</h4>
                    <div className="space-y-2.5">
                      {recentTx.slice(0, 3).map((tx) => (
                        <div key={tx.id} className="flex justify-between items-center text-sm">
                          <div className="flex-1 pr-3 truncate">
                            <span className="font-medium">
                              {tx.description || tx.transaction_type || "Transaction"}
                            </span>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDate(tx.timestamp)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "font-medium whitespace-nowrap",
                              tx.amount > 0 ? "text-green-400" : "text-red-400"
                            )}
                          >
                            {tx.amount > 0 ? "+" : "-"} {formatCurrency(Math.abs(tx.amount))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </LiquidGlassCard>
            )
          })
        )}

        {/* "Add new account" card */}
        <LiquidGlassCard
          className={cn(
            "border-dashed border-2 border-white/20 flex flex-col items-center justify-center min-h-[220px] cursor-pointer hover:border-spartan-cyan hover:bg-white/5 transition-all",
            creating && "opacity-70 cursor-wait"
          )}
          hover={!creating}
          onClick={() => !creating && handleOpenNewAccount("savings")}
        >
          <div className="text-center">
            {creating ? (
              <Loader2 className="h-12 w-12 animate-spin text-spartan-cyan mx-auto mb-4" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 mx-auto border border-white/10">
                <Plus className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <p className="font-medium text-foreground">Open New Account</p>
            <p className="text-sm text-muted-foreground mt-1.5">Savings, Checking or Loan</p>
          </div>
        </LiquidGlassCard>
      </div>

      {/* Quick Action Modal */}
      {activeModal && modalAccountId && (
        <QuickActionModal
          isOpen={!!activeModal}
          onClose={() => {
            setActiveModal(null)
            setModalAccountId(null)
          }}
          actionType={activeModal}
          onSuccess={() => {
            loadData()           // Refresh accounts & balances
            if (refreshData) refreshData()
          }}
        />
      )}
    </div>
  )
}