/**
 * Analyzer LLM Prompts
 *
 * LLM 호출에 사용되는 분석용 프롬프트 템플릿
 */

/**
 * 파일을 특정 도메인으로 분류하는 프롬프트
 */
export function classifyFilePrompt(
  fileContent: string,
  filePath: string,
  candidateDomains: string[]
): string {
  return `You are analyzing a React codebase to classify files into business domains.

Given the following file, determine which domain it belongs to.

File Path: ${filePath}

File Content:
\`\`\`
${fileContent}
\`\`\`

Candidate Domains:
${candidateDomains.map(d => `- ${d}`).join('\n')}

Instructions:
1. Analyze the file's imports, exports, component names, and business logic
2. Determine which domain best matches the file's functionality
3. If the file doesn't clearly belong to any domain, suggest "shared" or "common"
4. Provide a confidence score (0.0 to 1.0) for your classification

Respond in JSON format:
{
  "domain": "selected_domain_name",
  "confidence": 0.85,
  "reasoning": "Brief explanation of why this file belongs to this domain"
}`;
}

/**
 * Reducer 액션을 분석하여 도메인 인텐트를 추출하는 프롬프트
 */
export function analyzeReducerPrompt(reducerCode: string, fileName: string): string {
  return `You are analyzing a React reducer to extract business domain actions.

File: ${fileName}

Reducer Code:
\`\`\`typescript
${reducerCode}
\`\`\`

Instructions:
1. Identify all action types in this reducer
2. For each action, determine:
   - The semantic meaning (what business operation it represents)
   - The input parameters required
   - The state changes it produces
   - Whether it's a command, query, or event

Respond in JSON format:
{
  "reducerName": "name of the reducer",
  "actions": [
    {
      "actionType": "ACTION_TYPE_CONSTANT",
      "semanticName": "businessOperationName",
      "intentType": "command" | "query" | "event",
      "description": "Human readable description",
      "inputFields": [
        { "name": "fieldName", "type": "fieldType" }
      ],
      "stateChanges": ["description of state changes"]
    }
  ],
  "suggestedDomainName": "Suggested domain based on actions"
}`;
}

/**
 * 패턴에서 도메인 이름을 제안하는 프롬프트
 */
export function suggestDomainNamePrompt(
  patterns: Array<{ name: string; type: string }>,
  filePaths: string[]
): string {
  return `You are analyzing React code patterns to suggest appropriate business domain names.

Detected Patterns:
${patterns.map(p => `- ${p.type}: ${p.name}`).join('\n')}

Source Files:
${filePaths.map(p => `- ${p}`).join('\n')}

Instructions:
1. Analyze the pattern names and file paths
2. Identify the common business concept they represent
3. Suggest 1-3 domain names that best describe this grouping
4. Domain names should be:
   - Singular nouns (User, Product, Order)
   - Business-focused, not technical
   - Clear and concise

Respond in JSON format:
{
  "suggestions": [
    {
      "name": "DomainName",
      "confidence": 0.9,
      "reasoning": "Why this name fits"
    }
  ],
  "primarySuggestion": "MostLikelyName"
}`;
}

/**
 * 복잡한 컴포넌트 분석 프롬프트
 */
export function analyzeComplexComponentPrompt(
  componentCode: string,
  componentName: string
): string {
  return `You are analyzing a complex React component to extract domain entities and state.

Component: ${componentName}

Code:
\`\`\`tsx
${componentCode}
\`\`\`

Instructions:
1. Identify the main business entity this component represents
2. Extract all props as potential entity fields
3. Identify state variables and their meanings
4. Detect event handlers and their semantic meanings
5. Note any context usage indicating shared state

Respond in JSON format:
{
  "componentName": "${componentName}",
  "entity": {
    "name": "EntityName",
    "fields": [
      { "name": "fieldName", "type": "fieldType", "description": "purpose" }
    ]
  },
  "state": [
    { "name": "stateName", "type": "stateType", "description": "purpose" }
  ],
  "actions": [
    { "name": "actionName", "type": "command|query|event", "description": "purpose" }
  ],
  "sharedState": ["list of context names used"]
}`;
}

/**
 * 도메인 경계 분석 프롬프트
 */
export function analyzeDomainBoundaryPrompt(
  domainFiles: string[],
  imports: string[],
  exports: string[]
): string {
  return `You are analyzing a potential domain boundary in a React codebase.

Domain Files:
${domainFiles.map(f => `- ${f}`).join('\n')}

External Imports:
${imports.map(i => `- ${i}`).join('\n')}

Exported Items:
${exports.map(e => `- ${e}`).join('\n')}

Instructions:
1. Determine if this is a well-defined domain boundary
2. Identify any leaky abstractions
3. Suggest improvements for better encapsulation
4. Rate the domain cohesion

Respond in JSON format:
{
  "isWellDefined": true | false,
  "cohesionScore": 0.0 - 1.0,
  "boundaryIssues": ["list of issues"],
  "suggestions": ["list of improvements"],
  "shouldSplit": false,
  "splitSuggestion": "If should split, explain how"
}`;
}
