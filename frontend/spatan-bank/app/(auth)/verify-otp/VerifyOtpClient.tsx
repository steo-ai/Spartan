"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Shield, ArrowRight, Check, Loader2, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import api from "@/lib/api";
import {
  LiquidGlassCard,
  LiquidGlassButton,
  LiquidGlassInput,
} from "@/components/spartan/liquid-glass-card";
import { SpartanLogoText } from "@/components/spartan/spartan-logo";

export default function VerifyOtpClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const emailFromQuery = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailFromQuery);
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!email || !otp.trim()) {
      setError("Please enter both email and OTP");
      setIsLoading(false);
      return;
    }

    try {
      await api.auth.verifyOtp({
        email,
        otp: otp.trim(),
      });

      toast({
        title: "Success",
        description: "Account verified successfully!",
      });

      setSuccess(true);

      // Redirect to login after success
      setTimeout(() => router.push("/login"), 1800);
    } catch (err: any) {
      const msg = 
        err?.response?.data?.message || 
        err?.response?.data?.detail || 
        err.message || 
        "Invalid or expired OTP. Please try again.";

      setError(msg);
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: msg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0 || !email || isResending) return;

    setIsResending(true);
    setError("");

    try {
      await api.auth.resendOtp({ email });

      toast({
        title: "OTP Resent",
        description: "A new 6-digit code has been sent to your email.",
      });

      setResendCountdown(60);
      setOtp(""); // Clear OTP field after resend
    } catch (err: any) {
      const msg = 
        err?.response?.data?.message || 
        err?.response?.data?.detail || 
        err.message || 
        "Failed to resend OTP. Please try again.";

      toast({
        variant: "destructive",
        title: "Resend Failed",
        description: msg,
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-spartan-navy/30 to-background flex items-center justify-center p-4">
      <LiquidGlassCard className="w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <SpartanLogoText className="mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Verify Your Email</h1>
          <p className="text-muted-foreground mt-2 text-center">
            Enter the 6-digit code sent to{" "}
            <strong className="text-foreground">{email || "your email"}</strong>
          </p>
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="mx-auto w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
              <Check className="h-10 w-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Email Verified Successfully!</h2>
            <p className="text-muted-foreground">Redirecting you to login...</p>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="space-y-6">
            {!emailFromQuery && (
              <LiquidGlassInput
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            )}

            <div>
              <label className="text-sm font-medium block mb-2">6-Digit OTP Code</label>
              <LiquidGlassInput
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="text-center text-2xl tracking-[8px] font-mono"
                required
              />
            </div>

            {error && <p className="text-destructive text-sm text-center">{error}</p>}

            <LiquidGlassButton
              type="submit"
              disabled={isLoading || !otp.trim() || !email}
              className="w-full py-6 text-base"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Verifying OTP...
                </>
              ) : (
                <>
                  Verify OTP
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </LiquidGlassButton>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCountdown > 0 || isResending || !email}
                className="flex items-center justify-center gap-2 text-sm text-spartan-cyan hover:underline disabled:opacity-50 disabled:cursor-not-allowed mx-auto"
              >
                {isResending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : resendCountdown > 0 ? (
                  `Resend OTP in ${resendCountdown}s`
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Resend OTP
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-spartan-cyan transition-colors"
          >
            ← Back to Sign In
          </Link>
        </div>

        <div className="mt-6 flex justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-4 w-4 text-spartan-success" />
          <span>Secure & Encrypted Verification</span>
        </div>
      </LiquidGlassCard>
    </div>
  );
}