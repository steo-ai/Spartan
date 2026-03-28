"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Shield } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { SpartanLogoText } from "@/components/spartan/spartan-logo";
import {
  LiquidGlassCard,
  LiquidGlassButton,
  LiquidGlassInput,
} from "@/components/spartan/liquid-glass-card";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSecurityQuestion, setShowSecurityQuestion] = useState(false);
  const [securityAnswer, setSecurityAnswer] = useState("");

  const securityInputRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (showSecurityQuestion && securityInputRef.current) {
      securityInputRef.current.focus();
    }
  }, [showSecurityQuestion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // First attempt: normal login (email + password)
      // We explicitly tell auth context NOT to add Bearer token
      const success = await login(
        email.trim(),
        password,
        showSecurityQuestion ? securityAnswer.trim() : undefined,
        { noAuth: true } // ← key fix: skip auth header on this request
      );

      if (success) {
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
          duration: 4000,
        });
        router.push("/dashboard");
      }
    } catch (err: any) {
      const errMsg = err.message || "Login failed";

      // Handle security question challenge from backend
      if (errMsg.includes("SECURITY_CHALLENGE") || errMsg.includes("security question")) {
        setShowSecurityQuestion(true);
        setError("This appears to be a new or unrecognized device. Please answer your security question.");
        toast({
          title: "Additional Verification",
          description: "Please answer your security question to continue.",
          variant: "default",
          duration: 5000,
        });
        setIsLoading(false);
        return;
      }

      // Handle the exact token error you're seeing
      if (errMsg.includes("Given token not valid for any token type") || errMsg.includes("HTTP 401")) {
        setError("Authentication error. Please try logging in again.");
        toast({
          variant: "destructive",
          title: "Login failed",
          description: "Invalid authentication token. Please clear cache or try again.",
          duration: 6000,
        });
      } else if (errMsg.toLowerCase().includes("invalid") || errMsg.toLowerCase().includes("credentials")) {
        setError("Invalid email or password. Please try again.");
      } else if (errMsg.toLowerCase().includes("otp") || errMsg.toLowerCase().includes("verification")) {
        setError("Additional verification required. Check your email for OTP.");
      } else {
        setError(errMsg);
      }

      // Option 1: Clean & Recommended
       toast({
         variant: "destructive",
         title: "Login failed",
         description: errorMessage || "An error occurred during login. Please try again.",
         duration: 6000,
       });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LiquidGlassCard className="w-full max-w-md p-8 relative z-10">
      <div className="flex flex-col items-center mb-8">
        <SpartanLogoText className="mb-3" />
        <h1 className="text-2xl font-bold text-foreground">Welcome Back</h1>
        <p className="text-muted-foreground mt-1.5 text-center">
          Sign in to continue to your Spartan account
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <LiquidGlassInput
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={<Mail className="h-5 w-5" />}
          required
          autoFocus
          autoComplete="email"
          disabled={isLoading}
        />

        <div className="relative">
          <LiquidGlassInput
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock className="h-5 w-5" />}
            required
            autoComplete="current-password"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showPassword ? "Hide password" : "Show password"}
            disabled={isLoading}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>

        {showSecurityQuestion && (
          <LiquidGlassInput
            ref={securityInputRef}
            type="text"
            placeholder="Your security answer"
            value={securityAnswer}
            onChange={(e) => setSecurityAnswer(e.target.value)}
            icon={<Shield className="h-5 w-5" />}
            required
            autoComplete="off"
            disabled={isLoading}
          />
        )}

        <LiquidGlassButton
          type="submit"
          variant="primary"
          size="lg"
          disabled={
            isLoading ||
            (showSecurityQuestion && !securityAnswer.trim()) ||
            (!showSecurityQuestion && (!email.trim() || !password))
          }
          className="w-full flex items-center justify-center gap-2.5"
        >
          {isLoading ? (
            <>
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Processing...</span>
            </>
          ) : showSecurityQuestion ? (
            <>
              Verify & Sign In
              <ArrowRight className="h-5 w-5" />
            </>
          ) : (
            <>
              Sign In
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </LiquidGlassButton>

        <div className="flex items-center justify-between text-sm mt-3">
          <Link
            href="/forgot-password"
            className="text-spartan-cyan hover:underline hover:text-spartan-cyan/80 transition-colors"
          >
            Forgot password?
          </Link>
        </div>
      </form>

      {!showSecurityQuestion && (
        <p className="text-center text-sm text-muted-foreground mt-8">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-spartan-cyan hover:underline font-medium hover:text-spartan-cyan/80 transition-colors"
          >
            Create account
          </Link>
        </p>
      )}

      {/* Trust badges */}
      <div className="mt-10 flex items-center justify-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-spartan-success" />
          <span>256-bit Encryption</span>
        </div>
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-spartan-success" />
          <span>CBK Licensed</span>
        </div>
      </div>
    </LiquidGlassCard>
  );
}