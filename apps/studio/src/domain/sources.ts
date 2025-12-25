import { defineSource, type SemanticMeta } from "@manifesto-ai/core";
import { z } from "zod";
import { EditorSourceSchema, EditorDerivedSchema } from "./types";

// Helper to create semantic metadata
const semantic = (
  type: string,
  description: string,
  opts?: Partial<SemanticMeta>
): SemanticMeta => ({
  type,
  description,
  readable: true,
  writable: true,
  ...opts,
});

export const sources = {
  // Domain metadata
  "domain.id": defineSource({
    schema: z.string(),
    defaultValue: "",
    semantic: semantic("id", "Unique identifier for the domain being edited"),
  }),

  "domain.name": defineSource({
    schema: z.string(),
    defaultValue: "",
    semantic: semantic("text", "Human-readable domain name"),
  }),

  "domain.description": defineSource({
    schema: z.string(),
    defaultValue: "",
    semantic: semantic("text", "Description of the domain purpose"),
  }),

  // Source definitions (the blocks user creates)
  sources: defineSource({
    schema: z.record(z.string(), EditorSourceSchema),
    defaultValue: {},
    semantic: semantic("collection", "Map of source block definitions by ID"),
  }),

  // Derived definitions (the blocks user creates)
  derived: defineSource({
    schema: z.record(z.string(), EditorDerivedSchema),
    defaultValue: {},
    semantic: semantic("collection", "Map of derived block definitions by ID"),
  }),
};
