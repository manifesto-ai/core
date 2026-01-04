/**
 * Dataset loader tests.
 */

import { describe, it, expect } from "vitest";
import {
  parseInitialState,
  parseEnvDescription,
  parseActionSequence,
  isValidAction,
} from "../dataset/index.js";

describe("parseInitialState", () => {
  it("should parse valid initial state string", () => {
    const result = parseInitialState("((3, 4), 3)");
    expect(result).toEqual({ x: 3, y: 4, direction: 3 });
  });

  it("should parse state with different values", () => {
    const result = parseInitialState("((1, 2), 0)");
    expect(result).toEqual({ x: 1, y: 2, direction: 0 });
  });

  it("should return default for invalid input", () => {
    const result = parseInitialState("invalid");
    expect(result).toEqual({ x: 1, y: 1, direction: 0 });
  });
});

describe("parseEnvDescription", () => {
  it("should parse grid size", () => {
    const desc = "An agent is in a grid world of size 8 by 8 cells.";
    const result = parseEnvDescription(desc);
    expect(result.gridSize).toEqual({ width: 8, height: 8 });
  });

  it("should parse agent position", () => {
    const desc = "Agent initial position: (3, 4)";
    const result = parseEnvDescription(desc);
    expect(result.agentPosition).toEqual({ x: 3, y: 4 });
  });

  it("should parse agent direction", () => {
    const desc = "Agent facing direction: north";
    const result = parseEnvDescription(desc);
    expect(result.agentDirection).toBe("north");
  });

  it("should parse mission", () => {
    const desc = "Mission: 'go to the red ball'";
    const result = parseEnvDescription(desc);
    expect(result.mission).toBe("go to the red ball");
  });

  it("should parse objects", () => {
    const desc = `Object 0: key, color=yellow, position=(1, 6)
Object 1: ball, color=red, position=(2, 3)`;
    const result = parseEnvDescription(desc);
    expect(result.objects).toHaveLength(2);
    expect(result.objects[0]).toEqual({
      type: "key",
      color: "yellow",
      position: { x: 1, y: 6 },
    });
    expect(result.objects[1]).toEqual({
      type: "ball",
      color: "red",
      position: { x: 2, y: 3 },
    });
  });
});

describe("parseActionSequence", () => {
  it("should parse comma-separated actions", () => {
    const result = parseActionSequence("forward, forward, left, pickup");
    expect(result).toEqual(["forward", "forward", "left", "pickup"]);
  });

  it("should handle empty string", () => {
    const result = parseActionSequence("");
    expect(result).toEqual([]);
  });

  it("should normalize to lowercase", () => {
    const result = parseActionSequence("Forward, LEFT, Right");
    expect(result).toEqual(["forward", "left", "right"]);
  });
});

describe("isValidAction", () => {
  it("should return true for valid actions", () => {
    expect(isValidAction("left")).toBe(true);
    expect(isValidAction("right")).toBe(true);
    expect(isValidAction("forward")).toBe(true);
    expect(isValidAction("pickup")).toBe(true);
    expect(isValidAction("drop")).toBe(true);
    expect(isValidAction("toggle")).toBe(true);
    expect(isValidAction("done")).toBe(true);
  });

  it("should return false for invalid actions", () => {
    expect(isValidAction("jump")).toBe(false);
    expect(isValidAction("run")).toBe(false);
    expect(isValidAction("")).toBe(false);
  });
});
