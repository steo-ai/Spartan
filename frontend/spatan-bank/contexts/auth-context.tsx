"use client";

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import api from "@/lib/api";
import { UserProfile, Account, Transaction, Card } from "@/lib/types";

// ────────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────────
export interface AuthContextType {
  isAuthenticated: boolean;
  user: UserProfile | null;
  accounts: Account[];
  transactions: Transaction[];
  cards: Card[];
  isLoading: boolean;
  login: (
    email: string,
    password: string,
    securityAnswer?: string,
    options?: { noAuth?: boolean }
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshData: (silent?: boolean) => Promise<void>;
  refreshUserOnly: () => Promise<void>;
  error: string | null;
}

// ────────────────────────────────────────────────────────────────────────────────
// Context
// ────────────────────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshInProgress = useRef(false);
  const DEBUG = process.env.NODE_ENV === "development";

  const log = (...args: any[]) => {
    if (DEBUG) console.log("[AuthProvider]", ...args);
  };

  const refreshData = async (silent = false) => {
    if (refreshInProgress.current) {
      log("Refresh already in progress — skipping");
      return;
    }

    const token = localStorage.getItem("access_token");
    if (!token) {
      log("No access token → skipping refresh");
      setIsAuthenticated(false);
      if (!silent) setError(null);
      setIsLoading(false);
      return;
    }

    refreshInProgress.current = true;
    if (!silent) setIsLoading(true);
    setError(null);

    try {
      log("Refreshing user data...");

      const userRes = await api.accounts.getCurrentUser();
      log("User fetched:", userRes?.email ?? "no email");

      const [accountsRes, cardsRes, txRes] = await Promise.all([
        api.accounts.getAccounts().catch(() => []),
        api.cards.list().catch(() => []),
        // FIXED: use getTransactions instead of the old getAll
        api.transactions.getTransactions({ page_size: 50 }).catch(() => ({
          count: 0,
          results: [],
        })),
      ]);

      setUser(userRes);
      setAccounts(Array.isArray(accountsRes) ? accountsRes : accountsRes?.results || []);
      setCards(Array.isArray(cardsRes) ? cardsRes : cardsRes?.results || []);

      // Handle both direct array and paginated { results } shape
      const txArray = Array.isArray(txRes) ? txRes : txRes?.results || [];
      setTransactions(txArray);
      
      setIsAuthenticated(true);
      setError(null);
    } catch (err: any) {
      console.error("[AuthProvider] Refresh failed:", err);

      const msg = err.message || "Session refresh failed";
      const isAuthError = /401|403|token|unauthorized|forbidden/i.test(msg);

      if (isAuthError) {
        log("Authentication error detected → logging out");
        await logout();
        if (!silent) setError("Your session has expired. Please sign in again.");
      } else {
        if (!silent) setError(msg);
      }
    } finally {
      refreshInProgress.current = false;
      setIsLoading(false);
    }
  };

  const refreshUserOnly = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    try {
      const userRes = await api.accounts.getCurrentUser();
      setUser(userRes);
      setError(null);
    } catch (err: any) {
      console.warn("User-only refresh failed:", err.message);
    }
  };

  const login = async (
    email: string,
    password: string,
    securityAnswer?: string,
    options: { noAuth?: boolean } = { noAuth: true }
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      let response: any;

      // Always skip auth header for login steps
      const loginOptions = { noAuth: true };

      if (!securityAnswer) {
        // Step 1: credentials login
        log("Login → step 1: credentials");
        response = await api.auth.login(email, password, loginOptions);
      } else {
        // Step 2: security question verification
        log("Login → step 2: security question");
        if (!email) {
          throw new Error("Email is required for security question verification");
        }
        response = await api.auth.verifySecurityQuestion(
          email,
          securityAnswer,
          "Web Browser",
          loginOptions
        );
      }

      log("Login response:", response);

      if (response?.challenge === "security_question") {
        throw Object.assign(new Error("SECURITY_CHALLENGE"), { cause: response });
      }

      if (!response?.access) {
        throw new Error("No access token received from server");
      }

      localStorage.setItem("access_token", response.access);
      if (response.refresh) {
        localStorage.setItem("refresh_token", response.refresh);
      }

      await refreshData();
      log("Login successful → data refreshed");
      return true;
    } catch (err: any) {
      if (err.message === "SECURITY_CHALLENGE") {
        throw err; // Let login page handle security question prompt
      }

      const rawMsg = err.message || "Login failed";
      let userMsg = rawMsg;

      if (rawMsg.includes("Email and answer required") || rawMsg.includes("400")) {
        userMsg = "Please provide both email and your security answer.";
      } else if (rawMsg.includes("Given token not valid") || rawMsg.includes("401")) {
        userMsg = "Authentication error. Please try again or clear browser cache.";
      } else if (rawMsg.toLowerCase().includes("credentials") || rawMsg.toLowerCase().includes("invalid")) {
        userMsg = "Invalid email or password.";
      } else if (rawMsg.toLowerCase().includes("otp") || rawMsg.toLowerCase().includes("verification")) {
        userMsg = "Additional verification required. Check your email for OTP.";
      }

      setError(userMsg);
      console.error("[AuthProvider] Login error:", rawMsg, err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);

    try {
      await api.auth.logout().catch(() => {});
    } catch (err) {
      console.warn("Logout request failed:", err);
    }

    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");

    setIsAuthenticated(false);
    setUser(null);
    setAccounts([]);
    setTransactions([]);
    setCards([]);
    setError(null);

    setIsLoading(false);
  };

  // Initial auth check on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        log("No token found → not authenticated");
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      log("Found token → validating session");
      setIsLoading(true);
      await refreshData(true); // silent mode
    };

    checkAuth();
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    user,
    accounts,
    transactions,
    cards,
    isLoading,
    login,
    logout,
    refreshData,
    refreshUserOnly,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}