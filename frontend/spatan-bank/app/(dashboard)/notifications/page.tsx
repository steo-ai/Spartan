"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Shield,
  Gift,
  AlertTriangle,
  Info,
  MoreVertical,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { enGB } from "date-fns/locale" // or enUS / your preferred locale

import { LiquidGlassCard } from "@/components/spartan/liquid-glass-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import { useAuth } from "@/contexts/auth-context" // adjust path if needed
import api from "@/lib/api"

interface Notification {
  id: string
  type: "transaction" | "security" | "promo" | "alert" | "info"
  title: string
  message: string
  timestamp: string
  is_read: boolean
  data?: {
    amount?: number
    direction?: "in" | "out"
  }
}

const getNotificationIcon = (type: Notification["type"], direction?: "in" | "out") => {
  switch (type) {
    case "transaction":
      return direction === "in" ? (
        <ArrowDownLeft className="h-5 w-5 text-emerald-400" />
      ) : (
        <ArrowUpRight className="h-5 w-5 text-red-400" />
      )
    case "security":
      return <Shield className="h-5 w-5 text-blue-400" />
    case "promo":
      return <Gift className="h-5 w-5 text-purple-400" />
    case "alert":
      return <AlertTriangle className="h-5 w-5 text-amber-400" />
    case "info":
      return <Info className="h-5 w-5 text-cyan-400" />
    default:
      return <Bell className="h-5 w-5 text-muted-foreground" />
  }
}

const getNotificationBg = (type: Notification["type"]) => {
  switch (type) {
    case "transaction":
      return "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5"
    case "security":
      return "bg-gradient-to-br from-blue-500/10 to-blue-500/5"
    case "promo":
      return "bg-gradient-to-br from-purple-500/10 to-purple-500/5"
    case "alert":
      return "bg-gradient-to-br from-amber-500/10 to-amber-500/5"
    case "info":
      return "bg-gradient-to-br from-cyan-500/10 to-cyan-500/5"
    default:
      return "bg-white/5"
  }
}

