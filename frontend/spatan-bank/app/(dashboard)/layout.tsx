"use client"

import { useState } from "react"
import { AppSidebar, MobileBottomNav } from "@/components/spartan/app-sidebar"
import { TopNavbar } from "@/components/spartan/top-navbar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top Navigation */}
      <TopNavbar showMobileSidebar={showMobileSidebar} setShowMobileSidebar={setShowMobileSidebar} />

      {/* Main Layout Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <AppSidebar />

        {/* Mobile Sidebar - Slides from left */}
        {showMobileSidebar && (
          <>
            {/* Translucent Overlay - Professional dimming effect */}
            <div
              className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
              onClick={() => setShowMobileSidebar(false)}
            />
            {/* Mobile Sidebar */}
            <div className="fixed left-0 top-16 bottom-20 w-64 z-40 md:hidden animate-in slide-in-from-left duration-300 overflow-y-auto">
              <AppSidebar isMobile onClose={() => setShowMobileSidebar(false)} />
            </div>
          </>
        )}

        {/* Main Content Area */}
        <main className={`flex-1 overflow-y-auto md:ml-0 mb-20 md:mb-0 w-full transition-all duration-300 ${showMobileSidebar ? "opacity-50 pointer-events-none md:opacity-100 md:pointer-events-auto" : "opacity-100"}`}>
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  )
}
