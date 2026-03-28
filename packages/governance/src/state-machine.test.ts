import { describe, expect, it } from "vitest";
import {
  getValidTransitions,
  isExecutionStageStatus,
  isIngressStatus,
  isTerminalStatus,
  isValidTransition,
  transitionCreatesDecisionRecord,
} from "./index.js";

describe("@manifesto-ai/governance state machine", () => {
  it("models split-native superseded transitions", () => {
    expect(getValidTransitions("submitted")).toEqual([
      "evaluating",
      "rejected",
      "superseded",
    ]);
    expect(getValidTransitions("evaluating")).toEqual([
      "approved",
      "rejected",
      "superseded",
    ]);
    expect(getValidTransitions("superseded")).toEqual([]);
    expect(isValidTransition("approved", "superseded")).toBe(false);
    expect(isValidTransition("executing", "superseded")).toBe(false);
  });

  it("classifies ingress, execution-stage, terminal, and decision-bearing statuses correctly", () => {
    expect(isIngressStatus("submitted")).toBe(true);
    expect(isIngressStatus("evaluating")).toBe(true);
    expect(isExecutionStageStatus("approved")).toBe(true);
    expect(isExecutionStageStatus("executing")).toBe(true);
    expect(isTerminalStatus("superseded")).toBe(true);
    expect(transitionCreatesDecisionRecord("submitted", "rejected")).toBe(true);
    expect(transitionCreatesDecisionRecord("evaluating", "approved")).toBe(true);
    expect(transitionCreatesDecisionRecord("evaluating", "superseded")).toBe(false);
  });
});
