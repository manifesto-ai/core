/**
 * Schema Proposal Generator
 *
 * 도메인 요약으로부터 Manifesto 스키마 제안을 생성합니다.
 */

import type { DetectedPattern, PatternMetadata } from '../../../parser/types.js';
import type {
  DomainSummary,
  DomainRelationship,
  SchemaProposal,
  SchemaFieldProposal,
  ExtractedEntity,
  ExtractedField,
  ExtractedAction,
} from '../types.js';
import { generateId } from '../summarizer.js';

/**
 * 스키마 제안 생성 설정
 */
export interface SchemaProposalConfig {
  confidenceThreshold: number;
  maxAlternatives: number;
  includePrivateFields: boolean;
}

const DEFAULT_CONFIG: SchemaProposalConfig = {
  confidenceThreshold: 0.7,
  maxAlternatives: 3,
  includePrivateFields: false,
};

/**
 * 패턴에서 엔티티 추출
 */
export function extractEntitiesFromPatterns(
  patterns: DetectedPattern[]
): ExtractedEntity[] {
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
            type: 'unknown', // 타입은 LLM으로 추론하거나 기본값 사용
            optional: true,
          })),
          sourcePatterns: [pattern.name],
          confidence: pattern.confidence,
        });
      }
    }

    // Context의 Value에서 Entity 추출
    if (pattern.type === 'context' && pattern.metadata.contextValue) {
      entities.push({
        id: `entity-context-${pattern.name}-${generateId()}`,
        name: pattern.metadata.contextName as string ?? pattern.name,
        type: 'entity',
        fields: extractFieldsFromContextValue(pattern.metadata.contextValue as string),
        sourcePatterns: [pattern.name],
        confidence: pattern.confidence,
      });
    }

    // Reducer의 State에서 Entity 추출
    // initialState 변수는 제외 (인터페이스에서 이미 추출됨)
    if (pattern.type === 'reducer' && pattern.metadata.stateShape && pattern.name !== 'initialState') {
      const stateShape = pattern.metadata.stateShape as Record<string, unknown>;
      // State 접미사 처리
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
        confidence: pattern.confidence,
      });
    }

    // TypeScript 인터페이스에서 엔티티 추출 (isEntity 플래그가 있는 경우)
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
        confidence: pattern.confidence,
      });
    }
  }

  return deduplicateEntities(entities);
}

/**
 * Context Value 문자열에서 필드 추출 (간단한 파싱)
 */
