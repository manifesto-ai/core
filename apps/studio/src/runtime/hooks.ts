"use client";

import { useValue, useSetValue, useAction, useDerived } from "@manifesto-ai/bridge-react";
import { useEffect, useMemo, useRef, useCallback } from "react";
import type { EditorSource, EditorDerived, EditorAction, EditorPolicy, ValidationResult } from "@/domain";
import { validateDomain } from "./validation";
import { serializeDomain, deserializeDomain, type DomainState, type DomainExport } from "./domain-serializer";
import type { Scenario, ScenarioResult } from "./scenario-types";
import { executeScenario, type DomainDefinition } from "./scenario-executor";

// Re-export bridge-react hooks for convenience
export { useValue, useSetValue, useAction, useDerived } from "@manifesto-ai/bridge-react";

// Typed hooks for Studio-specific paths
export function useDomainId() {
  return useValue<string>("data.domain.id");
}

export function useDomainName() {
  return useValue<string>("data.domain.name");
}

export function useDomainDescription() {
  return useValue<string>("data.domain.description");
}

export function useSources() {
  return useValue<Record<string, EditorSource>>("data.sources");
}

export function useDerivedBlocks() {
  return useValue<Record<string, EditorDerived>>("data.derived");
}

export function useActionBlocks() {
  return useValue<Record<string, EditorAction>>("data.actions");
}

export function usePolicyBlocks() {
  return useValue<Record<string, EditorPolicy>>("data.policies");
}

export function useSelectedBlockId() {
  return useValue<string | null>("state.selectedBlockId");
}

export function useIsValidating() {
  return useValue<boolean>("state.isValidating");
}

export function useValidationResult() {
  return useValue<ValidationResult | null>("state.validationResult");
}

export function useAllPaths() {
  return useDerived<string[]>("derived.allPaths");
}

export function useSourcePaths() {
  return useDerived<string[]>("derived.sourcePaths");
}

export function useHasContent() {
  return useDerived<boolean>("derived.hasContent");
}

export function useTotalBlocks() {
  return useDerived<number>("derived.totalBlocks");
}

// Validation hook - runs validateDomain when content changes
export function useStudioValidation() {
  const { value: sources } = useSources();
  const { value: derived } = useDerivedBlocks();
  const { value: actions } = useActionBlocks();
  const { value: policies } = usePolicyBlocks();
  const { value: domainId } = useDomainId();
  const { value: domainName } = useDomainName();
  const { setValue } = useSetValue();

  // Create stable keys to prevent infinite loops from object reference changes
  const sourcesKey = useMemo(
    () => JSON.stringify(sources ?? {}),
    [sources]
  );
  const derivedKey = useMemo(
    () => JSON.stringify(derived ?? {}),
    [derived]
  );
  const actionsKey = useMemo(
    () => JSON.stringify(actions ?? {}),
    [actions]
  );
  const policiesKey = useMemo(
    () => JSON.stringify(policies ?? {}),
    [policies]
  );

  // Use ref to access current values without adding to dependencies
  const dataRef = useRef({ sources, derived, actions, policies, domainId, domainName });
  dataRef.current = { sources, derived, actions, policies, domainId, domainName };

  useEffect(() => {
    const { sources: currentSources, derived: currentDerived, actions: currentActions, policies: currentPolicies, domainId: currentDomainId, domainName: currentDomainName } = dataRef.current;

    const hasContent =
      Object.keys(currentSources ?? {}).length > 0 ||
      Object.keys(currentDerived ?? {}).length > 0 ||
      Object.keys(currentActions ?? {}).length > 0 ||
      Object.keys(currentPolicies ?? {}).length > 0;

    if (!hasContent) {
      setValue("state.validationResult", null);
      return;
    }

    // Debounce validation
    const timer = setTimeout(() => {
      setValue("state.isValidating", true);

      // Use extracted validation function
      const result = validateDomain({
        domainId: currentDomainId,
        domainName: currentDomainName,
        sources: currentSources,
        derived: currentDerived,
        actions: currentActions,
        policies: currentPolicies,
      });

      setValue("state.validationResult", result);
      setValue("state.isValidating", false);
    }, 300);

    return () => clearTimeout(timer);
  }, [sourcesKey, derivedKey, actionsKey, policiesKey, domainId, domainName, setValue]);
}

