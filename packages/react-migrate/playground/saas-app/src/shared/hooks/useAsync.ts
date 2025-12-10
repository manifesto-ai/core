import { useState, useCallback, useEffect, useRef } from 'react';

interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

export function useAsync<T>(asyncFn: () => Promise<T>, immediate = true) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    isLoading: immediate,
    isSuccess: false,
    isError: false,
  });

  const isMountedRef = useRef(true);

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await asyncFn();
      if (isMountedRef.current) {
        setState({ data, error: null, isLoading: false, isSuccess: true, isError: false });
      }
      return data;
    } catch (error) {
      if (isMountedRef.current) {
        setState({
          data: null,
          error: error as Error,
          isLoading: false,
          isSuccess: false,
          isError: true,
        });
      }
      throw error;
    }
  }, [asyncFn]);

  useEffect(() => {
    isMountedRef.current = true;
    if (immediate) {
      execute();
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [execute, immediate]);

  return { ...state, execute };
}

export function useAsyncCallback<T, Args extends any[]>(
  asyncFn: (...args: Args) => Promise<T>
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    isLoading: false,
    isSuccess: false,
    isError: false,
  });

  const isMountedRef = useRef(true);

  const execute = useCallback(
    async (...args: Args) => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      try {
        const data = await asyncFn(...args);
        if (isMountedRef.current) {
          setState({ data, error: null, isLoading: false, isSuccess: true, isError: false });
        }
        return data;
      } catch (error) {
        if (isMountedRef.current) {
          setState({
            data: null,
            error: error as Error,
            isLoading: false,
            isSuccess: false,
            isError: true,
          });
        }
        throw error;
      }
    },
    [asyncFn]
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return { ...state, execute };
}

export function usePoll<T>(asyncFn: () => Promise<T>, interval: number, enabled = true) {
  const { data, error, isLoading, execute } = useAsync(asyncFn, enabled);

  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      execute();
    }, interval);

    return () => clearInterval(timer);
  }, [enabled, interval, execute]);

  return { data, error, isLoading, refresh: execute };
}
