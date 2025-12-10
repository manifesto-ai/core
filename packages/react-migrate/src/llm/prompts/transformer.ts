/**
 * Transformer LLM Prompts
 *
 * LLM 호출에 사용되는 변환용 프롬프트 템플릿
 */

import type { SchemaProposal } from '../../domains/summarizer/types.js';
import type { ManifestoDomainJson, ValidationError } from '../../domains/transformer/types.js';

/**
 * 스키마 제안을 최종 스키마로 정제하는 프롬프트
 */
export function finalizeSchemaPrompt(proposal: SchemaProposal): string {
  return `You are finalizing a Manifesto domain schema from a proposal.

Domain: ${proposal.domainName}
Confidence: ${proposal.confidence}

Proposed Entities:
${proposal.entities.map(e => `- ${e.path}: ${e.type} (${e.description || 'no description'})`).join('\n')}

Proposed State:
${proposal.state.map(s => `- ${s.path}: ${s.type} (${s.description || 'no description'})`).join('\n')}

Proposed Intents:
${proposal.intents.map(i => `- ${i.path}: ${i.type} (${i.description || 'no description'})`).join('\n')}

Review Notes:
${proposal.reviewNotes.length > 0 ? proposal.reviewNotes.join('\n') : 'None'}

Instructions:
1. Review the proposal for consistency and completeness
2. Ensure all types are valid Manifesto types
3. Add any missing descriptions
4. Ensure naming follows Manifesto conventions:
   - Entities: PascalCase singular nouns
   - State: camelCase paths
   - Intents: camelCase verbs
5. Validate logical relationships between entities and intents

Respond in JSON format (final Manifesto schema):
{
  "$schema": "https://manifesto.ai/schema/domain/1.0.0",
  "domain": "${proposal.domainName}",
  "version": "1.0.0",
  "entities": { ... },
  "state": { ... },
  "intents": { ... },
  "metadata": {
    "generatedAt": ${Date.now()},
    "generatedBy": "@manifesto-ai/react-migrate",
    "confidence": ${proposal.confidence}
  }
}`;
}

/**
 * 도메인 설명을 생성하는 프롬프트
 */
export function generateDescriptionPrompt(
  domainName: string,
  sourceFiles: string[],
  entities: string[],
  intents: string[]
): string {
  return `You are generating a description for a Manifesto domain.

Domain Name: ${domainName}

Source Files:
${sourceFiles.slice(0, 10).map(f => `- ${f}`).join('\n')}
${sourceFiles.length > 10 ? `... and ${sourceFiles.length - 10} more files` : ''}

Entities:
${entities.map(e => `- ${e}`).join('\n')}

Intents:
${intents.map(i => `- ${i}`).join('\n')}

Instructions:
1. Write a concise description (1-2 sentences) of what this domain handles
2. Focus on the business purpose, not technical implementation
3. Use active voice and present tense

Respond in JSON format:
{
  "description": "Brief description of the domain's business purpose",
  "tags": ["relevant", "business", "tags"]
}`;
}

/**
 * 검증 실패 스키마를 수정하는 프롬프트
 */
export function fixValidationErrorsPrompt(
  schema: ManifestoDomainJson,
  errors: ValidationError[]
): string {
  return `You are fixing validation errors in a Manifesto domain schema.

Current Schema:
\`\`\`json
${JSON.stringify(schema, null, 2)}
\`\`\`

Validation Errors:
${errors.map(e => `- [${e.code}] ${e.message}${e.path ? ` at ${e.path}` : ''}`).join('\n')}

Instructions:
1. Fix each validation error while preserving the schema's intent
2. Ensure the fix doesn't introduce new errors
3. Maintain consistency with Manifesto schema standards
4. Document any significant changes

Respond in JSON format:
{
  "fixedSchema": { ... corrected schema ... },
  "changes": [
    { "error": "error that was fixed", "fix": "what was done to fix it" }
  ]
}`;
}

/**
 * 스키마를 개선하는 프롬프트
 */
export function improveSchemaPrompt(schema: ManifestoDomainJson): string {
  return `You are improving a Manifesto domain schema for better quality.

Current Schema:
\`\`\`json
${JSON.stringify(schema, null, 2)}
\`\`\`

Instructions:
1. Review the schema for completeness and clarity
2. Add missing descriptions where helpful
3. Suggest more appropriate types if current ones are too generic
4. Identify missing intents that would logically exist
5. Check for redundant or overlapping entities

Respond in JSON format:
{
  "improvedSchema": { ... improved schema ... },
  "improvements": [
    { "type": "added|modified|removed", "path": "schema.path", "reason": "why this change" }
  ],
  "suggestions": [
    "Additional suggestions that couldn't be automatically applied"
  ]
}`;
}

/**
 * 소스 매핑 검증 프롬프트
 */
export function validateMappingsPrompt(
  mappings: Array<{ source: string; target: string; patternType: string }>,
  schema: ManifestoDomainJson
): string {
  return `You are validating source mappings between React code and a Manifesto schema.

Schema Domain: ${schema.domain}

Mappings:
${mappings.map(m => `- ${m.source} -> ${m.target} (${m.patternType})`).join('\n')}

Schema Structure:
- Entities: ${Object.keys(schema.entities).join(', ')}
- State: ${Object.keys(schema.state).join(', ')}
- Intents: ${Object.keys(schema.intents).join(', ')}

Instructions:
1. Verify each mapping makes semantic sense
2. Identify any suspicious or incorrect mappings
3. Suggest missing mappings that should exist
4. Rate the overall mapping quality

Respond in JSON format:
{
  "validMappings": ["list of valid mapping target paths"],
  "suspiciousMappings": [
    { "target": "path", "reason": "why it's suspicious" }
  ],
  "missingMappings": [
    { "pattern": "expected pattern", "target": "suggested target path" }
  ],
  "qualityScore": 0.0 - 1.0
}`;
}

/**
 * 마이그레이션 요약 생성 프롬프트
 */
export function generateMigrationSummaryPrompt(
  domains: Array<{ name: string; entities: number; intents: number; confidence: number }>,
  sourceFiles: number,
  warnings: string[]
): string {
  return `You are generating a migration summary report.

Migration Results:
- Total Source Files Analyzed: ${sourceFiles}
- Domains Generated: ${domains.length}

Domain Details:
${domains.map(d => `- ${d.name}: ${d.entities} entities, ${d.intents} intents (${(d.confidence * 100).toFixed(0)}% confidence)`).join('\n')}

Warnings:
${warnings.length > 0 ? warnings.map(w => `- ${w}`).join('\n') : 'None'}

Instructions:
1. Write a brief executive summary of the migration
2. Highlight any areas needing attention
3. Provide recommendations for next steps

Respond in JSON format:
{
  "summary": "Executive summary paragraph",
  "highlights": ["key migration achievements"],
  "attentionNeeded": ["areas requiring review"],
  "recommendations": ["suggested next steps"]
}`;
}
