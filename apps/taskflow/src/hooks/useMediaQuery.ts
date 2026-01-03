'use client';

import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);

    // Set initial value
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query, matches]);

  return matches;
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
