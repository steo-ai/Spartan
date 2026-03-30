"use client"

import { cn } from "@/lib/utils"
import { type ReactNode, forwardRef, InputHTMLAttributes, MouseEvent, ElementType } from "react"
import { Slot } from "@radix-ui/react-slot"

// ─── LiquidGlassCard ─────────────────────────────────────────────────────
interface LiquidGlassCardProps {
  children: ReactNode
  className?: string
  variant?: "default" | "cyan" | "purple" | "gold" | "neon"
  glow?: boolean
  hover?: boolean
  onClick?: () => void
}

export function LiquidGlassCard({
  children,
  className,
  variant = "default",
  glow = false,
  hover = false,
  onClick,
}: LiquidGlassCardProps) {
  const variantClasses = {
    default: "",
    cyan: "card-gradient-cyan",
    purple: "card-gradient-purple",
    gold: "card-gradient-gold",
    neon: "liquid-glass-neon",
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        // Base glass card styles - Responsive padding & radius
        "liquid-glass relative overflow-hidden rounded-2xl sm:rounded-3xl",
        "p-4 sm:p-5 md:p-6",                    // Smaller padding on mobile
        "transition-all duration-300",

        // Variant styles
        variantClasses[variant],

        // Glow effect - subtler on mobile
        glow && "liquid-glass-glow",
        glow && "sm:liquid-glass-glow",         // Stronger glow only on larger screens

        // Hover effects - disabled/reduced on mobile for better UX
        hover && "hover:scale-[1.02] active:scale-[0.985] sm:hover:scale-[1.02]",
        hover && "cursor-pointer",

        // Clickable state
        onClick && "cursor-pointer active:scale-[0.985]",

        // Extra polish for small screens
        "min-h-[80px] sm:min-h-0",              // Prevents cards from being too tall on very small screens

        className
      )}
    >
      {children}
    </div>
  )
}

// ─── LiquidGlassButton (Improved responsiveness) ─────────────────────
interface LiquidGlassButtonProps {
  children: ReactNode
  className?: string
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "md" | "lg"
  disabled?: boolean
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  type?: "button" | "submit" | "reset"
  asChild?: boolean
  as?: ElementType
}

export const LiquidGlassButton = forwardRef<
  HTMLButtonElement,
  LiquidGlassButtonProps
>(({
  children,
  className,
  variant = "primary",
  size = "md",
  disabled = false,
  onClick,
  type = "button",
  asChild = false,
  as: Component = "button",
  ...props
}, ref) => {
  const variantClasses = {
    primary: "bg-gradient-to-r from-spartan-cyan to-spartan-purple text-white hover:opacity-90 active:opacity-95",
    secondary: "liquid-glass hover:bg-white/10 active:bg-white/15",
    ghost: "hover:bg-white/5 active:bg-white/10",
    danger: "bg-gradient-to-r from-spartan-error to-red-600 text-white hover:opacity-90",
  }

  const sizeClasses = {
    sm: "px-4 py-2 text-sm",
    md: "px-5 py-2.5 text-base",
    lg: "px-6 py-3.5 text-base sm:text-lg",
  }

  const baseClasses = cn(
    "liquid-ripple relative rounded-2xl font-medium transition-all duration-300",
    "focus:outline-none focus:ring-2 focus:ring-spartan-cyan/50 focus:ring-offset-2 focus:ring-offset-background",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "active:scale-[0.97] sm:active:scale-[0.985]",   // Better touch feedback on mobile
    variantClasses[variant],
    sizeClasses[size],
    className
  )

  if (asChild) {
    return (
      <Slot
        ref={ref}
        className={baseClasses}
        onClick={onClick}
        {...props}
      >
        {children}
      </Slot>
    )
  }

  return (
    <Component
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={baseClasses}
      {...props}
    >
      {children}
    </Component>
  )
})

LiquidGlassButton.displayName = "LiquidGlassButton"

// ─── LiquidGlassInput ────────────────────────────────────────────────────
interface LiquidGlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  icon?: ReactNode
}

export const LiquidGlassInput = forwardRef<HTMLInputElement, LiquidGlassInputProps>(
  (
    {
      type = "text",
      placeholder,
      value,
      onChange,
      className,
      icon,
      disabled = false,
      ...props
    },
    ref
  ) => {
    return (
      <div className={cn("relative", className)}>
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          {...props}
          className={cn(
            "liquid-glass w-full rounded-2xl border-0 bg-white/5",
            "px-4 py-3.5 text-base",                    // Better padding & text size
            "text-foreground placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-spartan-cyan/50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-all duration-300",
            icon && "pl-12",
            className
          )}
        />
      </div>
    )
  }
)

LiquidGlassInput.displayName = "LiquidGlassInput"

// ─── LiquidGlassSelect ───────────────────────────────────────────────────
interface LiquidGlassSelectProps {
  value?: string
  onChange?: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  className?: string
  disabled?: boolean
  icon?: ReactNode
}

export function LiquidGlassSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled = false,
  icon,
}: LiquidGlassSelectProps) {
  return (
    <div className={cn("relative", className)}>
      {icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10">
          {icon}
        </div>
      )}
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        className={cn(
          "liquid-glass w-full rounded-2xl border-0 bg-white/5",
          "px-4 py-3.5 text-base appearance-none cursor-pointer",
          "text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-spartan-cyan/50",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "transition-all duration-300",
          icon && "pl-12",
          className
        )}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-background">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}