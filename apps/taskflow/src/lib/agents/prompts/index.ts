/**
 * Prompts Index
 *
 * Central export for all agent prompts.
 * Supports production mode (no examples) for token optimization.
 */

// Schema & Constants
export {
  SCHEMA_VERSION,
  TASK_STATUSES,
  TASK_PRIORITIES,
  VIEW_MODES,
  DATE_FILTER_TYPES,
  INTENT_TYPES,
  AGENT_TYPES,
  SCHEMA_DSL,
  LANGUAGE_INSTRUCTION,
  JSON_RESPONSE_INSTRUCTION,
  type TaskStatus,
  type TaskPriority,
  type ViewMode,
  type DateFilterType,
  type IntentType,
  type AgentType,
} from './schema';

// Orchestrator
import {
  ORCHESTRATOR_SYSTEM_PROMPT,
  ORCHESTRATOR_IDENTITY,
  ORCHESTRATOR_AGENTS,
  ORCHESTRATOR_RESPONSE_FORMAT,
  ORCHESTRATOR_RULES,
} from './orchestrator.system';
import {
  ORCHESTRATOR_EXAMPLES,
  ORCHESTRATOR_EXAMPLE_COUNT,
} from './orchestrator.examples';

export {
  ORCHESTRATOR_SYSTEM_PROMPT,
  ORCHESTRATOR_IDENTITY,
  ORCHESTRATOR_AGENTS,
  ORCHESTRATOR_RESPONSE_FORMAT,
  ORCHESTRATOR_RULES,
  ORCHESTRATOR_EXAMPLES,
  ORCHESTRATOR_EXAMPLE_COUNT,
};

// TaskCreator
import {
  TASK_CREATOR_SYSTEM_PROMPT,
  TASK_CREATOR_IDENTITY,
  TASK_CREATOR_RESPONSE_FORMAT,
  TASK_CREATOR_SCHEMA,
  TASK_CREATOR_PRIORITY_RULES,
  TASK_CREATOR_TAG_RULES,
} from './task-creator.system';
import {
  TASK_CREATOR_EXAMPLES,
  TASK_CREATOR_EXAMPLE_COUNT,
} from './task-creator.examples';

export {
  TASK_CREATOR_SYSTEM_PROMPT,
  TASK_CREATOR_IDENTITY,
  TASK_CREATOR_RESPONSE_FORMAT,
  TASK_CREATOR_SCHEMA,
  TASK_CREATOR_PRIORITY_RULES,
  TASK_CREATOR_TAG_RULES,
  TASK_CREATOR_EXAMPLES,
  TASK_CREATOR_EXAMPLE_COUNT,
};

// TaskMutator
import {
  TASK_MUTATOR_SYSTEM_PROMPT,
  TASK_MUTATOR_IDENTITY,
  TASK_MUTATOR_RESPONSE_FORMAT,
  TASK_MUTATOR_OPERATIONS,
  TASK_MUTATOR_PATTERNS,
  TASK_MUTATOR_RULES,
} from './task-mutator.system';
import {
  TASK_MUTATOR_EXAMPLES,
  TASK_MUTATOR_EXAMPLE_COUNT,
} from './task-mutator.examples';

export {
  TASK_MUTATOR_SYSTEM_PROMPT,
  TASK_MUTATOR_IDENTITY,
  TASK_MUTATOR_RESPONSE_FORMAT,
  TASK_MUTATOR_OPERATIONS,
  TASK_MUTATOR_PATTERNS,
  TASK_MUTATOR_RULES,
  TASK_MUTATOR_EXAMPLES,
  TASK_MUTATOR_EXAMPLE_COUNT,
};

// ViewControl
import {
  VIEW_CONTROL_SYSTEM_PROMPT,
  VIEW_CONTROL_IDENTITY,
  VIEW_CONTROL_RESPONSE_FORMAT,
  VIEW_CONTROL_VIEW_MODES,
  VIEW_CONTROL_DATE_FILTERS,
  VIEW_CONTROL_SELECTION,
  VIEW_CONTROL_RULES,
} from './view-control.system';
import {
  VIEW_CONTROL_EXAMPLES,
  VIEW_CONTROL_EXAMPLE_COUNT,
} from './view-control.examples';

export {
  VIEW_CONTROL_SYSTEM_PROMPT,
  VIEW_CONTROL_IDENTITY,
  VIEW_CONTROL_RESPONSE_FORMAT,
  VIEW_CONTROL_VIEW_MODES,
  VIEW_CONTROL_DATE_FILTERS,
  VIEW_CONTROL_SELECTION,
  VIEW_CONTROL_RULES,
  VIEW_CONTROL_EXAMPLES,
  VIEW_CONTROL_EXAMPLE_COUNT,
};

