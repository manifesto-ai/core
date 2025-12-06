import { describe, test, expect } from 'vitest'
import {
  validateSchema,
  validateEntitySchema,
  validateViewSchema,
  validateActionSchema,
  entitySchemaValidator,
  viewSchemaValidator,
  actionSchemaValidator,
  type ValidationError,
} from '../schema'
import { isOk, isErr } from '../../types/result'

describe('Schema Validators', () => {
  describe('Entity Schema Validation', () => {
    test('validates valid entity schema', () => {
      const entityData = {
        _type: 'entity',
        id: 'user',
        version: '1.0.0',
        name: 'User',
        fields: [
          { id: 'name', dataType: 'string', label: 'Name' },
          { id: 'age', dataType: 'number', label: 'Age' },
        ],
      }

      const result = validateEntitySchema(entityData)
      expect(isOk(result)).toBe(true)
    })

    test('validates entity with all field types', () => {
      const entityData = {
        _type: 'entity',
        id: 'testEntity',
        version: '0.1.0',
        name: 'Test Entity',
        fields: [
          { id: 'stringField', dataType: 'string', label: 'String' },
          { id: 'numberField', dataType: 'number', label: 'Number' },
          { id: 'booleanField', dataType: 'boolean', label: 'Boolean' },
          { id: 'dateField', dataType: 'date', label: 'Date' },
          { id: 'datetimeField', dataType: 'datetime', label: 'Datetime' },
          {
            id: 'enumField',
            dataType: 'enum',
            label: 'Enum',
            enumValues: [
              { value: 'A', label: 'Option A' },
              { value: 'B', label: 'Option B' },
            ],
          },
          { id: 'arrayField', dataType: 'array', label: 'Array', arrayItemType: 'string' },
          {
            id: 'objectField',
            dataType: 'object',
            label: 'Object',
            objectFields: [
              { id: 'nested', dataType: 'string', label: 'Nested' },
            ],
          },
          {
            id: 'referenceField',
            dataType: 'reference',
            label: 'Reference',
            reference: { entity: 'other', displayField: 'name', valueField: 'id' },
          },
        ],
      }

      const result = validateEntitySchema(entityData)
      expect(isOk(result)).toBe(true)
    })

    test('validates entity with constraints', () => {
      const entityData = {
        _type: 'entity',
        id: 'user',
        version: '0.1.0',
        name: 'User',
        fields: [
          {
            id: 'email',
            dataType: 'string',
            label: 'Email',
            constraints: [
              { type: 'required', message: 'Email is required' },
              { type: 'pattern', value: '^[a-z]+@[a-z]+$', message: 'Invalid email' },
            ],
          },
          {
            id: 'age',
            dataType: 'number',
            label: 'Age',
            constraints: [
              { type: 'min', value: 0 },
              { type: 'max', value: 150 },
            ],
          },
        ],
      }

      const result = validateEntitySchema(entityData)
      expect(isOk(result)).toBe(true)
    })

    test('validates entity with relations', () => {
      const entityData = {
        _type: 'entity',
        id: 'user',
        version: '0.1.0',
        name: 'User',
        fields: [{ id: 'name', dataType: 'string', label: 'Name' }],
        relations: [
          { type: 'hasOne', target: 'profile', foreignKey: 'userId' },
          { type: 'hasMany', target: 'post', foreignKey: 'authorId' },
          { type: 'belongsTo', target: 'organization', foreignKey: 'orgId' },
          { type: 'manyToMany', target: 'role', through: 'user_roles' },
        ],
      }

      const result = validateEntitySchema(entityData)
      expect(isOk(result)).toBe(true)
    })

    test('validates entity with indexes', () => {
      const entityData = {
        _type: 'entity',
        id: 'user',
        version: '0.1.0',
        name: 'User',
        fields: [
          { id: 'email', dataType: 'string', label: 'Email' },
          { id: 'createdAt', dataType: 'datetime', label: 'Created At' },
        ],
        indexes: [
          { fields: ['email'], unique: true },
          { fields: ['createdAt'] },
          { fields: ['email', 'createdAt'], name: 'idx_user_email_created' },
        ],
      }

      const result = validateEntitySchema(entityData)
      expect(isOk(result)).toBe(true)
    })

    test('rejects entity with invalid version format', () => {
      const entityData = {
        _type: 'entity',
        id: 'user',
        version: 'invalid',
        name: 'User',
        fields: [],
      }

      const result = validateEntitySchema(entityData)
      expect(isErr(result)).toBe(true)
      if (isErr(result)) {
        expect(result.error.some(e => e.message.includes('Invalid version'))).toBe(true)
      }
    })

    test('rejects entity with empty id', () => {
      const entityData = {
        _type: 'entity',
        id: '',
        version: '0.1.0',
        name: 'User',
        fields: [],
      }

      const result = validateEntitySchema(entityData)
      expect(isErr(result)).toBe(true)
    })

    test('rejects entity with invalid data type', () => {
      const entityData = {
        _type: 'entity',
        id: 'user',
        version: '0.1.0',
        name: 'User',
        fields: [
          { id: 'name', dataType: 'invalid', label: 'Name' },
        ],
      }

      const result = validateEntitySchema(entityData)
      expect(isErr(result)).toBe(true)
    })

    test('rejects entity with invalid relation type', () => {
      const entityData = {
        _type: 'entity',
        id: 'user',
        version: '0.1.0',
        name: 'User',
        fields: [],
        relations: [
          { type: 'invalidRelation', target: 'post' },
        ],
      }

      const result = validateEntitySchema(entityData)
      expect(isErr(result)).toBe(true)
    })
  })

  describe('View Schema Validation', () => {
    test('validates valid view schema', () => {
      const viewData = {
        _type: 'view',
        id: 'user-create',
        version: '0.1.0',
        name: 'Create User',
        entityRef: 'user',
        mode: 'create',
        layout: { type: 'form' },
        sections: [
          {
            id: 'basic',
            layout: { type: 'form' },
            fields: [
              { id: 'nameInput', entityFieldId: 'name', component: 'text-input' },
            ],
          },
        ],
      }

      const result = validateViewSchema(viewData)
      expect(isOk(result)).toBe(true)
    })

    test('validates view with all layout types', () => {
      const layoutTypes = ['form', 'grid', 'flex', 'tabs', 'accordion', 'wizard']

      for (const layoutType of layoutTypes) {
        const viewData = {
          _type: 'view',
          id: `test-${layoutType}`,
          version: '0.1.0',
          name: 'Test View',
          entityRef: 'test',
          mode: 'create',
          layout: { type: layoutType },
          sections: [
            { id: 'section1', layout: { type: 'form' }, fields: [] },
          ],
        }

        const result = validateViewSchema(viewData)
        expect(isOk(result)).toBe(true)
      }
    })

    test('validates view with all component types', () => {
      const components = [
        'text-input', 'number-input', 'select', 'multi-select',
        'checkbox', 'radio', 'date-picker', 'datetime-picker',
        'textarea', 'rich-editor', 'file-upload', 'image-upload',
        'autocomplete', 'toggle', 'slider', 'color-picker', 'custom',
      ]

      const viewData = {
        _type: 'view',
        id: 'test-components',
        version: '0.1.0',
        name: 'Test View',
        entityRef: 'test',
        mode: 'create',
        layout: { type: 'form' },
        sections: [
          {
            id: 'section1',
            layout: { type: 'form' },
            fields: components.map((c, i) => ({
              id: `field${i}`,
              entityFieldId: `field${i}`,
              component: c,
            })),
          },
        ],
      }

      const result = validateViewSchema(viewData)
      expect(isOk(result)).toBe(true)
    })

    test('validates view with header and footer', () => {
      const viewData = {
        _type: 'view',
        id: 'user-create',
        version: '0.1.0',
        name: 'Create User',
        entityRef: 'user',
        mode: 'create',
        layout: { type: 'form' },
        sections: [{ id: 'basic', layout: { type: 'form' }, fields: [] }],
        header: {
          title: 'Create User',
          subtitle: 'Fill in the form',
          actions: [
            { id: 'help', label: 'Help', action: { type: 'custom', actionId: 'showHelp' } },
          ],
        },
        footer: {
          actions: [
            { id: 'cancel', label: 'Cancel', action: { type: 'cancel' } },
            { id: 'submit', label: 'Create', variant: 'primary', action: { type: 'submit' } },
          ],
          sticky: true,
        },
      }

      const result = validateViewSchema(viewData)
      expect(isOk(result)).toBe(true)
    })

    test('validates view with reactions', () => {
      const viewData = {
        _type: 'view',
        id: 'user-create',
        version: '0.1.0',
        name: 'Create User',
        entityRef: 'user',
        mode: 'create',
        layout: { type: 'form' },
        sections: [
          {
            id: 'basic',
            layout: { type: 'form' },
            fields: [
              {
                id: 'nameInput',
                entityFieldId: 'name',
                component: 'text-input',
                reactions: [
                  {
                    trigger: 'change',
                    condition: ['!=', '$state.name', ''],
                    actions: [
                      { type: 'setValue', target: 'computed', value: ['UPPER', '$state.name'] },
                    ],
                    debounce: 300,
                  },
                ],
              },
            ],
          },
        ],
      }

      const result = validateViewSchema(viewData)
      expect(isOk(result)).toBe(true)
    })

    test('validates view with conditional sections', () => {
      const viewData = {
        _type: 'view',
        id: 'dynamic-form',
        version: '0.1.0',
        name: 'Dynamic Form',
        entityRef: 'test',
        mode: 'create',
        layout: { type: 'form' },
        sections: [
          {
            id: 'basic',
            layout: { type: 'form' },
            fields: [],
          },
          {
            id: 'conditional',
            layout: { type: 'form' },
            fields: [],
            visible: ['==', '$state.showSection', true],
            collapsible: true,
            collapsed: false,
          },
        ],
      }

      const result = validateViewSchema(viewData)
      expect(isOk(result)).toBe(true)
    })

    test('rejects view with invalid mode', () => {
      const viewData = {
        _type: 'view',
        id: 'test',
        version: '0.1.0',
        name: 'Test',
        entityRef: 'test',
        mode: 'invalid',
        layout: { type: 'form' },
        sections: [],
      }

      const result = validateViewSchema(viewData)
      expect(isErr(result)).toBe(true)
    })

    test('rejects view with invalid component type', () => {
      const viewData = {
        _type: 'view',
        id: 'test',
        version: '0.1.0',
        name: 'Test',
        entityRef: 'test',
        mode: 'create',
        layout: { type: 'form' },
        sections: [
          {
            id: 'section1',
            layout: { type: 'form' },
            fields: [
              { id: 'field1', entityFieldId: 'field1', component: 'invalid-component' },
            ],
          },
        ],
      }

      const result = validateViewSchema(viewData)
      expect(isErr(result)).toBe(true)
    })

    test('rejects view with invalid reaction trigger', () => {
      const viewData = {
        _type: 'view',
        id: 'test',
        version: '0.1.0',
        name: 'Test',
        entityRef: 'test',
        mode: 'create',
        layout: { type: 'form' },
        sections: [
          {
            id: 'section1',
            layout: { type: 'form' },
            fields: [
              {
                id: 'field1',
                entityFieldId: 'field1',
                component: 'text-input',
                reactions: [
                  { trigger: 'invalidTrigger', actions: [] },
                ],
              },
            ],
          },
        ],
      }

      const result = validateViewSchema(viewData)
      expect(isErr(result)).toBe(true)
    })
  })

  describe('Action Schema Validation', () => {
    test('validates valid action schema', () => {
      const actionData = {
        _type: 'action',
        id: 'createUser',
        version: '0.1.0',
        name: 'Create User',
        trigger: { type: 'manual' },
        steps: [
          {
            _step: 'apiCall',
            id: 'callApi',
            endpoint: '/api/users',
            method: 'POST',
          },
        ],
      }

      const result = validateActionSchema(actionData)
      expect(isOk(result)).toBe(true)
    })

    test('validates action with all trigger types', () => {
      const triggers = [
        { type: 'manual' },
        { type: 'event', event: 'userCreated' },
        { type: 'schedule', cron: '0 0 * * *' },
      ]

      for (const trigger of triggers) {
        const actionData = {
          _type: 'action',
          id: 'testAction',
          version: '0.1.0',
          name: 'Test Action',
          trigger,
          steps: [],
        }

        const result = validateActionSchema(actionData)
        expect(isOk(result)).toBe(true)
      }
    })

    test('validates action with all step types', () => {
      const actionData = {
        _type: 'action',
        id: 'complexAction',
        version: '0.1.0',
        name: 'Complex Action',
        trigger: { type: 'manual' },
        steps: [
          {
            _step: 'apiCall',
            id: 'fetchData',
            endpoint: '/api/data',
            method: 'GET',
            headers: { 'Authorization': 'Bearer token' },
          },
          {
            _step: 'transform',
            id: 'transformData',
            operation: 'map',
            config: { expression: '$item' },
          },
          {
            _step: 'setState',
            id: 'setData',
            updates: { data: '$result.transformData' },
          },
          {
            _step: 'navigation',
            id: 'navigate',
            path: '/success',
            params: { id: '123' },
          },
        ],
      }

      const result = validateActionSchema(actionData)
      expect(isOk(result)).toBe(true)
    })

    test('validates action with condition step', () => {
      const actionData = {
        _type: 'action',
        id: 'conditionalAction',
        version: '0.1.0',
        name: 'Conditional Action',
        trigger: { type: 'manual' },
        steps: [
          {
            _step: 'condition',
            id: 'checkAuth',
            condition: ['==', '$context.isAuthenticated', true],
            then: [
              { _step: 'navigation', id: 'goToDashboard', path: '/dashboard' },
            ],
            else: [
              { _step: 'navigation', id: 'goToLogin', path: '/login' },
            ],
          },
        ],
      }

      const result = validateActionSchema(actionData)
      expect(isOk(result)).toBe(true)
    })

    test('validates action with parallel step', () => {
      const actionData = {
        _type: 'action',
        id: 'parallelAction',
        version: '0.1.0',
        name: 'Parallel Action',
        trigger: { type: 'manual' },
        steps: [
          {
            _step: 'parallel',
            id: 'fetchAll',
            mode: 'all',
            steps: [
              { _step: 'apiCall', id: 'fetch1', endpoint: '/api/1', method: 'GET' },
              { _step: 'apiCall', id: 'fetch2', endpoint: '/api/2', method: 'GET' },
            ],
          },
        ],
      }

      const result = validateActionSchema(actionData)
      expect(isOk(result)).toBe(true)
    })

    test('validates action with rollback and options', () => {
      const actionData = {
        _type: 'action',
        id: 'actionWithRollback',
        version: '0.1.0',
        name: 'Action with Rollback',
        trigger: { type: 'manual' },
        steps: [
          { _step: 'apiCall', id: 'createItem', endpoint: '/api/items', method: 'POST' },
        ],
        rollback: [
          { _step: 'apiCall', id: 'deleteItem', endpoint: '/api/items/:id', method: 'DELETE' },
        ],
        timeout: 30000,
        retries: 3,
      }

      const result = validateActionSchema(actionData)
      expect(isOk(result)).toBe(true)
    })

    test('validates action with adapter config', () => {
      const actionData = {
        _type: 'action',
        id: 'legacyAction',
        version: '0.1.0',
        name: 'Legacy Action',
        trigger: { type: 'manual' },
        steps: [
          {
            _step: 'apiCall',
            id: 'callLegacy',
            endpoint: '/api/legacy',
            method: 'POST',
            adapter: {
              type: 'legacy',
              requestTransform: {
                steps: [
                  { _step: 'transform', id: 'rename', operation: 'rename', config: { mapping: { name: 'full_name' } } },
                ],
              },
            },
          },
        ],
      }

      const result = validateActionSchema(actionData)
      expect(isOk(result)).toBe(true)
    })

    test('rejects action with invalid method', () => {
      const actionData = {
        _type: 'action',
        id: 'invalidAction',
        version: '0.1.0',
        name: 'Invalid Action',
        trigger: { type: 'manual' },
        steps: [
          { _step: 'apiCall', id: 'call', endpoint: '/api', method: 'INVALID' },
        ],
      }

      const result = validateActionSchema(actionData)
      expect(isErr(result)).toBe(true)
    })

    test('rejects action with invalid step type', () => {
      const actionData = {
        _type: 'action',
        id: 'invalidAction',
        version: '0.1.0',
        name: 'Invalid Action',
        trigger: { type: 'manual' },
        steps: [
          { _step: 'invalidStep', id: 'step1' },
        ],
      }

      const result = validateActionSchema(actionData)
      expect(isErr(result)).toBe(true)
    })

    test('rejects action with invalid transform operation', () => {
      const actionData = {
        _type: 'action',
        id: 'invalidAction',
        version: '0.1.0',
        name: 'Invalid Action',
        trigger: { type: 'manual' },
        steps: [
          { _step: 'transform', id: 't1', operation: 'invalidOp', config: {} },
        ],
      }

      const result = validateActionSchema(actionData)
      expect(isErr(result)).toBe(true)
    })
  })

  describe('Unified Schema Validation', () => {
    test('validates entity via unified validator', () => {
      const entityData = {
        _type: 'entity',
        id: 'user',
        version: '0.1.0',
        name: 'User',
        fields: [],
      }

      const result = validateSchema(entityData)
      expect(isOk(result)).toBe(true)
      if (isOk(result)) {
        expect(result.value._type).toBe('entity')
      }
    })

    test('validates view via unified validator', () => {
      const viewData = {
        _type: 'view',
        id: 'user-create',
        version: '0.1.0',
        name: 'Create User',
        entityRef: 'user',
        mode: 'create',
        layout: { type: 'form' },
        sections: [],
      }

      const result = validateSchema(viewData)
      expect(isOk(result)).toBe(true)
      if (isOk(result)) {
        expect(result.value._type).toBe('view')
      }
    })

    test('validates action via unified validator', () => {
      const actionData = {
        _type: 'action',
        id: 'testAction',
        version: '0.1.0',
        name: 'Test Action',
        trigger: { type: 'manual' },
        steps: [],
      }

      const result = validateSchema(actionData)
      expect(isOk(result)).toBe(true)
      if (isOk(result)) {
        expect(result.value._type).toBe('action')
      }
    })

    test('rejects unknown schema type', () => {
      const unknownData = {
        _type: 'unknown',
        id: 'test',
        version: '0.1.0',
        name: 'Test',
      }

      const result = validateSchema(unknownData)
      expect(isErr(result)).toBe(true)
    })

    test('rejects schema without _type', () => {
      const invalidData = {
        id: 'test',
        version: '0.1.0',
        name: 'Test',
      }

      const result = validateSchema(invalidData)
      expect(isErr(result)).toBe(true)
    })
  })

  describe('Expression Validation', () => {
    test('validates literal expressions', () => {
      const viewData = {
        _type: 'view',
        id: 'test',
        version: '0.1.0',
        name: 'Test',
        entityRef: 'test',
        mode: 'create',
        layout: { type: 'form' },
        sections: [
          {
            id: 'section1',
            layout: { type: 'form' },
            fields: [],
            visible: true, // boolean literal
          },
        ],
      }

      const result = validateViewSchema(viewData)
      expect(isOk(result)).toBe(true)
    })

    test('validates context reference expressions', () => {
      const viewData = {
        _type: 'view',
        id: 'test',
        version: '0.1.0',
        name: 'Test',
        entityRef: 'test',
        mode: 'create',
        layout: { type: 'form' },
        sections: [
          {
            id: 'section1',
            layout: { type: 'form' },
            fields: [],
            visible: '$state.showSection',
          },
        ],
      }

      const result = validateViewSchema(viewData)
      expect(isOk(result)).toBe(true)
    })

    test('validates operator expressions', () => {
      const viewData = {
        _type: 'view',
        id: 'test',
        version: '0.1.0',
        name: 'Test',
        entityRef: 'test',
        mode: 'create',
        layout: { type: 'form' },
        sections: [
          {
            id: 'section1',
            layout: { type: 'form' },
            fields: [],
            visible: ['AND', ['>', '$state.count', 0], ['==', '$state.enabled', true]],
          },
        ],
      }

      const result = validateViewSchema(viewData)
      expect(isOk(result)).toBe(true)
    })

    test('validates nested operator expressions', () => {
      const actionData = {
        _type: 'action',
        id: 'test',
        version: '0.1.0',
        name: 'Test',
        trigger: { type: 'manual' },
        steps: [
          {
            _step: 'condition',
            id: 'complexCondition',
            condition: [
              'AND',
              ['>', '$state.amount', 0],
              ['OR', ['==', '$user.role', 'admin'], ['==', '$user.role', 'manager']],
              ['NOT', ['IS_EMPTY', '$state.items']],
            ],
            then: [],
          },
        ],
      }

      const result = validateActionSchema(actionData)
      expect(isOk(result)).toBe(true)
    })
  })

  describe('Validation Error Messages', () => {
    test('returns error path for nested errors', () => {
      const entityData = {
        _type: 'entity',
        id: 'user',
        version: '0.1.0',
        name: 'User',
        fields: [
          { id: '', dataType: 'string', label: 'Name' }, // empty id
        ],
      }

      const result = validateEntitySchema(entityData)
      expect(isErr(result)).toBe(true)
      if (isErr(result)) {
        const fieldError = result.error.find(e => e.path.includes('fields'))
        expect(fieldError).toBeDefined()
      }
    })

    test('returns multiple errors when multiple validations fail', () => {
      const entityData = {
        _type: 'entity',
        id: '',
        version: 'invalid',
        name: '',
        fields: [],
      }

      const result = validateEntitySchema(entityData)
      expect(isErr(result)).toBe(true)
      if (isErr(result)) {
        expect(result.error.length).toBeGreaterThan(1)
      }
    })

    test('error contains meaningful message', () => {
      const viewData = {
        _type: 'view',
        id: 'test',
        version: '0.1.0',
        name: 'Test',
        entityRef: 'test',
        mode: 'invalid',
        layout: { type: 'form' },
        sections: [],
      }

      const result = validateViewSchema(viewData)
      expect(isErr(result)).toBe(true)
      if (isErr(result)) {
        const modeError = result.error.find(e => e.path.includes('mode'))
        expect(modeError).toBeDefined()
      }
    })
  })

  describe('Complex Schema Scenarios', () => {
    test('validates complete product entity', () => {
      const productEntity = {
        _type: 'entity',
        id: 'product',
        version: '1.0.0',
        name: 'Product',
        description: 'Product information entity',
        tags: ['real-estate', 'core'],
        fields: [
          { id: 'id', dataType: 'string', label: 'ID' },
          {
            id: 'name',
            dataType: 'string',
            label: 'Name',
            constraints: [{ type: 'required' }, { type: 'min', value: 1 }, { type: 'max', value: 100 }],
          },
          {
            id: 'type',
            dataType: 'enum',
            label: 'Type',
            enumValues: [
              { value: 'RESIDENTIAL', label: 'Residential' },
              { value: 'COMMERCIAL', label: 'Commercial' },
            ],
          },
          { id: 'floors', dataType: 'number', label: 'Floors', defaultValue: 1 },
          {
            id: 'address',
            dataType: 'object',
            label: 'Address',
            objectFields: [
              { id: 'street', dataType: 'string', label: 'Street' },
              { id: 'city', dataType: 'string', label: 'City' },
            ],
          },
        ],
        relations: [
          { type: 'belongsTo', target: 'user', foreignKey: 'ownerId' },
          { type: 'hasMany', target: 'floor', foreignKey: 'productId' },
        ],
        indexes: [
          { fields: ['name'] },
          { fields: ['type', 'ownerId'] },
        ],
      }

      const result = validateEntitySchema(productEntity)
      expect(isOk(result)).toBe(true)
    })

    test('validates complete product create view', () => {
      const productView = {
        _type: 'view',
        id: 'product-create',
        version: '1.0.0',
        name: 'Create Product',
        entityRef: 'product',
        mode: 'create',
        layout: { type: 'form', columns: 2 },
        sections: [
          {
            id: 'basic',
            title: 'Basic Information',
            layout: { type: 'form' },
            fields: [
              {
                id: 'nameInput',
                entityFieldId: 'name',
                component: 'text-input',
                label: 'Product Name',
                reactions: [
                  { trigger: 'change', actions: [{ type: 'validate', targets: ['name'] }] },
                ],
              },
              { id: 'typeSelect', entityFieldId: 'type', component: 'select', label: 'Type' },
            ],
          },
          {
            id: 'details',
            title: 'Details',
            layout: { type: 'form' },
            fields: [
              { id: 'floorsInput', entityFieldId: 'floors', component: 'number-input' },
            ],
            visible: ['!=', '$state.type', null],
            collapsible: true,
          },
        ],
        header: { title: 'Create Product', subtitle: 'Enter product information' },
        footer: {
          actions: [
            { id: 'cancel', label: 'Cancel', action: { type: 'cancel' } },
            {
              id: 'submit',
              label: 'Create',
              variant: 'primary',
              action: {
                type: 'submit',
                confirm: { title: 'Create Product?', message: 'This will create a new product.' },
              },
              disabled: ['==', '$state.isValid', false],
            },
          ],
          sticky: true,
        },
      }

      const result = validateViewSchema(productView)
      expect(isOk(result)).toBe(true)
    })

    test('validates complete create product action', () => {
      const createProductAction = {
        _type: 'action',
        id: 'create-product',
        version: '1.0.0',
        name: 'Create Product',
        description: 'Creates a new product',
        tags: ['product', 'create'],
        trigger: { type: 'manual' },
        steps: [
          { _step: 'setState', id: 'setLoading', updates: { loading: true } },
          {
            _step: 'apiCall',
            id: 'createApi',
            endpoint: '/api/products',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '$state.formData',
            outputKey: 'created',
          },
          {
            _step: 'condition',
            id: 'checkResult',
            condition: ['!=', '$result.created', null],
            then: [
              { _step: 'setState', id: 'setSuccess', updates: { loading: false, success: true } },
              { _step: 'navigation', id: 'goToDetail', path: '/products/:id', params: { id: '$result.created.id' } },
            ],
            else: [
              { _step: 'setState', id: 'setError', updates: { loading: false, error: 'Failed' } },
            ],
          },
        ],
        rollback: [
          { _step: 'setState', id: 'resetState', updates: { loading: false, error: null } },
        ],
        timeout: 30000,
        retries: 1,
      }

      const result = validateActionSchema(createProductAction)
      expect(isOk(result)).toBe(true)
    })
  })
})
