/**
 * Summarizer LLM Service
 *
 * LLM을 사용하여 엔티티, 액션, 스키마를 추출합니다.
 * 휴리스틱 fallback도 제공합니다.
 */

import type { DetectedPattern } from '../../parser/types.js';
import type { DomainSummary, ExtractedEntity, ExtractedAction, ExtractedField } from './types.js';
import type { LLMProvider } from '../../llm/types.js';
import {
  extractEntitiesPrompt,
  extractActionsPrompt,
  generateSchemaPrompt,
  identifyDomainPrompt,
} from '../../llm/prompts/summarizer.js';
import { generateId } from './summarizer.js';

/**
 * LLM 서비스 설정
 */
export interface LLMServiceConfig {
  provider: LLMProvider;
  enableFallback: boolean;
  maxRetries: number;
  timeout: number;
}

/**
 * LLM 응답 파싱 결과
 */
interface ParsedEntitiesResponse {
  entities: Array<{
    name: string;
    description?: string;
    fields: Array<{
      name: string;
      type: string;
      description?: string;
    }>;
    source?: string;
  }>;
}

interface ParsedActionsResponse {
  actions: Array<{
    name: string;
    type: 'command' | 'query' | 'event';
    description?: string;
    input?: Array<{ name: string; type: string }>;
    effects?: string[];
    source?: string;
  }>;
}

interface ParsedSchemaResponse {
  domain: string;
  entities: Record<string, {
    type: string;
    description?: string;
    fields: Record<string, { type: string; description?: string }>;
  }>;
  state: Record<string, { type: string; description?: string }>;
  intents: Record<string, { type: string; description?: string }>;
}

interface ParsedDomainResponse {
  domainName: string;
  description: string;
  confidence: number;
  isCohesive: boolean;
  splitSuggestion?: string;
  relatedDomains?: string[];
}

/**
 * JSON 응답 파싱 (코드 블록 처리)
 */
function parseJSONResponse<T>(response: string): T | null {
  try {
    // 코드 블록 제거
    let cleaned = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      cleaned = jsonMatch[1].trim();
    }

    return JSON.parse(cleaned) as T;
  } catch {
    console.error('Failed to parse LLM response as JSON:', response.slice(0, 200));
    return null;
  }
}

/**
 * LLM을 사용하여 도메인 식별
 */
export async function identifyDomainWithLLM(
  patterns: DetectedPattern[],
  files: string[],
  config: LLMServiceConfig
): Promise<{ name: string; description: string; confidence: number } | null> {
  const prompt = identifyDomainPrompt(
    patterns.map(p => ({
      name: p.name,
      type: p.type,
      file: (p.metadata.sourceFile as string) ?? 'unknown',
    })),
    files
  );

  try {
    const response = await config.provider.complete(
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.3,
        maxTokens: 1000,
      }
    );

    const parsed = parseJSONResponse<ParsedDomainResponse>(response.content);
    if (parsed) {
      return {
        name: parsed.domainName,
        description: parsed.description,
        confidence: parsed.confidence,
      };
    }
  } catch (error) {
    console.error('LLM domain identification failed:', error);
  }

  return null;
}

/**
 * LLM을 사용하여 엔티티 추출
 */
export async function extractEntitiesWithLLM(
  patterns: DetectedPattern[],
  domainName: string,
  config: LLMServiceConfig
): Promise<ExtractedEntity[]> {
  const prompt = extractEntitiesPrompt(
    patterns.map(p => ({
      name: p.name,
      type: p.type,
      metadata: p.metadata,
    })),
    domainName
  );

  try {
    const response = await config.provider.complete(
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.2,
        maxTokens: 2000,
      }
    );

    const parsed = parseJSONResponse<ParsedEntitiesResponse>(response.content);
    if (parsed && parsed.entities) {
      return parsed.entities.map(e => ({
        id: `entity-llm-${e.name}-${generateId()}`,
        name: e.name,
        type: 'entity' as const,
        fields: e.fields.map(f => ({
          name: f.name,
          type: f.type,
          optional: false,
          description: f.description,
        })),
        sourcePatterns: e.source ? [e.source] : [],
        confidence: 0.85, // LLM 추출은 높은 신뢰도
      }));
    }
  } catch (error) {
    console.error('LLM entity extraction failed:', error);
  }

  // Fallback to empty if LLM fails
  if (config.enableFallback) {
    console.log('Using fallback for entity extraction');
    return [];
  }

  return [];
}