// QueryAgent
import {
  QUERY_AGENT_SYSTEM_PROMPT,
  QUERY_AGENT_IDENTITY,
  QUERY_AGENT_RESPONSE_FORMAT,
  QUERY_AGENT_CAPABILITIES,
  QUERY_AGENT_GUIDELINES,
} from './query-agent.system';
import {
  QUERY_AGENT_EXAMPLES,
  QUERY_AGENT_EXAMPLE_COUNT,
} from './query-agent.examples';

export {
  QUERY_AGENT_SYSTEM_PROMPT,
  QUERY_AGENT_IDENTITY,
  QUERY_AGENT_RESPONSE_FORMAT,
  QUERY_AGENT_CAPABILITIES,
  QUERY_AGENT_GUIDELINES,
  QUERY_AGENT_EXAMPLES,
  QUERY_AGENT_EXAMPLE_COUNT,
};

/**
 * Configuration for prompt building
 */
export interface PromptConfig {
  /** Include examples in system prompts (default: false for production) */
  includeExamples?: boolean;
}

/**
 * Build full system prompt for an agent
 *
 * @param agent - The agent type
 * @param config - Prompt configuration
 * @returns The complete system prompt
 */
export function buildSystemPrompt(
  agent: 'orchestrator' | 'task-creator' | 'task-mutator' | 'view-control' | 'query',
  config: PromptConfig = {}
): string {
  const { includeExamples = false } = config;

  switch (agent) {
    case 'orchestrator':
      return includeExamples
        ? `${ORCHESTRATOR_SYSTEM_PROMPT}\n\n${ORCHESTRATOR_EXAMPLES}`
        : ORCHESTRATOR_SYSTEM_PROMPT;

    case 'task-creator':
      return includeExamples
        ? `${TASK_CREATOR_SYSTEM_PROMPT}\n\n${TASK_CREATOR_EXAMPLES}`
        : TASK_CREATOR_SYSTEM_PROMPT;

    case 'task-mutator':
      return includeExamples
        ? `${TASK_MUTATOR_SYSTEM_PROMPT}\n\n${TASK_MUTATOR_EXAMPLES}`
        : TASK_MUTATOR_SYSTEM_PROMPT;

    case 'view-control':
      return includeExamples
        ? `${VIEW_CONTROL_SYSTEM_PROMPT}\n\n${VIEW_CONTROL_EXAMPLES}`
        : VIEW_CONTROL_SYSTEM_PROMPT;

    case 'query':
      return includeExamples
        ? `${QUERY_AGENT_SYSTEM_PROMPT}\n\n${QUERY_AGENT_EXAMPLES}`
        : QUERY_AGENT_SYSTEM_PROMPT;

    default:
      throw new Error(`Unknown agent: ${agent}`);
  }
}

/**
 * Get token statistics for prompts
 */
export function getPromptStats(includeExamples: boolean = false) {
  const stats = {
    orchestrator: {
      system: ORCHESTRATOR_SYSTEM_PROMPT.length,
      examples: ORCHESTRATOR_EXAMPLES.length,
      exampleCount: ORCHESTRATOR_EXAMPLE_COUNT,
    },
    'task-creator': {
      system: TASK_CREATOR_SYSTEM_PROMPT.length,
      examples: TASK_CREATOR_EXAMPLES.length,
      exampleCount: TASK_CREATOR_EXAMPLE_COUNT,
    },
    'task-mutator': {
      system: TASK_MUTATOR_SYSTEM_PROMPT.length,
      examples: TASK_MUTATOR_EXAMPLES.length,
      exampleCount: TASK_MUTATOR_EXAMPLE_COUNT,
    },
    'view-control': {
      system: VIEW_CONTROL_SYSTEM_PROMPT.length,
      examples: VIEW_CONTROL_EXAMPLES.length,
      exampleCount: VIEW_CONTROL_EXAMPLE_COUNT,
    },
    query: {
      system: QUERY_AGENT_SYSTEM_PROMPT.length,
      examples: QUERY_AGENT_EXAMPLES.length,
      exampleCount: QUERY_AGENT_EXAMPLE_COUNT,
    },
  };

  const totalSystem = Object.values(stats).reduce((sum, s) => sum + s.system, 0);
  const totalExamples = Object.values(stats).reduce((sum, s) => sum + s.examples, 0);
  const totalExampleCount = Object.values(stats).reduce((sum, s) => sum + s.exampleCount, 0);

  return {
    byAgent: stats,
    totals: {
      systemChars: totalSystem,
      examplesChars: totalExamples,
      totalChars: includeExamples ? totalSystem + totalExamples : totalSystem,
      exampleCount: totalExampleCount,
      estimatedTokens: Math.ceil((includeExamples ? totalSystem + totalExamples : totalSystem) / 4),
    },
  };
}
