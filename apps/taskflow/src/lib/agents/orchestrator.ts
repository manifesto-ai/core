/**
 * Orchestrator Agent
 *
 * Responsible for:
 * - Analyzing user intent
 * - Routing to appropriate specialized agents
 * - Coordinating multi-agent workflows
 */

import OpenAI from 'openai';
import type {
  OrchestratorInput,
  OrchestratorOutput,
  OrchestratorDecision,
  AgentCall,
  TasksSummary,
} from './types';
import { calculateTasksSummary } from './types';
import { buildSystemPrompt } from './prompts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function runOrchestrator(
  input: OrchestratorInput
): Promise<OrchestratorOutput> {
  const { instruction, snapshot } = input;
  const tasksSummary = calculateTasksSummary(snapshot.data.tasks);

  // Build context for orchestrator
  const contextMessage = buildContextMessage(snapshot, tasksSummary);

  // Build system prompt (without examples in production)
  const systemPrompt = buildSystemPrompt('orchestrator', {
    includeExamples: process.env.NODE_ENV === 'development',
  });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `${contextMessage}

---
User request: ${instruction}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3, // Lower temperature for more consistent classification
    max_tokens: 500,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from orchestrator');
  }

  const parsed = JSON.parse(content) as OrchestratorDecision;

  // Validate and normalize the decision
  const decision = normalizeDecision(parsed);

  return {
    decision,
    trace: {
      model: 'gpt-4o-mini',
      tokensIn: completion.usage?.prompt_tokens,
      tokensOut: completion.usage?.completion_tokens,
      raw: parsed,
    },
  };
}

function buildContextMessage(
  snapshot: OrchestratorInput['snapshot'],
  tasksSummary: TasksSummary
): string {
  const activeTasks = snapshot.data.tasks.filter(t => !t.deletedAt);
  const deletedTasks = snapshot.data.tasks.filter(t => t.deletedAt);

  const tasksList = activeTasks
    .map((t, i) => `- [${i}] id="${t.id}" "${t.title}" (${t.status}, ${t.priority})`)
    .join('\n') || '(no tasks)';

  const deletedList = deletedTasks.length > 0
    ? `\nDeleted tasks (in trash): ${deletedTasks.map(t => `"${t.title}"`).join(', ')}`
    : '';

  return `Current state:
- View mode: ${snapshot.state.viewMode}
- Date filter: ${snapshot.state.dateFilter ? `${snapshot.state.dateFilter.field}=${snapshot.state.dateFilter.type}` : 'none'}
- Selected task: ${snapshot.state.selectedTaskId || 'none'}

Tasks summary:
- Total: ${tasksSummary.total}
- By status: Todo=${tasksSummary.byStatus.todo}, In Progress=${tasksSummary.byStatus['in-progress']}, Review=${tasksSummary.byStatus.review}, Done=${tasksSummary.byStatus.done}
- Overdue: ${tasksSummary.overdue}, Due today: ${tasksSummary.dueToday}

Tasks:
${tasksList}${deletedList}`;
}

function normalizeDecision(parsed: OrchestratorDecision): OrchestratorDecision {
  // Ensure valid intent
  const validIntents = ['create', 'mutate', 'view', 'query', 'multi'] as const;
  const intent = validIntents.includes(parsed.intent as typeof validIntents[number])
    ? parsed.intent
    : 'query';

  // Ensure agents array exists and is valid
  const agents: AgentCall[] = (parsed.agents || []).map(agent => ({
    agent: agent.agent,
    params: agent.params || {},
    reason: agent.reason || '',
  }));

  // If no agents specified, default based on intent
  if (agents.length === 0) {
    agents.push({
      agent: intent === 'create' ? 'task-creator'
        : intent === 'mutate' ? 'task-mutator'
        : intent === 'view' ? 'view-control'
        : 'query',
      params: {},
      reason: 'Default agent for intent',
    });
  }

  return {
    intent,
    agents,
    reasoning: parsed.reasoning || '',
  };
}