/**
 * LLM을 사용하여 액션 추출
 */
export async function extractActionsWithLLM(
  patterns: DetectedPattern[],
  domainName: string,
  config: LLMServiceConfig
): Promise<ExtractedAction[]> {
  // 액션 관련 패턴만 추출
  const actionPatterns = patterns.filter(
    p => p.type === 'reducer' || p.type === 'hook' || p.type === 'effect'
  );

  if (actionPatterns.length === 0) {
    return [];
  }

  const handlers = actionPatterns.map(p => ({
    name: p.name,
    code: p.rawCode ?? JSON.stringify(p.metadata),
  }));

  const prompt = extractActionsPrompt(handlers, domainName);

  try {
    const response = await config.provider.complete(
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.2,
        maxTokens: 2000,
      }
    );

    const parsed = parseJSONResponse<ParsedActionsResponse>(response.content);
    if (parsed && parsed.actions) {
      return parsed.actions.map(a => ({
        id: `action-llm-${a.name}-${generateId()}`,
        name: a.name,
        type: a.type,
        sourcePatterns: a.source ? [a.source] : [],
        confidence: 0.85,
      }));
    }
  } catch (error) {
    console.error('LLM action extraction failed:', error);
  }

  if (config.enableFallback) {
    console.log('Using fallback for action extraction');
    return [];
  }

  return [];
}

/**
 * LLM을 사용하여 Manifesto 스키마 생성
 */
export async function generateSchemaWithLLM(
  domain: DomainSummary,
  config: LLMServiceConfig
): Promise<ParsedSchemaResponse | null> {
  const prompt = generateSchemaPrompt(domain);

  try {
    const response = await config.provider.complete(
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.3,
        maxTokens: 3000,
      }
    );

    const parsed = parseJSONResponse<ParsedSchemaResponse>(response.content);
    return parsed;
  } catch (error) {
    console.error('LLM schema generation failed:', error);
  }

  return null;
}

/**
 * 휴리스틱 + LLM 하이브리드 엔티티 추출
 */
export async function extractEntitiesHybrid(
  patterns: DetectedPattern[],
  domainName: string,
  config: LLMServiceConfig | null
): Promise<ExtractedEntity[]> {
  // 1. 휴리스틱으로 기본 추출
  const heuristicEntities = extractEntitiesHeuristic(patterns);

  // 2. LLM이 있으면 보강
  if (config) {
    try {
      const llmEntities = await extractEntitiesWithLLM(patterns, domainName, config);

      // LLM 결과와 휴리스틱 결과 병합
      return mergeEntities(heuristicEntities, llmEntities);
    } catch (error) {
      console.error('LLM enrichment failed, using heuristic only:', error);
    }
  }

  return heuristicEntities;
}

/**
 * 휴리스틱 + LLM 하이브리드 액션 추출
 */
export async function extractActionsHybrid(
  patterns: DetectedPattern[],
  domainName: string,
  config: LLMServiceConfig | null
): Promise<ExtractedAction[]> {
  // 1. 휴리스틱으로 기본 추출
  const heuristicActions = extractActionsHeuristic(patterns);

  // 2. LLM이 있으면 보강
  if (config) {
    try {
      const llmActions = await extractActionsWithLLM(patterns, domainName, config);

      // LLM 결과와 휴리스틱 결과 병합
      return mergeActions(heuristicActions, llmActions);
    } catch (error) {
      console.error('LLM enrichment failed, using heuristic only:', error);
    }
  }

  return heuristicActions;
}

/**
 * 휴리스틱 엔티티 추출 (기존 로직)
 */