function extractFieldsFromContextValue(contextValue: string): ExtractedField[] {
  const fields: ExtractedField[] = [];

  // JSON으로 파싱 시도 (TypeScript 패턴 감지기에서 JSON.stringify된 경우)
  try {
    const parsed = JSON.parse(contextValue);
    if (typeof parsed === 'object' && parsed !== null) {
      for (const [name, type] of Object.entries(parsed)) {
        // 따옴표 제거
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

  // 예: "{ user: User, isLoading: boolean }"
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
 * 패턴에서 액션 추출
 */
export function extractActionsFromPatterns(
  patterns: DetectedPattern[]
): ExtractedAction[] {
  const actions: ExtractedAction[] = [];

  for (const pattern of patterns) {
    // Reducer의 액션에서 추출 (TypeScript 타입에서 추출된 액션 포함)
    if (pattern.type === 'reducer' && pattern.metadata.actions) {
      const reducerActions = pattern.metadata.actions as string[];
      for (const actionName of reducerActions) {
        // 액션 타입을 camelCase 이름으로 변환 (AUTH_SUCCESS -> authSuccess)
        const camelCaseName = actionName
          .toLowerCase()
          .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

        // 액션 종류 추론 (START/LOADING -> command, SUCCESS/FAILURE -> event)
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
          confidence: pattern.confidence,
        });
      }
    }

    // isActionType 플래그가 있는 패턴 (TypeScript 타입에서 직접 추출)
    if (pattern.metadata.isActionType && pattern.metadata.actions) {
      const typeActions = pattern.metadata.actions as string[];
      for (const actionName of typeActions) {
        const camelCaseName = actionName
          .toLowerCase()
          .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

        let actionType: 'command' | 'query' | 'event' = 'command';
        if (actionName.includes('SUCCESS') || actionName.includes('FAILURE')) {
          actionType = 'event';
        }

        actions.push({
          id: `action-type-${actionName}-${generateId()}`,
          name: camelCaseName,
          type: actionType,
          sourcePatterns: [pattern.name],
          confidence: pattern.confidence,
        });
      }
    }

    // Custom Hook에서 반환하는 함수들을 액션으로
    if (pattern.type === 'hook' && pattern.metadata.isCustomHook) {
      // Hook 이름에서 액션 추론 (useUser -> getUser, setUser 등)
      const hookName = pattern.name.replace(/^use/, '');
      actions.push({
        id: `action-${hookName}-query-${generateId()}`,
        name: `get${hookName}`,
        type: 'query',
        sourcePatterns: [pattern.name],
        confidence: pattern.confidence * 0.8, // 추론이므로 약간 낮춤
      });
    }

    // Effect에서 이벤트 추출 (built-in useEffect는 제외)
    if (pattern.type === 'effect' && pattern.name !== 'useEffect' && pattern.name !== 'useLayoutEffect') {
      actions.push({
        id: `action-effect-${pattern.name}-${generateId()}`,
        name: pattern.name,
        type: 'event',
        sourcePatterns: [pattern.name],
        confidence: pattern.confidence,
      });
    }
  }

  return deduplicateActions(actions);
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
      // 필드 병합
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
 * 엔티티에서 스키마 필드 제안 생성
 */
export function entitiesToSchemaFields(
  entities: ExtractedEntity[],
  domainName: string
): SchemaFieldProposal[] {
  const fields: SchemaFieldProposal[] = [];

  for (const entity of entities) {
    // 엔티티 자체
    fields.push({
      path: `${domainName}.entities.${entity.name}`,
      type: 'object',
      description: `Entity: ${entity.name}`,
      source: entity.sourcePatterns.join(', '),
      confidence: entity.confidence,
    });

    // 엔티티 필드들
    for (const field of entity.fields) {
      fields.push({
        path: `${domainName}.entities.${entity.name}.${field.name}`,
        type: field.type,
        description: field.description,
        source: entity.sourcePatterns.join(', '),
        confidence: entity.confidence * 0.9,
      });
    }
  }

  return fields;
}

/**
 * 액션에서 스키마 필드 제안 생성
 */
export function actionsToSchemaFields(
  actions: ExtractedAction[],
  domainName: string
): SchemaFieldProposal[] {
  return actions.map(action => ({
    path: `${domainName}.intents.${action.name}`,
    type: action.type,
    description: `${action.type}: ${action.name}`,
    source: action.sourcePatterns.join(', '),
    confidence: action.confidence,
  }));
}

/**
 * 상태 추론하여 스키마 필드 제안 생성
 */
export function inferStateFields(
  entities: ExtractedEntity[],
  patterns: DetectedPattern[],
  domainName: string
): SchemaFieldProposal[] {
  const fields: SchemaFieldProposal[] = [];

  // Context에서 상태 추론
  const contextPatterns = patterns.filter(p => p.type === 'context');
  for (const pattern of contextPatterns) {
    if (pattern.metadata.contextName) {
      fields.push({
        path: `${domainName}.state.${pattern.metadata.contextName}`,
        type: 'context',
        description: `Context state from ${pattern.name}`,
        source: pattern.name,
        confidence: pattern.confidence,
      });
    }
  }

  // Reducer에서 상태 추론
  const reducerPatterns = patterns.filter(p => p.type === 'reducer');
  for (const pattern of reducerPatterns) {
    const stateShape = pattern.metadata.stateShape as Record<string, unknown> | undefined;
    if (stateShape) {
      for (const [key, value] of Object.entries(stateShape)) {
        fields.push({
          path: `${domainName}.state.${key}`,
          type: typeof value === 'string' ? value : 'unknown',
          description: `State field from ${pattern.name}`,
          source: pattern.name,
          confidence: pattern.confidence,
        });
      }
    }
  }

  return fields;
}

/**
 * 도메인에서 스키마 제안 생성
 */
export function generateSchemaProposal(
  domain: DomainSummary,
  patterns: DetectedPattern[],
  relationships: DomainRelationship[],
  config: Partial<SchemaProposalConfig> = {}
): SchemaProposal {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // 패턴에서 엔티티와 액션 추출
  const entities = extractEntitiesFromPatterns(patterns);
  const actions = extractActionsFromPatterns(patterns);

  // 스키마 필드 제안 생성
  const entityFields = entitiesToSchemaFields(entities, domain.name);
  const stateFields = inferStateFields(entities, patterns, domain.name);
  const intentFields = actionsToSchemaFields(actions, domain.name);

  // 전체 신뢰도 계산
  const allFields = [...entityFields, ...stateFields, ...intentFields];
  const overallConfidence = allFields.length > 0
    ? allFields.reduce((sum, f) => sum + f.confidence, 0) / allFields.length
    : 0;

  // 리뷰 노트 생성
  const reviewNotes: string[] = [];

  if (entities.length === 0) {
    reviewNotes.push('No entities could be extracted - manual entity definition may be needed');
  }

  if (actions.length === 0) {
    reviewNotes.push('No actions could be extracted - manual action definition may be needed');
  }

  const lowConfidenceFields = allFields.filter(f => f.confidence < cfg.confidenceThreshold);
  if (lowConfidenceFields.length > 0) {
    reviewNotes.push(`${lowConfidenceFields.length} fields have low confidence and may need review`);
  }

  // 관계에서 추가 정보 추출
  const relatedDomains = relationships
    .filter(r => r.from === domain.id || r.to === domain.id)
    .map(r => r.from === domain.id ? r.to : r.from);

  if (relatedDomains.length > 0) {
    reviewNotes.push(`Related domains: ${relatedDomains.join(', ')}`);
  }

  return {
    id: `proposal-${domain.id}-${generateId()}`,
    domainId: domain.id,
    domainName: domain.name,
    entities: entityFields,
    state: stateFields,
    intents: intentFields,
    confidence: overallConfidence,
    alternatives: [], // 대안은 LLM 호출로 생성
    reviewNotes,
    needsReview: overallConfidence < cfg.confidenceThreshold || reviewNotes.length > 2,
  };
}

/**
 * 여러 도메인의 스키마 제안 일괄 생성
 */
export function generateAllSchemaProposals(
  domains: DomainSummary[],
  patternsByDomain: Map<string, DetectedPattern[]>,
  relationships: DomainRelationship[],
  config?: Partial<SchemaProposalConfig>
): SchemaProposal[] {
  return domains.map(domain => {
    const patterns = patternsByDomain.get(domain.id) ?? [];
    const domainRelationships = relationships.filter(
      r => r.from === domain.id || r.to === domain.id
    );

    return generateSchemaProposal(domain, patterns, domainRelationships, config);
  });
}

/**
 * 스키마 제안 검증
 */
export function validateSchemaProposal(
  proposal: SchemaProposal
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 엔티티 경로 유효성
  for (const entity of proposal.entities) {
    if (!entity.path.startsWith(proposal.domainName)) {
      errors.push(`Entity path "${entity.path}" doesn't start with domain name`);
    }
  }

  // 중복 경로 체크
  const allPaths = [
    ...proposal.entities.map(e => e.path),
    ...proposal.state.map(s => s.path),
    ...proposal.intents.map(i => i.path),
  ];

  const duplicates = allPaths.filter((p, i) => allPaths.indexOf(p) !== i);
  if (duplicates.length > 0) {
    errors.push(`Duplicate paths found: ${[...new Set(duplicates)].join(', ')}`);
  }

  // 빈 제안 체크
  if (proposal.entities.length === 0 && proposal.state.length === 0 && proposal.intents.length === 0) {
    errors.push('Schema proposal is empty');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 스키마 제안 병합
 */
export function mergeSchemaProposals(
  proposals: SchemaProposal[]
): SchemaProposal {
  if (proposals.length === 0) {
    throw new Error('Cannot merge empty proposals array');
  }

  if (proposals.length === 1) {
    return proposals[0]!;
  }

  const first = proposals[0]!;

  // 모든 필드 수집
  const allEntities = proposals.flatMap(p => p.entities);
  const allState = proposals.flatMap(p => p.state);
  const allIntents = proposals.flatMap(p => p.intents);

  // 중복 제거 (높은 신뢰도 우선)
  const mergeFields = (fields: SchemaFieldProposal[]): SchemaFieldProposal[] => {
    const byPath = new Map<string, SchemaFieldProposal>();
    for (const field of fields) {
      const existing = byPath.get(field.path);
      if (!existing || field.confidence > existing.confidence) {
        byPath.set(field.path, field);
      }
    }
    return [...byPath.values()];
  };

  return {
    id: `merged-${generateId()}`,
    domainId: first.domainId,
    domainName: first.domainName,
    entities: mergeFields(allEntities),
    state: mergeFields(allState),
    intents: mergeFields(allIntents),
    confidence: proposals.reduce((sum, p) => sum + p.confidence, 0) / proposals.length,
    alternatives: [],
    reviewNotes: [...new Set(proposals.flatMap(p => p.reviewNotes))],
    needsReview: proposals.some(p => p.needsReview),
  };
}
