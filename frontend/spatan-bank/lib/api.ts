"use client"

import { UserProfile, Account, Card, Transaction } from "@/lib/types"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"
//const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://spartan-swjb.onrender.com/api"

// ─── Generic Fetch Wrapper ───────────────────────────────────────────────────────
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit & { noAuth?: boolean } = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`

  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  }

  if (!options.noAuth && token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(url, { ...options, headers })

  if (!res.ok) {
    let errorText = `HTTP ${res.status} - ${endpoint}`
    try {
      const errorJson = await res.json()
      errorText += ` | ${errorJson.detail || errorJson.error || errorJson.message || JSON.stringify(errorJson)}`
    } catch {
      try {
        errorText += ` | ${await res.text()}`
      } catch {}
    }
    const error = new Error(errorText)
    ;(error as any).status = res.status
    throw error
  }

  const contentType = res.headers.get("content-type")
  if (contentType?.includes("application/json")) {
    return res.json() as Promise<T>
  }

  return res.text() as unknown as T
}

// ─── Notification Type ───────────────────────────────────────────────────────────
export interface NotificationResponse {
  id: number
  type: "transaction" | "security" | "promo" | "alert" | "info"
  title: string
  message: string
  timestamp: string
  is_read: boolean
  amount?: number
  direction?: "in" | "out"
}

// ─── Paginated Response (DRF style) ──────────────────────────────────────────────
export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
// ─── AUTH ────────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<{
      access?: string;
      refresh?: string;
      device_token?: string;
      challenge?: string;
      question?: string;
      email?: string;
      message?: string;
    }>("/accounts/login/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      noAuth: true,
    }),

  verifySecurityQuestion: (
    email: string,
    securityAnswer: string,
    device_name: string = "Web Browser"
  ) =>
    apiFetch<{
      access: string;
      refresh: string;
      device_token: string;
      message: string;
      user?: {
        id: number;
        email: string;
        first_name: string;
        last_name: string;
      };
    }>("/accounts/login/verify-question/", {
      method: "POST",
      body: JSON.stringify({ 
        email, 
        answer: securityAnswer, 
        device_name 
      }),
      noAuth: true,
    }),

  // Biometric Login
  biometricLogin: (device_token: string, device_name: string = "Biometric Device") =>
    apiFetch<{
      access: string;
      refresh: string;
      message: string;
      user: {
        id: number;
        email: string;
        first_name: string;
        last_name: string;
      };
      device_name?: string;
      biometric_type?: string;
    }>("/accounts/login/biometric/", {
      method: "POST",
      body: JSON.stringify({ 
        device_token, 
        device_name 
      }),
      noAuth: true,
    }),

// In api.ts → inside authApi object

  // Updated enableBiometric - accepts explicit biometric_type
  enableBiometric: (device_token: string, device_name: string, biometric_type: "fingerprint" | "face_id") =>
    apiFetch<{
      message: string;
      device_token?: string;
      biometric_type?: string;
      is_new_device?: boolean;
    }>("/accounts/profiles/enable-biometric/", {
      method: "POST",
      body: JSON.stringify({ 
        device_token, 
        device_name,
        biometric_type: biometric_type   // ← Send exactly what user chose
      }),
    }),
    
  // Logout
  logout: (refreshToken?: string) => 
    apiFetch<{ detail?: string; message?: string }>("/accounts/logout/", { 
      method: "POST",
      body: refreshToken ? JSON.stringify({ refresh: refreshToken }) : undefined,
      noAuth: true,   // usually logout doesn't need auth header
    }),

  register: (data: {
    email: string
    password: string
    first_name: string
    last_name: string
    phone_number?: string
    date_of_birth?: string
    security_question: string
    security_answer: string
    national_id?: string
  }) =>
    apiFetch<{ message: string; email: string }>("/accounts/register/", {
      method: "POST",
      body: JSON.stringify(data),
      noAuth: true,
    }),

  verifyOtp: (payload: { email: string; otp: string }) =>
    apiFetch<{ message: string }>("/accounts/verify-otp/", {
      method: "POST",
      body: JSON.stringify(payload),
      noAuth: true,
    }),

  resendOtp: (payload: { email: string }) =>
    apiFetch<{ message: string }>("/accounts/resend-otp/", {
      method: "POST",
      body: JSON.stringify(payload),
      noAuth: true,
    }),
}
// ─── ACCOUNTS ────────────────────────────────────────────────────────────────────
export const accountsApi = {
  getCurrentUser: () => apiFetch<UserProfile>("/accounts/profiles/me/"),

  getAccounts: () => apiFetch<Account[]>("/accounts/accounts/"),

  getAccount: (accountId: number) => apiFetch<Account>(`/accounts/accounts/${accountId}/`),

  getMiniStatement: (accountId: number, days = 30, limit = 50) =>
    apiFetch<any>(
      `/accounts/accounts/${accountId}/mini-statement/?days=${days}&limit=${limit}`
    ),

  openAccount: (payload: { account_type: "savings" | "checking" | "loan" }) =>
    apiFetch<Account>("/accounts/accounts/open_account/", {   // ← Fixed: Use the correct action endpoint
      method: "POST",
      body: JSON.stringify(payload),
    }),

  
}

// ─── TRANSACTIONS ────────────────────────────────────────────────────────────────
export const transactionsApi = {
  getTransactions: (params: {
    page?: number
    page_size?: number
    start?: string
    end?: string
    type?: string
    cat?: string
    search?: string
    account?: number | string
  } = {}) => {
    const query = new URLSearchParams()
    if (params.page !== undefined) query.set("page", params.page.toString())
    if (params.page_size !== undefined) query.set("page_size", params.page_size.toString())
    if (params.start) query.set("start", params.start)
    if (params.end) query.set("end", params.end)
    if (params.type) query.set("type", params.type)
    if (params.cat) query.set("cat", params.cat)
    if (params.search?.trim()) query.set("search", params.search.trim())
    if (params.account) query.set("account", String(params.account))

    const qs = query.toString()
    return apiFetch<Paginated<Transaction>>(
      `/accounts/transactions/${qs ? `?${qs}` : ""}`
    )
  },

  getTransaction: (txId: number | string) =>
    apiFetch<Transaction>(`/accounts/transactions/${txId}/`),
}

// ─── CARDS ───────────────────────────────────────────────────────────────────────
export const cardsApi = {
  list: () => apiFetch<Card[]>("/cards/cards/"),

  generateVirtual: (payload: {
    account: number
    daily_limit?: number | string
    tx_limit?: number | string
  }) =>
    apiFetch<{ message: string; card: Card }>("/cards/cards/generate_virtual/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  reveal: (cardId: number | string, payload: { pin: string }) =>
    apiFetch<{ message: string; card: Card }>("/cards/cards/" + cardId + "/reveal/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  freeze: (cardId: number | string) =>
    apiFetch<{ message: string }>("/cards/cards/" + cardId + "/freeze/", { method: "POST" }),

  unfreeze: (cardId: number | string) =>
    apiFetch<{ message: string }>("/cards/cards/" + cardId + "/unfreeze/", { method: "POST" }),

  setLimits: (cardId: number | string, payload: { daily_limit?: number; transaction_limit?: number }) =>
    apiFetch<{ message: string; card: Card }>("/cards/cards/" + cardId + "/set_limits/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Per-card transactions
  getCardTransactions: (cardId: number | string, params: { limit?: number; offset?: number } = {}) => {
    const query = new URLSearchParams()
    if (params.limit) query.set("limit", params.limit.toString())
    if (params.offset) query.set("offset", params.offset.toString())
    return apiFetch<Paginated<CardTransaction>>(
      `/cards/cards/${cardId}/transactions/?${query.toString()}`
    )
  },

  // ←←← NEW: Global card transactions (ALL transactions across user's cards)
  // This is what your frontend was trying to call
  getAllCardTransactions: (params: { limit?: number } = {}) => {
    const query = new URLSearchParams()
    if (params.limit) query.set("limit", params.limit.toString())

    return apiFetch<Paginated<CardTransaction>>(
      `/cards/card-transactions/?${query.toString()}`
    )
  },
}
// ─── PAYMENTS / TRANSFERS API ───────────────────────────────────────────────────
const normalizePhone = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "254" + cleaned.slice(1);
  } else if (cleaned.startsWith("7") || cleaned.startsWith("1")) {
    cleaned = "254" + cleaned;
  }
  if (!cleaned.startsWith("254") || cleaned.length !== 12) {
    throw new Error("Invalid Kenyan phone number. Use 07xx xxx xxx format.");
  }
  return cleaned;
};

export const paymentsApi = {
  /** M-Pesa Deposit (STK Push) */
  deposit: (
    accountId: number,
    amount: number | string,
    phoneNumber?: string,
    description?: string
  ) =>
    apiFetch<any>("/payments/deposit/", {
      method: "POST",
      body: JSON.stringify({
        account: accountId,
        amount: String(amount),
        ...(phoneNumber && { phone_number: normalizePhone(phoneNumber) }),
        ...(description && { description }),
      }),
    }),

  /** M-Pesa Withdrawal */
  withdraw: (
    accountId: number,
    amount: number | string,
    phoneNumber: string,
    description?: string
  ) =>
    apiFetch<any>("/payments/withdraw/", {
      method: "POST",
      body: JSON.stringify({
        account: accountId,
        amount: String(amount),
        phone_number: normalizePhone(phoneNumber),
        ...(description && { description }),
      }),
    }),

  /** Internal Transfer (Between Spartan Accounts) */
  internalTransfer: (
    fromAccount: number,
    toAccount: number,
    amount: number | string,
    description?: string
  ) =>
    apiFetch<any>("/payments/internal_transfer/", {
      method: "POST",
      body: JSON.stringify({
        from_account: fromAccount,
        to_account: toAccount,
        amount: String(amount),
        ...(description && { description }),
      }),
    }),

  /** Frequent Recipients */
  frequentRecipients: (limit: number = 5) =>
    apiFetch<any>(`/payments/frequent-recipients/?limit=${limit}`),

  /** Check Deposit Status */
checkDepositStatus: (transferId: number) =>
  apiFetch<any>(`/payments/check-deposit-status/?transfer_id=${transferId}`),

  /** Unified transfer (used by QuickActionModal for transfer action) */
  transfer: async (
    fromAccount: number,
    to: number | string,
    amount: number | string,
    description?: string
  ) => {
    if (typeof to === "number" || !isNaN(Number(to))) {
      // Internal transfer
      return paymentsApi.internalTransfer(fromAccount, Number(to), amount, description);
    } else {
      // Treat as M-Pesa withdrawal/send money
      return paymentsApi.withdraw(fromAccount, amount, String(to), description);
    }
  },

  // Optional: Add Paybill and Card later when you implement backend endpoints
  paybill: async (
    accountId: number,
    paybillNumber: string,
    amount: number | string,
    description?: string
  ) => {
    // Placeholder - implement when backend is ready
    return apiFetch<any>("/payments/paybill/", {
      method: "POST",
      body: JSON.stringify({
        account: accountId,
        paybill_number: paybillNumber,
        amount: String(amount),
        ...(description && { description }),
      }),
    });
  },

  payWithCard: async (
    accountId: number,
    cardNumber: string,
    amount: number | string,
    description?: string
  ) => {
    // Placeholder - implement when backend is ready
    return apiFetch<any>("/payments/pay-with-card/", {
      method: "POST",
      body: JSON.stringify({
        account: accountId,
        card_number: cardNumber,
        amount: String(amount),
        ...(description && { description }),
      }),
    });
  },
};

// ─── BILLS & AIRTIME ─────────────────────────────────────────────────────────────
export const billsApi = {
  // Bill Categories
  getCategories: () => 
    apiFetch<any[]>("/bills/categories/"),

  // General Bill Payment
  payBill: (payload: {
    user_account: number
    category: number
    paybill_number?: string
    account_number: string
    amount: string | number
    description?: string
  }) =>
    apiFetch<{
      message: string
      payment: any
      new_balance: string
      daily_outflow_remaining: string
    }>("/bills/payments/pay/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Airtime & Data Bundles
  getProviders: () => 
    apiFetch<any[]>("/bills/payments/providers/"),

  getBundles: (providerId?: number) => {
    let url = "/bills/payments/bundles/"
    if (providerId) url += `?provider=${providerId}`
    return apiFetch<any[]>(url)
  },

  topupAirtime: (payload: {
    user_account: number
    provider: number
    phone_number: string
    amount?: string | number
    bundle?: number
    description?: string
  }) =>
    apiFetch<{
      message: string
      topup: any
      new_balance: string
      daily_outflow_remaining: string
    }>("/bills/payments/topup_airtime/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // ─────────────────────────────────────────────────────────────
  // NEW: Sidebar Stats & Recent Activity (used by BillsPage)
  // ─────────────────────────────────────────────────────────────
  getStats: () =>
    apiFetch<{
      total_spent: number
      bills_paid: number
    }>("/bills/payments/stats/"),

  getRecentActivity: () =>
    apiFetch<any[]>("/bills/payments/recent/"),
}
// ─── LOANS ───────────────────────────────────────────────────────────────────────
export const loansApi = {
  getAll: () => apiFetch<any[]>("/accounts/loans/"),

  create: (payload: {
    account: number;
    amount_requested: number;
    term_months: number;
    interest_rate?: number;
  }) => apiFetch<any>("/accounts/loans/", {
    method: "POST",
    body: JSON.stringify(payload),
  }),

  getOne: (id: number) => apiFetch<any>(`/accounts/loans/${id}/`),

  getStatement: (id: number) => apiFetch<any>(`/accounts/loans/${id}/statement/`),

  // NEW: Repay loan with support for choosing repayment account
  repay: (id: number, payload: {
    amount: number;
    repayment_account: number;   // User can choose any of their accounts
  }) => apiFetch<any>(`/accounts/loans/${id}/repay/`, {
    method: "POST",
    body: JSON.stringify(payload),
  }),
};

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────────
export const notificationsApi = {
  getNotifications: () => apiFetch<Paginated<NotificationResponse>>("/notifications/"),

  markAsRead: (id: number) =>
    apiFetch<{ message: string }>(`/notifications/${id}/mark-read/`, { method: "POST" }),
}

// ─── Default Export ──────────────────────────────────────────────────────────────
export default {
  auth: authApi,
  accounts: accountsApi,
  transactions: transactionsApi,
  cards: cardsApi,
  payments: paymentsApi,
  bills: billsApi,
  loans: loansApi,
  notifications: notificationsApi,
}