export default function NotificationsPage() {
  const { isAuthenticated } = useAuth()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "unread">("all")

  const unreadCount = notifications.filter(n => !n.is_read).length
  const filteredNotifications =
    filter === "unread" ? notifications.filter(n => !n.is_read) : notifications

  const fetchNotifications = async () => {
    if (!isAuthenticated) return

    try {
      setLoading(true)
      setError(null)

      const response = await api.notifications.getNotifications()
      // assuming response shape: { results: [...], unread_count: number }
      // or just array — adjust accordingly
      const raw = Array.isArray(response) ? response : response.results || []

      const mapped = raw.map((n: any) => ({
        id: n.id.toString(),
        type: n.type,
        title: n.title,
        message: n.message,
        timestamp: formatDistanceToNow(new Date(n.timestamp), {
          addSuffix: true,
          locale: enGB,
        }),
        is_read: n.is_read,
        data: n.amount
          ? {
              amount: n.amount,
              direction: n.direction,
            }
          : undefined,
      }))

      setNotifications(mapped)
    } catch (err: any) {
      console.error("Failed to load notifications:", err)
      setError("Could not load notifications. Please try again later.")
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      await api.notifications.markAsRead(Number(id))
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n)),
      )
    } catch (err) {
      console.error("Failed to mark as read:", err)
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.notifications.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (err) {
      console.error("Failed to mark all as read:", err)
    }
  }

  // Optional: delete if your backend supports it
  // const deleteNotification = async (id: string) => { ... }

  useEffect(() => {
    fetchNotifications()

    // Optional: auto-refresh every 45 seconds
    // const interval = setInterval(fetchNotifications, 45000)
    // return () => clearInterval(interval)
  }, [isAuthenticated])

  if (!isAuthenticated) {
    return (
      <div className="text-center py-16">
        <Bell className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold">Please sign in</h2>
        <p className="text-muted-foreground mt-2">
          You need to be logged in to view notifications.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        <AlertTriangle className="mx-auto h-12 w-12 mb-4" />
        <p>{error}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={fetchNotifications}
        >
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notifications`
              : "All caught up!"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 glass-clear border-white/10"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="glass-clear border-white/10"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-clear border-white/10">
              <DropdownMenuItem onClick={markAllAsRead}>
                <CheckCheck className="h-4 w-4 mr-2" />
                Mark all as read
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* <DropdownMenuItem className="text-red-400" onClick={clearAll}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear all notifications
              </DropdownMenuItem> */}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filters */}
      <Tabs value={filter} onValueChange={v => setFilter(v as "all" | "unread")}>
        <TabsList className="glass-clear border border-white/10 p-1">
          <TabsTrigger value="all" className="data-[state=active]:bg-white/10">
            All
            <Badge variant="secondary" className="ml-2 bg-white/10">
              {notifications.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="unread" className="data-[state=active]:bg-white/10">
            Unread
            {unreadCount > 0 && (
              <Badge variant="default" className="ml-2 bg-primary">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Notifications List */}
      <LiquidGlassCard className="p-4">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No notifications</h3>
            <p className="text-muted-foreground text-sm">
              {filter === "unread"
                ? "You've read all your notifications"
                : "You don't have any notifications yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filteredNotifications.map((notification, index) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "relative p-4 rounded-xl transition-all cursor-pointer group",
                    getNotificationBg(notification.type),
                    !notification.is_read && "border-l-2 border-primary",
                  )}
                  onClick={() => !notification.is_read && markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                        notification.type === "transaction" &&
                          notification.data?.direction === "in"
                          ? "bg-emerald-500/20"
                          : notification.type === "transaction"
                          ? "bg-red-500/20"
                          : notification.type === "security"
                          ? "bg-blue-500/20"
                          : notification.type === "promo"
                          ? "bg-purple-500/20"
                          : notification.type === "alert"
                          ? "bg-amber-500/20"
                          : "bg-cyan-500/20",
                      )}
                    >
                      {getNotificationIcon(notification.type, notification.data?.direction)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4
                          className={cn(
                            "font-medium",
                            !notification.is_read && "text-foreground",
                          )}
                        >
                          {notification.title}
                        </h4>
                        {!notification.is_read && (
                          <span className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-2">
                        {notification.timestamp}
                      </p>
                    </div>

                    {notification.data?.amount && (
                      <div
                        className={cn(
                          "text-right shrink-0",
                          notification.data.direction === "in"
                            ? "text-emerald-400"
                            : "text-red-400",
                        )}
                      >
                        <span className="font-mono font-semibold">
                          {notification.data.direction === "in" ? "+" : "-"}
                          KES {notification.data.amount.toLocaleString()}
                        </span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      {!notification.is_read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-white/10"
                          onClick={e => {
                            e.stopPropagation()
                            markAsRead(notification.id)
                          }}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      {/* Uncomment if you implement delete on backend
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-red-500/10 hover:text-red-400"
                        onClick={e => {
                          e.stopPropagation()
                          deleteNotification(notification.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button> */}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </LiquidGlassCard>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Transactions",
            count: notifications.filter(n => n.type === "transaction").length,
            icon: CreditCard,
            color: "emerald",
          },
          {
            label: "Security",
            count: notifications.filter(n => n.type === "security").length,
            icon: Shield,
            color: "blue",
          },
          {
            label: "Promotions",
            count: notifications.filter(n => n.type === "promo").length,
            icon: Gift,
            color: "purple",
          },
          {
            label: "Alerts",
            count: notifications.filter(n => n.type === "alert").length,
            icon: AlertTriangle,
            color: "amber",
          },
        ].map(stat => (
          <LiquidGlassCard key={stat.label} className="p-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  stat.color === "emerald" && "bg-emerald-500/20",
                  stat.color === "blue" && "bg-blue-500/20",
                  stat.color === "purple" && "bg-purple-500/20",
                  stat.color === "amber" && "bg-amber-500/20",
                )}
              >
                <stat.icon
                  className={cn(
                    "h-5 w-5",
                    stat.color === "emerald" && "text-emerald-400",
                    stat.color === "blue" && "text-blue-400",
                    stat.color === "purple" && "text-purple-400",
                    stat.color === "amber" && "text-amber-400",
                  )}
                />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.count}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </LiquidGlassCard>
        ))}
      </div>
    </div>
  )
}