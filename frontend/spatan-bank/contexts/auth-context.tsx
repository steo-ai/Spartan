"use client";

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import api from "@/lib/api";   // ← This is your apiFetch-based client
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
  error: string | null;

  login: (
    email: string,
    password: string,
    securityAnswer?: string
  ) => Promise<boolean>;

  loginWithBiometric: (deviceToken: string, deviceName?: string) => Promise<boolean>;

  enableBiometric: (deviceToken: string, deviceName?: string) => Promise<boolean>;

  logout: () => Promise<void>;
  refreshData: (silent?: boolean) => Promise<void>;
  refreshUserOnly: () => Promise<void>;
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

  // ====================== TOKEN REFRESH ======================
  const refreshAccessToken = async (): Promise<string | null> => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) return null;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"}/token/refresh/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: refreshToken }),
        }
      );

      if (!response.ok) throw new Error("Refresh failed");

      const data = await response.json();
      localStorage.setItem("access_token", data.access);
      return data.access;
    } catch (err) {
      console.warn("Token refresh failed");
      await logout();
      return null;
    }
  };

  // Protected call with auto-refresh on 401
  const protectedApiCall = async <T,>(apiCall: () => Promise<T>): Promise<T> => {
    try {
      return await apiCall();
    } catch (err: any) {
      if (err.status === 401 || err.message?.includes("token") || err.message?.includes("401")) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          return await apiCall();
        }
      }
      throw err;
    }
  };

  const refreshData = async (silent = false) => {
    if (refreshInProgress.current) return;

    const token = localStorage.getItem("access_token");
    if (!token) {
      setIsAuthenticated(false);
      if (!silent) setError(null);
      setIsLoading(false);
      return;
    }

    refreshInProgress.current = true;
    if (!silent) setIsLoading(true);
    setError(null);

    try {
      const userRes = await api.accounts.getCurrentUser();

      const [accountsRes, cardsRes, txRes] = await Promise.all([
        api.accounts.getAccounts().catch(() => []),
        api.cards?.list?.().catch(() => []),
        api.transactions?.getTransactions?.({ page_size: 50 }).catch(() => ({ results: [] })),
      ]);

      setUser(userRes);
      setAccounts(Array.isArray(accountsRes) ? accountsRes : accountsRes?.results || []);
      setCards(Array.isArray(cardsRes) ? cardsRes : cardsRes?.results || []);

      const txArray = Array.isArray(txRes) ? txRes : txRes?.results || [];
      setTransactions(txArray);

      setIsAuthenticated(true);
      setError(null);
    } catch (err: any) {
      console.error("[AuthProvider] Refresh failed:", err);
      const isAuthError = /401|403|token|unauthorized/i.test(err.message || "");

      if (isAuthError) {
        await logout();
        if (!silent) setError("Session expired. Please sign in again.");
      } else if (!silent) {
        setError(err.message || "Failed to load user data");
      }
    } finally {
      refreshInProgress.current = false;
      setIsLoading(false);
    }
  };

  const refreshUserOnly = async () => {
    try {
      const userRes = await api.accounts.getCurrentUser();
      setUser(userRes);
    } catch (err) {
      console.warn("User-only refresh failed:", err);
    }
  };

  // Main Login
  const login = async (
    email: string,
    password: string,
    securityAnswer?: string
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      let response: any;

      if (!securityAnswer) {
        response = await api.auth.login(email, password);
      } else {
        response = await api.auth.verifySecurityQuestion(email, securityAnswer, "Web Browser");
      }

      if (response?.challenge === "security_question") {
        throw Object.assign(new Error("SECURITY_CHALLENGE"), { cause: response });
      }

      if (!response?.access) {
        throw new Error("No access token received");
      }

      localStorage.setItem("access_token", response.access);
      if (response.refresh) {
        localStorage.setItem("refresh_token", response.refresh);
      }

      await refreshData();
      return true;
    } catch (err: any) {
      if (err.message === "SECURITY_CHALLENGE") {
        throw err;
      }

      let userMsg = "Login failed. Please try again.";

      if (err.message?.includes("Invalid credentials") || err.message?.includes("credentials")) {
        userMsg = "Invalid email or password.";
      } else if (err.message?.includes("Incorrect security answer")) {
        userMsg = "Incorrect security answer.";
      } else if (err.message?.includes("No OTP") || err.message?.includes("verification")) {
        userMsg = "Please complete email verification first.";
      }

      setError(userMsg);
      console.error("[AuthProvider] Login error:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Biometric Login
  const loginWithBiometric = async (
    deviceToken: string,
    deviceName: string = "Biometric Device"
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.auth.biometricLogin(deviceToken, deviceName);

      if (!response?.access) {
        throw new Error("Biometric login failed - no token received");
      }

      localStorage.setItem("access_token", response.access);
      if (response.refresh) {
        localStorage.setItem("refresh_token", response.refresh);
      }

      await refreshData();
      return true;
    } catch (err: any) {
      const msg = err.message || "Biometric login failed";
      console.error("[AuthProvider] Biometric login error:", msg);
      
      if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("invalid")) {
        localStorage.removeItem("biometric_device_token");
        localStorage.removeItem("biometric_type");
      }
      
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Updated enableBiometric
  const enableBiometric = async (
    deviceToken: string,
    deviceName: string,
    biometricType: "fingerprint" | "face_id" = "fingerprint"
  ): Promise<boolean> => {
    try {
      const response = await protectedApiCall(() =>
        api.auth.enableBiometric(deviceToken, deviceName, biometricType)
      );

      // Update user state
      if (user) {
        setUser({ ...user, biometric_enabled: true } as UserProfile);
      }

      // Persist in localStorage
      localStorage.setItem("biometric_device_token", deviceToken);
      localStorage.setItem("biometric_type", biometricType);

      return true;
    } catch (err: any) {
      console.error("Failed to enable biometric:", err);
      const errorMsg = err.message || "Failed to enable biometric login";
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  // FIXED: Logout - Do NOT clear biometric data
  const logout = async () => {
    setIsLoading(true);

    const refreshToken = localStorage.getItem("refresh_token");

    try {
      if (refreshToken) {
        await api.auth.logout(refreshToken).catch(() => {});
      }
    } catch (err) {
      console.warn("Logout API call failed:", err);
    }

    // Clear ONLY auth tokens — KEEP biometric data!
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");

    setIsAuthenticated(false);
    setUser(null);
    setAccounts([]);
    setTransactions([]);
    setCards([]);
    setError(null);

    setIsLoading(false);

    window.location.href = "/login";
  };

  // Initial auth check
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }
      await refreshData(true);
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
    error,
    login,
    loginWithBiometric,
    enableBiometric,
    logout,
    refreshData,
    refreshUserOnly,
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