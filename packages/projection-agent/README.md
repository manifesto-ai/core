# @manifesto-ai/projection-agent

> AI Agent Projection Layer for Manifesto AI - Generate AI-consumable context from domain state

Transform your domain runtime into a fully explainable context that AI agents can understand and act upon. Every decision is traceable, every action is assessable.

## Installation

```bash
pnpm add @manifesto-ai/projection-agent @manifesto-ai/core
```

## Quick Start

```typescript
import { createRuntime, defineDomain, z } from '@manifesto-ai/core';
import { projectAgentContext } from '@manifesto-ai/projection-agent';

// Define domain
const orderDomain = defineDomain('order', {
  dataSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
      quantity: z.number()
    })),
    couponCode: z.string().optional()
  }),

  stateSchema: z.object({
    isSubmitting: z.boolean().default(false)
  }),

  actions: {
    submit: defineAction({
      precondition: { $gt: [{ $size: { $get: 'data.items' } }, 0] },
      effect: sequence([
        setState('state.isSubmitting', true),
        apiCall({ method: 'POST', url: '/api/orders' }),
        setState('state.isSubmitting', false)
      ])
    })
  }
});

// Create runtime
const runtime = createRuntime(orderDomain);
runtime.set('data.items', [
  { id: '1', name: 'Laptop', price: 999, quantity: 1 }
]);

// Project to agent context
const context = projectAgentContext(runtime, orderDomain, {
  includeSuggestion: true
});

console.log(context.summary);
// "Order is ready with 1 item(s) totaling $999"

console.log(context.suggestion);
// {
//   action: 'submit',
//   reason: 'All items in cart, ready to submit',
//   confidence: 0.95
// }

console.log(context.actions.submit);
// {
//   id: 'submit',
//   available: true,
//   risk: { level: 'medium', factors: ['Makes API call'], mitigations: [...] },
//   effects: ['Sets isSubmitting to true', 'POST /api/orders', 'Sets isSubmitting to false']
// }
```

## Features

### 1. Complete State Visibility

```typescript
const context = projectAgentContext(runtime, domain);

// Domain info
context.domain.name;       // 'order'
context.domain.description; // 'Order management domain'

// All paths with values and metadata
context.paths.forEach((info, path) => {
  console.log(`${path}: ${info.value}`);
  console.log(`  Type: ${info.type}`);
  console.log(`  Editable: ${info.editable}`);
  console.log(`  Required: ${info.required}`);
});
```

### 2. Action Analysis

```typescript
const context = projectAgentContext(runtime, domain);

// Check action availability
const submitAction = context.actions.get('submit');
if (submitAction.available) {
  console.log('Ready to submit');
  console.log('Effects:', submitAction.effects);
} else {
  console.log('Cannot submit:', submitAction.blockedReasons);
}
```

### 3. Risk Assessment

```typescript
import { assessActionRisk } from '@manifesto-ai/projection-agent';

const risk = assessActionRisk('submit', runtime, domain);
// {
//   level: 'high',
//   factors: [
//     'Makes external API call',
//     'Cannot be undone'
//   ],
//   mitigations: [
//     'Confirm with user before executing',
//     'Validate all data first'
//   ]
// }
```

### 4. Smart Suggestions

```typescript
import { suggestAction, suggestForGoal } from '@manifesto-ai/projection-agent';

// Get best action suggestion
const suggestion = suggestAction(runtime, domain);
// { action: 'submit', reason: 'Cart is ready', confidence: 0.9 }

// Suggest action for specific goal
const goalSuggestion = suggestForGoal('complete order', runtime, domain);
// { action: 'submit', path: ['add items', 'submit'], confidence: 0.85 }
```

## API Reference

### Main Projector

#### `projectAgentContext(runtime, domain, config?)`

Projects runtime state to an AI-consumable context.

```typescript
interface AgentProjectorConfig {
  // Include action suggestions
  includeSuggestion?: boolean;

  // Include risk assessment
  includeRiskAssessment?: boolean;

  // Include effect predictions
  includeEffectPrediction?: boolean;

  // Custom value formatters
  formatters?: FormatterRegistry;

  // Summary configuration
  summaryConfig?: SummaryConfig;
}

const context = projectAgentContext(runtime, domain, {
  includeSuggestion: true,
  includeRiskAssessment: true
});
```

**Returns:** `AgentContext`

