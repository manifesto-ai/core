/**
 * Summarizer LLM Prompts
 *
 * LLM 호출에 사용되는 요약용 프롬프트 템플릿
 */

import type { DetectedPattern } from '../../parser/types.js';
import type { DomainSummary, ExtractedEntity, ExtractedAction } from '../../domains/summarizer/types.js';

/**
 * 패턴에서 도메인을 식별하는 프롬프트
 */
export function identifyDomainPrompt(
  patterns: Array<{ name: string; type: string; file: string }>,
  fileGroup: string[]
): string {
  return `You are analyzing React patterns to identify a business domain.

Detected Patterns:
${patterns.map(p => `- ${p.type}: ${p.name} (${p.file})`).join('\n')}

Files in Group:
${fileGroup.map(f => `- ${f}`).join('\n')}

Instructions:
1. Identify the primary business domain these patterns represent
2. Consider naming conventions, component purposes, and data flow
3. Determine if this is a cohesive domain or should be split

Respond in JSON format:
{
  "domainName": "suggested domain name",
  "description": "Brief description of what this domain handles",
  "confidence": 0.0 - 1.0,
  "isCohesive": true | false,
  "splitSuggestion": "If not cohesive, how to split",
  "relatedDomains": ["list of potentially related domains"]
}`;
}

/**
 * 패턴에서 엔티티를 추출하는 프롬프트
 */
export function extractEntitiesPrompt(
  patterns: Array<{ name: string; type: string; metadata: unknown }>,
  domainName: string
): string {
  return `You are extracting business entities from React patterns for the "${domainName}" domain.

Patterns:
${patterns.map(p => `- ${p.type}: ${p.name}
  Metadata: ${JSON.stringify(p.metadata)}`).join('\n\n')}

Instructions:
1. Identify distinct business entities from these patterns
2. For each entity, extract:
   - Name (singular noun, PascalCase)
   - Fields with their types
   - Description of the entity's purpose
3. Avoid duplicates - merge similar patterns into one entity
4. Focus on business concepts, not UI components

Respond in JSON format:
{
  "entities": [
    {
      "name": "EntityName",
      "description": "What this entity represents",
      "fields": [
        { "name": "fieldName", "type": "string | number | boolean | etc", "description": "purpose" }
      ],
      "source": "pattern name this came from"
    }
  ]
}`;
}

/**
 * 패턴에서 액션을 추출하는 프롬프트
 */
export function extractActionsPrompt(
  handlers: Array<{ name: string; code: string }>,
  domainName: string
): string {
  return `You are extracting business actions from React event handlers for the "${domainName}" domain.

Handlers:
${handlers.map(h => `- ${h.name}:
\`\`\`
${h.code.slice(0, 500)}${h.code.length > 500 ? '...' : ''}
\`\`\``).join('\n\n')}

Instructions:
1. Identify the business operations these handlers perform
2. Classify each as:
   - "command": Modifies state (create, update, delete)
   - "query": Reads data without modification
   - "event": Responds to external events
3. Extract input parameters needed
4. Describe the expected output or effect

Respond in JSON format:
{
  "actions": [
    {
      "name": "actionName",
      "type": "command" | "query" | "event",
      "description": "What this action does",
      "input": [
        { "name": "paramName", "type": "paramType" }
      ],
      "effects": ["list of side effects"],
      "source": "handler name this came from"
    }
  ]
}`;
}

/**
 * 도메인에서 Manifesto 스키마를 생성하는 프롬프트
 */
export function generateSchemaPrompt(domain: DomainSummary): string {
  return `You are generating a Manifesto domain schema from analyzed React patterns.

Domain: ${domain.name}
Description: ${domain.description}

Source Files:
${domain.sourceFiles.map(f => `- ${f}`).join('\n')}

Entities:
${domain.entities.map(e => `- ${e.name} (${e.type})
  Fields: ${JSON.stringify(e.fields)}`).join('\n')}

Actions:
${domain.actions.map(a => `- ${a.name} (${a.type})`).join('\n')}

Boundaries:
- Imports: ${domain.boundaries.imports.join(', ')}
- Exports: ${domain.boundaries.exports.join(', ')}
- Shared State: ${domain.boundaries.sharedState.join(', ')}

Instructions:
Generate a Manifesto-compatible domain schema:
1. entities: Define data structures with fields and types
2. state: Define domain state with semantic paths
3. intents: Define actions as commands, queries, or events

Respond in JSON format (Manifesto schema):
{
  "domain": "${domain.name}",
  "entities": {
    "EntityName": {
      "type": "object",
      "description": "entity description",
      "fields": {
        "fieldName": { "type": "string", "description": "field purpose" }
      }
    }
  },
  "state": {
    "statePath": { "type": "EntityName | null", "description": "state purpose" }
  },
  "intents": {
    "actionName": { "type": "command", "description": "action purpose" }
  }
}`;
}

/**
 * 도메인 관계 분석 프롬프트
 */
export function analyzeRelationshipsPrompt(
  domains: Array<{ name: string; description: string; files: string[] }>,
  imports: Array<{ from: string; to: string; items: string[] }>
): string {
  return `You are analyzing relationships between business domains in a React codebase.

Domains:
${domains.map(d => `- ${d.name}: ${d.description}
  Files: ${d.files.slice(0, 5).join(', ')}${d.files.length > 5 ? '...' : ''}`).join('\n\n')}

Import Relationships:
${imports.map(i => `- ${i.from} imports from ${i.to}: ${i.items.join(', ')}`).join('\n')}

Instructions:
1. Identify dependency relationships (A depends on B)
2. Identify shared state relationships (A and B share state)
3. Identify event flow relationships (A triggers events consumed by B)
4. Rate the coupling strength between domains

Respond in JSON format:
{
  "relationships": [
    {
      "type": "dependency" | "sharedState" | "eventFlow",
      "from": "DomainA",
      "to": "DomainB",
      "strength": 0.0 - 1.0,
      "evidence": ["specific imports or patterns showing this"],
      "isHealthy": true | false,
      "suggestion": "How to improve this relationship if needed"
    }
  ],
  "suggestions": [
    "Overall architectural suggestions"
  ]
}`;
}

/**
 * 충돌 해결 프롬프트
 */
export function resolveConflictPrompt(
  conflictType: 'ownership' | 'naming' | 'boundary',
  domains: string[],
  context: string
): string {
  return `You are resolving a domain conflict in a React codebase migration.

Conflict Type: ${conflictType}
Involved Domains: ${domains.join(', ')}

Context:
${context}

Instructions:
1. Analyze the conflict situation
2. Consider each domain's responsibilities
3. Suggest the best resolution

For ownership conflicts: Determine which domain should own the contested element
For naming conflicts: Suggest better names that distinguish the domains
For boundary conflicts: Suggest how to clarify the boundaries

Respond in JSON format:
{
  "resolution": "recommended resolution",
  "reasoning": "Why this resolution is best",
  "confidence": 0.0 - 1.0,
  "alternatives": [
    { "option": "alternative solution", "tradeoff": "what you lose" }
  ]
}`;
}
