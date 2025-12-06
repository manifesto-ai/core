/**
 * Entity Schema Combinator
 *
 * 필드들을 조합하여 Entity 스키마를 구성
 */

import type {
  EntitySchema,
  EntityField,
  Relation,
  IndexConfig,
  SchemaVersion,
} from '../types'

// ============================================================================
// Entity Builder
// ============================================================================

export interface EntityBuilder {
  readonly _schema: EntitySchema
  description(desc: string): EntityBuilder
  tags(...tags: string[]): EntityBuilder
  field(field: EntityField): EntityBuilder
  fields(...fields: EntityField[]): EntityBuilder
  relation(relation: Relation): EntityBuilder
  relations(...relations: Relation[]): EntityBuilder
  index(config: IndexConfig): EntityBuilder
  indexes(...configs: IndexConfig[]): EntityBuilder
  build(): EntitySchema
}

const createEntityBuilder = (schema: EntitySchema): EntityBuilder => ({
  _schema: schema,

  description(description: string) {
    return createEntityBuilder({ ...this._schema, description })
  },

  tags(...tags: string[]) {
    return createEntityBuilder({
      ...this._schema,
      tags: [...(this._schema.tags ?? []), ...tags],
    })
  },

  field(field: EntityField) {
    return createEntityBuilder({
      ...this._schema,
      fields: [...this._schema.fields, field],
    })
  },

  fields(...fields: EntityField[]) {
    return createEntityBuilder({
      ...this._schema,
      fields: [...this._schema.fields, ...fields],
    })
  },

  relation(relation: Relation) {
    return createEntityBuilder({
      ...this._schema,
      relations: [...(this._schema.relations ?? []), relation],
    })
  },

  relations(...relations: Relation[]) {
    return createEntityBuilder({
      ...this._schema,
      relations: [...(this._schema.relations ?? []), ...relations],
    })
  },

  index(config: IndexConfig) {
    return createEntityBuilder({
      ...this._schema,
      indexes: [...(this._schema.indexes ?? []), config],
    })
  },

  indexes(...configs: IndexConfig[]) {
    return createEntityBuilder({
      ...this._schema,
      indexes: [...(this._schema.indexes ?? []), ...configs],
    })
  },

  build() {
    return this._schema
  },
})

/**
 * Entity 스키마 생성
 *
 * @example
 * const productEntity = entity('product', 'Product', '0.1.0')
 *   .description('상품 정보')
 *   .fields(
 *     field.string('name', '상품명').required().build(),
 *     field.enum('type', '상품 유형', productTypes).build()
 *   )
 *   .build()
 */
export const entity = (
  id: string,
  name: string,
  version: SchemaVersion = '0.1.0'
): EntityBuilder =>
  createEntityBuilder({
    _type: 'entity',
    id,
    version,
    name,
    fields: [],
  })

// ============================================================================
// Relation Helpers
// ============================================================================

export const relation = {
  hasOne(target: string, foreignKey?: string): Relation {
    return { type: 'hasOne', target, foreignKey }
  },

  hasMany(target: string, foreignKey?: string): Relation {
    return { type: 'hasMany', target, foreignKey }
  },

  belongsTo(target: string, foreignKey?: string): Relation {
    return { type: 'belongsTo', target, foreignKey }
  },

  manyToMany(target: string, through: string): Relation {
    return { type: 'manyToMany', target, through }
  },
}

// ============================================================================
// Index Helpers
// ============================================================================

export const index = (...fields: string[]): IndexConfig => ({
  fields,
})

export const uniqueIndex = (...fields: string[]): IndexConfig => ({
  fields,
  unique: true,
})

export const namedIndex = (name: string, ...fields: string[]): IndexConfig => ({
  name,
  fields,
})
