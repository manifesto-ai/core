import { defineDomain, type ManifestoDomain } from "@manifesto-ai/core";
import { z } from "zod";
import { sources } from "./sources";
import { derived } from "./derived";
import { actions } from "./actions";
import { EditorSourceSchema, EditorDerivedSchema, EditorActionSchema, EditorPolicySchema } from "./types";
import { ScenarioSchema, ScenarioResultSchema } from "../runtime/scenario-types";

// Data schema for persistent domain data
const dataSchema = z.object({
  domain: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
  }),
  sources: z.record(z.string(), EditorSourceSchema),
  derived: z.record(z.string(), EditorDerivedSchema),
  actions: z.record(z.string(), EditorActionSchema),
  policies: z.record(z.string(), EditorPolicySchema),
  scenarios: z.record(z.string(), ScenarioSchema).optional(),
});

// State schema for transient UI state
const stateSchema = z.object({
  selectedBlockId: z.string().nullable(),
  isValidating: z.boolean(),
  validationResult: z
    .object({
      valid: z.boolean(),
      issues: z.array(
        z.object({
          code: z.string(),
          message: z.string(),
          path: z.string(),
          severity: z.enum(["error", "warning", "info", "suggestion"]),
          suggestedFix: z
            .object({
              description: z.string(),
              value: z.unknown(),
            })
            .optional(),
        })
      ),
    })
    .nullable(),
  scenarioResults: z.record(z.string(), ScenarioResultSchema).optional(),
  selectedScenarioId: z.string().nullable().optional(),
});

// Initial state
const initialState = {
  selectedBlockId: null,
  isValidating: false,
  validationResult: null,
};

// Define the Studio domain using Manifesto
export const studioDomain: ManifestoDomain = defineDomain({
  id: "manifesto-studio",
  name: "Manifesto Studio",
  description: "Visual IDE for creating and editing Manifesto Domains",

  dataSchema,
  stateSchema,
  initialState,

  paths: {
    sources,
    derived,
  },

  actions,

  meta: {
    version: "1.0.0",
    category: "ide",
    aiDescription:
      "A visual editor for Manifesto domains. Users can create source blocks (data fields) and derived blocks (computed values) to define their domain schema.",
  },
});

// Export types for initial data structure
export type StudioInitialData = {
  domain: {
    id: string;
    name: string;
    description: string;
  };
  sources: Record<string, unknown>;
  derived: Record<string, unknown>;
  actions: Record<string, unknown>;
  policies: Record<string, unknown>;
  scenarios?: Record<string, unknown>;
};

// Default initial data
export const defaultInitialData: StudioInitialData = {
  domain: {
    id: "",
    name: "",
    description: "",
  },
  sources: {},
  derived: {},
  actions: {},
  policies: {},
  scenarios: {},
};
