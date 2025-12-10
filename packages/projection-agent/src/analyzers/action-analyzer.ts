/**
 * Action Analyzer
 *
 * Analyzes domain actions for AI consumption.
 * Creates AgentActionInfo with blockedReasons and execution info.
 */

import type { ActionDefinition, PreconditionStatus } from '@manifesto-ai/core';
import type { AgentActionInfo, JsonSchema } from '../types.js';
import { describeEffect } from './effect-predictor.js';
import { assessActionRisk } from './risk-assessor.js';

// =============================================================================
// Blocked Reasons
// =============================================================================

/**
 * Convert precondition statuses to blocked reasons.
 * Provides 100% explainable reasons why action is blocked.
 */
export function preconditionsToBlockedReasons(
  preconditions: PreconditionStatus[]
): string[] {
  const unsatisfied = preconditions.filter((p) => !p.satisfied);

  return unsatisfied.map((p) => {
    // Use explicit reason if available
    if (p.reason) return p.reason;

    // Generate reason from path and expectation
    const actualStr = formatActualValue(p.actual);
    return `${p.path} is ${actualStr}, but must be ${p.expect}`;
  });
}

/**
 * Format actual value for display.
 */
function formatActualValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (value === '') return 'empty';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return `"${value}"`;
  return JSON.stringify(value);
}

// =============================================================================
// Action Analysis
// =============================================================================

/**
 * Analyze a single action and create AgentActionInfo.
 *
 * @param actionId - Action identifier
 * @param action - Action definition from domain
 * @param preconditions - Precondition statuses (from runtime.getPreconditions)
 * @returns AgentActionInfo for AI consumption
 */
export function analyzeAction(
  actionId: string,
  action: ActionDefinition,
  preconditions: PreconditionStatus[]
): AgentActionInfo {
  // Check if action can execute
  const canExecute = preconditions.every((p: PreconditionStatus) => p.satisfied);

  // Get blocked reasons
  const blockedReasons = canExecute
    ? []
    : preconditionsToBlockedReasons(preconditions);

  // Predict effects
  const willDo: string[] = [];
  if (action.effect) {
    willDo.push(describeEffect(action.effect));
  }

  // Assess risk
  const riskAssessment = assessActionRisk(action);

  // Extract semantic info
  const semantic = action.semantic;
  const verb = semantic.verb ?? actionId.replace('action.', '');
  const description = semantic.description ?? `Execute ${verb}`;

  // Check if input is required (via semantic hints)
  const requiresInput = !!(semantic.hints?.requiresInput);
  const inputSchema = semantic.hints?.inputSchema
    ? zodToJsonSchema(semantic.hints.inputSchema)
    : undefined;

  return {
    id: actionId,
    verb,
    description,
    canExecute,
    blockedReasons,
    willDo,
    risk: riskAssessment.level,
    requiresInput,
    inputSchema,
    expectedOutcome: semantic.description,
    reversible: undefined, // Could be determined from effect type
  };
}

/**
 * Analyze all actions in a domain.
 *
 * @param actions - Action definitions record
 * @param getPreconditions - Function to get preconditions for an action
 * @returns Array of AgentActionInfo
 */
export function analyzeAllActions(
  actions: Record<string, ActionDefinition>,
  getPreconditions: (actionId: string) => PreconditionStatus[]
): AgentActionInfo[] {
  return Object.entries(actions).map(([actionId, action]) =>
    analyzeAction(actionId, action, getPreconditions(actionId))
  );
}

// =============================================================================
// Zod to JSON Schema Conversion
// =============================================================================

/**
 * Convert Zod schema to JSON Schema (simplified).
 * This is a basic conversion that handles common cases.
 */
export function zodToJsonSchema(zodSchema: unknown): JsonSchema | undefined {
  if (!zodSchema) return undefined;

  // Check if it's a Zod schema by looking for common properties
  const schema = zodSchema as Record<string, unknown>;

  // Get Zod type info
  const typeName = schema._def as Record<string, unknown> | undefined;
  if (!typeName) return undefined;

  const type = typeName.typeName as string | undefined;

  switch (type) {
    case 'ZodString':
      return { type: 'string' };
    case 'ZodNumber':
      return { type: 'number' };
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodArray':
      return {
        type: 'array',
        items: zodToJsonSchema(typeName.type),
      };
    case 'ZodObject': {
      const shape = typeName.shape as Record<string, unknown> | undefined;
      if (!shape) return { type: 'object' };

      const properties: Record<string, JsonSchema> = {};
      for (const [key, value] of Object.entries(shape)) {
        const propSchema = zodToJsonSchema(value);
        if (propSchema) {
          properties[key] = propSchema;
        }
      }

      return { type: 'object', properties };
    }
    case 'ZodOptional':
      return zodToJsonSchema(typeName.innerType);
    case 'ZodNullable': {
      const inner = zodToJsonSchema(typeName.innerType);
      return inner ? { ...inner, nullable: true } : undefined;
    }
    default:
      return undefined;
  }
}

// =============================================================================
// Action Filtering
// =============================================================================

/**
 * Get only available actions.
 */
export function getAvailableActions(
  actions: AgentActionInfo[]
): AgentActionInfo[] {
  return actions.filter((a) => a.canExecute);
}

/**
 * Get only blocked actions.
 */
export function getBlockedActions(
  actions: AgentActionInfo[]
): AgentActionInfo[] {
  return actions.filter((a) => !a.canExecute);
}

/**
 * Group actions by risk level.
 */
export function groupActionsByRisk(
  actions: AgentActionInfo[]
): Record<'low' | 'medium' | 'high', AgentActionInfo[]> {
  return {
    low: actions.filter((a) => a.risk === 'low'),
    medium: actions.filter((a) => a.risk === 'medium'),
    high: actions.filter((a) => a.risk === 'high'),
  };
}
