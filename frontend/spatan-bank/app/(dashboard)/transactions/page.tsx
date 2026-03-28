"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Search,
  Filter,
  Download,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { LiquidGlassCard, LiquidGlassButton, LiquidGlassInput, LiquidGlassSelect } from "@/components/spartan/liquid-glass-card"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "@/hooks/use-toast"

// Filter options
const transactionTypes = [
  { value: "", label: "All Types" },
  { value: "deposit", label: "Deposits" },
  { value: "withdraw", label: "Withdrawals" },
  { value: "transfer_in", label: "Transfers In" },
  { value: "transfer_out", label: "Transfers Out" },
]

const categories = [
  { value: "", label: "All Categories" },
  { value: "salary", label: "Salary" },
  { value: "transfer", label: "Transfer" },
  { value: "utilities", label: "Utilities" },
  { value: "groceries", label: "Groceries" },
  { value: "loan", label: "Loan" },
  { value: "interest", label: "Interest" },
]

export default function TransactionsPage() {
  const { user } = useAuth()

  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const itemsPerPage = 10

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  const fetchTransactions = async () => {
    if (!user) {
      setError("Please log in to view transactions")
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const params: any = {
        page: currentPage,
        page_size: itemsPerPage,
      }

      if (searchQuery.trim()) params.search = searchQuery.trim()
      if (selectedType) params.type = selectedType
      if (selectedCategory) params.cat = selectedCategory

      const response = await api.transactions.getTransactions(params)

      // Handle both paginated {results, count} and direct array responses
      const txData = Array.isArray(response) ? response : (response?.results || [])
      const count = Array.isArray(response) ? response.length : (response?.count || txData.length)

      // Sanitize data - convert strings to numbers (fixes NaN)
      const sanitized = txData.map((tx: any) => ({
        ...tx,
        amount: Number(tx.amount) || 0,
        balance_after: Number(tx.balance_after) || 0,
      }))

      setTransactions(sanitized)
      setTotalCount(count)
    } catch (err: any) {
      console.error("[Transactions] Fetch failed:", err)
      setError(err.message || "Could not load transactions. Please try again.")
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  // Fetch when filters or page changes
  useEffect(() => {
    fetchTransactions()
  }, [currentPage, searchQuery, selectedType, selectedCategory, user])

  const totalPages = Math.ceil(totalCount / itemsPerPage)

  const clearFilters = () => {
    setSearchQuery("")
    setSelectedType("")
    setSelectedCategory("")
    setCurrentPage(1)
  }

  const hasActiveFilters = searchQuery || selectedType || selectedCategory

  // Summary calculations (Fixed)
  const totalIncome = useMemo(() => 
    transactions.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0), 
  [transactions])

  const totalExpenses = useMemo(() => 
    transactions.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0), 
  [transactions])

  const net = totalIncome - totalExpenses

  const getTransactionIcon = (type: string, amount: number) => {
    if (type?.includes("transfer")) return <ArrowLeftRight className="h-5 w-5" />
    if (amount > 0) return <ArrowDownLeft className="h-5 w-5" />
    return <ArrowUpRight className="h-5 w-5" />
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
    }).format(amount)

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-KE", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    })

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString("en-KE", {
      hour: "2-digit",
      minute: "2-digit",
    })

  // Export CSV - Working
  const exportCSV = () => {
    if (transactions.length === 0) {
      toast({ variant: "destructive", description: "No transactions to export" })
      return
    }

    const headers = ["Date", "Type", "Description", "Amount (KES)", "Balance After"]
    const rows = transactions.map(tx => [
      new Date(tx.timestamp).toLocaleString(),
      tx.transaction_type || "-",
      tx.description || "-",
      tx.amount,
      tx.balance_after
    ])

    let csvContent = headers.join(",") + "\n"
    rows.forEach(row => {
      csvContent += row.map(field => `"${field}"`).join(",") + "\n"
    })

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.href = url
    link.download = `transactions_${new Date().toISOString().slice(0,10)}.csv`
    link.click()
    URL.revokeObjectURL(url)

    toast({ title: "✅ Exported", description: "CSV downloaded successfully" })
  }

  // Export PDF - Placeholder (backend ready)
  const exportPDF = () => {
    toast({
      variant: "destructive",
      description: "PDF export coming soon. Backend already supports it per account."
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
          <p className="text-muted-foreground">View and manage your transaction history</p>
        </div>
        <div className="flex items-center gap-3">
          <LiquidGlassButton variant="secondary" onClick={exportCSV} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            CSV
          </LiquidGlassButton>
          <LiquidGlassButton variant="secondary" onClick={exportPDF} className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            PDF
          </LiquidGlassButton>
        </div>
      </div>

      {/* Summary Cards - Small & Responsive */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  
  {/* Transactions Shown */}
  <LiquidGlassCard className="p-4 flex flex-col min-h-[100px]">
    <p className="text-xs text-muted-foreground">Transactions Shown</p>
    <p className="mt-auto text-2xl sm:text-3xl font-medium text-foreground tracking-tight number-fit">
      {transactions.length}
    </p>
  </LiquidGlassCard>

  {/* Income */}
  <LiquidGlassCard className="p-4 flex flex-col min-h-[100px]">
    <p className="text-xs text-muted-foreground">Income (this page)</p>
    <p className="mt-auto text-2xl sm:text-3xl font-medium text-spartan-success tracking-tight number-fit">
      {formatCurrency(totalIncome)}
    </p>
  </LiquidGlassCard>

  {/* Expenses */}
  <LiquidGlassCard className="p-4 flex flex-col min-h-[100px]">
    <p className="text-xs text-muted-foreground">Expenses (this page)</p>
    <p className="mt-auto text-2xl sm:text-3xl font-medium text-spartan-error tracking-tight number-fit">
      {formatCurrency(totalExpenses)}
    </p>
  </LiquidGlassCard>

  {/* Net */}
  <LiquidGlassCard className="p-4 flex flex-col min-h-[100px]">
    <p className="text-xs text-muted-foreground">Net (this page)</p>
    <p className={cn(
      "mt-auto text-2xl sm:text-3xl font-medium tracking-tight number-fit",
      net >= 0 ? "text-spartan-success" : "text-spartan-error"
    )}>
      {formatCurrency(net)}
    </p>
  </LiquidGlassCard>
</div>

      {/* Filters */}
      <LiquidGlassCard className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <LiquidGlassInput
              placeholder="Search description or reference..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-12"
            />
          </div>

          <LiquidGlassButton
            variant="secondary"
            onClick={() => setShowFilters(!showFilters)}
            className={cn("flex items-center gap-2", showFilters && "bg-spartan-cyan/20")}
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-spartan-cyan rounded-full">
                {[selectedType, selectedCategory].filter(Boolean).length}
              </span>
            )}
          </LiquidGlassButton>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="grid md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Type</label>
                <LiquidGlassSelect
                  value={selectedType}
                  onChange={(v) => {
                    setSelectedType(v)
                    setCurrentPage(1)
                  }}
                  options={transactionTypes}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Category</label>
                <LiquidGlassSelect
                  value={selectedCategory}
                  onChange={(v) => {
                    setSelectedCategory(v)
                    setCurrentPage(1)
                  }}
                  options={categories}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Date Range</label>
                <LiquidGlassButton variant="secondary" className="w-full flex items-center justify-center gap-2" disabled>
                  <Calendar className="h-4 w-4" />
                  Select Dates (coming soon)
                </LiquidGlassButton>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="text-sm text-spartan-cyan hover:underline flex items-center gap-1"
                >
                  <X className="h-4 w-4" />
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </LiquidGlassCard>

      {/* Transactions Table */}
      <LiquidGlassCard className="overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-muted-foreground">
            Loading your transactions...
          </div>
        ) : error ? (
          <div className="py-12 text-center text-spartan-error">
            {error}
            <LiquidGlassButton
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={fetchTransactions}
            >
              Try Again
            </LiquidGlassButton>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            No transactions found
            {hasActiveFilters && (
              <div className="mt-3">
                <button onClick={clearFilters} className="text-sm text-spartan-cyan hover:underline">
                  Clear filters
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Header */}
            <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-4 border-b border-white/10 text-sm font-medium text-muted-foreground">
              <div className="col-span-4">Description</div>
              <div className="col-span-2">Date & Time</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-2 text-right">Balance After</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-white/5">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-4 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <div className="col-span-4 flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      tx.amount > 0 ? "bg-spartan-success/20 text-spartan-success" : "bg-spartan-error/20 text-spartan-error"
                    )}>
                      {getTransactionIcon(tx.transaction_type, tx.amount)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{tx.description || "—"}</p>
                      {tx.reference && (
                        <p className="text-xs text-muted-foreground/80">Ref: {tx.reference}</p>
                      )}
                    </div>
                  </div>

                  <div className="hidden md:flex col-span-2 flex-col justify-center">
                    <p className="text-sm text-foreground">{formatDate(tx.timestamp)}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(tx.timestamp)}</p>
                  </div>

                  <div className="hidden md:flex col-span-2 items-center">
                    <span className="px-2 py-1 text-xs rounded-full bg-white/5 text-muted-foreground capitalize">
                      {tx.category_display || tx.category || "—"}
                    </span>
                  </div>

                  <div className="col-span-2 flex items-center justify-end">
                    <p className={cn("font-semibold", tx.amount > 0 ? "text-spartan-success" : "text-foreground")}>
                      {tx.amount > 0 ? "+" : ""}{formatCurrency(tx.amount)}
                    </p>
                  </div>

                  <div className="hidden md:flex col-span-2 items-center justify-end">
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(tx.balance_after)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
                <p>
                  Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount}
                </p>
                <div className="flex items-center gap-2">
                  <LiquidGlassButton
                    variant="secondary"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </LiquidGlassButton>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        "w-8 h-8 rounded-lg text-sm font-medium transition-colors",
                        currentPage === page ? "bg-spartan-cyan text-white" : "hover:bg-white/10 text-muted-foreground"
                      )}
                    >
                      {page}
                    </button>
                  ))}

                  <LiquidGlassButton
                    variant="secondary"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </LiquidGlassButton>
                </div>
              </div>
            )}
          </>
        )}
      </LiquidGlassCard>
    </div>
  )
}