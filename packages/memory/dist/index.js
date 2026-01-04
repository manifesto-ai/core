/**
 * @manifesto-ai/memory
 *
 * Manifesto Memory Layer - Memory retrieval, verification, and tracing.
 *
 * This package implements the Memory Specification v1.2.0, providing:
 * - Type definitions for memory references, proofs, and traces
 * - Interfaces for Store, Verifier, and Selector
 * - Pure Verifier implementations (Existence, Hash, Merkle)
 * - Trace utilities for audit trail management
 * - Example implementations for testing and reference
 *
 * @packageDocumentation
 */
// ============ Schema / Types ============
export * from "./schema/index.js";
// ============ Interfaces ============
export * from "./interfaces/index.js";
// ============ Verifiers ============
export * from "./verifier/index.js";
// ============ Trace Utilities ============
export * from "./trace/index.js";
// ============ Example Implementations ============
export * from "./examples/index.js";
//# sourceMappingURL=index.js.map