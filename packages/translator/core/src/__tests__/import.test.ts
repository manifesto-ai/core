/**
 * @fileoverview Import Test
 *
 * Verify that core public exports are accessible.
 */

import { describe, it, expect } from "vitest";
import {
  // Version
  TRANSLATOR_VERSION,
  TRANSLATOR_SPEC_VERSION,
  // Core API
  TranslatorPipeline,
  createDefaultPipeline,
  createCustomPipeline,
  buildExecutionPlan,
  validateGraph,
  validateChunks,
  exportTo,
  createNodeId,
  // Invariants
  checkCausalIntegrity,
  checkReferentialIdentity,
  checkCompleteness,
  checkStatefulness,
} from "../index.js";

describe("@manifesto-ai/translator exports", () => {
  it("exports version constants", () => {
    expect(TRANSLATOR_VERSION).toBeDefined();
    expect(TRANSLATOR_SPEC_VERSION).toBeDefined();
  });

  it("exports core pipeline and helpers", () => {
    expect(typeof TranslatorPipeline).toBe("function");
    expect(typeof createDefaultPipeline).toBe("function");
    expect(typeof createCustomPipeline).toBe("function");
    expect(typeof buildExecutionPlan).toBe("function");
    expect(typeof validateGraph).toBe("function");
    expect(typeof validateChunks).toBe("function");
    expect(typeof exportTo).toBe("function");
  });

  it("exports core type helpers", () => {
    const id = createNodeId("test-id");
    expect(id).toBe("test-id");
  });

  it("exports invariant checks", () => {
    expect(typeof checkCausalIntegrity).toBe("function");
    expect(typeof checkReferentialIdentity).toBe("function");
    expect(typeof checkCompleteness).toBe("function");
    expect(typeof checkStatefulness).toBe("function");
  });
});
