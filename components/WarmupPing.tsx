'use client';

import { useEffect } from 'react';

/**
 * Background warm-up ping component that triggers Render backend cold-start
 * as early as possible on initial page load (included in app/layout.tsx).
 *
 * Fire-and-forget: No loading UI, non-blocking, silently catches any errors.
 */
export function WarmupPing() {
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Fire a lightweight background GET request to wake the backend
    fetch(`${apiUrl}/zones`, {
      method: 'GET',
    }).catch(() => {
      // Silently ignore network errors / cold-start timeouts
    });
  }, []);

  return null;
}
