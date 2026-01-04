/**
 * Test Actor Fixtures
 *
 * Pre-defined actors for integration testing.
 */

import type { ActorRef } from "@manifesto-ai/world";

/**
 * Test human user actor.
 */
export const userActor: ActorRef = {
  actorId: "user:test-user",
  kind: "human",
  name: "Test User",
};

/**
 * Test AI agent actor.
 */
export const agentActor: ActorRef = {
  actorId: "agent:ai-assistant",
  kind: "agent",
  name: "AI Assistant",
};

/**
 * Test system actor.
 */
export const systemActor: ActorRef = {
  actorId: "system:automated",
  kind: "system",
  name: "Automated System",
};

/**
 * Create a test actor with custom properties.
 *
 * @param id - Actor ID suffix
 * @param kind - Actor kind (human, agent, system)
 * @returns ActorRef instance
 */
export function createTestActor(
  id: string,
  kind: "human" | "agent" | "system" = "human"
): ActorRef {
  return {
    actorId: `${kind}:${id}`,
    kind,
    name: `Test ${kind} ${id}`,
  };
}
