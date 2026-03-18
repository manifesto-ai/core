'use client';

import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onStoreChange);
      return () => media.removeEventListener('change', onStoreChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

// Convenience hooks for common breakpoints
// Mobile: < 640px
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 639px)');
}

// Tablet: 640px ~ 1024px
export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 640px) and (max-width: 1024px)');
}

// Desktop: >= 1025px
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1025px)');
}
