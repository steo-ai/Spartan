// components/InstallButton.tsx
'use client';

import { useState, useEffect } from 'react';
import { Download } from 'lucide-react'; // ← if you don't have lucide-react, just remove this line and the icon below

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Cleanup
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    const promptEvent = deferredPrompt;
    promptEvent.prompt();

    const { outcome } = await promptEvent.userChoice;

    console.log(`✅ Spartan Bank install outcome: ${outcome}`);

    // Hide button after choice
    setDeferredPrompt(null);
    setIsVisible(false);

    // Optional: you can add a sonner toast here if you want
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={handleInstall}
      className="fixed bottom-8 right-8 z-[9999] flex items-center gap-3 
                 bg-[#1e40af] hover:bg-[#16338a] active:scale-95 transition-all
                 text-white font-semibold text-base px-7 py-4 rounded-3xl 
                 shadow-2xl shadow-[#1e40af]/30 border border-white/10"
    >
      <Download className="w-6 h-6" />
      Install Spartan Bank
    </button>
  );
}