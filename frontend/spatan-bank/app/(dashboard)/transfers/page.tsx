"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeftRight,
  Users,
  Smartphone,
  Building2,
  Clock,
  Check,
  Loader2,
  AlertCircle,
  ChevronRight,
  Star,
  Plus,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { LiquidGlassCard, LiquidGlassButton, LiquidGlassInput, LiquidGlassSelect } from "@/components/spartan/liquid-glass-card";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "sonner";

type TransferType = "internal" | "spartan" | "mpesa" | "pesalink";

const transferTypes = [
  { id: "internal", label: "Between My Accounts", icon: ArrowLeftRight, description: "Move money between your Spartan accounts" },
  { id: "spartan", label: "To Spartan User", icon: Users, description: "Send to another Spartan Bank customer" },
  { id: "mpesa", label: "To M-Pesa", icon: Smartphone, description: "Send to any M-Pesa number" },
  { id: "pesalink", label: "To Other Bank", icon: Building2, description: "Send via Pesalink to other banks" },
];

export default function TransfersPage() {
  const { accounts, refreshData } = useAuth();

  const [selectedType, setSelectedType] = useState<TransferType>("internal");
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [frequentRecipients, setFrequentRecipients] = useState<any[]>([]);
  const [recentTransfers, setRecentTransfers] = useState<any[]>([]);
  const [loadingFrequent, setLoadingFrequent] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const [formData, setFormData] = useState({
    fromAccount: "",
    toAccount: "",
    recipient: "",
    amount: "",
    description: "",
    bank: "",
  });

  // Safe accounts handling
  const safeAccounts = Array.isArray(accounts) ? accounts : [];
  const hasAccounts = safeAccounts.length > 0;

  const accountOptions = safeAccounts.map((acc: any) => ({
    value: acc.id?.toString() || "",
    label: `${(acc.account_type || "Account").charAt(0).toUpperCase() + (acc.account_type || "").slice(1)} ••••${acc.account_number?.slice(-6) || "••••••"} (KES ${(acc.balance || 0).toLocaleString()})`,
  }));

  const bankOptions = [
    { value: "kcb", label: "KCB Bank" },
    { value: "equity", label: "Equity Bank" },
    { value: "coop", label: "Co-operative Bank" },
    { value: "absa", label: "ABSA Bank" },
    { value: "stanbic", label: "Stanbic Bank" },
    { value: "dtb", label: "DTB Bank" },
    { value: "ncba", label: "NCBA Bank" },
  ];

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getTransferFee = () => {
    const amount = Number(formData.amount) || 0;
    if (selectedType === "internal" || selectedType === "spartan") return 0;
    if (selectedType === "mpesa") return amount <= 100 ? 0 : Math.min(amount * 0.01, 100);
    if (selectedType === "pesalink") return 50;
    return 0;
  };

  // Fetch supporting data
  const fetchFrequentRecipients = async () => {
    try {
      setLoadingFrequent(true);
      const response = await api.payments.frequentRecipients(5);
      setFrequentRecipients(response.results || response || []);
    } catch (err) {
      console.error("Failed to fetch frequent recipients:", err);
      setFrequentRecipients([]);
    } finally {
      setLoadingFrequent(false);
    }
  };

  const fetchRecentTransfers = async () => {
    try {
      setLoadingRecent(true);
      const response = await api.transactions.getTransactions({ page_size: 8 });
      const results = response.results || response || [];
      const sorted = [...results].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setRecentTransfers(sorted);
    } catch (err) {
      console.error("Failed to fetch recent transfers:", err);
      setRecentTransfers([]);
    } finally {
      setLoadingRecent(false);
    }
  };

  // Load data when accounts are ready
  useEffect(() => {
    if (hasAccounts) {
      fetchFrequentRecipients();
      fetchRecentTransfers();
    }
  }, [hasAccounts]);

  const handleContinue = () => {
    if (!formData.fromAccount || !formData.amount || Number(formData.amount) <= 0) {
      toast.error("Please select an account and enter a valid amount");
      return;
    }
    setStep(2);
  };

  const handleConfirmTransfer = async () => {
    setIsProcessing(true);

    try {
      const fromId = Number(formData.fromAccount);
      const amt = Number(formData.amount);

      if (selectedType === "internal") {
        if (!formData.toAccount) throw new Error("Please select destination account");
        await api.payments.internalTransfer(fromId, Number(formData.toAccount), amt, formData.description);
      } else if (selectedType === "mpesa") {
        if (!formData.recipient) throw new Error("Please enter M-Pesa phone number");
        await api.payments.withdraw(fromId, amt, formData.recipient, formData.description);
      } else if (selectedType === "spartan") {
        if (!formData.recipient) throw new Error("Please enter recipient account number");
        await api.payments.internalTransfer(fromId, Number(formData.recipient), amt, formData.description);
      } else if (selectedType === "pesalink") {
        toast.error("Pesalink support coming soon");
        return;
      }

      setIsSuccess(true);
      toast.success("Transfer completed successfully!");

      // Refresh data
      setTimeout(() => {
        fetchFrequentRecipients();
        fetchRecentTransfers();
      }, 1500);

    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || 
                      err?.response?.data?.error || 
                      err.message || 
                      "Transfer failed. Please try again.";
      toast.error(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setFormData({
      fromAccount: "",
      toAccount: "",
      recipient: "",
      amount: "",
      description: "",
      bank: "",
    });
    setStep(1);
    setIsSuccess(false);
  };

  // No accounts state
  if (!hasAccounts) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <AlertCircle className="h-16 w-16 text-amber-500 mb-6" />
        <h2 className="text-2xl font-bold text-foreground mb-3">No Accounts Found</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          You need to open at least one account before you can make transfers.
        </p>
        <LiquidGlassButton 
          onClick={() => window.location.href = "/accounts"} 
          className="flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Open an Account Now
        </LiquidGlassButton>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Transfer Money</h1>
        <p className="text-muted-foreground">Send money instantly to anyone, anywhere</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Transfer Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transfer Type Selection */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {transferTypes.map((type) => (
              <LiquidGlassCard
                key={type.id}
                className={cn(
                  "p-4 text-center cursor-pointer transition-all hover:scale-[1.02]",
                  selectedType === type.id && "ring-2 ring-spartan-cyan bg-spartan-cyan/10"
                )}
                hover
                onClick={() => {
                  setSelectedType(type.id as TransferType);
                  resetForm();
                }}
              >
                <div className={cn(
                  "mx-auto w-10 h-10 rounded-xl flex items-center justify-center mb-3",
                  selectedType === type.id ? "bg-spartan-cyan/20 text-spartan-cyan" : "bg-white/5 text-muted-foreground"
                )}>
                  <type.icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-foreground">{type.label}</p>
              </LiquidGlassCard>
            ))}
          </div>

          {/* Transfer Form */}
          {!isSuccess ? (
            <LiquidGlassCard className="p-6" glow>
              {step === 1 ? (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-foreground">
                    {transferTypes.find((t) => t.id === selectedType)?.description}
                  </h3>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">From Account</label>
                    <LiquidGlassSelect
                      value={formData.fromAccount}
                      onChange={(value) => updateField("fromAccount", value)}
                      options={accountOptions}
                      placeholder="Select source account"
                    />
                  </div>

                  {selectedType === "internal" && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">To Account</label>
                      <LiquidGlassSelect
                        value={formData.toAccount}
                        onChange={(value) => updateField("toAccount", value)}
                        options={accountOptions.filter((a) => a.value !== formData.fromAccount)}
                        placeholder="Select destination account"
                      />
                    </div>
                  )}

                  {(selectedType === "spartan" || selectedType === "mpesa") && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        {selectedType === "spartan" ? "Recipient Account Number" : "M-Pesa Phone Number"}
                      </label>
                      <LiquidGlassInput
                        placeholder={selectedType === "spartan" ? "Enter full account number" : "+254 7XX XXX XXX"}
                        value={formData.recipient}
                        onChange={(e) => updateField("recipient", e.target.value)}
                      />
                    </div>
                  )}

                  {selectedType === "pesalink" && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Destination Bank</label>
                        <LiquidGlassSelect
                          value={formData.bank}
                          onChange={(value) => updateField("bank", value)}
                          options={bankOptions}
                          placeholder="Select bank"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Account Number</label>
                        <LiquidGlassInput
                          placeholder="Enter account number"
                          value={formData.recipient}
                          onChange={(e) => updateField("recipient", e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Amount (KES)</label>
                    <LiquidGlassInput
                      type="number"
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => updateField("amount", e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {[1000, 2000, 5000, 10000, 20000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => updateField("amount", amt.toString())}
                          className={cn(
                            "px-3 py-1 text-sm rounded-lg transition-colors",
                            formData.amount === amt.toString()
                              ? "bg-spartan-cyan/20 text-spartan-cyan"
                              : "bg-white/5 text-muted-foreground hover:bg-white/10"
                          )}
                        >
                          {amt.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Description (Optional)</label>
                    <LiquidGlassInput
                      placeholder="What's this for?"
                      value={formData.description}
                      onChange={(e) => updateField("description", e.target.value)}
                    />
                  </div>

                  <LiquidGlassButton
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={handleContinue}
                    disabled={!formData.fromAccount || !formData.amount || Number(formData.amount) <= 0}
                  >
                    Continue <ChevronRight className="h-5 w-5 ml-2" />
                  </LiquidGlassButton>
                </div>
              ) : (
                /* Confirmation Step */
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-foreground">Confirm Transfer</h3>

                  <div className="space-y-4 p-4 rounded-xl bg-white/5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-semibold text-foreground">{formatCurrency(Number(formData.amount))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transfer Fee</span>
                      <span className="font-semibold text-foreground">{formatCurrency(getTransferFee())}</span>
                    </div>
                    <div className="border-t border-white/10 pt-4 flex justify-between font-bold">
                      <span className="text-foreground">Total</span>
                      <span className="text-spartan-cyan">
                        {formatCurrency(Number(formData.amount) + getTransferFee())}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Please verify the details</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Transfers cannot be reversed once completed.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <LiquidGlassButton
                      variant="secondary"
                      size="lg"
                      className="flex-1"
                      onClick={() => setStep(1)}
                      disabled={isProcessing}
                    >
                      Back
                    </LiquidGlassButton>
                    <LiquidGlassButton
                      variant="primary"
                      size="lg"
                      className="flex-1 flex items-center justify-center gap-2"
                      onClick={handleConfirmTransfer}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Confirm & Send"
                      )}
                    </LiquidGlassButton>
                  </div>
                </div>
              )}
            </LiquidGlassCard>
          ) : (
            /* Success State */
            <LiquidGlassCard className="p-8 text-center" glow>
              <div className="mx-auto w-20 h-20 rounded-full bg-spartan-success/20 flex items-center justify-center mb-6">
                <Check className="h-10 w-10 text-spartan-success" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">Transfer Successful!</h3>
              <p className="text-muted-foreground mb-6">
                You have successfully transferred {formatCurrency(Number(formData.amount))}
              </p>
              <div className="flex gap-3 justify-center">
                <LiquidGlassButton variant="secondary" onClick={resetForm}>
                  Make Another Transfer
                </LiquidGlassButton>
                <LiquidGlassButton variant="primary">
                  View Receipt
                </LiquidGlassButton>
              </div>
            </LiquidGlassCard>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Frequent Recipients */}
          <LiquidGlassCard className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Frequent Recipients</h3>
              <Star className="h-4 w-4 text-spartan-gold" />
            </div>
            <div className="space-y-3">
              {loadingFrequent ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : frequentRecipients.length > 0 ? (
                frequentRecipients.map((recipient) => (
                  <button
                    key={recipient.id}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left"
                    onClick={() => {
                      updateField("recipient", recipient.account_number || "");
                      setSelectedType("spartan");
                    }}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-spartan-cyan to-spartan-purple flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {recipient.name?.split(" ").map((n: string) => n[0]).join("") || "??"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{recipient.name}</p>
                      <p className="text-xs text-muted-foreground">{recipient.short_account || recipient.account_number}</p>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No frequent recipients yet</p>
              )}
            </div>
          </LiquidGlassCard>

          {/* Recent Transfers */}
          <LiquidGlassCard className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Recent Transfers</h3>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-3">
              {loadingRecent ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : recentTransfers.length > 0 ? (
                recentTransfers.map((transfer: any) => {
                  const isOutgoing = transfer.amount < 0 || transfer.transaction_type === 'transfer_out';
                  const absAmount = Math.abs(transfer.amount || 0);

                  return (
                    <div key={transfer.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                      <div className="flex-1">
                        <p className="font-medium text-foreground">
                          {isOutgoing 
                            ? `To ${transfer.related_account_number || "Unknown"}` 
                            : `From ${transfer.related_account_number || "Unknown"}`
                          }
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(transfer.timestamp).toLocaleDateString('en-KE', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${isOutgoing ? 'text-red-400' : 'text-emerald-400'}`}>
                          {isOutgoing ? '-' : '+'}{formatCurrency(absAmount)}
                        </p>
                        <span className="text-xs capitalize text-muted-foreground">
                          {isOutgoing ? 'Sent' : 'Received'}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No recent transfers yet.<br />Make your first transfer!
                </p>
              )}
            </div>
          </LiquidGlassCard>
        </div>
      </div>
    </div>
  );
}