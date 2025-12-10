import { useCallback } from 'react';

// Simple navigation hook - in a real app, this would use react-router or similar
export function useNavigate() {
  return useCallback((path: string) => {
    window.location.href = path;
  }, []);
}

export function useSearchParams() {
  const params = new URLSearchParams(window.location.search);

  const get = (key: string) => params.get(key);
  const set = (key: string, value: string) => {
    params.set(key, value);
    window.history.pushState({}, '', `${window.location.pathname}?${params}`);
  };

  return { get, set, params };
}
