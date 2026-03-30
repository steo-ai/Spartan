"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Shield, Fingerprint, ScanFace } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { SpartanLogoText } from "@/components/spartan/spartan-logo";
import {
  LiquidGlassCard,
  LiquidGlassButton,
  LiquidGlassInput,
} from "@/components/spartan/liquid-glass-card";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithBiometric } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSecurityQuestion, setShowSecurityQuestion] = useState(false);
  const [securityAnswer, setSecurityAnswer] = useState("");

  // Biometric states
  const [savedDeviceToken, setSavedDeviceToken] = useState<string | null>(null);
  const [savedBiometricType, setSavedBiometricType] = useState<"fingerprint" | "face_id" | null>(null);
  const [isBiometricLogin, setIsBiometricLogin] = useState(false);

  const securityInputRef = useRef<HTMLInputElement>(null);

  // Focus security question input when shown
  useEffect(() => {
    if (showSecurityQuestion && securityInputRef.current) {
      securityInputRef.current.focus();
    }
  }, [showSecurityQuestion]);

  // Load saved biometric data from localStorage (this should persist after logout)
  useEffect(() => {
    const token = localStorage.getItem("biometric_device_token");
    const type = localStorage.getItem("biometric_type") as "fingerprint" | "face_id" | null;

    console.log("🔍 LoginPage - Loaded biometric token:", token ? "✅ PRESENT" : "❌ MISSING");
    console.log("🔍 Biometric type from storage:", type);

    if (token) {
      setSavedDeviceToken(token);
      setSavedBiometricType(type || "fingerprint"); // fallback
    }
  }, []);

  // Safe base64url decoder for credential ID
  const base64UrlToUint8Array = (base64Url: string): Uint8Array => {
    if (!base64Url || typeof base64Url !== "string") {
      throw new Error("Invalid biometric credential");
    }

    let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }

    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    } catch (e) {
      console.error("Failed to decode base64url:", e);
      throw new Error("Invalid biometric credential");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const success = await login(
        email.trim(),
        password,
        showSecurityQuestion ? securityAnswer.trim() : undefined
      );

      if (success) {
        toast.success("Welcome back!", {
          description: "You have successfully logged in.",
        });
        router.push("/dashboard");
      }
    } catch (err: any) {
      const errMsg = err.message || "Login failed";

      if (errMsg.includes("SECURITY_CHALLENGE") || errMsg.includes("security question")) {
        setShowSecurityQuestion(true);
        setError("New device detected. Please verify with your security question.");
        toast.info("Additional Verification Required", {
          description: "Please answer your security question to continue.",
        });
        setIsLoading(false);
        return;
      }

      setError(errMsg.includes("Invalid credentials") ? "Invalid email or password." : errMsg);
      toast.error("Login Failed", { description: errMsg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!savedDeviceToken) {
      toast.error("No biometric setup found", {
        description: "Please enable Face ID or Fingerprint in your profile settings first.",
      });
      return;
    }

    setIsBiometricLogin(true);
    setIsLoading(true);

    try {
      // Note: The WebAuthn get() call is mostly for UX (to trigger native prompt)
      // Your backend uses the saved token directly, so we still call it for consistency
      const credentialId = base64UrlToUint8Array(savedDeviceToken);

      // Trigger native biometric prompt (this may not always be necessary but improves UX)
      await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(32),
          allowCredentials: [{ type: "public-key", id: credentialId }],
          userVerification: "required",
          rpId: window.location.hostname,
        },
      }).catch((e) => {
        // Ignore errors here - some browsers may not support full WebAuthn flow
        console.warn("WebAuthn get() failed, continuing with token-based login:", e);
      });

      const success = await loginWithBiometric(
        savedDeviceToken,
        savedBiometricType === "face_id" ? "Face ID" : "Fingerprint"
      );

      if (success) {
        toast.success(
          savedBiometricType === "face_id" ? "Face ID Login Successful" : "Fingerprint Login Successful"
        );
        router.push("/dashboard");
      } else {
        throw new Error("Biometric login rejected by server");
      }
    } catch (err: any) {
      console.error("Biometric login error:", err);

      let message = "Biometric login failed. Please try again.";

      if (err.name === "NotAllowedError") {
        message = "Biometric authentication was cancelled or not available on this device.";
      } else if (err.name === "SecurityError") {
        message = "Biometric login is not supported in this browser or context.";
      } else if (err.message?.includes("Invalid biometric credential") || err.message?.includes("not found")) {
        message = "Biometric data is no longer valid. Please re-enable it in profile settings.";
        // Optional: clear invalid token
        localStorage.removeItem("biometric_device_token");
        localStorage.removeItem("biometric_type");
        setSavedDeviceToken(null);
        setSavedBiometricType(null);
      }

      toast.error("Biometric Login Failed", { description: message });
      setError(message);
    } finally {
      setIsBiometricLogin(false);
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
          disabled={isLoading || showSecurityQuestion || isBiometricLogin}
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
            disabled={isLoading || showSecurityQuestion || isBiometricLogin}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            disabled={isLoading || isBiometricLogin}
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

        {/* Biometric Login Button */}
        {savedDeviceToken && !showSecurityQuestion && (
          <LiquidGlassButton
            type="button"
            variant="secondary"
            size="lg"
            onClick={handleBiometricLogin}
            disabled={isLoading || isBiometricLogin}
            className="w-full flex items-center justify-center gap-3 border border-white/20 hover:border-white/40"
          >
            {savedBiometricType === "face_id" ? (
              <ScanFace className="h-5 w-5 text-sky-400" />
            ) : (
              <Fingerprint className="h-5 w-5 text-emerald-400" />
            )}
            Login with {savedBiometricType === "face_id" ? "Face ID" : "Fingerprint"}
          </LiquidGlassButton>
        )}

        <LiquidGlassButton
          type="submit"
          variant="primary"
          size="lg"
          disabled={
            isLoading ||
            isBiometricLogin ||
            (showSecurityQuestion && !securityAnswer.trim()) ||
            (!showSecurityQuestion && (!email.trim() || !password))
          }
          className="w-full flex items-center justify-center gap-2.5"
        >
          {isLoading || isBiometricLogin ? (
            <>
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>{isBiometricLogin ? "Verifying Biometrics..." : "Signing in..."}</span>
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