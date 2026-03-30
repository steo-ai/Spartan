// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, Shield, Zap, Users, LogIn, UserPlus } from 'lucide-react';

export default function SpartanBankLanding() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installing, setInstalling] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
    };

    checkStandalone();
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkStandalone);

    // Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => 
        console.error('SW registration failed:', err)
      );
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      mediaQuery.removeEventListener('change', checkStandalone);
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
    }
  };

  const backgroundStyle = {
    backgroundImage: "url('/images/spartan-bank-bg.jpg')",
  };

  // ==================== INSTALLED APP MODE ====================
  if (isStandalone) {
    return (
      <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-75" style={backgroundStyle} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/70 to-black" />

        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
          <div className="mb-10">
            <img src="/images/spartan-logo-512.png" alt="Spartan Bank" className="w-28 h-28 mx-auto drop-shadow-2xl" />
          </div>
          <h1 className="text-5xl font-bold mb-3">Welcome Back</h1>
          <p className="text-slate-300 text-xl mb-12">Secure Banking at your fingertips</p>

          <div className="w-full max-w-md space-y-4">
            <button onClick={() => window.location.href = "/login"} className="w-full bg-[#1e40af] hover:bg-[#16338a] py-5 rounded-3xl font-semibold text-lg flex items-center justify-center gap-3">
              <LogIn className="w-6 h-6" /> Login to Account
            </button>
            <button onClick={() => window.location.href = "/register"} className="w-full bg-white/10 hover:bg-white/15 py-5 rounded-3xl font-semibold text-lg flex items-center justify-center gap-3 border border-white/20">
              <UserPlus className="w-6 h-6" /> Create New Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== NORMAL BROWSER LANDING PAGE ====================
  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden relative">
      {/* Background */}
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-75" style={backgroundStyle} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/70 to-black" />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 pt-20 pb-16 text-center">
        
        <div className="mb-8">
          <img src="/images/spartan-logo-512.png" alt="Spartan Bank Logo" className="w-32 h-32 mx-auto drop-shadow-2xl" />
        </div>

        <h1 className="text-6xl md:text-7xl font-bold tracking-tight mb-3">Spartan Bank</h1>
        <p className="text-2xl md:text-3xl text-slate-300 mb-12 max-w-md">Secure Banking.<br />Instant Loans.</p>
        <p className="text-lg text-slate-400 mb-16 max-w-sm">Choose your journey with confidence</p>

        <div className="w-full max-w-lg space-y-4 mb-12">
          {/* Continue with Browser */}
          <button onClick={() => window.location.href = "/login"} className="w-full bg-white/10 hover:bg-white/15 backdrop-blur-xl border border-white/20 rounded-3xl p-5 flex items-center gap-4 text-left group transition-all active:scale-[0.98]">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-3xl">🌐</div>
            <div className="flex-1 text-left">
              <div className="font-semibold text-xl">Continue with Browser</div>
              <div className="text-slate-400 text-sm">Fast access without installing</div>
            </div>
            <ArrowRight className="text-slate-400 group-hover:translate-x-1 transition" />
          </button>

          {/* Continue with Application */}
          <button onClick={handleInstall} disabled={installing} className="w-full bg-[#1e40af] hover:bg-[#16338a] disabled:opacity-70 rounded-3xl p-5 flex items-center gap-4 text-left group transition-all active:scale-[0.98]">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center overflow-hidden">
              <img src="/images/spartan-logo-192.png" alt="Spartan Bank" className="w-10 h-10 object-contain" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-semibold text-xl">{installing ? "Installing..." : "Continue with Application"}</div>
              <div className="text-blue-200 text-sm">Install Spartan Bank • Works Offline</div>
            </div>
            <ArrowRight className="text-blue-200 group-hover:translate-x-1 transition" />
          </button>

          {/* About Us Card */}
          <a href="#about" className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-3xl p-5 flex items-center gap-4 text-left group transition-all">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
              <Users className="w-8 h-8" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-semibold text-xl">About Spartan Bank</div>
              <div className="text-slate-400 text-sm">Learn more about us</div>
            </div>
            <ArrowRight className="text-slate-400 group-hover:translate-x-1 transition" />
          </a>
        </div>
      </div>

      {/* About Section */}
      <div id="about" className="relative z-10 bg-slate-900 py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Why Choose Spartan Bank?</h2>
          <p className="text-slate-300 text-lg leading-relaxed">
            We provide secure, fast, and reliable banking services with instant loans, 
            smart savings tools, and seamless digital experience. Your money is safe with us.
          </p>
        </div>
      </div>
    </div>
  );
}