function extractEntitiesHeuristic(patterns: DetectedPattern[]): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  for (const pattern of patterns) {
    // Component의 Props에서 Entity 추출
    if (pattern.type === 'component' && pattern.metadata.props) {
      const props = pattern.metadata.props as string[];
      if (props.length > 0) {
        entities.push({
          id: `entity-props-${pattern.name}-${generateId()}`,
          name: `${pattern.name}Props`,
          type: 'entity',
          fields: props.map(prop => ({
            name: prop,
            type: 'unknown',
            optional: true,
          })),
          sourcePatterns: [pattern.name],
          confidence: pattern.confidence * 0.8, // 휴리스틱은 조금 낮은 신뢰도
        });
      }
    }

    // Context의 Value에서 Entity 추출
    if (pattern.type === 'context' && pattern.metadata.contextValue) {
      const contextValue = pattern.metadata.contextValue as string;
      entities.push({
        id: `entity-context-${pattern.name}-${generateId()}`,
        name: (pattern.metadata.contextName as string) ?? pattern.name,
        type: 'entity',
        fields: parseContextValueFields(contextValue),
        sourcePatterns: [pattern.name],
        confidence: pattern.confidence * 0.8,
      });
    }

    // Reducer의 State에서 Entity 추출
    if (pattern.type === 'reducer' && pattern.metadata.stateShape && pattern.name !== 'initialState') {
      const stateShape = pattern.metadata.stateShape as Record<string, unknown>;
      const entityName = pattern.name.endsWith('State')
        ? pattern.name
        : `${pattern.name}State`;
      entities.push({
        id: `entity-state-${pattern.name}-${generateId()}`,
        name: entityName,
        type: 'entity',
        fields: Object.entries(stateShape).map(([name, type]) => ({
          name,
          type: typeof type === 'string' ? type : 'unknown',
          optional: false,
        })),
        sourcePatterns: [pattern.name],
        confidence: pattern.confidence * 0.8,
      });
    }

    // TypeScript 인터페이스에서 엔티티 추출
    if (pattern.type === 'unknown' && pattern.metadata.isEntity && pattern.metadata.entityFields) {
      const entityFields = pattern.metadata.entityFields as Array<{ name: string; type: string; optional: boolean }>;
      entities.push({
        id: `entity-interface-${pattern.name}-${generateId()}`,
        name: pattern.name,
        type: 'entity',
        fields: entityFields.map(f => ({
          name: f.name,
          type: f.type,
          optional: f.optional,
        })),
        sourcePatterns: [pattern.name],
        confidence: pattern.confidence * 0.8,
      });
    }
  }

  return deduplicateEntities(entities);
}

/**
 * 휴리스틱 액션 추출 (기존 로직)
 */
function extractActionsHeuristic(patterns: DetectedPattern[]): ExtractedAction[] {
  const actions: ExtractedAction[] = [];

  for (const pattern of patterns) {
    // Reducer의 액션에서 추출
    if (pattern.type === 'reducer' && pattern.metadata.actions) {
      const reducerActions = pattern.metadata.actions as string[];
      for (const actionName of reducerActions) {
        const camelCaseName = actionName
          .toLowerCase()
          .replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

        let actionType: 'command' | 'query' | 'event' = 'command';
        if (actionName.includes('SUCCESS') || actionName.includes('FAILURE') || actionName.includes('ERROR')) {
          actionType = 'event';
        } else if (actionName.includes('FETCH') || actionName.includes('GET') || actionName.includes('LOAD')) {
          actionType = 'query';
        }

        actions.push({
          id: `action-${actionName}-${generateId()}`,
          name: camelCaseName,
          type: actionType,
          sourcePatterns: [pattern.name],
          confidence: pattern.confidence * 0.8,
        });
      }
    }

    // isActionType 플래그가 있는 패턴
    if (pattern.metadata.isActionType && pattern.metadata.actions) {
      const typeActions = pattern.metadata.actions as string[];
      for (const actionName of typeActions) {
        const camelCaseName = actionName
          .toLowerCase()
          .replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

        let actionType: 'command' | 'query' | 'event' = 'command';
        if (actionName.includes('SUCCESS') || actionName.includes('FAILURE')) {
          actionType = 'event';
        }

        actions.push({
          id: `action-type-${actionName}-${generateId()}`,
          name: camelCaseName,
          type: actionType,
          sourcePatterns: [pattern.name],
          confidence: pattern.confidence * 0.8,
        });
      }
    }

    // Custom Hook에서 액션 추출
    if (pattern.type === 'hook' && pattern.metadata.isCustomHook) {
      const hookName = pattern.name.replace(/^use/, '');
      actions.push({
        id: `action-${hookName}-query-${generateId()}`,
        name: `get${hookName}`,
        type: 'query',
        sourcePatterns: [pattern.name],
        confidence: pattern.confidence * 0.7,
      });
    }

    // Effect에서 이벤트 추출
    if (pattern.type === 'effect' && pattern.name !== 'useEffect' && pattern.name !== 'useLayoutEffect') {
      actions.push({
        id: `action-effect-${pattern.name}-${generateId()}`,
        name: pattern.name,
        type: 'event',
        sourcePatterns: [pattern.name],
        confidence: pattern.confidence * 0.8,
      });
    }
  }

  return deduplicateActions(actions);
}

