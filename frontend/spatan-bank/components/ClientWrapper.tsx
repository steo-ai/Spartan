// components/ClientWrapper.tsx
'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/auth-context';
import { GlassProvider } from '@/contexts/glass-context';   // Make sure this path is correct

export default function ClientWrapper({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <GlassProvider>
        {children}
      </GlassProvider>
    </AuthProvider>
  );
}