import { useState, useEffect, useRef, useCallback } from "react";
import { createApp, createSilentPolicyService } from "@manifesto-ai/app";
import type { App, AppState } from "@manifesto-ai/app";

type UseManifestoResult = {
  state: AppState<unknown> | null;
  ready: boolean;
  act: (type: string, input?: unknown) => Promise<void>;
};

/**
 * React hook that bridges a Manifesto app to React state.
 *
 * - Creates the app on mount, disposes on unmount
 * - Subscribes to state changes and triggers re-renders
 * - Provides a stable `act()` callback for dispatching actions
 */
export function useManifesto(schema: unknown): UseManifestoResult {
  const appRef = useRef<App | null>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<AppState<unknown> | null>(null);

  useEffect(() => {
    const app = createApp({
      schema: schema as string,
      effects: {},
      policyService: createSilentPolicyService(),
    });
    appRef.current = app;

    let disposed = false;

    app.ready().then(() => {
      if (disposed) return;
      setState(app.getState());

      app.subscribe(
        (s) => s,
        (newState) => {
          if (!disposed) setState(newState);
        },
      );

      setReady(true);
    });

    return () => {
      disposed = true;
      appRef.current = null;
      setReady(false);
      setState(null);
      app.dispose();
    };
  }, [schema]);

  const act = useCallback(async (type: string, input?: unknown) => {
    if (!appRef.current) return;
    await appRef.current.act(type, input).done();
  }, []);

  return { state, ready, act };
}