```typescript
interface AgentContext {
  // Domain metadata
  domain: AgentDomainInfo;

  // All paths with current values and metadata
  paths: Map<SemanticPath, AgentPathInfo>;

  // All actions with availability and effects
  actions: Map<string, AgentActionInfo>;

  // Human-readable summary
  summary: string;

  // Optional: suggested next action
  suggestion?: AgentSuggestion;

  // Timestamp
  timestamp: number;
}
```

#### `createAgentProjector(runtime, domain, config?)`

Creates a reusable projector for ongoing context generation.

```typescript
const projector = createAgentProjector(runtime, domain);

// Project current state
const context1 = projector.project();

// Later, project again (efficiently reuses internal state)
const context2 = projector.project();

// Subscribe to changes
projector.subscribe((context) => {
  console.log('Context updated:', context.summary);
});

// Cleanup
projector.dispose();
```

### Formatters

#### Built-in Formatters

```typescript
import {
  currencyFormatter,
  percentFormatter,
  relativeTimeFormatter,
  fileSizeFormatter,
  phoneNumberFormatter,
  yesNoFormatter,
  maskedFormatter
} from '@manifesto-ai/projection-agent';

// Format currency
currencyFormatter(1234.56, { currency: 'USD' });
// "$1,234.56"

// Format percent
percentFormatter(0.156);
// "15.6%"

// Format relative time
relativeTimeFormatter(new Date(Date.now() - 3600000));
// "1 hour ago"

// Format file size
fileSizeFormatter(1536000);
// "1.5 MB"

// Mask sensitive data
maskedFormatter('1234-5678-9012-3456', { visibleChars: 4 });
// "****3456"
```

#### Custom Formatters

```typescript
import { createFormatterRegistry, registerFormatter } from '@manifesto-ai/projection-agent';

const registry = createFormatterRegistry();

registerFormatter(registry, 'orderStatus', (value) => {
  const statusMap = {
    pending: 'Awaiting confirmation',
    processing: 'Being prepared',
    shipped: 'On the way',
    delivered: 'Delivered'
  };
  return statusMap[value] || value;
});

const context = projectAgentContext(runtime, domain, {
  formatters: registry
});
```

### Analyzers

#### Action Analysis

```typescript
import { analyzeAction, analyzeAllActions } from '@manifesto-ai/projection-agent';

// Analyze single action
const analysis = analyzeAction('submit', runtime, domain);
// {
//   id: 'submit',
//   available: true,
//   blockedReasons: [],
//   inputSchema: { ... },
//   effects: [...],
//   risk: { level: 'medium', factors: [...] }
// }

// Analyze all actions
const allActions = analyzeAllActions(runtime, domain);

// Filter actions
import { getAvailableActions, getBlockedActions, groupActionsByRisk } from '@manifesto-ai/projection-agent';

const available = getAvailableActions(runtime, domain);
const blocked = getBlockedActions(runtime, domain);
const byRisk = groupActionsByRisk(runtime, domain);
// { low: [...], medium: [...], high: [...], critical: [...] }
```

#### Effect Prediction

```typescript
import { predictEffect, describeEffect, extractAffectedPaths } from '@manifesto-ai/projection-agent';

// Predict what an effect will do
const prediction = predictEffect(submitAction.effect, runtime);
// {
//   stateChanges: [
//     { path: 'state.isSubmitting', before: false, after: true },
//   ],
//   apiCalls: [{ method: 'POST', url: '/api/orders' }],
//   navigation: null
// }

// Get human-readable description
const description = describeEffect(submitAction.effect);
// ['Sets state.isSubmitting to true', 'Makes POST request to /api/orders', ...]

// Get affected paths
const paths = extractAffectedPaths(submitAction.effect);
// ['state.isSubmitting', 'data.orderConfirmation']
```

#### Risk Assessment

```typescript
import { assessActionRisk, analyzeRiskFactors } from '@manifesto-ai/projection-agent';

const risk = assessActionRisk('delete', runtime, domain);
// {
//   level: 'high',  // 'low' | 'medium' | 'high' | 'critical'
//   score: 0.75,
//   factors: [
//     'Permanently deletes data',
//     'Cannot be undone',
//     'Affects external system'
//   ],
//   mitigations: [
//     'Require confirmation dialog',
//     'Create backup before deletion',
//     'Log action for audit'
//   ]
// }
```

### Summary Generation

