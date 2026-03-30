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
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top Navigation */}
      <TopNavbar 
        showMobileSidebar={showMobileSidebar} 
        setShowMobileSidebar={setShowMobileSidebar} 
      />

      {/* Main Layout Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <AppSidebar />

        {/* Mobile Sidebar Overlay + Sidebar */}
        {showMobileSidebar && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setShowMobileSidebar(false)}
            />
            <div className="fixed left-0 top-16 bottom-20 w-72 z-40 md:hidden animate-in slide-in-from-left duration-300 overflow-y-auto bg-background border-r border-white/10">
              <AppSidebar isMobile onClose={() => setShowMobileSidebar(false)} />
            </div>
          </>
        )}

        {/* Main Content Area */}
        <main 
          className={`
            flex-1 overflow-y-auto w-full transition-all duration-300 
            md:ml-0 pb-20 md:pb-0
            ${showMobileSidebar ? "md:opacity-100 md:pointer-events-auto" : ""}
          `}
        >
          <div className="p-4 sm:p-5 md:p-6 lg:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  )
}