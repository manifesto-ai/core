/**
 * Agent Session Setup
 *
 * Provides both mock and real LLM clients for the agent session.
 * Real LLM uses OpenAI via API route.
 */

import {
  createSimpleSession,
  createMockClient,
  generateEffectId,
  type AgentClient,
  type AgentDecision,
  type AgentClientInput,
} from '@manifesto-ai/agent';
import { useTasksStore } from '../store/useTasksStore';

// ============================================
// OpenAI Client (Real LLM via API Route)
// ============================================

/**
 * Creates an AgentClient that uses OpenAI via the /api/agent route.
 */
export function createOpenAIClient(instruction: string): AgentClient {
  return {
    async decide(input: AgentClientInput): Promise<AgentDecision> {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot: input.snapshot,
          instruction,
          constraints: input.constraints,
          recentErrors: input.recentErrors,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to call agent API');
      }

      const decision = await response.json();
      return decision as AgentDecision;
    },
  };
}

// ============================================
// Mock Client (For testing without API key)
// ============================================

function createMockAgentDecisions(instruction?: string): AgentDecision[] {
  return [
    {
      effects: [
        {
          type: 'log.emit',
          id: generateEffectId(),
          level: 'info',
          message: `[Mock] Agent received: "${instruction || 'No instruction'}"`,
        },
      ],
    },
    {
      effects: [
        {
          type: 'log.emit',
          id: generateEffectId(),
          level: 'info',
          message: '[Mock] Processing... (Real LLM requires OPENAI_API_KEY)',
        },
      ],
    },
    { effects: [] }, // Empty effects = session complete
  ];
}

// ============================================
// Session Factory
// ============================================

function getInitialSnapshot() {
  const store = useTasksStore.getState();

  return {
    data: {
      tasks: store.tasks,
      currentFilter: store.currentFilter,
    },
    state: {
      selectedTaskId: store.selectedTaskId,
      viewMode: store.viewMode,
      isCreating: store.isCreating,
      isEditing: store.isEditing,
      agentStatus: 'idle' as string,
    },
    derived: {},
  };
}

/**
 * Create a session with mock client (no API key needed)
 */
export function createMockAgentSession(instruction?: string) {
  const { session, getSnapshot, getErrors, getObservations } = createSimpleSession({
    initialSnapshot: getInitialSnapshot(),
    client: createMockClient(createMockAgentDecisions(instruction)),
    policy: { maxSteps: 10 },
  });

  return { session, getSnapshot, getErrors, getObservations };
}

/**
 * Create a session with real OpenAI client
 */
export function createOpenAIAgentSession(instruction: string) {
  const { session, getSnapshot, getErrors, getObservations } = createSimpleSession({
    initialSnapshot: getInitialSnapshot(),
    client: createOpenAIClient(instruction),
    policy: { maxSteps: 10 },
  });

  return { session, getSnapshot, getErrors, getObservations };
}

// ============================================
// Run Helpers
// ============================================

/**
 * Run agent with mock client (legacy, for backward compatibility)
 */
export async function runAgentWithInstruction(instruction: string) {
  const { session, getSnapshot, getErrors } = createMockAgentSession(instruction);
  const result = await session.run();

  return {
    result,
    finalSnapshot: getSnapshot(),
    errors: getErrors(),
  };
}

/**
 * Run agent with real OpenAI LLM
 */
export async function runAgentWithOpenAI(instruction: string) {
  const { session, getSnapshot, getErrors } = createOpenAIAgentSession(instruction);
  const result = await session.run();

  const finalSnapshot = getSnapshot();

  return {
    result,
    finalSnapshot,
    errors: getErrors(),
  };
}

/**
 * Single-step agent call with OpenAI (for streaming/interactive use)
 */
export async function stepAgentWithOpenAI(instruction: string) {
  const { session, getSnapshot, getErrors } = createOpenAIAgentSession(instruction);
  const stepResult = await session.step();

  return {
    stepResult,
    snapshot: getSnapshot(),
    errors: getErrors(),
    isDone: stepResult.done,
  };
}
