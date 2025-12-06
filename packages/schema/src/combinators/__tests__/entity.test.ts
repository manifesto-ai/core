import { describe, test, expect } from 'vitest'
import {
  entity,
  relation,
  index,
  uniqueIndex,
  namedIndex,
  type EntityBuilder,
} from '../entity'
import { field, enumValue } from '../../primitives/field'

describe('Entity Combinator', () => {
  describe('entity()', () => {
    test('creates entity with id, name, and default version', () => {
      const e = entity('user', 'User').build()
      expect(e._type).toBe('entity')
      expect(e.id).toBe('user')
      expect(e.name).toBe('User')
      expect(e.version).toBe('0.1.0')
      expect(e.fields).toEqual([])
    })

    test('creates entity with custom version', () => {
      const e = entity('user', 'User', '1.0.0').build()
      expect(e.version).toBe('1.0.0')
    })
  })

  describe('EntityBuilder Methods', () => {
    test('description() sets entity description', () => {
      const e = entity('user', 'User')
        .description('User account entity')
        .build()
      expect(e.description).toBe('User account entity')
    })

    test('tags() adds tags', () => {
      const e = entity('user', 'User')
        .tags('auth', 'core')
        .build()
      expect(e.tags).toEqual(['auth', 'core'])
    })

    test('tags() accumulates multiple calls', () => {
      const e = entity('user', 'User')
        .tags('auth')
        .tags('core', 'v1')
        .build()
      expect(e.tags).toEqual(['auth', 'core', 'v1'])
    })

    test('field() adds single field', () => {
      const e = entity('user', 'User')
        .field(field.string('name', 'Name').required().build())
        .build()
      expect(e.fields).toHaveLength(1)
      expect(e.fields[0].id).toBe('name')
    })

    test('fields() adds multiple fields', () => {
      const e = entity('user', 'User')
        .fields(
          field.string('name', 'Name').required().build(),
          field.string('email', 'Email').required().build(),
          field.number('age', 'Age').build()
        )
        .build()
      expect(e.fields).toHaveLength(3)
    })

    test('field() and fields() can be combined', () => {
      const e = entity('user', 'User')
        .field(field.string('id', 'ID').build())
        .fields(
          field.string('name', 'Name').build(),
          field.string('email', 'Email').build()
        )
        .field(field.boolean('active', 'Active').build())
        .build()
      expect(e.fields).toHaveLength(4)
    })

    test('relation() adds single relation', () => {
      const e = entity('user', 'User')
        .relation(relation.hasMany('post', 'authorId'))
        .build()
      expect(e.relations).toHaveLength(1)
      expect(e.relations?.[0].type).toBe('hasMany')
      expect(e.relations?.[0].target).toBe('post')
    })

    test('relations() adds multiple relations', () => {
      const e = entity('user', 'User')
        .relations(
          relation.hasMany('post', 'authorId'),
          relation.hasOne('profile', 'userId'),
          relation.belongsTo('organization', 'organizationId')
        )
        .build()
      expect(e.relations).toHaveLength(3)
    })

    test('index() adds single index', () => {
      const e = entity('user', 'User')
        .index(index('email'))
        .build()
      expect(e.indexes).toHaveLength(1)
      expect(e.indexes?.[0].fields).toEqual(['email'])
    })

    test('indexes() adds multiple indexes', () => {
      const e = entity('user', 'User')
        .indexes(
          index('email'),
          index('createdAt'),
          uniqueIndex('username')
        )
        .build()
      expect(e.indexes).toHaveLength(3)
    })
  })

  describe('Builder Immutability', () => {
    test('each method returns new builder instance', () => {
      const builder1 = entity('user', 'User')
      const builder2 = builder1.description('User entity')
      const builder3 = builder2.field(field.string('name', 'Name').build())

      const e1 = builder1.build()
      const e2 = builder2.build()
      const e3 = builder3.build()

      expect(e1.description).toBeUndefined()
      expect(e2.description).toBe('User entity')
      expect(e2.fields).toHaveLength(0)
      expect(e3.fields).toHaveLength(1)
    })
  })

  describe('Relation Helpers', () => {
    test('relation.hasOne() creates hasOne relation', () => {
      const r = relation.hasOne('profile', 'userId')
      expect(r.type).toBe('hasOne')
      expect(r.target).toBe('profile')
      expect(r.foreignKey).toBe('userId')
    })

    test('relation.hasOne() without foreignKey', () => {
      const r = relation.hasOne('profile')
      expect(r.type).toBe('hasOne')
      expect(r.target).toBe('profile')
      expect(r.foreignKey).toBeUndefined()
    })

    test('relation.hasMany() creates hasMany relation', () => {
      const r = relation.hasMany('post', 'authorId')
      expect(r.type).toBe('hasMany')
      expect(r.target).toBe('post')
      expect(r.foreignKey).toBe('authorId')
    })

    test('relation.belongsTo() creates belongsTo relation', () => {
      const r = relation.belongsTo('organization', 'organizationId')
      expect(r.type).toBe('belongsTo')
      expect(r.target).toBe('organization')
      expect(r.foreignKey).toBe('organizationId')
    })

    test('relation.manyToMany() creates manyToMany relation', () => {
      const r = relation.manyToMany('role', 'user_roles')
      expect(r.type).toBe('manyToMany')
      expect(r.target).toBe('role')
      expect(r.through).toBe('user_roles')
    })
  })

  describe('Index Helpers', () => {
    test('index() creates basic index', () => {
      const idx = index('email')
      expect(idx.fields).toEqual(['email'])
      expect(idx.unique).toBeUndefined()
      expect(idx.name).toBeUndefined()
    })

    test('index() creates composite index', () => {
      const idx = index('firstName', 'lastName')
      expect(idx.fields).toEqual(['firstName', 'lastName'])
    })

    test('uniqueIndex() creates unique index', () => {
      const idx = uniqueIndex('email')
      expect(idx.fields).toEqual(['email'])
      expect(idx.unique).toBe(true)
    })

    test('uniqueIndex() creates composite unique index', () => {
      const idx = uniqueIndex('brandId', 'email')
      expect(idx.fields).toEqual(['brandId', 'email'])
      expect(idx.unique).toBe(true)
    })

    test('namedIndex() creates named index', () => {
      const idx = namedIndex('idx_user_email', 'email')
      expect(idx.name).toBe('idx_user_email')
      expect(idx.fields).toEqual(['email'])
    })

    test('namedIndex() creates named composite index', () => {
      const idx = namedIndex('idx_user_name', 'firstName', 'lastName')
      expect(idx.name).toBe('idx_user_name')
      expect(idx.fields).toEqual(['firstName', 'lastName'])
    })
  })

  describe('Complex Entity Scenarios', () => {
    test('creates complete user entity', () => {
      const userEntity = entity('user', 'User', '1.0.0')
        .description('User account entity for authentication and authorization')
        .tags('auth', 'core')
        .fields(
          field.string('id', 'ID').required().build(),
          field.string('email', 'Email')
            .required()
            .pattern('^[a-z]+@[a-z]+\\.[a-z]+$')
            .build(),
          field.string('username', 'Username')
            .required()
            .min(3)
            .max(20)
            .build(),
          field.string('passwordHash', 'Password Hash').required().build(),
          field.enum('role', 'Role', [
            enumValue('ADMIN', 'Admin'),
            enumValue('USER', 'User'),
            enumValue('GUEST', 'Guest'),
          ]).defaultValue('USER').build(),
          field.boolean('active', 'Active').defaultValue(true).build(),
          field.datetime('createdAt', 'Created At').build(),
          field.datetime('updatedAt', 'Updated At').build()
        )
        .relations(
          relation.hasOne('profile', 'userId'),
          relation.hasMany('post', 'authorId'),
          relation.manyToMany('role', 'user_roles')
        )
        .indexes(
          uniqueIndex('email'),
          uniqueIndex('username'),
          index('createdAt'),
          namedIndex('idx_user_active_created', 'active', 'createdAt')
        )
        .build()

      expect(userEntity._type).toBe('entity')
      expect(userEntity.id).toBe('user')
      expect(userEntity.version).toBe('1.0.0')
      expect(userEntity.fields).toHaveLength(8)
      expect(userEntity.relations).toHaveLength(3)
      expect(userEntity.indexes).toHaveLength(4)
      expect(userEntity.tags).toEqual(['auth', 'core'])
    })

    test('creates product entity with complex fields', () => {
      const productTypes = [
        enumValue('RESIDENTIAL', 'Residential'),
        enumValue('COMMERCIAL', 'Commercial'),
        enumValue('INDUSTRIAL', 'Industrial'),
      ]

      const productEntity = entity('product', 'Product')
        .description('Product information entity')
        .fields(
          field.string('id', 'ID').required().build(),
          field.string('name', 'Product Name').required().min(1).max(100).build(),
          field.enum('type', 'Product Type', productTypes).required().build(),
          field.number('floors', 'Number of Floors').min(1).build(),
          field.number('totalArea', 'Total Area (m²)').min(0).build(),
          field.object('address', 'Address', [
            field.string('street', 'Street').build(),
            field.string('city', 'City').build(),
            field.string('zipCode', 'ZIP Code').build(),
          ]).build(),
          field.array('tags', 'Tags', 'string').build(),
          field.reference('ownerId', 'Owner', {
            entity: 'user',
            displayField: 'name',
          }).build()
        )
        .relations(
          relation.belongsTo('user', 'ownerId'),
          relation.hasMany('floor', 'productId')
        )
        .indexes(
          index('type'),
          index('ownerId'),
          namedIndex('idx_product_name', 'name')
        )
        .build()

      expect(productEntity.fields).toHaveLength(8)
      expect(productEntity.relations).toHaveLength(2)
      expect(productEntity.indexes).toHaveLength(3)

      const addressField = productEntity.fields.find(f => f.id === 'address')
      expect(addressField?.dataType).toBe('object')
      expect(addressField?.objectFields).toHaveLength(3)
    })
  })
})
