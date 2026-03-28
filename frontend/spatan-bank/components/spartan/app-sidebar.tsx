"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Receipt,
  CreditCard,
  History,
  User,
  Bell,
  LogOut,
  Shield,
  Landmark,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { SpartanLogo } from "./spartan-logo"
import { useEffect, useState, useCallback } from "react"
import api from "@/lib/api"

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/accounts", icon: Wallet, label: "Accounts" },
  { href: "/transfers", icon: ArrowLeftRight, label: "Transfers" },
  { href: "/bills", icon: Receipt, label: "Bills & Airtime" },
  { href: "/cards", icon: CreditCard, label: "Cards" },
  { href: "/notifications", icon: Bell, label: "Notifications" },
  { href: "/transactions", icon: History, label: "Transactions" },
  { href: "/loans", icon: Landmark, label: "Loans" },
  { href: "/profile", icon: User, label: "Profile" },
]

interface AppSidebarProps {
  isMobile?: boolean
  onClose?: () => void
}

export function AppSidebar({ isMobile, onClose }: AppSidebarProps = {}) {
  const pathname = usePathname()
  const { user, logout, isAuthenticated } = useAuth()
  
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [loading, setLoading] = useState(false)

  // Fetch unread notifications count
  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return

    setLoading(true)
    try {
      // Best approach: Call the notifications endpoint and count unread ones
      const response = await api.notifications.getNotifications()
      
      // Handle both paginated and non-paginated responses
      let notifications = []
      if (response?.results && Array.isArray(response.results)) {
        notifications = response.results
      } else if (Array.isArray(response)) {
        notifications = response
      }

      const unread = notifications.filter((notif: any) => !notif.is_read)
      setUnreadCount(unread.length)
      
    } catch (err) {
      console.error("Failed to fetch unread notifications:", err)
      setUnreadCount(0)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  // Initial fetch + refresh every 45 seconds
  useEffect(() => {
    fetchUnreadCount()

    const interval = setInterval(fetchUnreadCount, 45000) // every 45 seconds
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  // Optional: Refresh when window regains focus (good UX)
  useEffect(() => {
    const handleFocus = () => fetchUnreadCount()
    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [fetchUnreadCount])

  const sidebarClass = isMobile 
    ? "flex flex-col w-full h-full liquid-glass border-r border-white/10" 
    : "hidden md:flex flex-col w-64 h-screen liquid-glass border-r border-white/10 fixed left-0 top-0 z-40"

  return (
    <aside className={sidebarClass}>
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-3">
          <SpartanLogo className="h-10 w-10" />
          <div>
            <h1 className="font-bold text-lg text-foreground">Spartan Bank</h1>
            <p className="text-xs text-spartan-cyan">Digital Banking</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const showBadge = item.href === "/notifications" && unreadCount > 0

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => isMobile && onClose?.()}
              className={cn(
                "flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                "hover:bg-white/10",
                isActive && "bg-gradient-to-r from-spartan-cyan/20 to-spartan-purple/20 text-spartan-cyan"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className={cn("h-5 w-5", isActive ? "text-spartan-cyan" : "text-muted-foreground")} />
                <span className={cn("font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>
                  {item.label}
                </span>
              </div>

              {showBadge && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-[1.25rem] text-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-white/10">
        {user && (
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-spartan-cyan to-spartan-purple flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {user?.first_name?.[0]}{user?.last_name?.[0] || "?"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3 text-spartan-success" />
                <span className="text-xs text-spartan-success">Verified</span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-spartan-error hover:bg-spartan-error/10 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Mobile Bottom Nav
// ────────────────────────────────────────────────────────────────────────────────
export function MobileBottomNav() {
  const pathname = usePathname()
  const { isAuthenticated } = useAuth()

  const mobileNavItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
    { href: "/accounts", icon: Wallet, label: "Accounts" },
    { href: "/transfers", icon: ArrowLeftRight, label: "Transfer" },
    { href: "/cards", icon: CreditCard, label: "Cards" },
    { href: "/profile", icon: User, label: "Profile" },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 liquid-glass border-t border-white/10">
      <div className="flex items-center justify-around py-2">
        {mobileNavItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all relative",
                isActive ? "text-spartan-cyan" : "text-muted-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "animate-pulse")} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}