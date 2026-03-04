import { useState, useEffect, useRef, useCallback } from "react";
import { createManifesto } from "@manifesto-ai/sdk";
import type { ManifestoInstance, Snapshot } from "@manifesto-ai/sdk";

type UseManifestoResult = {
  state: Snapshot | null;
  ready: boolean;
  act: (type: string, input?: unknown) => void;
};

/**
 * React hook that bridges a ManifestoInstance to React state.
 *
 * - Creates the instance on mount, disposes on unmount
 * - Subscribes to state changes and triggers re-renders
 * - Provides a stable `act()` callback for dispatching intents
 */
export function useManifesto(schema: unknown): UseManifestoResult {
  const instanceRef = useRef<ManifestoInstance | null>(null);
  const [state, setState] = useState<Snapshot | null>(null);

  useEffect(() => {
    const instance = createManifesto({
      schema: schema as string,
      effects: {},
    });
    instanceRef.current = instance;

    let disposed = false;

    // Synchronous — no ready() needed
    setState(instance.getSnapshot());

    instance.subscribe(
      (s) => s,
      (newState) => {
        if (!disposed) setState(newState);
      },
    );

    return () => {
      disposed = true;
      instanceRef.current = null;
      setState(null);
      instance.dispose();
    };
  }, [schema]);

  const act = useCallback((type: string, input?: unknown) => {
    if (!instanceRef.current) return;
    instanceRef.current.dispatch({ type, input, intentId: crypto.randomUUID() });
  }, []);

  return { state, ready: state !== null, act };
}
