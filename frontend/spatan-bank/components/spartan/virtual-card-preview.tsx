"use client"

import { Wifi, CreditCard as CreditCardIcon, Lock } from "lucide-react"
import { SpartanLogo } from "./spartan-logo"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"

// Updated Card interface - more flexible to match DashboardPage
interface Card {
  id: string | number
  card_type?: string          // Made optional
  masked_number?: string      // Made optional
  expiry_date?: string        // Made optional
  status?: string             // Made optional
  full_number?: string
  cvv?: string
  [key: string]: any          // Allow extra fields from backend
}

interface VirtualCardPreviewProps {
  card: Card
  showFullDetails?: boolean
  revealingCardId?: string | number | null
  className?: string
}

export function VirtualCardPreview({
  card,
  showFullDetails = false,
  revealingCardId = null,
  className,
}: VirtualCardPreviewProps) {
  const { user } = useAuth()

  const isRevealed = showFullDetails || card.id === revealingCardId

  const cardholderName =
    user
      ? `${user.first_name || ""} ${user.last_name || ""}`.trim().toUpperCase() || "CARD HOLDER"
      : "CARD HOLDER"

  const cardTypeLabel =
    card.card_type?.toLowerCase().includes("virtual")
      ? "VIRTUAL"
      : card.card_type?.toLowerCase().includes("physical")
      ? "PHYSICAL"
      : card.card_type?.toUpperCase() || "DEBIT"

  const displayExpiry =
    card.expiry_date && card.expiry_date.includes("-")
      ? card.expiry_date.slice(2).replace("-", "/")
      : card.expiry_date || "••/••"

  const displayNumber = isRevealed
    ? card.full_number || card.masked_number || "•••• •••• •••• ••••"
    : card.masked_number || "•••• •••• •••• ••••"

  const displayCVV = isRevealed ? card.cvv || "•••" : "•••"

  return (
    <div
      className={cn(
        "relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden shadow-2xl",
        "bg-gradient-to-br from-spartan-navy via-spartan-purple/30 to-spartan-cyan/20",
        "border border-white/10",
        isRevealed && "ring-2 ring-spartan-cyan/60 ring-offset-2 ring-offset-background",
        className
      )}
      aria-label="Virtual card preview"
    >
      {/* Glass overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/12 via-transparent to-transparent pointer-events-none" />

      {/* Glow when revealed */}
      {isRevealed && (
        <div className="absolute inset-0 bg-cyan-500/5 animate-pulse-slow pointer-events-none" />
      )}

      {/* Main content */}
      <div className="relative z-10 h-full p-[clamp(10px,2.5vw,18px)] flex flex-col justify-between">
        {/* Top row */}
        <div className="flex items-start justify-between">
          <SpartanLogo className="h-[clamp(32px,8vw,52px)] w-auto" />
          <div className="flex items-center gap-[clamp(6px,1.5vw,10px)]">
            <Wifi className="h-[clamp(18px,4.5vw,26px)] w-auto text-white/75 rotate-90" />
            <span className="text-[clamp(9px,2.2vw,13px)] font-medium text-white/90 uppercase tracking-wider">
              {cardTypeLabel}
            </span>
          </div>
        </div>

        {/* Chip + Number */}
        <div className="space-y-[clamp(12px,3vw,24px)] mt-[clamp(8px,2vw,16px)]">
          <div className="w-[clamp(48px,12vw,68px)] h-[clamp(30px,7.5vw,46px)] bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-400 rounded-lg shadow-inner flex items-center justify-center">
            <div className="w-[clamp(26px,6.5vw,38px)] h-[clamp(20px,5vw,30px)] bg-black/50 rounded-sm" />
          </div>

          <p
            className={cn(
              "font-mono text-[clamp(18px,5vw,26px)] xs:text-[clamp(20px,5.5vw,30px)] sm:text-[clamp(24px,6vw,36px)] md:text-[clamp(28px,7vw,42px)] lg:text-5xl",
              "tracking-[0.08em] xs:tracking-[0.12em] sm:tracking-[0.16em] md:tracking-[0.20em] lg:tracking-[0.24em]",
              "text-white font-light break-all hyphens-auto leading-tight",
              isRevealed && "text-shadow-glow scale-[1.01]"
            )}
            style={{ wordBreak: "break-all", hyphens: "auto" }}
          >
            {displayNumber}
          </p>
        </div>

        {/* Bottom section */}
        <div className="mt-auto flex flex-wrap justify-between items-end gap-3 pt-3 sm:pt-4 border-t border-white/10">
          {/* Cardholder */}
          <div className="max-w-[55%] sm:max-w-[48%]">
            <p className="text-[clamp(8px,2vw,11px)] text-white/65 uppercase tracking-wider font-medium">
              Card Holder
            </p>
            <p
              className="text-[clamp(11px,2.8vw,15px)] sm:text-base md:text-lg font-medium text-white truncate"
              title={cardholderName}
            >
              {cardholderName}
            </p>
          </div>

          {/* Expiry + CVV */}
          <div className="text-right space-y-1 sm:space-y-1.5 flex-shrink-0">
            <div>
              <p className="text-[clamp(8px,2vw,11px)] text-white/65 uppercase tracking-wider font-medium">
                Expires
              </p>
              <p className="text-[clamp(12px,3vw,16px)] sm:text-base md:text-lg lg:text-xl font-mono font-medium text-white">
                {displayExpiry}
              </p>
            </div>

            <div
              className={cn(
                "transition-all duration-500",
                isRevealed ? "opacity-100 max-h-20" : "opacity-0 max-h-0 overflow-hidden"
              )}
            >
              {isRevealed && (
                <>
                  <p className="text-[clamp(8px,2vw,11px)] text-white/65 uppercase tracking-wider font-medium">
                    CVV
                  </p>
                  <div className="flex items-center justify-end gap-2 sm:gap-3 mt-0.5">
                    <p className="text-[clamp(14px,3.8vw,20px)] sm:text-lg md:text-xl lg:text-2xl font-mono font-bold text-white tracking-wider">
                      {displayCVV}
                    </p>
                    <CreditCardIcon className="h-[clamp(18px,4.5vw,24px)] w-auto text-white/70" />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Decorative orbs */}
      <div className="absolute -bottom-6 -right-6 xs:-bottom-8 xs:-right-8 flex gap-2 xs:gap-3 opacity-60 pointer-events-none">
        <div className="w-10 h-10 xs:w-12 xs:h-12 rounded-full bg-red-500/60 blur-lg xs:blur-xl" />
        <div className="w-10 h-10 xs:w-12 xs:h-12 rounded-full bg-orange-400/60 -ml-6 blur-lg xs:blur-xl" />
      </div>

      {/* Status overlay */}
      {card.status && card.status !== "active" && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-20 px-3 xs:px-4 text-center">
          <span className="px-[clamp(14px,4vw,28px)] py-[clamp(8px,2vw,16px)] rounded-xl bg-white/10 border border-white/20 text-white font-bold uppercase tracking-widest text-[clamp(13px,3.8vw,20px)] sm:text-lg md:text-xl lg:text-2xl shadow-lg">
            {card.status.replace("_", " ")}
          </span>
        </div>
      )}

      {/* Lock overlay */}
      {!isRevealed && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
          <Lock className="h-[clamp(48px,12vw,88px)] w-auto text-white/40" strokeWidth={1.5} />
        </div>
      )}
    </div>
  )
}