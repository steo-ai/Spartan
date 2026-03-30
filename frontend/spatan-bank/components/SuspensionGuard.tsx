// components/SuspensionGuard.tsx
'use client';

import { useEffect } from 'react';

export default function SuspensionGuard() {
  useEffect(() => {
    // Prevent app suspension / keep service worker alive (useful for banking apps)
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.log('Wake Lock not supported or failed');
      }
    };

    requestWakeLock();

    // Re-request wake lock when visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    });

    return () => {
      if (wakeLock) wakeLock.release();
    };
  }, []);

  return null; // This component renders nothing
}