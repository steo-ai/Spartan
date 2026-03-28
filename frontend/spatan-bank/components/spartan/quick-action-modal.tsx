"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Receipt,
  CreditCard,
  CheckCircle,
  Loader2,
  AlertCircle,
  Phone,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import {
  LiquidGlassCard,
  LiquidGlassButton,
  LiquidGlassInput,
  LiquidGlassSelect,
} from "./liquid-glass-card"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "@/hooks/use-toast"

interface QuickActionModalProps {
  isOpen: boolean
  onClose: () => void
  actionType: "deposit" | "withdraw" | "transfer" | "paybill" | "card" | "bills" | "airtime"
  onSuccess?: () => void
}

const quickAmounts = [500, 1000, 2000, 5000, 10000, 20000]

export function QuickActionModal({
  isOpen,
  onClose,
  actionType,
  onSuccess,
}: QuickActionModalProps) {
  const { user, accounts, refreshUser } = useAuth()

  const [step, setStep] = useState<"form" | "confirm" | "processing" | "success" | "error">("form")
  const [amount, setAmount] = useState("")
  const [selectedAccount, setSelectedAccount] = useState("")
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || "")
  const [recipient, setRecipient] = useState("")
  const [paybillNumber, setPaybillNumber] = useState("")
  const [description, setDescription] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [transactionId, setTransactionId] = useState<number | null>(null)

  const safeAccounts = Array.isArray(accounts) ? accounts : []

  const accountOptions = safeAccounts.map((acc: any) => ({
    value: acc.id?.toString() || "",
    label: `${(acc.account_type || "Account").charAt(0).toUpperCase() + (acc.account_type || "").slice(1)} ••••${(acc.account_number || "").slice(-4)}`,
  }))

  const getActionConfig = () => {
    switch (actionType) {
      case "deposit":
        return {
          title: "Deposit via M-Pesa",
          icon: ArrowDownLeft,
          color: "text-spartan-success",
          bgColor: "bg-spartan-success/10",
          showPhone: true,
          accountLabel: "Deposit To",
          successMessage: "Deposit request initiated successfully!",
        }
      case "withdraw":
        return {
          title: "Withdraw to M-Pesa",
          icon: ArrowUpRight,
          color: "text-spartan-warning",
          bgColor: "bg-spartan-warning/10",
          showPhone: true,
          accountLabel: "Withdraw From",
          successMessage: "Withdrawal request submitted successfully.",
        }
      case "transfer":
        return {
          title: "Internal Transfer",
          icon: ArrowLeftRight,
          color: "text-spartan-cyan",
          bgColor: "bg-spartan-cyan/10",
          showRecipient: true,
          accountLabel: "From Account",
          recipientLabel: "To Account Number or Phone",
          successMessage: "Transfer completed successfully!",
        }
      case "bills":
      case "paybill":
        return {
          title: "Pay Bill",
          icon: Receipt,
          color: "text-spartan-purple",
          bgColor: "bg-spartan-purple/10",
          showPaybill: true,
          accountLabel: "Pay From",
          successMessage: "Bill payment initiated.",
        }
      default:
        return {
          title: "Quick Action",
          icon: ArrowLeftRight,
          color: "text-spartan-cyan",
          bgColor: "bg-spartan-cyan/10",
          accountLabel: "From Account",
          successMessage: "Action completed.",
        }
    }
  }

  const config = getActionConfig()
  const Icon = config.icon

  const resetForm = () => {
    setAmount("")
    setSelectedAccount("")
    setRecipient("")
    setPaybillNumber("")
    setPhoneNumber(user?.phone_number || "")
    setDescription("")
    setStep("form")
    setErrorMessage(null)
    setTransactionId(null)
    setIsProcessing(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  // ====================== DEPOSIT POLLING ======================
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (step === "processing" && transactionId && actionType === "deposit") {
      interval = setInterval(async () => {
        try {
          const response = await api.payments.checkDepositStatus(transactionId)
          const status = response?.status || response?.data?.status || "pending"

          console.log("Polling deposit status:", status)

          if (status === "completed" || status === "mpesa_confirmed") {
            clearInterval(interval!)
            setStep("success")
            toast({ 
              title: "Payment Confirmed!", 
              description: "Funds have been credited to your account." 
            })
            refreshUser?.()
          } else if (status === "failed") {
            clearInterval(interval!)
            setErrorMessage("M-Pesa payment failed or was cancelled.")
            setStep("error")
          }
        } catch (err) {
          console.error("Deposit polling error:", err)
        }
      }, 4000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [step, transactionId, actionType, refreshUser])

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedAccount || !amount || Number(amount) <= 0) {
      toast({ 
        title: "Missing Fields", 
        description: "Please select an account and enter a valid amount", 
        variant: "destructive" 
      })
      return
    }

    if (config.showPhone && !phoneNumber) {
      toast({ title: "Error", description: "Phone number is required", variant: "destructive" })
      return
    }
    if (config.showRecipient && !recipient) {
      toast({ title: "Error", description: "Recipient is required", variant: "destructive" })
      return
    }
    if (config.showPaybill && !paybillNumber) {
      toast({ title: "Error", description: "Paybill number is required", variant: "destructive" })
      return
    }

    setStep("confirm")
  }

  // ====================== handleFinalSubmit with delay for withdrawal ======================
  const handleFinalSubmit = async () => {
    setIsProcessing(true)
    setErrorMessage(null)

    try {
      const accId = Number(selectedAccount)
      const amt = Number(amount)

      if (actionType === "deposit") {
        const response = await api.payments.deposit(accId, amt, phoneNumber, description)

        console.log("✅ Full Deposit Response from backend:", response)

        const transferId = 
          response?.transfer_id || 
          response?.id || 
          response?.transferId ||
          response?.data?.transfer_id ||
          response?.data?.id

        if (!transferId) {
          console.error("No transfer_id found in response:", response)
          throw new Error("Server did not return a transaction ID. Please try again.")
        }

        setTransactionId(Number(transferId))
        setStep("processing")

        toast({
          title: "M-Pesa Prompt Sent",
          description: "Check your phone and enter your M-Pesa PIN",
        })
        return
      }

      // === NON-DEPOSIT ACTIONS (Withdraw, Transfer, Paybill) ===
      let res: any

      if (actionType === "withdraw") {
        res = await api.payments.withdraw(accId, amt, phoneNumber, description)
      } else if (actionType === "transfer") {
        res = await api.payments.transfer?.(accId, recipient, amt, description)
      } else if (actionType === "paybill" || actionType === "bills") {
        res = await api.payments.paybill?.(accId, paybillNumber, amt, description)
      }

      // Add small delay for better UX on instant actions (especially withdrawal)
      await new Promise(resolve => setTimeout(resolve, 1200)) // 1.2 seconds delay

      // Success
      setStep("success")
      toast({ title: "Success", description: config.successMessage })
      refreshUser?.()

    } catch (err: any) {
      const msg = 
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err.message ||
        "Operation failed. Please try again."

      console.error("Action failed:", err)
      setErrorMessage(msg)
      setStep("error")

      toast({ 
        variant: "destructive", 
        title: "Failed", 
        description: msg 
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Animation Variants
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
    exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2 } }
  }

  const contentVariants = {
    enter: { opacity: 0, x: -20 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <LiquidGlassCard className="w-full max-w-md overflow-hidden" glow onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center", config.bgColor)}>
                <Icon className={cn("h-6 w-6", config.color)} />
              </div>
              <h2 className="text-2xl font-semibold text-foreground">{config.title}</h2>
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          <AnimatePresence mode="wait">
            {/* SUCCESS */}
            {step === "success" && (
              <motion.div 
                key="success" 
                variants={contentVariants} 
                initial="enter" 
                animate="center" 
                exit="exit" 
                className="p-8 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="mx-auto w-24 h-24 rounded-full bg-spartan-success/20 flex items-center justify-center mb-6"
                >
                  <CheckCircle className="h-16 w-16 text-spartan-success" />
                </motion.div>
                <h3 className="text-2xl font-semibold mb-2">Transaction Successful!</h3>
                <p className="text-muted-foreground mb-8">{config.successMessage}</p>
                
                <LiquidGlassButton 
                  onClick={() => {
                    handleClose()
                    onSuccess?.()
                  }} 
                  className="w-full"
                >
                  Done
                </LiquidGlassButton>
              </motion.div>
            )}

            {/* ERROR */}
            {step === "error" && (
              <motion.div key="error" variants={contentVariants} initial="enter" animate="center" exit="exit" className="p-8 text-center">
                <div className="mx-auto w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
                  <AlertCircle className="h-16 w-16 text-red-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-red-400">Transaction Failed</h3>
                <p className="text-red-400 mb-8">{errorMessage}</p>
                <LiquidGlassButton variant="primary" onClick={() => setStep("form")} className="w-full">Try Again</LiquidGlassButton>
              </motion.div>
            )}

            {/* PROCESSING - Now used for both Deposit and Withdrawal */}
            {(step === "processing" || isProcessing) && (
              <motion.div key="processing" variants={contentVariants} initial="enter" animate="center" exit="exit" className="p-12 text-center">
                <Loader2 className="mx-auto h-16 w-16 animate-spin text-spartan-cyan mb-6" />
                <h3 className="text-xl font-semibold mb-3">
                  {actionType === "deposit" ? "Waiting for M-Pesa Payment" : "Processing Withdrawal"}
                </h3>
                <p className="text-muted-foreground mb-2">
                  {actionType === "deposit" 
                    ? "Check your phone for the prompt" 
                    : "Please wait while we process your request..."}
                </p>
                {actionType === "withdraw" && (
                  <p className="text-sm text-muted-foreground">This usually takes a few seconds</p>
                )}
              </motion.div>
            )}

            {/* CONFIRMATION */}
            {step === "confirm" && (
              <motion.div key="confirm" variants={contentVariants} initial="enter" animate="center" exit="exit" className="p-6">
                <div className="text-center py-6">
                  <h3 className="text-xl font-semibold mb-6">Confirm Transaction</h3>
                  <div className="bg-white/5 rounded-2xl p-6 mb-8">
                    <p className="text-4xl font-bold text-foreground mb-1">KES {Number(amount).toLocaleString("en-KE")}</p>
                    <p className="text-sm text-muted-foreground">
                      {actionType === "deposit" && "via M-Pesa STK Push"}
                      {actionType === "withdraw" && "to M-Pesa"}
                      {actionType === "transfer" && `to ${recipient}`}
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <LiquidGlassButton variant="secondary" onClick={() => setStep("form")} className="flex-1">Back</LiquidGlassButton>
                    <LiquidGlassButton onClick={handleFinalSubmit} disabled={isProcessing} className="flex-1">
                      {isProcessing ? (
                        <>
                          <Loader2 className="animate-spin mr-2 h-5 w-5" />
                          Processing...
                        </>
                      ) : (
                        "Confirm & Proceed"
                      )}
                    </LiquidGlassButton>
                  </div>
                </div>
              </motion.div>
            )}

            {/* MAIN FORM */}
            {step === "form" && (
              <motion.form 
                key="form" 
                variants={contentVariants} 
                initial="enter" 
                animate="center" 
                exit="exit" 
                onSubmit={handleConfirm} 
                className="p-6 space-y-6"
              >
                {/* ... same form content as before ... */}
                <div>
                  <label className="text-sm font-medium block mb-2">{config.accountLabel}</label>
                  <LiquidGlassSelect 
                    value={selectedAccount} 
                    onChange={setSelectedAccount} 
                    options={accountOptions} 
                    placeholder="Select account" 
                  />
                </div>

                {config.showPhone && (
                  <div>
                    <label className="text-sm font-medium block mb-2 flex items-center gap-2">
                      <Phone className="h-4 w-4" /> M-Pesa Phone Number
                    </label>
                    <LiquidGlassInput 
                      placeholder="+254 712 345 678" 
                      value={phoneNumber} 
                      onChange={(e) => setPhoneNumber(e.target.value)} 
                    />
                  </div>
                )}

                {config.showRecipient && (
                  <div>
                    <label className="text-sm font-medium block mb-2">{config.recipientLabel}</label>
                    <LiquidGlassInput 
                      placeholder="Account Number or Phone" 
                      value={recipient} 
                      onChange={(e) => setRecipient(e.target.value)} 
                    />
                  </div>
                )}

                {config.showPaybill && (
                  <div>
                    <label className="text-sm font-medium block mb-2">Paybill Number</label>
                    <LiquidGlassInput 
                      placeholder="Business Paybill Number" 
                      value={paybillNumber} 
                      onChange={(e) => setPaybillNumber(e.target.value)} 
                    />
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium block mb-2">Amount (KES)</label>
                  <LiquidGlassInput 
                    type="number" 
                    placeholder="0.00" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    min="1" 
                  />

                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {quickAmounts.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAmount(amt.toString())}
                        className={cn(
                          "py-2.5 text-sm font-medium rounded-xl transition-all border",
                          amount === amt.toString()
                            ? "bg-spartan-cyan text-black border-spartan-cyan"
                            : "hover:bg-white/10 border-white/10"
                        )}
                      >
                        {amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">Description (optional)</label>
                  <LiquidGlassInput 
                    placeholder="Purpose of this transaction" 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                  />
                </div>

                <LiquidGlassButton 
                  type="submit" 
                  size="lg" 
                  disabled={!selectedAccount || !amount} 
                  className="w-full mt-4"
                >
                  Continue <Icon className="ml-2 h-5 w-5" />
                </LiquidGlassButton>
              </motion.form>
            )}
          </AnimatePresence>
        </LiquidGlassCard>
      </motion.div>
    </div>
  )
}