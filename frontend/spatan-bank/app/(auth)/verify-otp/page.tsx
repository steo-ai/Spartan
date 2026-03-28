// app/(auth)/verify-otp/page.tsx
import { Suspense } from "react";
import VerifyOtpClient from "./VerifyOtpClient";

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-background via-spartan-navy/30 to-background flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin h-10 w-10 border-4 border-spartan-cyan border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Loading verification page...</p>
          </div>
        </div>
      }
    >
      <VerifyOtpClient />
    </Suspense>
  );
}