import { describe, test, expect } from 'vitest'
import { field, enumValue, enumValues } from '../field'

describe('Field Primitives', () => {
  describe('field.string()', () => {
    test('creates string field with id and label', () => {
      const f = field.string('name', 'Name').build()
      expect(f.id).toBe('name')
      expect(f.label).toBe('Name')
      expect(f.dataType).toBe('string')
    })

    test('supports description() method', () => {
      const f = field.string('name', 'Name')
        .description('User full name')
        .build()
      expect(f.description).toBe('User full name')
    })

    test('supports defaultValue() method', () => {
      const f = field.string('status', 'Status')
        .defaultValue('active')
        .build()
      expect(f.defaultValue).toBe('active')
    })

    test('supports required() with custom message', () => {
      const f = field.string('name', 'Name')
        .required('Name is required')
        .build()
      expect(f.constraints).toBeDefined()
      expect(f.constraints?.some(c => c.type === 'required')).toBe(true)
      const requiredConstraint = f.constraints?.find(c => c.type === 'required')
      expect(requiredConstraint?.message).toBe('Name is required')
    })

    test('supports min() constraint', () => {
      const f = field.string('name', 'Name')
        .min(2, 'Minimum 2 characters')
        .build()
      const minConstraint = f.constraints?.find(c => c.type === 'min')
      expect(minConstraint).toBeDefined()
      expect(minConstraint?.value).toBe(2)
      expect(minConstraint?.message).toBe('Minimum 2 characters')
    })

    test('supports max() constraint', () => {
      const f = field.string('name', 'Name')
        .max(100, 'Maximum 100 characters')
        .build()
      const maxConstraint = f.constraints?.find(c => c.type === 'max')
      expect(maxConstraint).toBeDefined()
      expect(maxConstraint?.value).toBe(100)
    })

    test('supports pattern() constraint', () => {
      const f = field.string('email', 'Email')
        .pattern('^[a-z]+@[a-z]+\\.[a-z]+$', 'Invalid email format')
        .build()
      const patternConstraint = f.constraints?.find(c => c.type === 'pattern')
      expect(patternConstraint).toBeDefined()
      expect(patternConstraint?.value).toBe('^[a-z]+@[a-z]+\\.[a-z]+$')
    })

    test('chains multiple constraints', () => {
      const f = field.string('username', 'Username')
        .required()
        .min(3)
        .max(20)
        .pattern('^[a-zA-Z0-9_]+$')
        .build()
      expect(f.constraints?.length).toBe(4)
    })

    test('build() returns immutable field', () => {
      const builder = field.string('name', 'Name')
      const f1 = builder.build()
      const f2 = builder.required().build()
      expect(f1.constraints).toBeUndefined()
      expect(f2.constraints?.length).toBe(1)
    })
  })

  describe('field.number()', () => {
    test('creates number field', () => {
      const f = field.number('age', 'Age').build()
      expect(f.dataType).toBe('number')
      expect(f.id).toBe('age')
    })

    test('supports min/max constraints for numbers', () => {
      const f = field.number('age', 'Age')
        .min(0, 'Must be positive')
        .max(150, 'Invalid age')
        .build()
      expect(f.constraints?.length).toBe(2)
    })

    test('supports defaultValue for numbers', () => {
      const f = field.number('count', 'Count')
        .defaultValue(0)
        .build()
      expect(f.defaultValue).toBe(0)
    })
  })

  describe('field.boolean()', () => {
    test('creates boolean field', () => {
      const f = field.boolean('active', 'Active').build()
      expect(f.dataType).toBe('boolean')
    })

    test('supports defaultValue', () => {
      const f = field.boolean('enabled', 'Enabled')
        .defaultValue(true)
        .build()
      expect(f.defaultValue).toBe(true)
    })
  })

  describe('field.date()', () => {
    test('creates date field', () => {
      const f = field.date('birthDate', 'Birth Date').build()
      expect(f.dataType).toBe('date')
    })
  })

  describe('field.datetime()', () => {
    test('creates datetime field', () => {
      const f = field.datetime('createdAt', 'Created At').build()
      expect(f.dataType).toBe('datetime')
    })
  })

  describe('field.enum()', () => {
    test('creates enum field with values', () => {
      const values = [
        enumValue('ACTIVE', 'Active'),
        enumValue('INACTIVE', 'Inactive'),
      ]
      const f = field.enum('status', 'Status', values).build()
      expect(f.dataType).toBe('enum')
      expect(f.enumValues).toEqual(values)
    })

    test('supports required constraint', () => {
      const values = [enumValue('A', 'A'), enumValue('B', 'B')]
      const f = field.enum('type', 'Type', values)
        .required()
        .build()
      expect(f.constraints?.some(c => c.type === 'required')).toBe(true)
    })

    test('validates enum values structure', () => {
      const values = [
        enumValue('DRAFT', 'Draft', { description: 'Initial state' }),
        enumValue('PUBLISHED', 'Published'),
      ]
      const f = field.enum('status', 'Status', values).build()
      expect(f.enumValues?.[0].description).toBe('Initial state')
    })
  })

  describe('field.reference()', () => {
    test('creates reference field with config', () => {
      const f = field.reference('userId', 'User', {
        entity: 'user',
        displayField: 'name',
      }).build()
      expect(f.dataType).toBe('reference')
      expect(f.reference?.entity).toBe('user')
      expect(f.reference?.displayField).toBe('name')
    })

    test('supports foreignKey config', () => {
      const f = field.reference('categoryId', 'Category', {
        entity: 'category',
        displayField: 'title',
        foreignKey: 'id',
      }).build()
      expect(f.reference?.foreignKey).toBe('id')
    })
  })

  describe('field.array()', () => {
    test('creates array field with item type', () => {
      const f = field.array('tags', 'Tags', 'string').build()
      expect(f.dataType).toBe('array')
      expect(f.arrayItemType).toBe('string')
    })

    test('supports number item type', () => {
      const f = field.array('scores', 'Scores', 'number').build()
      expect(f.arrayItemType).toBe('number')
    })
  })

  describe('field.object()', () => {
    test('creates object field with nested fields', () => {
      const addressFields = [
        field.string('street', 'Street').build(),
        field.string('city', 'City').build(),
      ]
      const f = field.object('address', 'Address', addressFields).build()
      expect(f.dataType).toBe('object')
      expect(f.objectFields?.length).toBe(2)
    })
  })

  describe('enumValue()', () => {
    test('creates enum value with value and label', () => {
      const ev = enumValue('ACTIVE', 'Active')
      expect(ev.value).toBe('ACTIVE')
      expect(ev.label).toBe('Active')
    })

    test('supports optional description', () => {
      const ev = enumValue('DRAFT', 'Draft', { description: 'Work in progress' })
      expect(ev.description).toBe('Work in progress')
    })

    test('supports disabled flag', () => {
      const ev = enumValue('DEPRECATED', 'Deprecated', { disabled: true })
      expect(ev.disabled).toBe(true)
    })

    test('supports description and disabled options only', () => {
      // Note: The actual implementation only supports description and disabled options
      const ev = enumValue('DEPRECATED', 'Deprecated', { description: 'Old value', disabled: true })
      expect(ev.description).toBe('Old value')
      expect(ev.disabled).toBe(true)
    })
  })

  describe('enumValues()', () => {
    test('creates enum values from Record', () => {
      const values = enumValues({
        ACTIVE: 'Active',
        INACTIVE: 'Inactive',
        PENDING: 'Pending',
      })
      expect(values).toHaveLength(3)
      expect(values[0].value).toBe('ACTIVE')
      expect(values[0].label).toBe('Active')
    })
  })

  describe('constraint()', () => {
    test('adds custom constraint', () => {
      const f = field.string('code', 'Code')
        .constraint({ type: 'custom', value: 'uniqueCode', message: 'Must be unique' })
        .build()
      const customConstraint = f.constraints?.find(c => c.type === 'custom')
      expect(customConstraint).toBeDefined()
      expect(customConstraint?.value).toBe('uniqueCode')
    })
  })

  describe('Builder immutability', () => {
    test('each method returns new builder instance', () => {
      const builder1 = field.string('name', 'Name')
      const builder2 = builder1.required()
      const builder3 = builder2.min(1)

      const f1 = builder1.build()
      const f2 = builder2.build()
      const f3 = builder3.build()

      expect(f1.constraints).toBeUndefined()
      expect(f2.constraints?.length).toBe(1)
      expect(f3.constraints?.length).toBe(2)
    })
  })
})
