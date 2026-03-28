"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  User,
  Phone,
  Calendar,
  Shield,
  Check,
  X,
} from "lucide-react";
import { SpartanLogoText } from "@/components/spartan/spartan-logo";
import {
  LiquidGlassCard,
  LiquidGlassButton,
  LiquidGlassInput,
  LiquidGlassSelect,
} from "@/components/spartan/liquid-glass-card";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import api from "@/lib/api";   // ← this must contain auth.register (added earlier)

const securityQuestions = [
  { value: "What was the name of your first pet?", label: "What was the name of your first pet?" },
  { value: "What city were you born in?", label: "What city were you born in?" },
  { value: "What is your mother's maiden name?", label: "What is your mother's maiden name?" },
  { value: "What was your first school called?", label: "What was your first school called?" },
  { value: "What is the name of the street you grew up on?", label: "What is the name of the street you grew up on?" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    first_name: "",
    last_name: "",
    phone_number: "",
    date_of_birth: "",
    security_question: securityQuestions[0].value,
    security_answer: "",
    terms: false,
    national_id: "",
  });

  const updateForm = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const getPasswordStrength = () => {
    const pwd = formData.password;
    if (!pwd) return { level: "", color: "", width: "0%", text: "" };

    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { level: "weak", color: "bg-red-500", width: "25%", text: "Weak" };
    if (score <= 3) return { level: "medium", color: "bg-yellow-500", width: "50%", text: "Medium" };
    if (score <= 4) return { level: "strong", color: "bg-green-500", width: "75%", text: "Strong" };
    return { level: "very-strong", color: "bg-emerald-500", width: "100%", text: "Very Strong" };
  };

  const passwordStrength = getPasswordStrength();

  const validateStep = () => {
    if (step === 1) {
      if (!formData.email || !formData.password || !formData.confirmPassword) {
        setError("All fields are required");
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match");
        return false;
      }
      if (formData.password.length < 8) {
        setError("Password must be at least 8 characters");
        return false;
      }
    }
    if (step === 2) {
      if (!formData.first_name.trim() || !formData.last_name.trim() || !formData.phone_number || !formData.date_of_birth) {
        setError("Please fill all personal details");
        return false;
      }
    }
    if (step === 3) {
      if (!formData.terms) {
        setError("You must accept the terms");
        return false;
      }
      if (!formData.security_answer.trim()) {
        setError("Security answer is required");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setStep((prev) => prev - 1);
    setError("");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep()) return;

    setIsLoading(true);
    setError("");

    try {
      const payload = {
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        phone_number: formData.phone_number.trim() || undefined,
        date_of_birth: formData.date_of_birth || undefined,
        security_question: formData.security_question,
        security_answer: formData.security_answer.trim(),
        national_id: formData.national_id.trim() || undefined,
        // password_confirm is NOT sent → backend now accepts it as optional
      };

      await api.auth.register(payload);   // ← this must exist in lib/api.ts

      toast({
        title: "✅ Account Created",
        description: "A 6-digit OTP has been sent to your email. Check inbox & spam.",
        duration: 8000,
      });

      // ← THIS IS THE FIX: always go to OTP page with email
      router.push(`/verify-otp?email=${encodeURIComponent(formData.email)}`);

    } catch (err: any) {
      const msg = err.message?.includes("already") 
        ? "This email is already registered." 
        : err.message || "Registration failed. Please try again.";

      setError(msg);
      toast({
        variant: "destructive",
        title: "Registration Error",
        description: msg,
      });
      console.error("Register error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LiquidGlassCard className="w-full max-w-lg p-8 relative z-10">
      <div className="flex flex-col items-center mb-8">
        <SpartanLogoText className="mb-2" />
        <h1 className="text-2xl font-bold text-foreground">Create Spartan Account</h1>
        <p className="text-muted-foreground mt-1">Step {step} of 3 • Takes 60 seconds</p>
      </div>

      {/* Progress */}
      <div className="flex justify-between mb-8 px-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              "flex-1 h-2.5 rounded-full mx-1 transition-all",
              step >= s ? "bg-spartan-cyan" : "bg-white/20"
            )}
          />
        ))}
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-xl bg-destructive/10 border border-destructive text-destructive text-sm">
          {error}
        </div>
      )}

      {step === 1 && (
        <form className="space-y-5">
          <LiquidGlassInput
            type="email"
            placeholder="you@email.com"
            value={formData.email}
            onChange={(e) => updateForm("email", e.target.value)}
            icon={<Mail className="h-5 w-5" />}
            required
            autoFocus
          />

          <div className="relative">
            <LiquidGlassInput
              type={showPassword ? "text" : "password"}
              placeholder="Create strong password"
              value={formData.password}
              onChange={(e) => updateForm("password", e.target.value)}
              icon={<Lock className="h-5 w-5" />}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-3 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className="relative">
            <LiquidGlassInput
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm password"
              value={formData.confirmPassword}
              onChange={(e) => updateForm("confirmPassword", e.target.value)}
              icon={<Lock className="h-5 w-5" />}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-3 text-muted-foreground"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {formData.password && (
            <div className="space-y-2">
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className={cn("h-2 transition-all", passwordStrength.color)} style={{ width: passwordStrength.width }} />
              </div>
              <p className="text-xs text-center font-medium">{passwordStrength.text}</p>
            </div>
          )}

          <div className="flex gap-3">
            <LiquidGlassButton type="button" variant="secondary" className="flex-1" onClick={() => router.push("/login")}>
              ← Login
            </LiquidGlassButton>
            <LiquidGlassButton type="button" className="flex-1" onClick={handleNext} disabled={passwordStrength.level === "weak" || passwordStrength.level === "medium"}>
              Continue →
            </LiquidGlassButton>
          </div>
        </form>
      )}

      {step === 2 && (
        <form className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <LiquidGlassInput placeholder="First name" value={formData.first_name} onChange={(e) => updateForm("first_name", e.target.value)} icon={<User className="h-5 w-5" />} required />
            <LiquidGlassInput placeholder="Last name" value={formData.last_name} onChange={(e) => updateForm("last_name", e.target.value)} icon={<User className="h-5 w-5" />} required />
          </div>

          <LiquidGlassInput type="tel" placeholder="+254 712 345 678" value={formData.phone_number} onChange={(e) => updateForm("phone_number", e.target.value)} icon={<Phone className="h-5 w-5" />} required />
          <LiquidGlassInput type="date" value={formData.date_of_birth} onChange={(e) => updateForm("date_of_birth", e.target.value)} icon={<Calendar className="h-5 w-5" />} required />

          {/* Fixed: no label prop (component doesn't support it) */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">National ID / Passport (optional)</p>
            <LiquidGlassInput
              placeholder="12345678 or passport number"
              value={formData.national_id}
              onChange={(e) => updateForm("national_id", e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <LiquidGlassButton type="button" variant="secondary" className="flex-1" onClick={handleBack}>← Back</LiquidGlassButton>
            <LiquidGlassButton type="button" className="flex-1" onClick={handleNext}>Continue →</LiquidGlassButton>
          </div>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleRegister} className="space-y-6">
          <LiquidGlassSelect
            placeholder="Choose security question"
            value={formData.security_question}
            onChange={(value) => updateForm("security_question", value)}
            options={securityQuestions}
            icon={<Shield className="h-5 w-5" />}
          />

          <LiquidGlassInput
            placeholder="Answer to security question"
            value={formData.security_answer}
            onChange={(e) => updateForm("security_answer", e.target.value)}
            icon={<Shield className="h-5 w-5" />}
            required
          />

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="terms"
              checked={formData.terms}
              onChange={(e) => updateForm("terms", e.target.checked)}
              className="mt-1 h-5 w-5 accent-spartan-cyan"
            />
            <label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed">
              I agree to the{" "}
              <Link href="/terms" className="text-spartan-cyan hover:underline">Terms</Link> and{" "}
              <Link href="/privacy" className="text-spartan-cyan hover:underline">Privacy Policy</Link>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <LiquidGlassButton type="button" variant="secondary" className="flex-1" onClick={handleBack}>← Back</LiquidGlassButton>
            <LiquidGlassButton
              type="submit"
              disabled={isLoading || !formData.terms}
              className="flex-1 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>Creating account…</>
              ) : (
                <>
                  Create Account & Verify Email
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </LiquidGlassButton>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            After creation you will be taken to the OTP verification page automatically
          </p>
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground mt-8">
        Already a member?{" "}
        <Link href="/login" className="text-spartan-cyan font-medium hover:underline">Sign in</Link>
      </p>
    </LiquidGlassCard>
  );
}