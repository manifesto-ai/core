/**
 * Form Generator Tests
 */

import { describe, it, expect, vi } from 'vitest'
import type { EntitySchema } from '@manifesto-ai/schema'
import { formGenerator, type FormGeneratorInput } from '../../generators/form'
import type { AIClient } from '../../core/client'
import type { GeneratorContext } from '../../types'

// Mock EntitySchema
const mockEntity: EntitySchema = {
  _type: 'entity',
  id: 'user',
  name: 'User',
  version: '0.1.0',
  fields: [
    { id: 'id', type: 'uuid', label: 'ID', required: true },
    { id: 'name', type: 'string', label: 'Name', required: true },
    { id: 'email', type: 'email', label: 'Email', required: true },
    { id: 'age', type: 'number', label: 'Age', required: false },
    {
      id: 'role',
      type: 'enum',
      label: 'Role',
      required: true,
      enumValues: [
        { value: 'admin', label: 'Admin' },
        { value: 'user', label: 'User' },
      ],
    },
    { id: 'bio', type: 'text', label: 'Biography', required: false },
    { id: 'active', type: 'boolean', label: 'Active', required: true },
  ],
}

// Mock AI response
const mockFormViewResponse = {
  id: 'user-form',
  name: 'User Form',
  description: 'Form for creating users',
  mode: 'create' as const,
  sections: [
    {
      id: 'section-basic',
      title: 'Basic Information',
      description: 'Enter basic user information',
      order: 1,
      columns: 2,
      fields: [
        {
          id: 'field-name',
          entityFieldId: 'name',
          component: 'text-input',
          label: 'Name',
          placeholder: 'Enter name',
          order: 1,
          colSpan: 1,
        },
        {
          id: 'field-email',
          entityFieldId: 'email',
          component: 'text-input',
          label: 'Email',
          placeholder: 'Enter email',
          order: 2,
          colSpan: 1,
        },
        {
          id: 'field-age',
          entityFieldId: 'age',
          component: 'number-input',
          label: 'Age',
          order: 3,
          colSpan: 1,
        },
        {
          id: 'field-role',
          entityFieldId: 'role',
          component: 'select',
          label: 'Role',
          order: 4,
          colSpan: 1,
        },
      ],
    },
    {
      id: 'section-additional',
      title: 'Additional Information',
      order: 2,
      columns: 1,
      collapsible: true,
      fields: [
        {
          id: 'field-bio',
          entityFieldId: 'bio',
          component: 'textarea',
          label: 'Biography',
          helpText: 'Tell us about yourself',
          order: 1,
          colSpan: 1,
        },
        {
          id: 'field-active',
          entityFieldId: 'active',
          component: 'toggle',
          label: 'Active',
          order: 2,
          colSpan: 1,
        },
      ],
    },
  ],
  submitLabel: 'Create User',
  cancelLabel: 'Cancel',
}

// Create mock client
const createMockClient = (response: unknown): AIClient => ({
  generateObject: vi.fn().mockResolvedValue({
    _tag: 'Ok',
    value: {
      value: response,
      metadata: {
        tokenUsage: { promptTokens: 100, completionTokens: 80, totalTokens: 180 },
        finishReason: 'stop' as const,
        durationMs: 1200,
      },
    },
  }),
  generateText: vi.fn(),
  generateWithTools: vi.fn(),
})

