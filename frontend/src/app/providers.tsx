'use client';

import { Toaster } from 'sonner';
import { useEffect } from 'react';
import { initToastBridge } from '@/lib/stores/toastBridge';

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initToastBridge();
  }, []);

  return (
    <>
      {children}
      <Toaster position="top-right" richColors closeButton toastOptions={{ className: 'text-sm' }} />
    </>
  );
}
