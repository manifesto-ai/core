/**
 * Schema types for AI-generated Manifesto domains
 */

export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "email"
  | "phone"
  | "date"
  | "select"
  | "multiselect"
  | "textarea";

export interface FieldDefinition {
  type: FieldType;
  label: string;
  description?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: unknown;
  options?: Array<{ value: string; label: string }>; // for select/multiselect
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}

export interface FieldPolicyDefinition {
  relevance?: string | boolean; // Expression or constant
  editability?: string | boolean;
  requirement?: string | boolean;
}

export interface DerivedDefinition {
  expression: unknown; // Expression DSL
  type: "string" | "number" | "boolean" | "array";
  description?: string;
}

export interface ActionDefinition {
  label: string;
  description?: string;
  precondition?: unknown; // Expression DSL
  effect?: unknown; // Effect DSL
}

export interface GeneratedSchema {
  name: string;
  description: string;
  fields: Record<string, FieldDefinition>;
  fieldPolicies?: Record<string, FieldPolicyDefinition>;
  derived?: Record<string, DerivedDefinition>;
  actions?: Record<string, ActionDefinition>;
}

export interface SchemaGenerationResult {
  success: boolean;
  schema?: GeneratedSchema;
  error?: string;
}
