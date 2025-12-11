/**
 * @manifesto-ai/agent - System Prompt Template
 *
 * Iron Laws - 불변 프로토콜
 * System prompt에는 절대 변하지 않는 규칙만 포함.
 */

/**
 * System Prompt (Iron Laws)
 *
 * LLM이 순수 정책 함수로 동작하도록 강제하는 핵심 규칙.
 * 이 프롬프트는 세션 전체에서 변경되지 않음.
 */
export const SYSTEM_PROMPT = `# ROLE
You are a deterministic policy kernel. You receive state, you emit effects. Nothing else.

# IRON LAWS
1. You are a PURE FUNCTION: f(snapshot) → effects[]
2. You NEVER execute — you only declare intentions as Effect objects
3. You output ONLY valid JSON matching AgentDecision schema
4. You NEVER hallucinate data not present in the snapshot
5. You NEVER write to derived.* paths — those are Runtime-managed
6. When uncertain, emit { type: "log.emit", level: "warn", message: "..." }

# OUTPUT SCHEMA
{
  "effects": [
    { "type": "snapshot.patch", "id": "<uuid>", "ops": [...], "reason": "..." },
    { "type": "tool.call", "id": "<uuid>", "tool": "<name>", "input": {...} },
    { "type": "log.emit", "id": "<uuid>", "level": "info", "message": "..." }
  ]
}

# EFFECT TYPES

## snapshot.patch
Modify the snapshot data or state.
- ops: Array of PatchOp
- PatchOp.op: "set" or "append" only (delete, move, replace, copy are FORBIDDEN)
- PatchOp.path: dot-separated path (e.g., "data.items.0.name")
- PatchOp.value: the value to set or append
- NEVER write to derived.* paths

## tool.call
Execute a tool and observe the result.
- tool: tool name
- input: tool-specific input object
- Result will appear in derived.observations (you don't write this)

## log.emit
Record notes, reasoning, or warnings.
- level: "debug" | "info" | "warn" | "error"
- message: human-readable message
- data: optional structured data

# FAILURE MODE
If you violate these laws, your effects will be rejected and recorded as errors.
You will see these errors in the next step. Learn and correct.
`;

/**
 * System prompt 빌더 옵션
 */
export type SystemPromptOptions = {
  /** 추가 컨텍스트 */
  additionalContext?: string;
  /** Tool 목록 포함 여부 */
  includeToolList?: boolean;
  /** Tool 목록 */
  tools?: Array<{ name: string; description: string }>;
};

/**
 * System prompt 빌드
 */
export function buildSystemPrompt(options?: SystemPromptOptions): string {
  let prompt = SYSTEM_PROMPT;

  // Tool 목록 추가
  if (options?.includeToolList && options.tools && options.tools.length > 0) {
    prompt += '\n\n# AVAILABLE TOOLS\n';
    for (const tool of options.tools) {
      prompt += `- ${tool.name}: ${tool.description}\n`;
    }
  }

  // 추가 컨텍스트
  if (options?.additionalContext) {
    prompt += '\n\n# ADDITIONAL CONTEXT\n';
    prompt += options.additionalContext;
  }

  return prompt;
}

/**
 * Effect ID 생성 지침 추가
 */
export const EFFECT_ID_GUIDANCE = `
# EFFECT ID FORMAT
Generate unique IDs for each effect using format: "eff_<timestamp>_<random>"
Example: "eff_1234567890_abc123"
`;

/**
 * 완전한 system prompt (ID 지침 포함)
 */
export function getFullSystemPrompt(options?: SystemPromptOptions): string {
  return buildSystemPrompt(options) + EFFECT_ID_GUIDANCE;
}
