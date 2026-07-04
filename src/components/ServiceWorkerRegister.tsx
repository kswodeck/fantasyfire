'use client';

import { useEffect } from 'react';

/** Registers the service worker in production only (skips dev to avoid caching churn). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    // updateViaCache: 'none' makes the browser bypass the HTTP cache when it
    // checks /sw.js for updates, so new deployments roll out promptly.
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      /* registration is best-effort */
    });
  }, []);
  return null;
}
