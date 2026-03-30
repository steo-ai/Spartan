// app/layout.tsx
import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "sonner";
import { Suspense } from "react";

import ClientWrapper from "@/components/ClientWrapper";
import SuspensionGuard from '@/components/SuspensionGuard';
import { ThemeProvider } from "@/components/theme-provider";   // ← Import here

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Spartan Bank",
  description: "Secure banking, instant loans & smart financial management",
  generator: "v0.app",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/images/spartan-logo-192.png", sizes: "192x192", type: "image/png" },
      { url: "/images/spartan-logo-512.png", sizes: "512x512", type: "image/png" },
      { url: "/images/spartan-logo-maskable-192.png", sizes: "192x192", type: "image/png" },
      { url: "/images/spartan-logo-maskable-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/images/spartan-logo-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1e40af" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Spartan Bank" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 to-slate-900">
              <img
                src="/images/spartan-logo-192.png"
                alt="Spartan Bank Logo"
                className="w-48 h-auto"
              />
            </div>
          }
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            <ClientWrapper>
              {children}
              <SuspensionGuard />
            </ClientWrapper>
          </ThemeProvider>

          <Toaster 
            theme="dark"
            richColors
            position="top-right"
            expand={true}
            visibleToasts={3}
            closeButton
            toastOptions={{
              duration: 4000,
              style: {
                background: "linear-gradient(to bottom right, #1e2937, #0f172a)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.15)",
                backdropFilter: "blur(20px)",
              },
            }}
          />
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}