```typescript
import {
  summarizeState,
  generateSummaryText,
  categorizePathsByType,
  calculateCompletion
} from '@manifesto-ai/projection-agent';

// Full state summary
const summary = summarizeState(runtime, domain, {
  includeHighlights: true,
  includeIssues: true,
  includeNextSteps: true
});

// {
//   text: 'Order form is 75% complete with 2 issues',
//   highlights: ['Total: $999', '1 item in cart'],
//   issues: ['Missing delivery address', 'Invalid coupon code'],
//   nextSteps: ['Fill in delivery address', 'Remove invalid coupon']
// }

// Calculate completion percentage
const completion = calculateCompletion(runtime, domain);
// 0.75

// Categorize paths
const categories = categorizePathsByType(runtime, domain);
// {
//   data: ['data.items', 'data.couponCode'],
//   state: ['state.isSubmitting'],
//   derived: ['derived.total'],
//   async: ['async.shippingRates']
// }
```

### Suggestion Engine

```typescript
import { suggestAction, suggestAlternatives, rankActions } from '@manifesto-ai/projection-agent';

// Get primary suggestion
const suggestion = suggestAction(runtime, domain, {
  preferLowRisk: true,
  preferHighImpact: true
});
// {
//   action: 'save',
//   reason: 'Save current progress before submitting',
//   confidence: 0.9,
//   alternatives: ['submit', 'cancel']
// }

// Get alternative actions
const alternatives = suggestAlternatives('submit', runtime, domain);
// [
//   { action: 'saveDraft', reason: 'Save for later' },
//   { action: 'preview', reason: 'Review before submitting' }
// ]

// Rank all available actions
const ranked = rankActions(runtime, domain, {
  goal: 'complete order'
});
// [
//   { action: 'submit', score: 0.95 },
//   { action: 'addPayment', score: 0.7 },
//   { action: 'editItems', score: 0.3 }
// ]
```

## Full Example: AI Assistant

```typescript
import { createRuntime, defineDomain } from '@manifesto-ai/core';
import {
  projectAgentContext,
  suggestAction,
  assessActionRisk,
  describeEffect
} from '@manifesto-ai/projection-agent';

// Create AI assistant
class OrderAssistant {
  constructor(private runtime: DomainRuntime, private domain: ManifestoDomain) {}

  getSystemPrompt(): string {
    const context = projectAgentContext(this.runtime, this.domain, {
      includeSuggestion: true,
      includeRiskAssessment: true
    });

    return `
You are an AI assistant helping with order management.

Current State:
${context.summary}

Available Actions:
${Array.from(context.actions.entries())
  .filter(([_, info]) => info.available)
  .map(([id, info]) => `- ${id}: ${info.effects.join(', ')}`)
  .join('\n')}

Blocked Actions:
${Array.from(context.actions.entries())
  .filter(([_, info]) => !info.available)
  .map(([id, info]) => `- ${id}: ${info.blockedReasons.join(', ')}`)
  .join('\n')}

${context.suggestion ? `
Suggested Action: ${context.suggestion.action}
Reason: ${context.suggestion.reason}
Confidence: ${(context.suggestion.confidence * 100).toFixed(0)}%
` : ''}

Path Values:
${Array.from(context.paths.entries())
  .map(([path, info]) => `- ${path}: ${info.formattedValue}`)
  .join('\n')}
    `.trim();
  }

  async executeAction(actionId: string): Promise<{ success: boolean; message: string }> {
    const risk = assessActionRisk(actionId, this.runtime, this.domain);

    if (risk.level === 'critical') {
      return {
        success: false,
        message: `Action "${actionId}" requires manual confirmation due to: ${risk.factors.join(', ')}`
      };
    }

    const effects = describeEffect(this.domain.actions[actionId].effect);

    try {
      await this.runtime.executeAction(actionId);
      return {
        success: true,
        message: `Executed "${actionId}". Effects: ${effects.join(', ')}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to execute "${actionId}": ${error.message}`
      };
    }
  }
}

// Usage
const assistant = new OrderAssistant(runtime, domain);
console.log(assistant.getSystemPrompt());

// AI can use this to make informed decisions
const result = await assistant.executeAction('addItem');
console.log(result.message);
```

## Type Safety

All types are fully exported:

```typescript
import type {
  AgentContext,
  AgentPathInfo,
  AgentActionInfo,
  AgentSuggestion,
  RiskAssessment,
  EffectPrediction,
  ValueFormatter,
  FormatterRegistry
} from '@manifesto-ai/projection-agent';
```

## Related Packages

- [@manifesto-ai/core](../core) - Core runtime and domain definitions
- [@manifesto-ai/projection-ui](../projection-ui) - UI state projection
- [@manifesto-ai/projection-graphql](../projection-graphql) - GraphQL schema projection

## License

MIT
