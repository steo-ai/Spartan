"use client"

import { GlassProvider } from "@/contexts/glass-context"
import { AuthProvider } from "@/contexts/auth-context"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <GlassProvider>
        <div className="min-h-screen bg-gradient-to-br from-background via-spartan-navy/30 to-background dark:from-spartan-navy dark:via-background dark:to-spartan-navy/50 flex items-center justify-center p-4 relative overflow-hidden">
          {/* Background Effects */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-spartan-cyan/20 rounded-full blur-3xl animate-float" />
            <div className="absolute top-1/2 -left-40 w-96 h-96 bg-spartan-purple/20 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />
            <div className="absolute -bottom-40 right-1/3 w-96 h-96 bg-spartan-gold/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "4s" }} />
          </div>
          
          {children}
        </div>
      </GlassProvider>
    </AuthProvider>
  )
}
