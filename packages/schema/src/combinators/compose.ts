/**
 * Schema Composition Utilities
 *
 * 스키마 간의 합성, 확장, 오버라이드 기능
 */

import type {
  EntitySchema,
  ViewSchema,
  FormViewSchema,
  ActionSchema,
  EntityField,
  ViewField,
  ViewSection,
} from '../types'

// ============================================================================
// Entity Composition
// ============================================================================

/**
 * Entity 스키마 확장 (상속)
 *
 * @example
 * const extendedEntity = extendEntity(baseEntity, {
 *   id: 'extended-product',
 *   fields: [additionalField]
 * })
 */
export const extendEntity = (
  base: EntitySchema,
  overrides: Partial<Omit<EntitySchema, '_type'>> & {
    fields?: EntityField[]
    removeFields?: string[]
  }
): EntitySchema => {
  const { fields: additionalFields = [], removeFields = [], ...rest } = overrides

  const baseFields = base.fields.filter(
    (f) => !removeFields.includes(f.id)
  )

  return {
    ...base,
    ...rest,
    _type: 'entity',
    fields: [...baseFields, ...additionalFields],
    relations: [...(base.relations ?? []), ...(rest.relations ?? [])],
    indexes: [...(base.indexes ?? []), ...(rest.indexes ?? [])],
  }
}

/**
 * 두 Entity 스키마 병합
 */
export const mergeEntities = (
  a: EntitySchema,
  b: EntitySchema,
  options?: { id?: string; name?: string }
): EntitySchema => {
  const fieldMap = new Map<string, EntityField>()

  for (const field of a.fields) {
    fieldMap.set(field.id, field)
  }
  for (const field of b.fields) {
    fieldMap.set(field.id, field)
  }

  return {
    _type: 'entity',
    id: options?.id ?? `${a.id}-${b.id}`,
    version: a.version,
    name: options?.name ?? `${a.name} + ${b.name}`,
    fields: Array.from(fieldMap.values()),
    relations: [...(a.relations ?? []), ...(b.relations ?? [])],
    indexes: [...(a.indexes ?? []), ...(b.indexes ?? [])],
  }
}

// ============================================================================
// View Composition
// ============================================================================

/**
 * Form View 스키마 확장
 */
export const extendView = (
  base: FormViewSchema,
  overrides: Partial<Omit<FormViewSchema, '_type'>> & {
    sections?: ViewSection[]
    removeSections?: string[]
  }
): FormViewSchema => {
  const { sections: additionalSections = [], removeSections = [], ...rest } = overrides

  const baseSections = base.sections.filter(
    (s: ViewSection) => !removeSections.includes(s.id)
  )

  return {
    ...base,
    ...rest,
    _type: 'view',
    sections: [...baseSections, ...additionalSections],
  }
}

/**
 * View Section 확장
 */
export const extendSection = (
  base: ViewSection,
  overrides: Partial<ViewSection> & {
    fields?: ViewField[]
    removeFields?: string[]
  }
): ViewSection => {
  const { fields: additionalFields = [], removeFields = [], ...rest } = overrides

  const baseFields = base.fields.filter(
    (f) => !removeFields.includes(f.id)
  )

  return {
    ...base,
    ...rest,
    fields: [...baseFields, ...additionalFields],
  }
}

// ============================================================================
// Brand Override (멀티 브랜드/벤더 확장)
// ============================================================================

export interface BrandOverride<T> {
  readonly base: T
  readonly overrides: Partial<T>
  readonly brandId: string
}

/**
 * 브랜드/벤더별 스키마 오버라이드 적용
 *
 * @example
 * const brandProductEntity = applyBrandOverride(productEntity, {
 *   brandId: 'brand-a',
 *   overrides: {
 *     fields: [...brandSpecificFields]
 *   }
 * })
 */
export const applyBrandOverride = <T extends EntitySchema | ViewSchema | ActionSchema>(
  base: T,
  override: { brandId: string; overrides: Partial<T> }
): T => {
  const result = { ...base, ...override.overrides } as T

  // ID에 브랜드 정보 추가
  return {
    ...result,
    id: `${base.id}@${override.brandId}`,
  }
}

/**
 * 조건부 필드 포함
 */
export const includeFieldsIf = (
  condition: boolean,
  ...fields: EntityField[]
): EntityField[] => (condition ? fields : [])

/**
 * 조건부 섹션 포함
 */
export const includeSectionsIf = (
  condition: boolean,
  ...sections: ViewSection[]
): ViewSection[] => (condition ? sections : [])
