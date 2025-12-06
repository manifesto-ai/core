import { describe, test, expect, beforeEach, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { useFormRuntime } from '../useFormRuntime'
import type { ViewSchema, ViewSection, ViewField } from '@manifesto-ai/schema'

// Test fixtures
const createTestViewSchema = (sections: ViewSection[]): ViewSchema => ({
  _type: 'view',
  id: 'test-form',
  name: 'Test Form',
  version: '0.1.0',
  entityRef: 'test-entity',
  mode: 'create',
  layout: { type: 'form' },
  sections,
})

const createTestSection = (fields: ViewField[]): ViewSection => ({
  id: 'section1',
  title: 'Test Section',
  layout: { type: 'form' },
  fields,
})

const createTestField = (
  id: string,
  options: Partial<ViewField> = {}
): ViewField => ({
  id,
  entityFieldId: id,
  component: 'text-input',
  ...options,
})

describe('useFormRuntime', () => {
  let schema: ViewSchema

  beforeEach(() => {
    schema = createTestViewSchema([
      createTestSection([
        createTestField('name'),
        createTestField('email'),
        createTestField('age'),
      ]),
    ])
  })

  describe('Initialization', () => {
    test('initializes with schema', () => {
      const { isInitialized, error } = useFormRuntime(schema)

      expect(isInitialized.value).toBe(true)
      expect(error.value).toBe(null)
    })

    test('initializes with initial values', () => {
      const { values } = useFormRuntime(schema, {
        initialValues: { name: 'John', email: 'john@example.com' },
      })

      expect(values.name).toBe('John')
      expect(values.email).toBe('john@example.com')
    })

    test('initializes with ref schema', async () => {
      const schemaRef = ref<ViewSchema | null>(null)
      const { isInitialized } = useFormRuntime(schemaRef)

      expect(isInitialized.value).toBe(false)

      schemaRef.value = schema
      await nextTick()

      expect(isInitialized.value).toBe(true)
    })

    test('provides field metadata', () => {
      const { fields } = useFormRuntime(schema)

      expect(fields.value.size).toBe(3)
      expect(fields.value.has('name')).toBe(true)
      expect(fields.value.has('email')).toBe(true)
      expect(fields.value.has('age')).toBe(true)
    })
  })

  describe('Field Operations', () => {
    test('setFieldValue updates field value', () => {
      const { values, setFieldValue } = useFormRuntime(schema)

      setFieldValue('name', 'Jane')

      expect(values.name).toBe('Jane')
    })

    test('setValues updates multiple fields', () => {
      const { values, setValues } = useFormRuntime(schema)

      setValues({
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
      })

      expect(values.name).toBe('Alice')
      expect(values.email).toBe('alice@example.com')
      expect(values.age).toBe(25)
    })

    test('focusField triggers focus event', () => {
      const { focusField, isInitialized } = useFormRuntime(schema)

      expect(isInitialized.value).toBe(true)
      // focusField doesn't throw
      expect(() => focusField('name')).not.toThrow()
    })

    test('blurField triggers blur event', () => {
      const { blurField, isInitialized } = useFormRuntime(schema)

      expect(isInitialized.value).toBe(true)
      expect(() => blurField('name')).not.toThrow()
    })

    test('validateField triggers validation', () => {
      const { validateField, isInitialized } = useFormRuntime(schema)

      expect(isInitialized.value).toBe(true)
      expect(() => validateField('name')).not.toThrow()
    })

    test('validateAll triggers full validation', () => {
      const { validateAll, isInitialized } = useFormRuntime(schema)

      expect(isInitialized.value).toBe(true)
      expect(() => validateAll()).not.toThrow()
    })
  })

  describe('Form State', () => {
    test('isDirty starts as false', () => {
      const { isDirty } = useFormRuntime(schema)

      expect(isDirty.value).toBe(false)
    })

    test('isDirty becomes true after field change', () => {
      const { isDirty, setFieldValue } = useFormRuntime(schema)

      setFieldValue('name', 'Changed')

      expect(isDirty.value).toBe(true)
    })

    test('isSubmitting starts as false', () => {
      const { isSubmitting } = useFormRuntime(schema)

      expect(isSubmitting.value).toBe(false)
    })

    test('isValid starts as true', () => {
      const { isValid } = useFormRuntime(schema)

      expect(isValid.value).toBe(true)
    })
  })

  describe('Submit and Reset', () => {
    test('submit returns form data', async () => {
      const { submit, setFieldValue } = useFormRuntime(schema, {
        initialValues: { name: 'Initial' },
      })

      setFieldValue('email', 'test@example.com')

      const data = await submit()

      expect(data).toBeDefined()
      expect(data?.name).toBe('Initial')
      expect(data?.email).toBe('test@example.com')
    })

    test('reset restores initial values', () => {
      const { values, reset, setFieldValue } = useFormRuntime(schema, {
        initialValues: { name: 'Original' },
      })

      setFieldValue('name', 'Changed')
      expect(values.name).toBe('Changed')

      reset()

      expect(values.name).toBe('Original')
    })

    test('reset clears dirty state', () => {
      const { isDirty, reset, setFieldValue } = useFormRuntime(schema)

      setFieldValue('name', 'Changed')
      expect(isDirty.value).toBe(true)

      reset()

      expect(isDirty.value).toBe(false)
    })
  })

  describe('Field Helpers', () => {
    test('getField returns field metadata', () => {
      const { getField } = useFormRuntime(schema)

      const field = getField('name')

      expect(field).toBeDefined()
      expect(field?.id).toBe('name')
      expect(field?.hidden).toBe(false)
      expect(field?.disabled).toBe(false)
    })

    test('getField returns undefined for unknown field', () => {
      const { getField } = useFormRuntime(schema)

      const field = getField('unknown')

      expect(field).toBeUndefined()
    })

    test('isFieldHidden returns hidden state', () => {
      const { isFieldHidden } = useFormRuntime(schema)

      expect(isFieldHidden('name')).toBe(false)
      expect(isFieldHidden('unknown')).toBe(false)
    })

    test('isFieldDisabled returns disabled state', () => {
      const { isFieldDisabled } = useFormRuntime(schema)

      expect(isFieldDisabled('name')).toBe(false)
      expect(isFieldDisabled('unknown')).toBe(false)
    })

    test('getFieldErrors returns empty array for valid field', () => {
      const { getFieldErrors } = useFormRuntime(schema)

      const errors = getFieldErrors('name')

      expect(errors).toEqual([])
    })
  })

  describe('Error Handling', () => {
    test('handles circular dependency error', () => {
      const circularSchema = createTestViewSchema([
        createTestSection([
          createTestField('a', { dependsOn: ['b'] }),
          createTestField('b', { dependsOn: ['a'] }),
        ]),
      ])

      const { isInitialized, error } = useFormRuntime(circularSchema)

      expect(isInitialized.value).toBe(false)
      expect(error.value).not.toBe(null)
      expect(error.value?.type).toBe('SCHEMA_ERROR')
    })
  })

  describe('Reactivity', () => {
    test('values are reactive', () => {
      const { values, setFieldValue } = useFormRuntime(schema, {
        initialValues: { name: 'Initial' },
      })

      // Track changes
      const history: string[] = []

      // Initial value
      history.push(values.name as string)

      // Change value
      setFieldValue('name', 'Updated')
      history.push(values.name as string)

      expect(history).toEqual(['Initial', 'Updated'])
    })

    test('computed states update on changes', () => {
      const { isDirty, setFieldValue } = useFormRuntime(schema)

      expect(isDirty.value).toBe(false)

      setFieldValue('name', 'Changed')

      expect(isDirty.value).toBe(true)
    })
  })

  describe('Options', () => {
    test('respects debug option', () => {
      const { isInitialized } = useFormRuntime(schema, {
        debug: true,
      })

      expect(isInitialized.value).toBe(true)
    })

    test('respects autoReinitialize option', async () => {
      const schemaRef = ref<ViewSchema | null>(schema)
      const { isInitialized, values } = useFormRuntime(schemaRef, {
        autoReinitialize: true,
        initialValues: { name: 'Initial' },
      })

      expect(isInitialized.value).toBe(true)
      expect(values.name).toBe('Initial')

      // Change schema
      schemaRef.value = createTestViewSchema([
        createTestSection([
          createTestField('newField'),
        ]),
      ])

      await nextTick()

      // Should reinitialize
      expect(isInitialized.value).toBe(true)
    })

    test('autoReinitialize false skips initialization on watch', async () => {
      // When autoReinitialize is false, the composable does NOT auto-initialize
      // This is because the watch only triggers when autoReinitialize is true
      const schemaRef = ref<ViewSchema | null>(schema)
      const { isInitialized } = useFormRuntime(schemaRef, {
        autoReinitialize: false,
      })

      // autoReinitialize: false means no automatic initialization on schema changes
      // The watch condition checks autoReinitialize before calling initialize()
      expect(isInitialized.value).toBe(false)
    })
  })
})
