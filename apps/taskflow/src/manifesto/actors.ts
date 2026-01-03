/**
 * TaskFlow Actors
 *
 * Defines actors that can interact with the TaskFlow domain.
 * All actors must be registered with an authority binding before submitting proposals.
 */

import {
  createActorRef,
  createHumanActor,
  createAgentActor,
  createSystemActor,
  type ActorRef,
} from "@manifesto-ai/world";

// Re-export ActorRef for use by other modules
export type { ActorRef };

/**
 * Actor kinds used in TaskFlow
 */
export const ActorKinds = {
  USER: "human",
  AI_AGENT: "agent",
  SYSTEM: "system",
} as const;

/**
 * Well-known actor IDs
 */
export const ActorIds = {
  ANONYMOUS_USER: "user:anonymous",
  SYSTEM: "system:taskflow",
  AI_ASSISTANT: "agent:assistant",
} as const;

/**
 * Create a user actor
 */
export function createUserActor(
  userId: string,
  name?: string
): ActorRef {
  return createHumanActor(`user:${userId}`, name ?? `User ${userId}`);
}

/**
 * Create the AI assistant actor
 */
export function createAssistantActor(sessionId: string): ActorRef {
  return createAgentActor(
    `agent:assistant:${sessionId}`,
    "AI Assistant",
    { sessionId }
  );
}

/**
 * Create the system actor (for automated operations)
 */
export function createTaskflowSystemActor(): ActorRef {
  return createSystemActor(ActorIds.SYSTEM, "TaskFlow System");
}

/**
 * Default actors for TaskFlow
 */
export const defaultActors = {
  anonymousUser: createHumanActor(ActorIds.ANONYMOUS_USER, "Anonymous User"),
  system: createSystemActor(ActorIds.SYSTEM, "TaskFlow System"),
};
