/**
 * Schema & Constants
 *
 * Centralized schema definitions for LLM prompts.
 * Version changes invalidate caches automatically.
 */

export const SCHEMA_VERSION = '1.0.0';

// Task statuses
export const TASK_STATUSES = ['todo', 'in-progress', 'review', 'done'] as const;
export type TaskStatus = typeof TASK_STATUSES[number];

// Task priorities
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
export type TaskPriority = typeof TASK_PRIORITIES[number];

// View modes
export const VIEW_MODES = ['kanban', 'table', 'todo'] as const;
export type ViewMode = typeof VIEW_MODES[number];

// Date filter types
export const DATE_FILTER_TYPES = ['today', 'week', 'month', 'custom'] as const;
export type DateFilterType = typeof DATE_FILTER_TYPES[number];

// Intent types
export const INTENT_TYPES = ['create', 'mutate', 'view', 'query', 'multi'] as const;
export type IntentType = typeof INTENT_TYPES[number];

// Agent types
export const AGENT_TYPES = ['task-creator', 'task-mutator', 'view-control', 'query'] as const;
export type AgentType = typeof AGENT_TYPES[number];

/**
 * Schema for prompts - can be injected into system prompts
 */
export const SCHEMA_DSL = `## Schema (v${SCHEMA_VERSION})
- Status: ${TASK_STATUSES.join(' | ')}
- Priority: ${TASK_PRIORITIES.join(' | ')}
- ViewMode: ${VIEW_MODES.join(' | ')}
- DateFilter: ${DATE_FILTER_TYPES.join(' | ')}`;

/**
 * Common language instruction for all agents
 * NOTE: User input is pre-translated to English by the translator layer.
 * Responses will be translated back to user's language by the response translator.
 */
export const LANGUAGE_INSTRUCTION = `## Language
All user input has been pre-translated to English. Always respond in English.
Your response will be automatically translated back to the user's original language.`;

/**
 * Common JSON response instruction
 */
export const JSON_RESPONSE_INSTRUCTION = `Always respond with valid JSON.`;
