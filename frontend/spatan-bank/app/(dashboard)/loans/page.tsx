"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { 
  Landmark, Plus, Clock, CheckCircle, XCircle, AlertCircle, 
  FileText, Calculator, Loader2, RefreshCw, CreditCard 
} from "lucide-react"
import { LiquidGlassCard } from "@/components/spartan/liquid-glass-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { loansApi, accountsApi } from "@/lib/api"
import type { Account } from "@/lib/types"

interface LoanApplication {
  id: number
  account_number: string
  amount_requested: number
  amount_disbursed?: number
  interest_rate: number
  term_months: number
  status: "pending" | "approved" | "rejected" | "active" | "repaid" | "defaulted"
  applied_at: string
  approved_at?: string
  disbursed_at?: string
  total_repaid: number
  remaining_balance: number
  total_interest: number
  next_due_date?: string
  monthly_emi?: number
  progress_percentage: number
  purpose?: string
}

const loanTypes = [
  { value: "personal", label: "Personal Loan", rate: 14, maxAmount: 1000000 },
  { value: "emergency", label: "Emergency Loan", rate: 18, maxAmount: 300000 },
  { value: "business", label: "Business Loan", rate: 13, maxAmount: 5000000 },
  { value: "education", label: "Education Loan", rate: 12, maxAmount: 2000000 },
]

function calculateMonthlyPayment(amount: number, months: number, annualRate: number): number {
  if (months <= 0 || amount <= 0) return 0
  const monthlyRate = annualRate / 100 / 12
  const power = Math.pow(1 + monthlyRate, months)
  return (amount * monthlyRate * power) / (power - 1)
}

