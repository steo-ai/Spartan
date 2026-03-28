"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  CreditCard,
  Plus,
  Snowflake,
  Sun,
  Copy,
  Settings,
  ShieldCheck,
  MoreVertical,
  TrendingUp,
  AlertTriangle,
  Loader2,
  LockKeyhole,
  Building,
  RefreshCw,
  ShoppingBag,
  Coffee,
  Utensils,
  Zap,
} from "lucide-react"
import { LiquidGlassCard } from "@/components/spartan/liquid-glass-card"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import api from "@/lib/api"
import { VirtualCardPreview } from "@/components/spartan/virtual-card-preview"

// ─── Themes ────────────────────────────────────────────────────────────
const generateCardTheme = () => {
  const themes = [
    "from-indigo-950 via-purple-900/40 to-cyan-800/30",
    "from-emerald-950 via-teal-900/40 to-cyan-700/30",
    "from-rose-950 via-pink-900/40 to-orange-700/30",
    "from-amber-950 via-yellow-900/40 to-amber-600/30",
    "from-blue-950 via-indigo-900/40 to-blue-600/30",
    "from-violet-950 via-purple-900/40 to-fuchsia-700/30",
    "from-gray-900 via-slate-800/40 to-zinc-700/30",
  ]
  return themes[Math.floor(Math.random() * themes.length)]
}

// ─── Future expiry ─────────────────────────────────────────────────────
const formatExpiry = (): string => {
  const today = new Date()
  const years = 4 + Math.floor(Math.random() * 4)
  const extraMonths = Math.floor(Math.random() * 12)

  const future = new Date(today.getFullYear() + years, today.getMonth() + extraMonths, 1)
  const month = (future.getMonth() + 1).toString().padStart(2, "0")
  const year = future.getFullYear().toString().slice(2)
  return `${month}/${year}`
}

interface Card {
  id: number
  card_type: string
  masked_number: string
  expiry_date: string
  status: string
  daily_spend_limit: number
  transaction_limit: number
  used_today: number
  full_number?: string
  cvv?: string
  theme?: string
  account_number?: string
}

interface CardTransaction {
  id: number
  amount: string
  merchant_name: string
  merchant_category: string
  status: string
  timestamp: string
  reference?: string
  card?: number
}

