// Domain definition exports
export { studioDomain, defaultInitialData, type StudioInitialData } from "./studio-domain";
export { sources } from "./sources";
export { derived } from "./derived";
export { actions } from "./actions";

// Type exports
export {
  EditorSourceSchema,
  EditorDerivedSchema,
  EditorActionSchema,
  EditorPolicySchema,
  DomainMetaSchema,
  SchemaTypeEnum,
  EffectTypeEnum,
  PolicyTypeEnum,
  type EditorSource,
  type EditorDerived,
  type EditorAction,
  type EditorPolicy,
  type DomainMeta,
  type SchemaType,
  type EffectType,
  type PolicyType,
  type ValidationIssue,
  type ValidationResult,
} from "./types";
