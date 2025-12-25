import { z } from "zod";

// Schema types for editor blocks
export const SchemaTypeEnum = z.enum([
  "string",
  "number",
  "boolean",
  "array",
  "object",
]);
export type SchemaType = z.infer<typeof SchemaTypeEnum>;

// Editor-specific source definition
export const EditorSourceSchema = z.object({
  id: z.string(),
  path: z.string(),
  schemaType: SchemaTypeEnum,
  description: z.string(),
  defaultValue: z.unknown().optional(),
});
export type EditorSource = z.infer<typeof EditorSourceSchema>;

// Editor-specific derived definition
export const EditorDerivedSchema = z.object({
  id: z.string(),
  path: z.string(),
  deps: z.array(z.string()),
  expr: z.unknown(),
  description: z.string(),
});
export type EditorDerived = z.infer<typeof EditorDerivedSchema>;

// Effect type enum for actions
export const EffectTypeEnum = z.enum([
  "setState",
  "apiCall",
  "navigate",
  "custom",
]);
export type EffectType = z.infer<typeof EffectTypeEnum>;

// Editor-specific action definition
export const EditorActionSchema = z.object({
  id: z.string(),
  path: z.string(),
  preconditions: z.unknown(), // Expression DSL
  effectType: EffectTypeEnum,
  effectConfig: z.unknown(), // Effect configuration (depends on effectType)
  description: z.string(),
});
export type EditorAction = z.infer<typeof EditorActionSchema>;

// Policy type enum
export const PolicyTypeEnum = z.enum([
  "allow",
  "deny",
]);
export type PolicyType = z.infer<typeof PolicyTypeEnum>;

// Editor-specific policy definition
export const EditorPolicySchema = z.object({
  id: z.string(),
  path: z.string(),
  targetPath: z.string(), // Path this policy governs
  condition: z.unknown(), // Expression DSL condition
  policyType: PolicyTypeEnum,
  description: z.string(),
});
export type EditorPolicy = z.infer<typeof EditorPolicySchema>;

// Domain metadata
export const DomainMetaSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
});
export type DomainMeta = z.infer<typeof DomainMetaSchema>;

// Validation issue (matches core types)
export type ValidationIssue = {
  code: string;
  message: string;
  path: string;
  severity: "error" | "warning" | "info" | "suggestion";
  suggestedFix?: {
    description: string;
    value: unknown;
  };
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};
