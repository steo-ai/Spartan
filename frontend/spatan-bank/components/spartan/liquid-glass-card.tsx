"use client"

import { cn } from "@/lib/utils"
import { type ReactNode, forwardRef, InputHTMLAttributes, MouseEvent, ElementType } from "react"
import { Slot } from "@radix-ui/react-slot"   // ← Add this import

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
        "liquid-glass relative overflow-hidden rounded-3xl p-6 transition-all duration-300",
        variantClasses[variant],
        glow && "liquid-glass-glow",
        hover && "liquid-ripple cursor-pointer hover:scale-[1.02] hover:shadow-2xl active:scale-[0.985]",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  )
}

// ─── LiquidGlassButton (UPDATED with asChild support) ─────────────────────
interface LiquidGlassButtonProps {
  children: ReactNode
  className?: string
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "md" | "lg"
  disabled?: boolean
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  type?: "button" | "submit" | "reset"
  asChild?: boolean          // ← Added
  as?: ElementType           // Optional: allow custom element
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
  as: Component = "button",   // default to button
  ...props
}, ref) => {
  const variantClasses = {
    primary: "bg-gradient-to-r from-spartan-cyan to-spartan-purple text-white hover:opacity-90",
    secondary: "liquid-glass hover:bg-white/10",
    ghost: "hover:bg-white/5",
    danger: "bg-gradient-to-r from-spartan-error to-red-600 text-white hover:opacity-90",
  }

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  }

  const baseClasses = cn(
    "liquid-ripple relative rounded-xl font-medium transition-all duration-300",
    "focus:outline-none focus:ring-2 focus:ring-spartan-cyan/50",
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
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
      name,
      required = false,
      maxLength,
      autoFocus,
      autoComplete,
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
          name={name}
          required={required}
          maxLength={maxLength}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          {...props}
          className={cn(
            "liquid-glass w-full rounded-xl border-0 bg-white/5 px-4 py-3",
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
          "liquid-glass w-full rounded-xl border-0 bg-white/5 px-4 py-3",
          "text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-spartan-cyan/50",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "transition-all duration-300",
          "appearance-none cursor-pointer",
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