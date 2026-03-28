"use client"

import { cn } from "@/lib/utils"

interface SpartanLogoProps {
  className?: string
}

export function SpartanLogo({ className }: SpartanLogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("text-spartan-cyan", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Shield Background */}
      <defs>
        <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="oklch(0.75 0.15 200)" />
          <stop offset="50%" stopColor="oklch(0.65 0.25 280)" />
          <stop offset="100%" stopColor="oklch(0.75 0.15 200)" />
        </linearGradient>
        <linearGradient id="helmetGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="oklch(0.85 0.1 200)" />
          <stop offset="100%" stopColor="oklch(0.55 0.2 260)" />
        </linearGradient>
      </defs>
      
      {/* Shield Shape */}
      <path
        d="M50 5 L85 20 L85 50 C85 75 50 95 50 95 C50 95 15 75 15 50 L15 20 Z"
        fill="url(#shieldGradient)"
        stroke="url(#helmetGradient)"
        strokeWidth="2"
        opacity="0.9"
      />
      
      {/* Spartan Helmet */}
      <g transform="translate(25, 18)">
        {/* Helmet Top/Crest */}
        <path
          d="M25 0 L30 10 L25 8 L20 10 Z"
          fill="url(#helmetGradient)"
        />
        
        {/* Helmet Main */}
        <path
          d="M10 15 L40 15 L42 35 L38 55 L35 60 L15 60 L12 55 L8 35 Z"
          fill="url(#helmetGradient)"
          stroke="oklch(0.85 0.1 200)"
          strokeWidth="1"
        />
        
        {/* Helmet Plume */}
        <path
          d="M25 5 C25 5 35 8 35 15 L25 12 L15 15 C15 8 25 5 25 5"
          fill="oklch(0.6 0.25 25)"
        />
        
        {/* Eye Slot */}
        <path
          d="M12 30 L38 30 L36 38 L14 38 Z"
          fill="oklch(0.12 0.02 260)"
        />
        
        {/* Nose Guard */}
        <path
          d="M23 30 L27 30 L26 50 L24 50 Z"
          fill="url(#helmetGradient)"
          stroke="oklch(0.85 0.1 200)"
          strokeWidth="0.5"
        />
        
        {/* Cheek Guards */}
        <path
          d="M12 38 L18 38 L16 55 L15 55 Z"
          fill="url(#helmetGradient)"
        />
        <path
          d="M38 38 L32 38 L34 55 L35 55 Z"
          fill="url(#helmetGradient)"
        />
      </g>
      
      {/* Decorative Lines */}
      <path
        d="M25 75 L50 85 L75 75"
        stroke="oklch(0.75 0.15 200)"
        strokeWidth="2"
        fill="none"
        opacity="0.6"
      />
    </svg>
  )
}

export function SpartanLogoText({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <SpartanLogo className="h-12 w-12" />
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-spartan-cyan to-spartan-purple bg-clip-text text-transparent">
          Spartan Bank
        </h1>
        <p className="text-xs text-muted-foreground tracking-widest uppercase">Digital Banking</p>
      </div>
    </div>
  )
}
