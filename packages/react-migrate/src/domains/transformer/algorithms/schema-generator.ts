/**
 * Schema Generator Algorithm
 *
 * SchemaProposal을 ManifestoDomainJson으로 변환합니다.
 */

import type { SchemaProposal, SchemaFieldProposal, DomainSummary } from '../../summarizer/types.js';
import type {
  ManifestoDomainJson,
  ManifestoEntity,
  ManifestoField,
  ManifestoStateField,
  ManifestoIntent,
  ManifestoDomainMetadata,
} from '../types.js';

/**
 * 스키마 생성 설정
 */
export interface SchemaGeneratorConfig {
  schemaVersion: string;
  includeDescriptions: boolean;
  defaultTypes: Record<string, string>;
}

const DEFAULT_CONFIG: SchemaGeneratorConfig = {
  schemaVersion: '1.0.0',
  includeDescriptions: true,
  defaultTypes: {
    unknown: 'any',
    object: 'object',
  },
};

/**
 * SchemaProposal에서 ManifestoDomainJson 생성
 */
export function generateManifestoSchema(
  proposal: SchemaProposal,
  summary: DomainSummary,
  config: Partial<SchemaGeneratorConfig> = {}
): ManifestoDomainJson {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const entities = generateEntities(proposal.entities, cfg);
  const state = generateState(proposal.state, cfg);
  const intents = generateIntents(proposal.intents, cfg);
  const metadata = generateMetadata(proposal, summary);

  return {
    $schema: `https://manifesto.ai/schema/domain/${cfg.schemaVersion}`,
    domain: proposal.domainName,
    version: cfg.schemaVersion,
    entities,
    state,
    intents,
    metadata,
  };
}

/**
 * 엔티티 필드 제안에서 ManifestoEntity 생성
 */
function generateEntities(
  entityFields: SchemaFieldProposal[],
  config: SchemaGeneratorConfig
): Record<string, ManifestoEntity> {
  const entities: Record<string, ManifestoEntity> = {};

  // 경로에서 엔티티 추출 (domain.entities.EntityName)
  const entityPaths = entityFields.filter(f => {
    const parts = f.path.split('.');
    return parts[1] === 'entities' && parts.length >= 3;
  });

  // 엔티티별로 그룹화
  const byEntity = new Map<string, SchemaFieldProposal[]>();
  for (const field of entityPaths) {
    const parts = field.path.split('.');
    const entityName = parts[2]!;

    if (!byEntity.has(entityName)) {
      byEntity.set(entityName, []);
    }
    byEntity.get(entityName)!.push(field);
  }

  // 각 엔티티에 대해 ManifestoEntity 생성
  for (const [entityName, fields] of byEntity) {
    // 엔티티 자체 필드 (domain.entities.EntityName)
    const entityField = fields.find(f => f.path.split('.').length === 3);

    // 엔티티의 속성 필드들 (domain.entities.EntityName.fieldName)
    const propertyFields = fields.filter(f => f.path.split('.').length > 3);

    const manifestoFields: Record<string, ManifestoField> = {};
    for (const pf of propertyFields) {
      const parts = pf.path.split('.');
      const fieldName = parts[3]!;

      manifestoFields[fieldName] = {
        type: normalizeType(pf.type, config.defaultTypes),
        ...(config.includeDescriptions && pf.description ? { description: pf.description } : {}),
      };
    }

    entities[entityName] = {
      type: 'object',
      ...(config.includeDescriptions && entityField?.description
        ? { description: entityField.description }
        : {}),
      fields: manifestoFields,
    };
  }

  return entities;
}

/**
 * 상태 필드 제안에서 ManifestoStateField 생성
 */
function generateState(
  stateFields: SchemaFieldProposal[],
  config: SchemaGeneratorConfig
): Record<string, ManifestoStateField> {
  const state: Record<string, ManifestoStateField> = {};

  for (const field of stateFields) {
    const parts = field.path.split('.');
    // domain.state.fieldName
    if (parts[1] !== 'state' || parts.length < 3) continue;

    const fieldName = parts.slice(2).join('.');

    state[fieldName] = {
      type: normalizeType(field.type, config.defaultTypes),
      ...(config.includeDescriptions && field.description ? { description: field.description } : {}),
    };
  }

  return state;
}

/**
 * 인텐트 필드 제안에서 ManifestoIntent 생성
 */
function generateIntents(
  intentFields: SchemaFieldProposal[],
  config: SchemaGeneratorConfig
): Record<string, ManifestoIntent> {
  const intents: Record<string, ManifestoIntent> = {};

  for (const field of intentFields) {
    const parts = field.path.split('.');
    // domain.intents.intentName
    if (parts[1] !== 'intents' || parts.length < 3) continue;

    const intentName = parts[2]!;

    // 타입이 command, query, event 중 하나인지 확인
    let intentType: 'command' | 'query' | 'event' = 'command';
    if (field.type === 'query' || field.type === 'event') {
      intentType = field.type;
    }

    intents[intentName] = {
      type: intentType,
      ...(config.includeDescriptions && field.description ? { description: field.description } : {}),
    };
  }

  return intents;
}

/**
 * 메타데이터 생성
 */
function generateMetadata(
  proposal: SchemaProposal,
  summary: DomainSummary
): ManifestoDomainMetadata {
  return {
    generatedAt: Date.now(),
    generatedBy: '@manifesto-ai/react-migrate',
    sourceFiles: summary.sourceFiles,
    confidence: proposal.confidence,
  };
}

/**
 * 타입 정규화
 */
function normalizeType(type: string, defaults: Record<string, string>): string {
  if (defaults[type]) {
    return defaults[type];
  }

  // 일반적인 타입 매핑
  const typeMap: Record<string, string> = {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    object: 'object',
    array: 'array',
    null: 'null',
    undefined: 'undefined',
    void: 'void',
    any: 'any',
    unknown: 'any',
  };

  const normalized = type.toLowerCase();
  return typeMap[normalized] ?? type;
}

/**
 * 스키마 검증
 */
export function validateGeneratedSchema(
  schema: ManifestoDomainJson
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 필수 필드 검증
  if (!schema.domain) {
    errors.push('Missing required field: domain');
  }

  if (!schema.version) {
    errors.push('Missing required field: version');
  }

  // 엔티티 검증
  for (const [name, entity] of Object.entries(schema.entities)) {
    if (!entity.type) {
      errors.push(`Entity "${name}" missing type`);
    }

    if (entity.type === 'object' && entity.fields) {
      for (const [fieldName, field] of Object.entries(entity.fields)) {
        if (!field.type) {
          errors.push(`Entity "${name}" field "${fieldName}" missing type`);
        }
      }
    }
  }

  // 인텐트 검증
  for (const [name, intent] of Object.entries(schema.intents)) {
    if (!['command', 'query', 'event'].includes(intent.type)) {
      errors.push(`Intent "${name}" has invalid type: ${intent.type}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 스키마 직렬화 (JSON 문자열로)
 */
export function serializeSchema(schema: ManifestoDomainJson): string {
  return JSON.stringify(schema, null, 2);
}

/**
 * 빈 스키마 생성
 */
export function createEmptySchema(
  domainName: string,
  sourceFiles: string[],
  schemaVersion: string = '1.0.0'
): ManifestoDomainJson {
  return {
    $schema: `https://manifesto.ai/schema/domain/${schemaVersion}`,
    domain: domainName,
    version: schemaVersion,
    entities: {},
    state: {},
    intents: {},
    metadata: {
      generatedAt: Date.now(),
      generatedBy: '@manifesto-ai/react-migrate',
      sourceFiles,
      confidence: 0,
    },
  };
}