export default function CardsPage() {
  const { user, accounts } = useAuth()

  const [cards, setCards] = useState<Card[]>([])
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [allCardTransactions, setAllCardTransactions] = useState<CardTransaction[]>([])
  const [txLoading, setTxLoading] = useState(false)

  const [loading, setLoading] = useState(true)

  const [revealingCardId, setRevealingCardId] = useState<number | null>(null)
  const [revealTimer, setRevealTimer] = useState<NodeJS.Timeout | null>(null)

  const [generateOpen, setGenerateOpen] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string>("")
  const [dailyLimit, setDailyLimit] = useState([50000])
  const [txnLimit, setTxnLimit] = useState([20000])
  const [generating, setGenerating] = useState(false)

  const [pinOpen, setPinOpen] = useState(false)
  const [pinValue, setPinValue] = useState("")
  const [pinSubmitting, setPinSubmitting] = useState(false)

  const [limitsOpen, setLimitsOpen] = useState(false)

  // Load cards once
  useEffect(() => {
    const loadCards = async () => {
      try {
        const data = await api.cards.list()

        const formatted = data.map((c: any) => ({
          id: c.id,
          card_type: c.card_type,
          masked_number: c.masked_number || "•••• •••• •••• ••••",
          expiry_date: formatExpiry(),
          status: c.status || "active",
          daily_spend_limit: Number(c.daily_spend_limit || 0),
          transaction_limit: Number(c.transaction_limit || 0),
          used_today: Number(c.used_today || 0),
          account_number: c.account_number,
          theme: generateCardTheme(),
        }))

        setCards(formatted)

        if (formatted.length > 0 && !selectedCard) {
          setSelectedCard(formatted[0])
          setDailyLimit([formatted[0].daily_spend_limit])
          setTxnLimit([formatted[0].transaction_limit])
        }
      } catch (err: any) {
        toast.error("Failed to load cards")
      } finally {
        setLoading(false)
      }
    }

    loadCards()
  }, [])

  // Load ALL card transactions (global) once cards are loaded
  const loadAllTransactions = async () => {
    setTxLoading(true)
    try {
      const res = await api.cards.getAllCardTransactions({ limit: 15 })
      setAllCardTransactions(res.results || [])
    } catch (err) {
      console.error("Failed to load all card transactions:", err)
      setAllCardTransactions([])
      toast.error("Could not load recent transactions")
    } finally {
      setTxLoading(false)
    }
  }

  useEffect(() => {
    if (!loading && cards.length > 0) {
      loadAllTransactions()
    }
  }, [loading, cards.length])

  // Auto-hide revealed details
  useEffect(() => {
    if (revealingCardId) {
      if (revealTimer) clearTimeout(revealTimer)
      const t = setTimeout(() => {
        setRevealingCardId(null)
        toast.info("Card details hidden for security")
      }, 30000)
      setRevealTimer(t)
    }
    return () => {
      if (revealTimer) clearTimeout(revealTimer)
    }
  }, [revealingCardId])

  const handleGenerate = async () => {
    if (!selectedAccountId) {
      toast.error("Select an account first")
      return
    }

    setGenerating(true)
    try {
      const res = await api.cards.generateVirtual({
        account: Number(selectedAccountId),
        daily_limit: dailyLimit[0],
        tx_limit: txnLimit[0],
      })

      const nc = res.card

      const newCard: Card = {
        id: nc.id,
        card_type: nc.card_type,
        masked_number: nc.masked_number,
        expiry_date: formatExpiry(),
        status: nc.status,
        daily_spend_limit: Number(nc.daily_spend_limit),
        transaction_limit: Number(nc.transaction_limit),
        used_today: 0,
        full_number: nc.full_card_number,
        cvv: nc.cvv,
        account_number: nc.account_number,
        theme: generateCardTheme(),
      }

      setCards((prev) => [newCard, ...prev])
      setSelectedCard(newCard)
      setRevealingCardId(newCard.id)

      // Refresh global transactions after creation
      await loadAllTransactions()

      toast.success("Virtual card created", {
        description: `Linked to account •••• ${nc.account_number?.slice(-4) || "XXXX"}`,
      })
      setGenerateOpen(false)
      setSelectedAccountId("")
    } catch (err: any) {
      toast.error("Creation failed", {
        description: err?.response?.data?.error || err.message,
      })
    } finally {
      setGenerating(false)
    }
  }

  const openPinDialog = () => {
    if (!selectedCard) return
    setPinOpen(true)
    setPinValue("")
  }

  const submitPin = async () => {
    if (!selectedCard || pinValue.length !== 4) return

    setPinSubmitting(true)
    try {
      const res = await api.cards.reveal(selectedCard.id, { pin: pinValue })

      const updated = {
        ...selectedCard,
        full_number: res.card.full_card_number,
        cvv: res.card.cvv,
      }

      setCards((prev) => prev.map((c) => (c.id === selectedCard.id ? updated : c)))
      setSelectedCard(updated)
      setRevealingCardId(selectedCard.id)
      setPinOpen(false)
      setPinValue("")
      toast.success("Card details revealed", { description: "Auto-hides in 30 seconds" })
    } catch (err: any) {
      toast.error("Reveal failed", {
        description: err?.response?.data?.error || "Invalid PIN",
      })
    } finally {
      setPinSubmitting(false)
    }
  }

  const toggleFreeze = async () => {
    if (!selectedCard) return
    const shouldFreeze = selectedCard.status !== "frozen"

    try {
      await (shouldFreeze ? api.cards.freeze : api.cards.unfreeze)(selectedCard.id)

      const newStatus = shouldFreeze ? "frozen" : "active"

      setCards((prev) =>
        prev.map((c) => (c.id === selectedCard.id ? { ...c, status: newStatus } : c))
      )
      setSelectedCard((prev) => (prev ? { ...prev, status: newStatus } : null))

      toast.success(`Card ${shouldFreeze ? "frozen" : "unfrozen"} successfully`)
    } catch (err: any) {
      toast.error("Failed to update card status")
    }
  }

  const saveLimits = async () => {
    if (!selectedCard) return

    try {
      const res = await api.cards.setLimits(selectedCard.id, {
        daily_limit: dailyLimit[0],
        transaction_limit: txnLimit[0],
      })

      const updatedCard = res.card

      setCards((prev) =>
        prev.map((c) =>
          c.id === selectedCard.id
            ? {
                ...c,
                daily_spend_limit: Number(updatedCard.daily_spend_limit),
                transaction_limit: Number(updatedCard.transaction_limit),
              }
            : c
        )
      )
      setSelectedCard((prev) =>
        prev
          ? {
              ...prev,
              daily_spend_limit: Number(updatedCard.daily_spend_limit),
              transaction_limit: Number(updatedCard.transaction_limit),
            }
          : null
      )

      toast.success("Spending limits updated")
      setLimitsOpen(false)
    } catch (err: any) {
      toast.error("Failed to update limits", {
        description: err?.response?.data?.error || "Please try again",
      })
    }
  }

  const copyToClipboard = (text: string, label = "Copied") => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const getCategoryIcon = (category: string) => {
    const lower = category?.toLowerCase() || ""
    if (lower.includes("food") || lower.includes("restaurant")) return <Utensils className="h-4 w-4" />
    if (lower.includes("coffee") || lower.includes("cafe")) return <Coffee className="h-4 w-4" />
    if (lower.includes("shop") || lower.includes("store")) return <ShoppingBag className="h-4 w-4" />
    return <Zap className="h-4 w-4" />
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cards</h1>
          <p className="text-muted-foreground">Manage your debit & virtual cards</p>
        </div>
        <Button onClick={() => setGenerateOpen(true)} className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" /> New Virtual Card
        </Button>
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CreditCard className="h-16 w-16 text-muted-foreground/60 mb-4" />
          <h3 className="text-xl font-medium mb-2">No cards yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            Create your first virtual card linked to one of your accounts
          </p>
          <Button onClick={() => setGenerateOpen(true)}>Create Virtual Card</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 xl:gap-8">
          {/* Card thumbnails */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 xl:gap-6">
              {cards.map((card, index) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => {
                    setSelectedCard(card)
                    setDailyLimit([card.daily_spend_limit])
                    setTxnLimit([card.transaction_limit])
                  }}
                  className="w-full max-w-[420px] mx-auto"
                >
                  <div
                    className={cn(
                      "relative cursor-pointer transition-all duration-300 rounded-2xl overflow-hidden shadow-xl",
                      "aspect-[1.586/1]",
                      "w-full h-full",
                      selectedCard?.id === card.id && "ring-2 ring-primary/70 scale-[1.02]"
                    )}
                  >
                    <VirtualCardPreview
                      card={card}
                      revealingCardId={revealingCardId}
                      className={cn(
                        "w-full h-full bg-gradient-to-br border border-white/10",
                        card.theme || "from-indigo-950 via-purple-900/40 to-cyan-800/30"
                      )}
                    />

                    {card.account_number && (
                      <div className="absolute top-3 right-3 bg-black/65 backdrop-blur-md text-white/90 text-[10px] sm:text-xs px-2 py-0.5 rounded-full border border-white/20 shadow-md z-10 flex items-center gap-1.5">
                        <Building className="h-3 w-3 opacity-80" />
                        <span>•••• {card.account_number.slice(-4)}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Selected card details */}
          {selectedCard && (
            <div className="space-y-6">
              <LiquidGlassCard className="shadow-2xl overflow-hidden border-none">
                <div className="aspect-[1.586/1] w-full max-w-[480px] mx-auto">
                  <VirtualCardPreview
                    card={selectedCard}
                    revealingCardId={revealingCardId}
                    className={cn(
                      "w-full h-full bg-gradient-to-br border border-white/10",
                      selectedCard.theme || "from-indigo-950 via-purple-900/40 to-cyan-800/30"
                    )}
                  />
                </div>
              </LiquidGlassCard>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={openPinDialog}
                  disabled={revealingCardId === selectedCard.id}
                  className="flex-1 sm:flex-none min-w-[140px]"
                >
                  {revealingCardId === selectedCard.id ? "Visible (hides soon)" : "Reveal Details"}
                </Button>

                {selectedCard.full_number && (
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(selectedCard.full_number!, "Card number")}
                    className="flex-1 sm:flex-none min-w-[140px]"
                  >
                    <Copy className="mr-2 h-4 w-4" /> Number
                  </Button>
                )}

                {selectedCard.cvv && (
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(selectedCard.cvv!, "CVV")}
                    className="flex-1 sm:flex-none min-w-[140px]"
                  >
                    <Copy className="mr-2 h-4 w-4" /> CVV
                  </Button>
                )}
              </div>

              <LiquidGlassCard className="p-5 sm:p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold text-lg">Controls</h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem disabled>
                        <Settings className="mr-2 h-4 w-4" /> Settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive">
                        <AlertTriangle className="mr-2 h-4 w-4" /> Report lost / stolen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start gap-3 h-11",
                      selectedCard.status === "frozen"
                        ? "bg-emerald-950/30 border-emerald-800 text-emerald-400 hover:bg-emerald-950/50"
                        : "hover:bg-blue-950/30 hover:border-blue-800 hover:text-blue-400"
                    )}
                    onClick={toggleFreeze}
                  >
                    {selectedCard.status === "frozen" ? (
                      <Sun className="h-5 w-5" />
                    ) : (
                      <Snowflake className="h-5 w-5" />
                    )}
                    {selectedCard.status === "frozen" ? "Unfreeze Card" : "Freeze Card"}
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start gap-3 h-11"
                    onClick={() => setLimitsOpen(true)}
                  >
                    <TrendingUp className="h-5 w-5" /> Manage Limits
                  </Button>
                </div>
              </LiquidGlassCard>

              <LiquidGlassCard className="p-5 sm:p-6">
                <h3 className="font-semibold mb-4">Today's Usage</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Used today</span>
                    <span className="font-medium">
                      KES {selectedCard.used_today.toLocaleString()} /{" "}
                      {selectedCard.daily_spend_limit.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.min(
                          100,
                          (selectedCard.used_today / selectedCard.daily_spend_limit) * 100 || 0
                        )}%`,
                      }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className={cn(
                        "h-full rounded-full",
                        selectedCard.used_today / selectedCard.daily_spend_limit > 0.85
                          ? "bg-red-600"
                          : selectedCard.used_today / selectedCard.daily_spend_limit > 0.6
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      )}
                    />
                  </div>
                </div>
              </LiquidGlassCard>
            </div>
          )}
        </div>
      )}

      {/* Recent Transactions — ALL cards */}
      <LiquidGlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Recent Card Transactions</h3>
          <div className="flex items-center gap-2">
            {txLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            <Button
              variant="ghost"
              size="icon"
              onClick={loadAllTransactions}
              disabled={txLoading}
              title="Refresh transactions"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {txLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            <Loader2 className="h-10 w-10 mx-auto animate-spin mb-4" />
            <p>Loading transactions...</p>
          </div>
        ) : allCardTransactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No card transactions yet</p>
            <p className="text-sm mt-2">
              Any purchases made with your cards will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4 divide-y divide-border/50">
            {allCardTransactions.map((tx) => {
              const amountNum = Number(tx.amount)
              const isDebit = amountNum < 0

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "p-3 rounded-xl",
                        isDebit ? "bg-red-950/30" : "bg-emerald-950/30"
                      )}
                    >
                      {getCategoryIcon(tx.merchant_category)}
                    </div>
                    <div>
                      <p className="font-medium">
                        {tx.merchant_name || "Card Payment"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.timestamp).toLocaleString("en-KE", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p
                      className={cn(
                        "font-semibold",
                        isDebit ? "text-red-500" : "text-emerald-500"
                      )}
                    >
                      {isDebit ? "-" : "+"}
                      KES {Math.abs(amountNum).toLocaleString()}
                    </p>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full mt-1 inline-block",
                        tx.status === "approved"
                          ? "bg-emerald-950/40 text-emerald-400"
                          : tx.status === "declined"
                          ? "bg-red-950/40 text-red-400"
                          : "bg-amber-950/40 text-amber-400"
                      )}
                    >
                      {tx.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </LiquidGlassCard>

      {/* ─── Dialogs ──────────────────────────────────────────────────────────────── */}

      {/* Generate Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Virtual Card</DialogTitle>
            <DialogDescription>
              Choose an account to link this virtual card to
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-5">
            <div>
              <Label>Select Account</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose account..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts?.map((acc: any) => (
                    <SelectItem key={acc.id} value={acc.id.toString()}>
                      {acc.account_number} • KES {acc.balance?.toLocaleString() || "0"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <Label>Daily limit (KES)</Label>
                <Slider
                  value={dailyLimit}
                  onValueChange={setDailyLimit}
                  min={1000}
                  max={500000}
                  step={1000}
                />
                <div className="text-right mt-1.5 font-medium">
                  {dailyLimit[0].toLocaleString()}
                </div>
              </div>

              <div>
                <Label>Per transaction (KES)</Label>
                <Slider
                  value={txnLimit}
                  onValueChange={setTxnLimit}
                  min={500}
                  max={200000}
                  step={500}
                />
                <div className="text-right mt-1.5 font-medium">
                  {txnLimit[0].toLocaleString()}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setGenerateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={generating || !selectedAccountId}
              >
                {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Card
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* PIN Dialog */}
      <Dialog open={pinOpen} onOpenChange={(v) => { setPinOpen(v); if (!v) setPinValue("") }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Enter Card PIN</DialogTitle>
            <DialogDescription>
              Enter the 4-digit PIN sent to your email when the card was created.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="password"
                maxLength={4}
                inputMode="numeric"
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                className="text-center text-3xl tracking-widest font-mono h-14"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPinOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitPin}
              disabled={pinSubmitting || pinValue.length !== 4}
            >
              {pinSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reveal Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Limits Dialog */}
      <Dialog open={limitsOpen} onOpenChange={setLimitsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Spending Limits</DialogTitle>
            <DialogDescription>Update limits for this card</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6">
            <div>
              <Label>Daily limit (KES)</Label>
              <Slider value={dailyLimit} onValueChange={setDailyLimit} min={1000} max={500000} step={1000} />
              <div className="text-right mt-2 font-medium">{dailyLimit[0].toLocaleString()}</div>
            </div>
            <div>
              <Label>Transaction limit (KES)</Label>
              <Slider value={txnLimit} onValueChange={setTxnLimit} min={500} max={200000} step={500} />
              <div className="text-right mt-2 font-medium">{txnLimit[0].toLocaleString()}</div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLimitsOpen(false)}>Cancel</Button>
            <Button onClick={saveLimits}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}