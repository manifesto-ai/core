"use client";

import { createRuntime, type DomainRuntime } from "@manifesto-ai/core";
import { RuntimeProvider } from "@manifesto-ai/bridge-react";
import { studioDomain, defaultInitialData, type StudioInitialData } from "@/domain";
import { useMemo, useEffect, useState, createContext, useContext } from "react";

const STORAGE_KEY = "manifesto-studio-domain";

// Context for accessing runtime directly when needed
const StudioRuntimeContext = createContext<DomainRuntime | null>(null);

export function useStudioRuntime(): DomainRuntime {
  const runtime = useContext(StudioRuntimeContext);
  if (!runtime) {
    throw new Error("useStudioRuntime must be used within StudioRuntimeProvider");
  }
  return runtime;
}

type StudioRuntimeProviderProps = {
  children: React.ReactNode;
};

export function StudioRuntimeProvider({ children }: StudioRuntimeProviderProps) {
  const [hydrated, setHydrated] = useState(false);

  // Create runtime with persisted data
  const runtime = useMemo(() => {
    // Load from localStorage (only on client)
    let initialData: StudioInitialData = defaultInitialData;

    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          initialData = {
            domain: parsed.domain ?? defaultInitialData.domain,
            sources: parsed.sources ?? {},
            derived: parsed.derived ?? {},
            actions: parsed.actions ?? {},
            policies: parsed.policies ?? {},
          };
        }
      } catch (e) {
        console.warn("Failed to load saved domain:", e);
      }
    }

    return createRuntime({
      domain: studioDomain,
      initialData,
    });
  }, []);

  // Persist to localStorage on changes
  useEffect(() => {
    const unsubscribe = runtime.subscribe((snapshot) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot.data));
      } catch (e) {
        console.warn("Failed to save domain:", e);
      }
    });

    setHydrated(true);
    return unsubscribe;
  }, [runtime]);

  // Show loading state during hydration
  if (!hydrated) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading Studio...</div>
      </div>
    );
  }

  return (
    <StudioRuntimeContext.Provider value={runtime}>
      <RuntimeProvider runtime={runtime} domain={studioDomain}>
        {children}
      </RuntimeProvider>
    </StudioRuntimeContext.Provider>
  );
}