export default function LoansPage() {
  const [applications, setApplications] = useState<LoanApplication[]>([])
  const [userAccounts, setUserAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Apply modal states
  const [applyModalOpen, setApplyModalOpen] = useState(false)
  const [loanType, setLoanType] = useState("personal")
  const [amount, setAmount] = useState(50000)
  const [tenure, setTenure] = useState(12)
  const [purpose, setPurpose] = useState("")
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Repay modal states
  const [repayModalOpen, setRepayModalOpen] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication | null>(null)
  const [repayAmount, setRepayAmount] = useState(0)
  const [repaymentAccountId, setRepaymentAccountId] = useState<number | null>(null)
  const [repaying, setRepaying] = useState(false)

  useEffect(() => {
    fetchUserAccounts()
    fetchLoans()
  }, [])

  const fetchUserAccounts = async () => {
    try {
      const response = await accountsApi.getAccounts()
      const accounts = Array.isArray(response) 
        ? response 
        : response?.results || response?.data || []

      setUserAccounts(accounts)

      if (accounts.length > 0 && !selectedAccountId) {
        const mainAccount = accounts.find((acc: Account) => 
          (acc.account_type === 'savings' || acc.account_type === 'checking') && acc.is_active
        ) || accounts[0]
        
        setSelectedAccountId(mainAccount.id)
      }
    } catch (err: any) {
      console.error("Failed to load accounts:", err)
      toast({ 
        variant: "destructive", 
        description: "Failed to load your accounts." 
      })
    }
  }

  const fetchLoans = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await loansApi.getAll()
      const loansArray = Array.isArray(response) 
        ? response 
        : response?.results || response?.data || []

      setApplications(loansArray.map((app: any) => ({
        id: app.id,
        account_number: app.account_number || "",
        amount_requested: Number(app.amount_requested || 0),
        amount_disbursed: Number(app.amount_disbursed || app.amount_requested || 0),
        interest_rate: Number(app.interest_rate || 12),
        term_months: Number(app.term_months || 6),
        status: app.status,
        applied_at: app.applied_at,
        approved_at: app.approved_at,
        disbursed_at: app.disbursed_at,
        total_repaid: Number(app.total_repaid || 0),
        remaining_balance: Number(app.remaining_balance || 0),
        total_interest: Number(app.total_interest || 0),
        next_due_date: app.next_due_date,
        monthly_emi: Number(app.monthly_emi || 0),
        progress_percentage: Number(app.progress_percentage || 0),
        purpose: app.purpose,
      })))
    } catch (err: any) {
      console.error("Failed to load loans:", err)
      setError(err.message || "Could not load loans")
      toast({ 
        variant: "destructive", 
        description: "Failed to load loan applications" 
      })
    } finally {
      setLoading(false)
    }
  }

  const getCurrentRate = (): number => {
    const selectedType = loanTypes.find(t => t.value === loanType)
    return selectedType?.rate || 14
  }

  const handleApply = async () => {
    if (!selectedAccountId) {
      toast({ variant: "destructive", description: "Please select an account" })
      return
    }
    if (amount < 10000 || tenure < 6 || !purpose.trim()) {
      toast({ variant: "destructive", description: "Minimum KES 10,000 and 6 months required" })
      return
    }

    setSubmitting(true)
    try {
      await loansApi.create({
        account: selectedAccountId,
        amount_requested: amount,
        term_months: tenure,
        interest_rate: getCurrentRate(),
      })

      toast({ 
        title: "Application Submitted", 
        description: "Your loan application is under review. You will be notified once approved." 
      })

      setApplyModalOpen(false)
      resetApplyForm()
      await fetchLoans()
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: err.message || "Failed to submit loan application"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const resetApplyForm = () => {
    setPurpose("")
    setAmount(50000)
    setTenure(12)
    setLoanType("personal")
  }

  const openRepayModal = (loan: LoanApplication) => {
    if (loan.status !== "active") {
      toast({ variant: "destructive", description: "Only active loans can be repaid" })
      return
    }

    setSelectedLoan(loan)
    setRepayAmount(Math.ceil(loan.monthly_emi || 0))

    if (userAccounts.length > 0) {
      setRepaymentAccountId(userAccounts[0].id)
    }
    
    setRepayModalOpen(true)
  }

  const handleRepay = async () => {
    if (!selectedLoan || repayAmount <= 0 || !repaymentAccountId) {
      toast({ variant: "destructive", description: "Please enter a valid amount and select an account" })
      return
    }

    setRepaying(true)
    try {
      await loansApi.repay(selectedLoan.id, { 
        amount: repayAmount, 
        repayment_account: repaymentAccountId 
      })

      toast({ 
        title: "Repayment Successful", 
        description: `KES ${repayAmount.toLocaleString()} applied to Loan #${selectedLoan.id}` 
      })

      setRepayModalOpen(false)
      await fetchLoans()
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Repayment Failed",
        description: err.message || "Please try again"
      })
    } finally {
      setRepaying(false)
    }
  }

  const getStatusConfig = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active": return { color: "emerald", icon: CheckCircle, text: "Active - Repay Now" }
      case "approved": return { color: "emerald", icon: CheckCircle, text: "Approved" }
      case "pending": return { color: "amber", icon: Clock, text: "Under Review" }
      case "rejected": return { color: "red", icon: XCircle, text: "Rejected" }
      case "repaid": return { color: "blue", icon: CheckCircle, text: "Fully Repaid ✓" }
      case "defaulted": return { color: "red", icon: AlertCircle, text: "Defaulted" }
      default: return { color: "amber", icon: Clock, text: status }
    }
  }

  const shortenAccount = (accNumber: string): string => {
    if (!accNumber) return "N/A"
    if (accNumber.length <= 14) return accNumber
    return `${accNumber.slice(0, 6)}...${accNumber.slice(-6)}`
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-12 px-4 md:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Landmark className="h-8 w-8" /> Loans
          </h1>
          <p className="text-muted-foreground">Apply for loans and manage repayments</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button variant="outline" onClick={fetchLoans} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button 
            onClick={() => setApplyModalOpen(true)} 
            className="gap-2"
            disabled={userAccounts.length === 0}
          >
            <Plus className="h-4 w-4" />
            Apply for New Loan
          </Button>
        </div>
      </div>

      {/* Your Loan Applications */}
      <LiquidGlassCard className="p-5 md:p-6">
        <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
          <CreditCard className="h-5 w-5" /> Your Loan Applications
        </h3>

        {applications.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/60" />
            <p className="text-xl font-medium">No loan applications yet</p>
            <p className="text-muted-foreground mt-2">Start by applying for your first loan</p>
          </div>
        ) : (
          <div className="space-y-6">
            {applications.map((loan) => {
              const statusConfig = getStatusConfig(loan.status)
              const StatusIcon = statusConfig.icon

              const totalOwed = (loan.amount_disbursed || loan.amount_requested) + loan.total_interest
              const remaining = loan.remaining_balance

              return (
                <motion.div
                  key={loan.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 md:p-6 rounded-3xl border bg-gradient-to-br from-white/5 to-transparent hover:border-primary/30 transition-all overflow-hidden"
                >
                  <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-4 mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Landmark className="h-7 w-7 text-primary" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3 mb-2">
                            <h4 className="text-xl font-semibold">Loan #{loan.id}</h4>
                            <div className={cn(
                              "flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0",
                              {
                                "text-emerald-400 bg-emerald-950/50 border border-emerald-500/30": statusConfig.color === "emerald",
                                "text-amber-400 bg-amber-950/50 border border-amber-500/30": statusConfig.color === "amber",
                                "text-red-400 bg-red-950/50 border border-red-500/30": statusConfig.color === "red",
                                "text-blue-400 bg-blue-950/50 border border-blue-500/30": statusConfig.color === "blue",
                              }
                            )}>
                              <StatusIcon className="h-4 w-4" />
                              {statusConfig.text}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Applied on {new Date(loan.applied_at).toLocaleDateString('en-KE')}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Requested</p>
                          <p className="font-semibold mt-0.5">KES {loan.amount_requested.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Disbursed</p>
                          <p className="font-semibold text-emerald-400 mt-0.5">
                            KES {(loan.amount_disbursed || 0).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Total Interest</p>
                          <p className="font-semibold mt-0.5">KES {loan.total_interest.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Rate & Term</p>
                          <p className="font-semibold mt-0.5">
                            {loan.interest_rate}% • {loan.term_months} months
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="lg:w-72 xl:w-80 flex-shrink-0 lg:text-right">
                      <div className="mb-5">
                        <p className="text-3xl font-bold text-primary">
                          KES {remaining.toLocaleString()}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Remaining of KES {totalOwed.toLocaleString()}
                        </p>
                      </div>

                      {loan.status === "active" && loan.progress_percentage > 0 && (
                        <div className="mb-6">
                          <div className="flex justify-between text-xs mb-1.5">
                            <span>Repayment Progress</span>
                            <span>{loan.progress_percentage}%</span>
                          </div>
                          <Progress value={loan.progress_percentage} className="h-2.5" />
                        </div>
                      )}

                      {loan.status === "active" && (
                        <Button 
                          onClick={() => openRepayModal(loan)}
                          className="w-full"
                          size="lg"
                        >
                          Make Repayment
                        </Button>
                      )}

                      {loan.status === "repaid" && (
                        <div className="mt-4 text-emerald-500 text-sm font-medium">
                          ✓ Loan Fully Repaid
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-white/10">
                    <p className="text-xs text-muted-foreground mb-2">Disbursed To Account</p>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 overflow-hidden">
                      <p className="font-mono text-sm md:text-base break-all leading-relaxed text-foreground/90 tracking-[0.5px]">
                        {shortenAccount(loan.account_number)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </LiquidGlassCard>

      {/* Available Loan Products */}
      <LiquidGlassCard className="p-6">
        <h3 className="font-semibold text-lg mb-6">Available Loan Products</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loanTypes.map((type, i) => (
            <motion.div
              key={type.value}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => {
                setLoanType(type.value)
                setApplyModalOpen(true)
              }}
              className="p-6 rounded-2xl border border-white/10 hover:border-primary/50 cursor-pointer transition-all group h-full"
            >
              <div className="text-right mb-4">
                <span className="text-2xl font-bold text-primary">{type.rate}%</span>
              </div>
              <h4 className="font-semibold text-lg mb-1 group-hover:text-primary">{type.label}</h4>
              <p className="text-sm text-muted-foreground">Up to KES {type.maxAmount.toLocaleString()}</p>
            </motion.div>
          ))}
        </div>
      </LiquidGlassCard>

      {/* FIXED Apply Modal - No Horizontal Scroll on Mobile */}
      <Dialog open={applyModalOpen} onOpenChange={setApplyModalOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-lg max-h-[92vh] overflow-hidden p-0">
          <div className="p-6 overflow-y-auto max-h-[92vh] overflow-x-hidden">
            <DialogHeader className="mb-6">
              <DialogTitle>Apply for a Loan</DialogTitle>
              <DialogDescription>Complete the form below to submit your application</DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div>
                <Label>Disburse To Account</Label>
                <Select 
                  value={selectedAccountId?.toString() || ""} 
                  onValueChange={(v) => setSelectedAccountId(Number(v))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select account for disbursement" />
                  </SelectTrigger>
                  <SelectContent>
                    {userAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id.toString()}>
                        {shortenAccount(acc.account_number)} — {acc.account_type} 
                        (Balance: KES {Number(acc.balance || 0).toLocaleString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Loan Type</Label>
                <Select value={loanType} onValueChange={setLoanType}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {loanTypes.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <Label>Loan Amount (KES)</Label>
                  <Slider 
                    value={[amount]} 
                    onValueChange={([v]) => setAmount(v)} 
                    min={10000} 
                    max={5000000} 
                    step={5000} 
                    className="mt-3"
                  />
                  <div className="text-center font-semibold mt-3 text-lg">
                    KES {amount.toLocaleString()}
                  </div>
                </div>

                <div>
                  <Label>Tenure (Months)</Label>
                  <Slider 
                    value={[tenure]} 
                    onValueChange={([v]) => setTenure(v)} 
                    min={6} 
                    max={60} 
                    step={1} 
                    className="mt-3"
                  />
                  <div className="text-center font-semibold mt-3 text-lg">
                    {tenure} months
                  </div>
                </div>
              </div>

              <div>
                <Label>Purpose of Loan</Label>
                <Textarea
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Business expansion, School fees, Medical emergency..."
                  rows={3}
                  className="mt-1.5 resize-y min-h-[80px]"
                />
              </div>

              <div className="p-5 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator className="h-5 w-5" />
                  <span className="font-medium">Estimated Monthly Installment</span>
                </div>
                <p className="text-3xl font-bold text-primary">
                  KES {Math.round(calculateMonthlyPayment(amount, tenure, getCurrentRate())).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  at {getCurrentRate()}% p.a. for {tenure} months
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setApplyModalOpen(false)}
                  className="w-full"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleApply} 
                  disabled={submitting || !purpose.trim() || !selectedAccountId}
                  className="w-full"
                >
                  {submitting ? "Submitting..." : "Submit Loan Application"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Repay Modal (unchanged) */}
      <Dialog open={repayModalOpen} onOpenChange={setRepayModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Repay Loan #{selectedLoan?.id}</DialogTitle>
            <DialogDescription>
              Remaining: <span className="font-semibold">KES {selectedLoan?.remaining_balance.toLocaleString()}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div>
              <div className="flex justify-between mb-2">
                <Label>Repayment Amount (KES)</Label>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => selectedLoan && setRepayAmount(Math.ceil(selectedLoan.monthly_emi || 0))}
                >
                  Pay Exact EMI
                </Button>
              </div>
              <Input
                type="number"
                value={repayAmount}
                onChange={(e) => setRepayAmount(Number(e.target.value))}
                placeholder="Enter repayment amount"
                className="text-lg"
              />
            </div>

            <div>
              <Label>Pay From Account</Label>
              <Select 
                value={repaymentAccountId?.toString() || ""} 
                onValueChange={(v) => setRepaymentAccountId(Number(v))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select repayment account" />
                </SelectTrigger>
                <SelectContent>
                  {userAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id.toString()}>
                      {shortenAccount(acc.account_number)} — {acc.account_type}
                      <br />
                      KES {Number(acc.balance || 0).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setRepayModalOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleRepay} 
                disabled={repaying || repayAmount <= 0 || !repaymentAccountId}
              >
                {repaying ? "Processing..." : "Confirm Repayment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}