describe('Form Generator', () => {
  describe('formGenerator', () => {
    it('should have correct tag', () => {
      expect(formGenerator._tag).toBe('FormGenerator')
    })

    it('should generate FormView from EntitySchema in create mode', async () => {
      const client = createMockClient(mockFormViewResponse)
      const context: GeneratorContext = {}

      const input: FormGeneratorInput = {
        entity: mockEntity,
        mode: 'create',
      }

      const result = await formGenerator.generate(input, context, client)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        const formView = result.value.value
        expect(formView._type).toBe('view')
        expect(formView.mode).toBe('create')
        expect(formView.entityRef).toBe('user')
        expect(formView.sections.length).toBe(2)
        expect(formView.layout?.type).toBe('form')
      }
    })

    it('should generate FormView in edit mode', async () => {
      const editResponse = {
        ...mockFormViewResponse,
        id: 'user-edit-form',
        name: 'Edit User',
        mode: 'edit' as const,
        submitLabel: 'Save Changes',
      }

      const client = createMockClient(editResponse)
      const context: GeneratorContext = {}

      const input: FormGeneratorInput = {
        entity: mockEntity,
        mode: 'edit',
      }

      const result = await formGenerator.generate(input, context, client)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        const formView = result.value.value
        expect(formView.mode).toBe('edit')
        expect(formView.footer?.actions?.find((a) => a.id === 'submit')?.label).toBe('Save Changes')
      }
    })

    it('should include sections with proper layout', async () => {
      const client = createMockClient(mockFormViewResponse)
      const context: GeneratorContext = {}

      const input: FormGeneratorInput = {
        entity: mockEntity,
        mode: 'create',
        columnsPerSection: 2,
      }

      const result = await formGenerator.generate(input, context, client)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        const formView = result.value.value
        const basicSection = formView.sections.find((s) => s.id === 'section-basic')
        expect(basicSection?.layout?.columns).toBe(2)
        expect(basicSection?.fields.length).toBeGreaterThan(0)
      }
    })

    it('should return error for entity without fields', async () => {
      const client = createMockClient(mockFormViewResponse)
      const context: GeneratorContext = {}

      const emptyEntity: EntitySchema = {
        _type: 'entity',
        id: 'empty',
        name: 'Empty',
        version: '0.1.0',
        fields: [],
      }

      const input: FormGeneratorInput = {
        entity: emptyEntity,
        mode: 'create',
      }

      const result = await formGenerator.generate(input, context, client)

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error._type).toBe('INVALID_INPUT')
      }
    })

    it('should validate field entityFieldIds exist in entity', async () => {
      const invalidResponse = {
        ...mockFormViewResponse,
        sections: [
          {
            id: 'section-invalid',
            title: 'Invalid',
            order: 1,
            fields: [
              {
                id: 'field-invalid',
                entityFieldId: 'nonexistent',
                component: 'text-input',
                label: 'Invalid',
                order: 1,
              },
            ],
          },
        ],
      }

      const client = createMockClient(invalidResponse)
      const context: GeneratorContext = {}

      const input: FormGeneratorInput = {
        entity: mockEntity,
        mode: 'create',
      }

      const result = await formGenerator.generate(input, context, client)

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error._type).toBe('SCHEMA_VALIDATION_ERROR')
      }
    })

    it('should detect duplicate field IDs across sections', async () => {
      const duplicateResponse = {
        ...mockFormViewResponse,
        sections: [
          {
            id: 'section-1',
            title: 'Section 1',
            order: 1,
            fields: [
              {
                id: 'duplicate-field',
                entityFieldId: 'name',
                component: 'text-input',
                label: 'Name',
                order: 1,
              },
            ],
          },
          {
            id: 'section-2',
            title: 'Section 2',
            order: 2,
            fields: [
              {
                id: 'duplicate-field', // Same ID
                entityFieldId: 'email',
                component: 'text-input',
                label: 'Email',
                order: 1,
              },
            ],
          },
        ],
      }

      const client = createMockClient(duplicateResponse)
      const context: GeneratorContext = {}

      const input: FormGeneratorInput = {
        entity: mockEntity,
        mode: 'create',
      }

      const result = await formGenerator.generate(input, context, client)

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error._type).toBe('SCHEMA_VALIDATION_ERROR')
      }
    })

    it('should include footer with submit and cancel actions', async () => {
      const client = createMockClient(mockFormViewResponse)
      const context: GeneratorContext = {}

      const input: FormGeneratorInput = {
        entity: mockEntity,
        mode: 'create',
      }

      const result = await formGenerator.generate(input, context, client)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        const formView = result.value.value
        const actions = formView.footer?.actions ?? []
        expect(actions.length).toBe(2)
        expect(actions.some((a) => a.id === 'submit')).toBe(true)
        expect(actions.some((a) => a.id === 'cancel')).toBe(true)
      }
    })

    it('should handle collapsible sections', async () => {
      const client = createMockClient(mockFormViewResponse)
      const context: GeneratorContext = {}

      const input: FormGeneratorInput = {
        entity: mockEntity,
        mode: 'create',
      }

      const result = await formGenerator.generate(input, context, client)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        const formView = result.value.value
        const additionalSection = formView.sections.find((s) => s.id === 'section-additional')
        expect(additionalSection?.collapsible).toBe(true)
      }
    })
  })

  describe('formGenerator monadic operations', () => {
    it('should map output', async () => {
      const client = createMockClient(mockFormViewResponse)
      const context: GeneratorContext = {}

      const mappedGenerator = formGenerator.map((formView) => ({
        formId: formView.id,
        sectionCount: formView.sections.length,
        fieldCount: formView.sections.reduce((acc, s) => acc + s.fields.length, 0),
      }))

      const input: FormGeneratorInput = {
        entity: mockEntity,
        mode: 'create',
      }

      const result = await mappedGenerator.generate(input, context, client)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.value).toHaveProperty('formId')
        expect(result.value.value).toHaveProperty('sectionCount', 2)
        expect(result.value.value).toHaveProperty('fieldCount', 6)
      }
    })

    it('should customize options with withOptions', async () => {
      const customGenerator = formGenerator.withOptions({
        temperature: 0.2,
        validate: false,
      })

      expect(customGenerator.options.temperature).toBe(0.2)
      expect(customGenerator.options.validate).toBe(false)
    })

    it('should customize context with withContext', async () => {
      const customGenerator = formGenerator.withContext({
        industry: { type: 'healthcare' },
      })

      // Generator should maintain its tag after context customization
      expect(customGenerator._tag).toBe('FormGenerator')
    })
  })
})