// Export/Import hooks
export function useDomainExport() {
  const { value: sources } = useSources();
  const { value: derived } = useDerivedBlocks();
  const { value: domainId } = useDomainId();
  const { value: domainName } = useDomainName();
  const { value: domainDescription } = useDomainDescription();

  const exportDomain = useCallback(() => {
    const state: DomainState = {
      domain: {
        id: domainId ?? "untitled",
        name: domainName ?? "Untitled Domain",
        description: domainDescription ?? "",
      },
      sources: sources ?? {},
      derived: derived ?? {},
    };
    return serializeDomain(state);
  }, [domainId, domainName, domainDescription, sources, derived]);

  const downloadDomain = useCallback(() => {
    const exported = exportDomain();
    const json = JSON.stringify(exported, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exported.domain.id}.manifesto.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [exportDomain]);

  return { exportDomain, downloadDomain };
}

export function useDomainImport() {
  const { setValue } = useSetValue();

  const importDomain = useCallback(
    (input: unknown) => {
      const result = deserializeDomain(input);
      if (!result.success) {
        return result;
      }

      // Apply imported data to runtime
      setValue("data.domain.id", result.data.domain.id);
      setValue("data.domain.name", result.data.domain.name);
      setValue("data.domain.description", result.data.domain.description);
      setValue("data.sources", result.data.sources);
      setValue("data.derived", result.data.derived);

      return result;
    },
    [setValue]
  );

  const importFromFile = useCallback(
    (file: File): Promise<ReturnType<typeof deserializeDomain>> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const json = JSON.parse(e.target?.result as string);
            resolve(importDomain(json));
          } catch {
            resolve({
              success: false,
              error: {
                code: "PARSE_ERROR",
                message: "Failed to parse JSON file",
              },
            });
          }
        };
        reader.onerror = () => {
          resolve({
            success: false,
            error: {
              code: "READ_ERROR",
              message: "Failed to read file",
            },
          });
        };
        reader.readAsText(file);
      });
    },
    [importDomain]
  );

  return { importDomain, importFromFile };
}

// ============================================================================
// Scenario Hooks
// ============================================================================

export function useScenarios() {
  return useValue<Record<string, Scenario>>("data.scenarios");
}

export function useScenarioResults() {
  return useValue<Record<string, ScenarioResult>>("state.scenarioResults");
}

export function useSelectedScenarioId() {
  return useValue<string | null>("state.selectedScenarioId");
}

export function useScenarioRunner() {
  const { value: sources } = useSources();
  const { value: derived } = useDerivedBlocks();
  const { value: actions } = useActionBlocks();
  const { value: policies } = usePolicyBlocks();
  const { value: scenarios } = useScenarios();
  const { value: scenarioResults } = useScenarioResults();
  const { setValue } = useSetValue();

  const runScenario = useCallback(
    (scenarioId: string) => {
      const scenario = scenarios?.[scenarioId];
      if (!scenario) {
        return null;
      }

      const domain: DomainDefinition = {
        sources: sources ?? {},
        derived: derived ?? {},
        actions: actions ?? {},
        policies: policies ?? {},
      };

      const result = executeScenario(scenario, domain);

      // Store result
      setValue("state.scenarioResults", {
        ...(scenarioResults ?? {}),
        [scenarioId]: result,
      });

      return result;
    },
    [sources, derived, actions, policies, scenarios, scenarioResults, setValue]
  );

  const runAllScenarios = useCallback(() => {
    if (!scenarios) return {};

    const results: Record<string, ScenarioResult> = {};
    const domain: DomainDefinition = {
      sources: sources ?? {},
      derived: derived ?? {},
      actions: actions ?? {},
      policies: policies ?? {},
    };

    for (const scenario of Object.values(scenarios)) {
      results[scenario.id] = executeScenario(scenario, domain);
    }

    setValue("state.scenarioResults", results);
    return results;
  }, [sources, derived, actions, policies, scenarios, setValue]);

  const clearResults = useCallback(() => {
    setValue("state.scenarioResults", {});
  }, [setValue]);

  return { runScenario, runAllScenarios, clearResults };
}

export function useScenarioEditor() {
  const { value: scenarios } = useScenarios();
  const { setValue } = useSetValue();

  const addScenario = useCallback(
    (scenario: Scenario) => {
      setValue("data.scenarios", {
        ...(scenarios ?? {}),
        [scenario.id]: scenario,
      });
    },
    [scenarios, setValue]
  );

  const updateScenario = useCallback(
    (scenarioId: string, updates: Partial<Scenario>) => {
      const existing = scenarios?.[scenarioId];
      if (!existing) return;

      setValue("data.scenarios", {
        ...(scenarios ?? {}),
        [scenarioId]: { ...existing, ...updates },
      });
    },
    [scenarios, setValue]
  );

  const deleteScenario = useCallback(
    (scenarioId: string) => {
      if (!scenarios) return;

      const { [scenarioId]: _removed, ...rest } = scenarios;
      setValue("data.scenarios", rest);
    },
    [scenarios, setValue]
  );

  const duplicateScenario = useCallback(
    (scenarioId: string) => {
      const existing = scenarios?.[scenarioId];
      if (!existing) return;

      const newId = `${scenarioId}-copy-${Date.now()}`;
      const newScenario: Scenario = {
        ...existing,
        id: newId,
        name: `${existing.name} (Copy)`,
      };

      setValue("data.scenarios", {
        ...(scenarios ?? {}),
        [newId]: newScenario,
      });

      return newId;
    },
    [scenarios, setValue]
  );

  return { addScenario, updateScenario, deleteScenario, duplicateScenario };
}
