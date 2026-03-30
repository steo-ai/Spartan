// contexts/glass-context.tsx
"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

export type GlassStyle = "clear" | "translucent" | "semi-opaque" | "opaque"

interface GlassContextType {
  glassStyle: GlassStyle
  setGlassStyle: (style: GlassStyle) => void
  mode: string | null
  setMode: (mode: string | null) => void
}

const GlassContext = createContext<GlassContextType | undefined>(undefined)

export function GlassProvider({ children }: { children: ReactNode }) {
  const [glassStyle, setGlassStyle] = useState<GlassStyle>("translucent")
  const [mode, setMode] = useState<string | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    const savedStyle = localStorage.getItem("spartan-glass-style") as GlassStyle | null
    if (savedStyle && ["clear", "translucent", "semi-opaque", "opaque"].includes(savedStyle)) {
      setGlassStyle(savedStyle)
    }

    const savedMode = localStorage.getItem("spartan-glass-mode")
    if (savedMode) {
      setMode(savedMode)
    }
  }, [])

  // Save glass style to localStorage and DOM
  useEffect(() => {
    document.documentElement.setAttribute("data-glass", glassStyle)
    localStorage.setItem("spartan-glass-style", glassStyle)
  }, [glassStyle])

  // Save mode to localStorage
  useEffect(() => {
    if (mode !== null) {
      localStorage.setItem("spartan-glass-mode", mode)
    }
  }, [mode])

  return (
    <GlassContext.Provider value={{ 
      glassStyle, 
      setGlassStyle, 
      mode, 
      setMode 
    }}>
      {children}
    </GlassContext.Provider>
  )
}

export function useGlass() {
  const context = useContext(GlassContext)
  if (context === undefined) {
    throw new Error("useGlass must be used within a GlassProvider")
  }
  return context
}