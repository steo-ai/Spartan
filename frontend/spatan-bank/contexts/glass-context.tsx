"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

export type GlassStyle = "clear" | "translucent" | "semi-opaque" | "opaque"

interface GlassContextType {
  glassStyle: GlassStyle
  setGlassStyle: (style: GlassStyle) => void
  mode: any
}

const GlassContext = createContext<GlassContextType | undefined>(undefined)

export function GlassProvider({ children }: { children: ReactNode }) {
  const [glassStyle, setGlassStyle] = useState<GlassStyle>("translucent")
  const [mode, setMode] = useState<any>(null)

  useEffect(() => {
    const saved = localStorage.getItem("spartan-glass-style") as GlassStyle | null
    if (saved && ["clear", "translucent", "semi-opaque", "opaque"].includes(saved)) {
      setGlassStyle(saved)
    }
    const savedMode = localStorage.getItem("spartan-glass-mode")
    if (savedMode) {
      setMode(savedMode)
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute("data-glass", glassStyle)
    localStorage.setItem("spartan-glass-style", glassStyle)
  }, [glassStyle])

  useEffect(() => {
    if (mode) {
      localStorage.setItem("spartan-glass-mode", mode)
    }
  }, [mode])

  return (
    <GlassContext.Provider value={{ glassStyle, setGlassStyle, mode }}>
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
