/**
 * Source Event Factories
 *
 * Creates SourceEvents for Translator operations.
 * Uses Bridge's SourceEvent structure.
 */

import { createAgentSourceEvent as createBridgeAgentSourceEvent } from "@manifesto-ai/bridge";
import type { SourceEvent } from "@manifesto-ai/bridge";
import type { AmbiguityResolution } from "../domain/index.js";

/**
 * Translate event payload
 */
export interface TranslateEventPayload {
  type: "translator:translate";
  input: string;
}

/**
 * Resolve event payload
 */
export interface ResolveEventPayload {
  type: "translator:resolve";
  reportId: string;
  resolution: AmbiguityResolution;
}

/**
 * CLI event payload
 */
export interface CLIEventPayload {
  type: "translator:cli";
  command: string;
  args: Record<string, unknown>;
}

/**
 * Agent event payload
 */
export interface AgentEventPayload {
  type: "translator:agent";
  agentId: string;
  action: string;
  [key: string]: unknown;
}

/**
 * Create a translate source event
 *
 * @param input - Natural language input
 * @param eventId - Optional event ID
 * @returns SourceEvent for translation
 */
export function createTranslateSourceEvent(
  input: string,
  eventId?: string
): SourceEvent {
  const payload: TranslateEventPayload = {
    type: "translator:translate",
    input,
  };
  return createBridgeAgentSourceEvent(
    eventId ?? `translate-${Date.now()}`,
    payload
  );
}

/**
 * Create a resolve source event
 *
 * @param reportId - Report ID being resolved
 * @param resolution - Ambiguity resolution
 * @param eventId - Optional event ID
 * @returns SourceEvent for resolution
 */
export function createResolveSourceEvent(
  reportId: string,
  resolution: AmbiguityResolution,
  eventId?: string
): SourceEvent {
  const payload: ResolveEventPayload = {
    type: "translator:resolve",
    reportId,
    resolution,
  };
  return createBridgeAgentSourceEvent(
    eventId ?? `resolve-${reportId}-${Date.now()}`,
    payload
  );
}

/**
 * Create a CLI source event
 *
 * @param command - CLI command
 * @param args - Command arguments
 * @param eventId - Optional event ID
 * @returns SourceEvent for CLI
 */
export function createCLISourceEvent(
  command: string,
  args: Record<string, unknown>,
  eventId?: string
): SourceEvent {
  const payload: CLIEventPayload = {
    type: "translator:cli",
    command,
    args,
  };
  return createBridgeAgentSourceEvent(
    eventId ?? `cli-${Date.now()}`,
    payload
  );
}

/**
 * Create an agent source event
 *
 * @param agentId - Agent ID
 * @param action - Agent action
 * @param data - Additional data
 * @param eventId - Optional event ID
 * @returns SourceEvent for agent
 */
export function createAgentSourceEvent(
  agentId: string,
  action: string,
  data: Record<string, unknown>,
  eventId?: string
): SourceEvent {
  const payload: AgentEventPayload = {
    type: "translator:agent",
    agentId,
    action,
    ...data,
  };
  return createBridgeAgentSourceEvent(
    eventId ?? `agent-${agentId}-${Date.now()}`,
    payload
  );
}

/**
 * Check if payload is a translate event
 */
export function isTranslatePayload(payload: unknown): payload is TranslateEventPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as any).type === "translator:translate"
  );
}

/**
 * Check if payload is a resolve event
 */
export function isResolvePayload(payload: unknown): payload is ResolveEventPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as any).type === "translator:resolve"
  );
}
