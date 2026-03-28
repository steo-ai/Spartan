"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { Bell, Moon, Sun, Menu, X } from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { SpartanLogo } from "./spartan-logo"
import api from "@/lib/api"

interface TopNavbarProps {
  showMobileSidebar: boolean
  setShowMobileSidebar: (show: boolean) => void
}

interface NotificationItem {
  id: string
  title: string
  message: string
  time: string
  unread: boolean
}

export function TopNavbar({ showMobileSidebar, setShowMobileSidebar }: TopNavbarProps) {
  const { theme, setTheme } = useTheme()
  const { user, isAuthenticated } = useAuth()

  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const bellRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; right: number }>({
    top: 0,
    right: 0,
  })

  // Calculate dropdown position under the bell icon
  const updatePosition = () => {
    if (bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect()
      setDropdownStyle({
        top: rect.bottom + window.scrollY + 8,
        right: window.innerWidth - rect.right - 8,
      })
    }
  }

  useEffect(() => {
    if (showNotifications) {
      updatePosition()
      window.addEventListener("resize", updatePosition)
      window.addEventListener("scroll", updatePosition)
    }
    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition)
    }
  }, [showNotifications])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
        bellRef.current && !bellRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // ====================== FETCH NOTIFICATIONS ======================
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return

    setLoading(true)
    try {
      // Fetch recent notifications (max 6)
      const recentRes = await api.notifications.getNotifications()
      
      let recentNotifications: any[] = []
      if (recentRes?.results && Array.isArray(recentRes.results)) {
        recentNotifications = recentRes.results
      } else if (Array.isArray(recentRes)) {
        recentNotifications = recentRes
      }

      // Map to our UI format
      const mapped = recentNotifications.slice(0, 6).map((item: any) => ({
        id: String(item.id),
        title: item.title || "Notification",
        message: item.message || "",
        time: item.timestamp 
          ? new Date(item.timestamp).toLocaleDateString('en-KE', { 
              month: 'short', 
              day: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit' 
            })
          : "recent",
        unread: !item.is_read,
      }))

      setNotifications(mapped)

      // Calculate unread count from the fetched data
      const unread = mapped.filter((n) => n.unread).length
      setUnreadCount(unread)

    } catch (err) {
      console.error("Failed to load notifications:", err)
      setNotifications([])
      setUnreadCount(0)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  // Auto fetch + refresh
  useEffect(() => {
    fetchNotifications()

    const interval = setInterval(fetchNotifications, 45000) // every 45 seconds
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Refresh when window regains focus
  useEffect(() => {
    const handleFocus = () => fetchNotifications()
    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [fetchNotifications])

  return (
    <>
      <header className="sticky top-0 z-50 w-full">
        <div className="liquid-glass border-b border-white/10">
          <div className="flex items-center justify-between px-4 py-3 md:px-6 h-16">
            {/* Mobile menu + logo */}
            <div className="flex items-center gap-3 md:hidden">
              <button
                onClick={() => setShowMobileSidebar(!showMobileSidebar)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                {showMobileSidebar ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <Link href="/dashboard" className="flex items-center gap-2">
                <SpartanLogo className="h-8 w-8" />
                <span className="font-bold text-foreground">Spartan</span>
              </Link>
            </div>

            {/* Desktop welcome */}
            <div className="hidden md:block">
              <h2 className="text-lg font-semibold text-foreground">
                Welcome back, {user?.first_name || "User"}
              </h2>
              <p className="text-sm text-muted-foreground">Manage your finances with ease</p>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              {/* Theme Toggle */}
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2.5 rounded-xl hover:bg-white/10 transition-colors"
                aria-label="Toggle theme"
              >
                <Sun className="h-5 w-5 hidden dark:block text-spartan-gold" />
                <Moon className="h-5 w-5 dark:hidden text-spartan-purple" />
              </button>

              {/* Notifications Bell */}
              <button
                ref={bellRef}
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2.5 rounded-xl hover:bg-white/10 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white ring-2 ring-background">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {/* User Avatar */}
              <div className="hidden md:flex items-center gap-3 ml-2 pl-4 border-l border-white/10">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {(user?.first_name?.[0] || "?") + (user?.last_name?.[0] || "")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Notifications Dropdown */}
      {showNotifications && (
        <div
          ref={dropdownRef}
          className={cn(
            "fixed z-[9999] w-80 sm:w-96 rounded-xl shadow-2xl overflow-hidden",
            "bg-black/85 backdrop-blur-xl border border-white/25",
            "max-h-[75vh] overflow-y-auto pointer-events-auto"
          )}
          style={{
            top: `${dropdownStyle.top}px`,
            right: `${dropdownStyle.right}px`,
          }}
        >
          <div className="sticky top-0 z-10 bg-black/70 backdrop-blur-lg p-4 border-b border-white/10">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-sm text-cyan-300">{unreadCount} unread</span>
              )}
            </div>
          </div>

          <div className="divide-y divide-white/5 bg-black/50">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 animate-pulse flex gap-3">
                  <div className="h-2 w-2 rounded-full bg-white/20 mt-3" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-white/10 rounded w-3/4" />
                    <div className="h-3 bg-white/5 rounded w-full" />
                    <div className="h-3 bg-white/5 rounded w-2/3" />
                  </div>
                </div>
              ))
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <Bell className="mx-auto h-10 w-10 opacity-50 mb-3" />
                <p>No new notifications</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "p-4 hover:bg-white/5 transition-colors cursor-pointer",
                    n.unread && "bg-cyan-950/30"
                  )}
                >
                  <div className="flex gap-3">
                    {n.unread && (
                      <div className="mt-1.5 h-2 w-2 rounded-full bg-cyan-400 flex-shrink-0" />
                    )}
                    <div className={cn(!n.unread && "ml-5")}>
                      <p className="font-medium text-white text-sm">{n.title}</p>
                      <p className="mt-1 text-sm text-gray-300 line-clamp-2">{n.message}</p>
                      <p className="mt-2 text-xs text-cyan-400/70">{n.time}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="sticky bottom-0 border-t border-white/10 bg-black/70 backdrop-blur-md p-3">
            <Link
              href="/notifications"
              onClick={() => setShowNotifications(false)}
              className="block text-center text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </>
  )
}