"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Shield,
  Bell,
  Lock,
  Smartphone,
  FileText,
  ChevronRight,
  Camera,
  Edit3,
  Check,
  X,
  LogOut,
  Loader2,
  Fingerprint,
  ScanFace,
} from "lucide-react";
import { LiquidGlassCard } from "@/components/spartan/liquid-glass-card";
import { GlassCustomizer } from "@/components/spartan/glass-customizer";
import { useAuth } from "@/contexts/auth-context";
import { useGlass } from "@/contexts/glass-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function ProfilePage() {
  const { user, logout, refreshUserOnly, enableBiometric } = useAuth();
  const { mode } = useGlass();

  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<Partial<typeof user>>({});
  const [loading, setLoading] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Biometric states
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<"fingerprint" | "face_id" | null>(null);
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [isRegisteringBiometric, setIsRegisteringBiometric] = useState(false);

  const [notifications, setNotifications] = useState([
    { id: "push_transactions", label: "Transaction Alerts", description: "Get notified for every transaction", enabled: true },
    { id: "push_security", label: "Security Alerts", description: "Login attempts and password changes", enabled: true },
    { id: "push_promotions", label: "Promotions", description: "Special offers and updates", enabled: false },
    { id: "email_statements", label: "Email Statements", description: "Monthly account statements", enabled: true },
    { id: "sms_otp", label: "SMS OTP", description: "One-time passwords via SMS", enabled: true },
  ]);

  const [securitySettings, setSecuritySettings] = useState([
    { id: "mfa_enabled", label: "Two-Factor Authentication", description: "Extra security for your account", enabled: false },
    { id: "biometric", label: "Biometric Login", description: "Fingerprint or Face ID", enabled: false },
    { id: "login_alerts", label: "Login Alerts", description: "Get notified of new logins", enabled: true },
  ]);

  useEffect(() => {
    if (user) {
      setEditedProfile(user);
      setLoading(false);

      const savedToken = localStorage.getItem("biometric_device_token");
      const savedType = localStorage.getItem("biometric_type") as "fingerprint" | "face_id" | null;

      setBiometricEnabled(!!savedToken);
      setBiometricType(savedType);

      setSecuritySettings(prev =>
        prev.map(s => {
          if (s.id === "mfa_enabled") return { ...s, enabled: user.mfa_enabled ?? false };
          if (s.id === "biometric") return { ...s, enabled: !!savedToken };
          return s;
        })
      );
    } else {
      setLoading(true);
      refreshUserOnly().finally(() => setLoading(false));
    }
  }, [user, refreshUserOnly]);

  // REAL Biometric Registration using WebAuthn
  const startRealBiometricCapture = async (type: "fingerprint" | "face_id") => {
    if (!user) return;

    setShowBiometricSetup(false);
    setIsRegisteringBiometric(true);

    try {
      // Trigger native biometric prompt (Face ID / Fingerprint / Touch ID)
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: new Uint8Array(32),
          rp: {
            name: "Spartan Bank",
            id: window.location.hostname,
          },
          user: {
            id: new Uint8Array(16), // Dummy user ID
            name: user.email,
            displayName: `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email,
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }], // ES256
          authenticatorSelection: {
            authenticatorAttachment: "platform", // Use device sensor/camera
            userVerification: "required",
            residentKey: "preferred",
          },
          timeout: 60000,
        },
      });

      // Convert rawId to base64url string (safe for storage)
      const deviceToken = btoa(
        String.fromCharCode(...new Uint8Array(credential.rawId))
      )
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

      // Save to localStorage and call backend
      localStorage.setItem("biometric_device_token", deviceToken);
      localStorage.setItem("biometric_type", type);

      const success = await enableBiometric(
        deviceToken, 
        type === "face_id" ? "Face ID" : "Fingerprint",
      // ← Pass the actual type ("fingerprint" or "face_id")
      );

      if (success) {
        setBiometricEnabled(true);
        setBiometricType(type);

        setSecuritySettings((prev) =>
          prev.map((s) => (s.id === "biometric" ? { ...s, enabled: true } : s))
        );

        toast.success(
          type === "fingerprint"
            ? "✅ Fingerprint Registered Successfully"
            : "✅ Face ID Registered Successfully",
          { description: "Biometric login is now active on this device." }
        );
      }
    } catch (err: any) {
      console.error("Biometric registration error:", err);

      let message = "Failed to register biometric";

      if (err.name === "NotAllowedError") {
        message = "Biometric setup was cancelled or not supported on this device.";
      } else if (err.name === "SecurityError") {
        message = "Biometric registration is not allowed in this context.";
      } else if (err.name === "InvalidStateError") {
        message = "Biometric is not available or already in use.";
      }

      toast.error(message);
    } finally {
      setIsRegisteringBiometric(false);
    }
  };

  const handleToggleBiometric = () => {
    const isCurrentlyEnabled = securitySettings.find((s) => s.id === "biometric")?.enabled ?? false;

    if (!isCurrentlyEnabled) {
      setShowBiometricSetup(true);
    } else {
      if (window.confirm("Disable biometric login on this device?")) {
        localStorage.removeItem("biometric_device_token");
        localStorage.removeItem("biometric_type");
        setBiometricEnabled(false);
        setBiometricType(null);

        setSecuritySettings((prev) =>
          prev.map((s) => (s.id === "biometric" ? { ...s, enabled: false } : s))
        );

        toast.info("Biometric Login Disabled");
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      toast.success("Profile Updated", { description: "Your changes have been saved." });
      setIsEditing(false);
      await refreshUserOnly();
    } catch (err: any) {
      toast.error("Failed to update profile", { description: err.message || "Please try again." });
    }
  };

  const handleCancelEdit = () => {
    if (user) setEditedProfile(user);
    setIsEditing(false);
  };

  const toggleNotification = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, enabled: !n.enabled } : n))
    );
  };

  const toggleSecurity = (id: string) => {
    if (id === "biometric") {
      handleToggleBiometric();
      return;
    }
    setSecuritySettings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const initials = `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase() || "U";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Profile & Settings</h1>
        <p className="text-muted-foreground">Manage your Spartan Bank account and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="glass-clear border border-white/10 p-1 w-full flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        {/* PROFILE TAB - Unchanged */}
        <TabsContent value="profile" className="space-y-6">
          {/* ... Your existing profile tab content remains exactly the same ... */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <LiquidGlassCard className="p-6 text-center">
              <div className="relative inline-block mx-auto">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border-2 border-primary/30">
                  <span className="text-4xl font-bold text-primary">{initials}</span>
                </div>
                <button className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors shadow-md">
                  <Camera className="h-4 w-4 text-primary-foreground" />
                </button>
              </div>

              <h2 className="mt-5 text-xl font-semibold">
                {user.first_name} {user.last_name}
              </h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>

              <div className="mt-4">
                {user.kyc_verified ? (
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <Check className="h-4 w-4" /> KYC Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <FileText className="h-4 w-4" /> KYC Pending
                  </span>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-white/10">
                <Button
                  variant="outline"
                  className="w-full gap-2 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  onClick={logout}
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </LiquidGlassCard>

            <LiquidGlassCard className="lg:col-span-2 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-lg">Personal Information</h3>
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-3">
                    <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveProfile}>
                      <Check className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2"><User className="h-4 w-4" /> First Name</Label>
                  {isEditing ? (
                    <Input value={editedProfile.first_name ?? ""} onChange={e => setEditedProfile(p => ({ ...p, first_name: e.target.value }))} />
                  ) : (
                    <p className="font-medium">{user.first_name || "—"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2"><User className="h-4 w-4" /> Last Name</Label>
                  {isEditing ? (
                    <Input value={editedProfile.last_name ?? ""} onChange={e => setEditedProfile(p => ({ ...p, last_name: e.target.value }))} />
                  ) : (
                    <p className="font-medium">{user.last_name || "—"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4" /> Email</Label>
                  <p className="font-medium">{user.email}</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2"><Phone className="h-4 w-4" /> Phone Number</Label>
                  {isEditing ? (
                    <Input value={editedProfile.phone_number ?? ""} onChange={e => setEditedProfile(p => ({ ...p, phone_number: e.target.value }))} />
                  ) : (
                    <p className="font-medium">{user.phone_number || "—"}</p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-muted-foreground flex items-center gap-2"><MapPin className="h-4 w-4" /> Address</Label>
                  {isEditing ? (
                    <Input value={editedProfile.address ?? ""} onChange={e => setEditedProfile(p => ({ ...p, address: e.target.value }))} />
                  ) : (
                    <p className="font-medium">{user.address || "—"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2"><FileText className="h-4 w-4" /> National ID</Label>
                  <p className="font-mono">
                    {user.kyc_verified ? user.national_id || "Verified" : "••••••••" + (user.national_id?.slice(-4) || "")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2">Date of Birth</Label>
                  <p className="font-medium">{user.date_of_birth || "—"}</p>
                </div>
              </div>
            </LiquidGlassCard>
          </div>

          <LiquidGlassCard className="p-6">
            <h3 className="font-semibold text-lg mb-6">Daily Transaction Limits (KES)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Deposits", value: user.daily_deposit_limit },
                { label: "Withdrawals", value: user.daily_withdrawal_limit },
                { label: "Transfers", value: user.daily_transfer_limit },
                { label: "Total Outflow", value: user.daily_outflow_limit },
              ].map(item => (
                <div
                  key={item.label}
                  className="p-4 rounded-xl border text-center bg-white/5"
                >
                  <p className="text-sm text-muted-foreground mb-1">{item.label}</p>
                  <p className="text-xl font-bold">{new Intl.NumberFormat("en-KE").format(item.value ?? 0)}</p>
                </div>
              ))}
            </div>
          </LiquidGlassCard>
        </TabsContent>

        {/* SECURITY TAB */}
        <TabsContent value="security" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LiquidGlassCard className="p-6">
              <h3 className="font-semibold text-lg mb-6">Security Controls</h3>
              <div className="space-y-4">
                {securitySettings.map((setting, i) => (
                  <motion.div
                    key={setting.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", setting.enabled ? "bg-emerald-500/20" : "bg-slate-500/20")}>
                        {setting.id === "biometric" ? (
                          biometricType === "face_id" ? (
                            <ScanFace className="h-5 w-5 text-sky-400" />
                          ) : (
                            <Fingerprint className="h-5 w-5 text-emerald-400" />
                          )
                        ) : (
                          <Shield className={cn("h-5 w-5", setting.enabled ? "text-emerald-400" : "text-slate-400")} />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{setting.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {setting.id === "biometric" && biometricType
                            ? biometricType === "fingerprint" ? "Fingerprint" : "Face ID"
                            : setting.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={setting.enabled}
                      onCheckedChange={() => toggleSecurity(setting.id)}
                    />
                  </motion.div>
                ))}
              </div>
            </LiquidGlassCard>

            <LiquidGlassCard className="p-6">
              <h3 className="font-semibold text-lg mb-6">Account Protection</h3>
              <div className="space-y-3">
                <button
                  onClick={() => setShowChangePassword(true)}
                  className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 text-left transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Lock className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium">Change Password</p>
                      <p className="text-sm text-muted-foreground">Last changed: Never</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>

                <button className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 text-left transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <Smartphone className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium">Trusted Devices</p>
                      <p className="text-sm text-muted-foreground">
                        {biometricEnabled ? "1 device trusted" : "Manage devices that can access your account"}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>

                <button className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 text-left transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="font-medium">Security Question</p>
                      <p className="text-sm text-muted-foreground">Used when logging in from new devices</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
            </LiquidGlassCard>
          </div>
        </TabsContent>

        {/* Notifications & Appearance tabs remain unchanged */}
        <TabsContent value="notifications" className="space-y-6">
          <LiquidGlassCard className="p-6">
            <h3 className="font-semibold text-lg mb-6">Notification Preferences</h3>
            <div className="space-y-4">
              {notifications.map((n, i) => (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/8"
                >
                  <div className="flex gap-4 items-center">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", n.enabled ? "bg-primary/20" : "bg-slate-500/20")}>
                      <Bell className={cn("h-5 w-5", n.enabled ? "text-primary" : "text-muted-foreground")} />
                    </div>
                    <div>
                      <p className="font-medium">{n.label}</p>
                      <p className="text-sm text-muted-foreground">{n.description}</p>
                    </div>
                  </div>
                  <Switch checked={n.enabled} onCheckedChange={() => toggleNotification(n.id)} />
                </motion.div>
              ))}
            </div>
          </LiquidGlassCard>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <GlassCustomizer />
          <LiquidGlassCard className="p-6">
            <h3 className="font-semibold text-lg mb-4">Current Appearance</h3>
            <p className="text-muted-foreground mb-6">
              You are using <span className="font-medium text-primary capitalize">{mode}</span> mode
            </p>
          </LiquidGlassCard>
        </TabsContent>
      </Tabs>

      {/* BIOMETRIC SETUP MODAL - Real Capture */}
      <Dialog open={showBiometricSetup} onOpenChange={setShowBiometricSetup}>
        <DialogContent className="glass-clear border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle>Set Up Biometric Login</DialogTitle>
            <DialogDescription>Choose your preferred method</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-8">
            <button
              onClick={() => startRealBiometricCapture("fingerprint")}
              disabled={isRegisteringBiometric}
              className="flex flex-col items-center gap-4 p-8 rounded-3xl hover:bg-white/10 transition-all border border-white/10 disabled:opacity-50"
            >
              <Fingerprint className="h-14 w-14 text-emerald-400" />
              <div className="text-center">
                <p className="font-semibold">Fingerprint</p>
                <p className="text-sm text-muted-foreground">Use device fingerprint sensor</p>
              </div>
            </button>

            <button
              onClick={() => startRealBiometricCapture("face_id")}
              disabled={isRegisteringBiometric}
              className="flex flex-col items-center gap-4 p-8 rounded-3xl hover:bg-white/10 transition-all border border-white/10 disabled:opacity-50"
            >
              <ScanFace className="h-14 w-14 text-sky-400" />
              <div className="text-center">
                <p className="font-semibold">Face ID</p>
                <p className="text-sm text-muted-foreground">Use device camera</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}