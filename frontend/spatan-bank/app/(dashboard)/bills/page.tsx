"use client"

import { useState, useEffect } from "react"
import {
  Zap,
  Droplets,
  Wifi,
  Tv,
  Phone,
  GraduationCap,
  Building,
  ShoppingBag,
  Check,
  Loader2,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { LiquidGlassCard, LiquidGlassButton, LiquidGlassInput, LiquidGlassSelect } from "@/components/spartan/liquid-glass-card"
import { cn } from "@/lib/utils"
import { billsApi } from "@/lib/api"
import { format } from "date-fns"

type TabType = "bills" | "airtime"

interface BillCategory {
  id: number
  name: string
  slug: string
  paybill_number: string
  account_number_label: string
  min_amount: string
  max_amount: string
  icon_class?: string
  is_active: boolean
}

interface AirtimeProvider {
  id: number
  name: string
  short_name: string
  default_paybill: string
}

interface DataBundle {
  id: number
  provider: number
  provider_name: string
  name: string
  code?: string
  amount: string
  data_amount: string
  validity_days: number
  is_popular: boolean
}

const iconMap: Record<string, any> = {
  electricity: Zap,
  water: Droplets,
  internet: Wifi,
  tv: Tv,
  airtime: Phone,
  education: GraduationCap,
  rent: Building,
  shopping: ShoppingBag,
}

export default function BillsPage() {
  const { accounts } = useAuth()

  const [activeTab, setActiveTab] = useState<TabType>("bills")
  const [selectedBillCategoryId, setSelectedBillCategoryId] = useState<number | null>(null)
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null)
  const [selectedBundleId, setSelectedBundleId] = useState<number | null>(null)
  const [buyType, setBuyType] = useState<"airtime" | "bundle">("airtime")

  const [isProcessing, setIsProcessing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [newBalance, setNewBalance] = useState<string>("")

  const [formData, setFormData] = useState({
    accountId: "",
    accountNumber: "",
    amount: "",
    phoneNumber: "",
    description: "",
  })

  // API Data
  const [categories, setCategories] = useState<BillCategory[]>([])
  const [providers, setProviders] = useState<AirtimeProvider[]>([])
  const [bundles, setBundles] = useState<DataBundle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Sidebar Real Data
  const [monthlyStats, setMonthlyStats] = useState({
    totalSpent: 0,
    billsPaid: 0,
  })
  const [recentActivity, setRecentActivity] = useState<any[]>([])

  // Load initial data
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError(null)
      try {
        const [cats, provs] = await Promise.all([
          billsApi.getCategories(),
          billsApi.getProviders(),
        ])
        setCategories(cats || [])
        setProviders(provs || [])

        if (provs?.length > 0) {
          setSelectedProviderId(provs[0].id)
        }

        await loadSidebarData()
      } catch (err: any) {
        console.error("Failed to load bill data:", err)
        setError(err.message || "Failed to load bill data")
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Refresh sidebar after successful transaction
  useEffect(() => {
    if (isSuccess) {
      loadSidebarData()
      const timer = setTimeout(() => setIsSuccess(false), 4000)
      return () => clearTimeout(timer)
    }
  }, [isSuccess])

  // Load bundles
  useEffect(() => {
    if (activeTab !== "airtime" || !selectedProviderId) {
      setBundles([])
      return
    }

    async function fetchBundles() {
      try {
        const data = await billsApi.getBundles(selectedProviderId!)
        setBundles(data || [])
        setSelectedBundleId(null)
        setFormData(prev => ({ ...prev, amount: "" }))
      } catch (err: any) {
        console.error("Failed to load bundles:", err)
      }
    }
    fetchBundles()
  }, [selectedProviderId, activeTab])

  // Real Backend Sidebar Data
  const loadSidebarData = async () => {
    try {
      const [statsRes, recentRes] = await Promise.all([
        billsApi.getStats().catch(() => ({ total_spent: 0, bills_paid: 0 })),
        billsApi.getRecentActivity().catch(() => []),
      ])

      setMonthlyStats({
        totalSpent: Number(statsRes.total_spent || 0),
        billsPaid: Number(statsRes.bills_paid || 0),
      })

      const formattedRecent = (recentRes || []).map((item: any, index: number) => ({
        id: item.id || `temp-${index}`, // fallback for safety
        description: item.description || "Bill / Airtime Payment",
        amount: Number(item.amount || 0),
        date: format(new Date(item.date || item.completed_at || Date.now()), "yyyy-MM-dd"),
      }))

      setRecentActivity(formattedRecent)
    } catch (err: any) {
      console.error("Failed to load sidebar data:", err)
      setRecentActivity([])
    }
  }

  const accountOptions = accounts.map((acc: any) => ({
    value: acc.id.toString(),
    label: `${acc.account_type?.charAt(0).toUpperCase() + acc.account_type?.slice(1) || "Account"} ••••${acc.account_number?.slice(-4) || ""}`,
  }))

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const formatCurrency = (amount: string | number): string => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(isNaN(num) ? 0 : num)
  }

  const getIconForCategory = (cat: BillCategory) => {
    const key = (cat.slug || cat.icon_class || "").toLowerCase()
    for (const [k, Icon] of Object.entries(iconMap)) {
      if (key.includes(k)) return Icon
    }
    return Phone
  }

  const handlePayBill = async () => {
    if (!formData.accountId || !selectedBillCategoryId || !formData.accountNumber || !formData.amount) return

    setIsProcessing(true)
    setError(null)

    try {
      const payload = {
        user_account: parseInt(formData.accountId),
        category: selectedBillCategoryId,
        paybill_number: "",
        account_number: formData.accountNumber.trim(),
        amount: formData.amount,
        description: formData.description || undefined,
      }

      const response = await billsApi.payBill(payload)

      setSuccessMessage(`Payment of ${formatCurrency(formData.amount)} was successful!`)
      setNewBalance(response.new_balance || "")
      setIsSuccess(true)
    } catch (err: any) {
      setError(err.message || "Payment failed. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBuyAirtime = async () => {
    if (!formData.accountId || !selectedProviderId || !formData.phoneNumber) return
    if (buyType === "bundle" && !selectedBundleId) return
    if (buyType === "airtime" && !formData.amount) return

    setIsProcessing(true)
    setError(null)

    try {
      const payload: any = {
        user_account: parseInt(formData.accountId),
        provider: selectedProviderId,
        phone_number: formData.phoneNumber.trim().replace(/\s/g, ""),
      }

      if (buyType === "bundle" && selectedBundleId) {
        payload.bundle = selectedBundleId
      } else {
        payload.amount = formData.amount
      }

      if (formData.description) payload.description = formData.description

      const response = await billsApi.topupAirtime(payload)

      setSuccessMessage(
        `${buyType === "bundle" ? "Data bundle" : "Airtime"} of ${formatCurrency(formData.amount || "0")} sent successfully to ${formData.phoneNumber}`
      )
      setNewBalance(response.new_balance || "")
      setIsSuccess(true)
    } catch (err: any) {
      setError(err.message || "Top-up failed. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSubmit = () => {
    if (activeTab === "bills") {
      handlePayBill()
    } else {
      handleBuyAirtime()
    }
  }

  const resetForm = () => {
    setFormData({ accountId: "", accountNumber: "", amount: "", phoneNumber: "", description: "" })
    setSelectedBillCategoryId(null)
    setSelectedBundleId(null)
    setIsSuccess(false)
    setError(null)
    setNewBalance("")
  }

  const selectedCategory = categories.find(c => c.id === selectedBillCategoryId)
  const selectedProvider = providers.find(p => p.id === selectedProviderId)
  const selectedBundle = bundles.find(b => b.id === selectedBundleId)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-spartan-cyan" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Bills & Airtime</h1>
        <p className="text-muted-foreground mt-1">Pay bills and top up instantly with Spartan Bank</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 p-1 rounded-2xl bg-white/5 w-fit">
        <button
          onClick={() => { setActiveTab("bills"); resetForm(); }}
          className={cn(
            "px-8 py-3 rounded-xl font-medium transition-all",
            activeTab === "bills" ? "bg-spartan-cyan text-white shadow-lg" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Pay Bills
        </button>
        <button
          onClick={() => { setActiveTab("airtime"); resetForm(); }}
          className={cn(
            "px-8 py-3 rounded-xl font-medium transition-all",
            activeTab === "airtime" ? "bg-spartan-cyan text-white shadow-lg" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Airtime & Data
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Form Area */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === "bills" ? (
            !selectedBillCategoryId ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {categories.filter(c => c.is_active).map((category) => {
                  const Icon = getIconForCategory(category)
                  return (
                    <LiquidGlassCard
                      key={category.id}
                      className="p-6 text-center cursor-pointer hover:scale-105 transition-transform"
                      hover
                      onClick={() => setSelectedBillCategoryId(category.id)}
                    >
                      <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-white/10">
                        <Icon className="h-8 w-8" />
                      </div>
                      <p className="font-semibold text-foreground">{category.name}</p>
                    </LiquidGlassCard>
                  )
                })}
              </div>
            ) : !isSuccess ? (
              <LiquidGlassCard className="p-8" glow>
                <div className="flex items-center gap-5 mb-8">
                  {selectedCategory && (
                    <>
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white/10">
                        {(() => {
                          const Icon = getIconForCategory(selectedCategory)
                          return <Icon className="h-9 w-9" />
                        })()}
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-foreground">{selectedCategory.name}</h3>
                        <p className="text-muted-foreground">Paybill: {selectedCategory.paybill_number || "Auto-filled"}</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium">Pay From</label>
                    <LiquidGlassSelect
                      value={formData.accountId}
                      onChange={(v) => updateField("accountId", v)}
                      options={accountOptions}
                      placeholder="Select your account"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      {selectedCategory?.account_number_label || "Account Number / Meter Number"}
                    </label>
                    <LiquidGlassInput
                      placeholder="Enter number"
                      value={formData.accountNumber}
                      onChange={(e) => updateField("accountNumber", e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Amount (KES)</label>
                    <LiquidGlassInput
                      type="number"
                      placeholder="0"
                      value={formData.amount}
                      onChange={(e) => updateField("amount", e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Description (optional)</label>
                    <LiquidGlassInput
                      placeholder="March electricity bill"
                      value={formData.description}
                      onChange={(e) => updateField("description", e.target.value)}
                    />
                  </div>
                </div>

                <LiquidGlassButton
                  variant="primary"
                  size="lg"
                  className="w-full mt-8"
                  onClick={handleSubmit}
                  disabled={isProcessing || !formData.accountId || !formData.accountNumber || !formData.amount}
                >
                  {isProcessing ? <>Processing Payment...</> : <>Pay {formatCurrency(formData.amount || "0")}</>}
                </LiquidGlassButton>
              </LiquidGlassCard>
            ) : (
              <LiquidGlassCard className="p-10 text-center" glow>
                <div className="mx-auto w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
                  <Check className="h-12 w-12 text-green-500" />
                </div>
                <h3 className="text-3xl font-bold mb-2">Payment Successful!</h3>
                <p className="text-lg text-muted-foreground mb-8">{successMessage}</p>
                {newBalance && <p className="text-sm text-spartan-cyan mb-8">New Balance: {newBalance}</p>}
                <div className="flex gap-4 justify-center">
                  <LiquidGlassButton variant="secondary" onClick={resetForm}>
                    Pay Another Bill
                  </LiquidGlassButton>
                  <LiquidGlassButton variant="primary">View Receipt</LiquidGlassButton>
                </div>
              </LiquidGlassCard>
            )
          ) : (
            <LiquidGlassCard className="p-8" glow>
              <div className="flex items-center gap-5 mb-8">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white/10">
                  <Phone className="h-9 w-9" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Airtime & Data Bundles</h3>
                  <p className="text-muted-foreground">Instant top-up to any number</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label>Provider</label>
                  <LiquidGlassSelect
                    value={selectedProviderId?.toString() ?? ""}
                    onChange={(v) => setSelectedProviderId(v ? parseInt(v) : null)}
                    options={providers.map(p => ({ value: p.id.toString(), label: p.name }))}
                    placeholder="Select network"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setBuyType("airtime"); setSelectedBundleId(null); }}
                    className={cn("flex-1 py-3 rounded-xl font-medium", buyType === "airtime" ? "bg-spartan-cyan text-white" : "bg-white/5")}
                  >
                    Airtime
                  </button>
                  <button
                    onClick={() => setBuyType("bundle")}
                    className={cn("flex-1 py-3 rounded-xl font-medium", buyType === "bundle" ? "bg-spartan-cyan text-white" : "bg-white/5")}
                  >
                    Data Bundle
                  </button>
                </div>

                <div>
                  <label>Phone Number (2547...)</label>
                  <LiquidGlassInput
                    placeholder="254712345678"
                    value={formData.phoneNumber}
                    onChange={(e) => updateField("phoneNumber", e.target.value)}
                  />
                </div>

                {buyType === "airtime" ? (
                  <div>
                    <label>Amount (KES)</label>
                    <LiquidGlassInput
                      type="number"
                      placeholder="50 - 10000"
                      value={formData.amount}
                      onChange={(e) => updateField("amount", e.target.value)}
                    />
                  </div>
                ) : (
                  <div>
                    <label>Select Bundle</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                      {bundles.map(bundle => (
                        <button
                          key={bundle.id}
                          onClick={() => {
                            setSelectedBundleId(bundle.id)
                            updateField("amount", bundle.amount)
                          }}
                          className={cn(
                            "p-5 rounded-2xl text-left border transition-all",
                            selectedBundleId === bundle.id ? "border-spartan-cyan bg-spartan-cyan/10" : "border-transparent bg-white/5 hover:border-white/30"
                          )}
                        >
                          <div className="font-bold text-lg">{bundle.data_amount}</div>
                          <div className="text-spartan-cyan font-semibold">{formatCurrency(bundle.amount)}</div>
                          <div className="text-xs text-muted-foreground mt-1">{bundle.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label>Pay From</label>
                  <LiquidGlassSelect
                    value={formData.accountId}
                    onChange={(v) => updateField("accountId", v)}
                    options={accountOptions}
                    placeholder="Select account"
                  />
                </div>
              </div>

              <LiquidGlassButton
                variant="primary"
                size="lg"
                className="w-full mt-8"
                onClick={handleSubmit}
                disabled={isProcessing || !formData.accountId || !formData.phoneNumber ||
                  (buyType === "airtime" && !formData.amount) ||
                  (buyType === "bundle" && !selectedBundleId)}
              >
                {isProcessing ? "Processing..." : `Confirm ${buyType === "bundle" ? "Bundle" : "Airtime"}`}
              </LiquidGlassButton>
            </LiquidGlassCard>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <LiquidGlassCard className="p-6">
            <h3 className="font-semibold mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">This Month</span>
                <span className="font-medium">{formatCurrency(monthlyStats.totalSpent)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bills Paid</span>
                <span className="font-medium">{monthlyStats.billsPaid}</span>
              </div>
            </div>
          </LiquidGlassCard>

          <LiquidGlassCard className="p-6">
            <h3 className="font-semibold mb-4">Recent Activity</h3>
            {recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.map((item, index) => (
                  <div 
                    key={`${item.id}-${index}`}   // Fixed: Unique composite key
                    className="flex justify-between items-center py-2 border-b border-white/10 last:border-none"
                  >
                    <div>
                      <p className="font-medium text-sm text-foreground">{item.description}</p>
                      <p className="text-xs text-muted-foreground">{item.date}</p>
                    </div>
                    <p className={cn("font-semibold",
                      item.amount < 0 ? "text-red-400" : "text-green-400"
                    )}>
                      {formatCurrency(item.amount)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No recent activity yet</p>
            )}
          </LiquidGlassCard>
        </div>
      </div>
    </div>
  )
}