/**
 * Context Value 문자열에서 필드 파싱
 */
function parseContextValueFields(contextValue: string): ExtractedField[] {
  const fields: ExtractedField[] = [];

  try {
    const parsed = JSON.parse(contextValue);
    if (typeof parsed === 'object' && parsed !== null) {
      for (const [name, type] of Object.entries(parsed)) {
        const cleanName = String(name).replace(/^"|"$/g, '');
        const cleanType = String(type).replace(/^"|"$/g, '');
        fields.push({
          name: cleanName,
          type: cleanType,
          optional: false,
        });
      }
      return fields;
    }
  } catch {
    // JSON 파싱 실패 시 기존 휴리스틱 사용
  }

  const match = contextValue.match(/\{([^}]+)\}/);
  if (match && match[1]) {
    const content = match[1];
    const parts = content.split(',').map(s => s.trim());

    for (const part of parts) {
      const [name, type] = part.split(':').map(s => s.trim());
      if (name) {
        fields.push({
          name: name.replace(/^"|"$/g, ''),
          type: (type ?? 'unknown').replace(/^"|"$/g, ''),
          optional: false,
        });
      }
    }
  }

  return fields;
}

/**
 * 엔티티 중복 제거
 */
function deduplicateEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
  const seen = new Map<string, ExtractedEntity>();

  for (const entity of entities) {
    const key = entity.name.toLowerCase();
    const existing = seen.get(key);

    if (!existing || entity.confidence > existing.confidence) {
      seen.set(key, entity);
    } else if (existing) {
      const existingFieldNames = new Set(existing.fields.map(f => f.name));
      const newFields = entity.fields.filter(f => !existingFieldNames.has(f.name));
      existing.fields.push(...newFields);
      existing.sourcePatterns.push(...entity.sourcePatterns);
    }
  }

  return [...seen.values()];
}

/**
 * 액션 중복 제거
 */
function deduplicateActions(actions: ExtractedAction[]): ExtractedAction[] {
  const seen = new Map<string, ExtractedAction>();

  for (const action of actions) {
    const key = action.name.toLowerCase();
    const existing = seen.get(key);

    if (!existing || action.confidence > existing.confidence) {
      seen.set(key, action);
    }
  }

  return [...seen.values()];
}

/**
 * 엔티티 병합 (휴리스틱 + LLM)
 */
function mergeEntities(heuristic: ExtractedEntity[], llm: ExtractedEntity[]): ExtractedEntity[] {
  const merged = [...heuristic];
  const heuristicNames = new Set(heuristic.map(e => e.name.toLowerCase()));

  for (const llmEntity of llm) {
    if (!heuristicNames.has(llmEntity.name.toLowerCase())) {
      merged.push(llmEntity);
    } else {
      // LLM이 더 풍부한 정보를 가질 수 있으므로 필드 보강
      const existing = merged.find(e => e.name.toLowerCase() === llmEntity.name.toLowerCase());
      if (existing && llmEntity.fields.length > existing.fields.length) {
        existing.fields = llmEntity.fields;
        existing.confidence = Math.max(existing.confidence, llmEntity.confidence);
      }
    }
  }

  return merged;
}

/**
 * 액션 병합 (휴리스틱 + LLM)
 */
function mergeActions(heuristic: ExtractedAction[], llm: ExtractedAction[]): ExtractedAction[] {
  const merged = [...heuristic];
  const heuristicNames = new Set(heuristic.map(a => a.name.toLowerCase()));

  for (const llmAction of llm) {
    if (!heuristicNames.has(llmAction.name.toLowerCase())) {
      merged.push(llmAction);
    }
  }

  return merged;
}
