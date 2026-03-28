"use client"

import { useState } from "react"
import { Sparkles, X } from "lucide-react"
import { useGlass, type GlassStyle } from "@/contexts/glass-context"
import { cn } from "@/lib/utils"

const glassOptions: { value: GlassStyle; label: string; description: string }[] = [
  { value: "clear", label: "Clear", description: "Maximum transparency" },
  { value: "translucent", label: "Translucent", description: "Balanced frost effect" },
  { value: "semi-opaque", label: "Semi-Opaque", description: "Moderate visibility" },
  { value: "opaque", label: "Opaque", description: "Solid glass effect" },
]

export function GlassCustomizer() {
  const [isOpen, setIsOpen] = useState(false)
  const { glassStyle, setGlassStyle } = useGlass()

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-24 right-4 z-50 md:bottom-6",
          "liquid-glass liquid-glass-glow p-3 rounded-full",
          "text-spartan-cyan hover:scale-110 transition-transform",
          "animate-pulse-glow"
        )}
        aria-label="Customize glass style"
      >
        <Sparkles className="h-5 w-5" />
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="liquid-glass liquid-glass-glow w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-spartan-cyan" />
                <h2 className="text-xl font-semibold text-foreground">Glass Style</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-3">
              {glassOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setGlassStyle(option.value)
                    setIsOpen(false)
                  }}
                  className={cn(
                    "w-full p-4 rounded-xl text-left transition-all duration-300",
                    "border border-transparent",
                    glassStyle === option.value
                      ? "bg-gradient-to-r from-spartan-cyan/20 to-spartan-purple/20 border-spartan-cyan/50"
                      : "liquid-glass hover:border-white/20"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{option.label}</p>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                    {glassStyle === option.value && (
                      <div className="h-3 w-3 rounded-full bg-spartan-cyan" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            <p className="mt-6 text-xs text-muted-foreground text-center">
              Changes apply instantly to all glass components
            </p>
          </div>
        </div>
      )}
    </>
  )
}
