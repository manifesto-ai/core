/**
 * Actor Schema
 *
 * Defines Actor types - entities capable of proposing changes.
 * All actors (human, agent, system) are first-class citizens with equal structural treatment.
 */
import { z } from "zod";

/**
 * Actor kinds - the type of entity proposing changes
 *
 * | Kind    | Description                    | Examples                      |
 * |---------|--------------------------------|-------------------------------|
 * | human   | A human user                   | UI user, admin, reviewer      |
 * | agent   | An AI/LLM agent                | GPT-4 agent, Claude agent     |
 * | system  | An automated system            | Scheduler, migration script   |
 */
export const ActorKind = z.enum(["human", "agent", "system"]);
export type ActorKind = z.infer<typeof ActorKind>;

/**
 * Actor Reference - identifies an actor in the system
 *
 * Actors MAY:
 * - Submit Proposals
 * - Be delegated to as HITL Authority
 * - Be part of a Constitutional tribunal
 *
 * Actors MUST NOT:
 * - Directly mutate Worlds
 * - Bypass Authority judgment
 * - Modify other Actors' Proposals
 */
export const ActorRef = z.object({
  /** Unique identifier for the actor */
  actorId: z.string(),

  /** Type of actor */
  kind: ActorKind,

  /** Optional human-readable name */
  name: z.string().optional(),

  /** Optional metadata */
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type ActorRef = z.infer<typeof ActorRef>;

/**
 * Helper to create an ActorRef
 */
export function createActorRef(
  actorId: string,
  kind: ActorKind,
  name?: string,
  meta?: Record<string, unknown>
): ActorRef {
  return {
    actorId,
    kind,
    ...(name !== undefined && { name }),
    ...(meta !== undefined && { meta }),
  };
}

/**
 * Helper to create a human actor
 */
export function createHumanActor(
  actorId: string,
  name?: string,
  meta?: Record<string, unknown>
): ActorRef {
  return createActorRef(actorId, "human", name, meta);
}

/**
 * Helper to create an agent actor
 */
export function createAgentActor(
  actorId: string,
  name?: string,
  meta?: Record<string, unknown>
): ActorRef {
  return createActorRef(actorId, "agent", name, meta);
}

/**
 * Helper to create a system actor
 */
export function createSystemActor(
  actorId: string,
  name?: string,
  meta?: Record<string, unknown>
): ActorRef {
  return createActorRef(actorId, "system", name, meta);
}
