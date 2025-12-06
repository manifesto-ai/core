import { describe, test, expect } from 'vitest'
import {
  api,
  transform,
  condition,
  parallel,
  setState,
  navigate,
  adapter,
  type ApiCallBuilder,
} from '../action'

describe('Action Primitives', () => {
  describe('API Call Builder', () => {
    test('api.get() creates GET request', () => {
      const step = api.get('fetchUser', '/api/users/:id').build()
      expect(step._step).toBe('apiCall')
      expect(step.id).toBe('fetchUser')
      expect(step.endpoint).toBe('/api/users/:id')
      expect(step.method).toBe('GET')
    })

    test('api.post() creates POST request', () => {
      const step = api.post('createUser', '/api/users').build()
      expect(step.method).toBe('POST')
    })

    test('api.put() creates PUT request', () => {
      const step = api.put('updateUser', '/api/users/:id').build()
      expect(step.method).toBe('PUT')
    })

    test('api.patch() creates PATCH request', () => {
      const step = api.patch('patchUser', '/api/users/:id').build()
      expect(step.method).toBe('PATCH')
    })

    test('api.delete() creates DELETE request', () => {
      const step = api.delete('deleteUser', '/api/users/:id').build()
      expect(step.method).toBe('DELETE')
    })

    test('headers() sets request headers', () => {
      const step = api.post('createUser', '/api/users')
        .headers({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $context.token',
        })
        .build()
      expect(step.headers).toEqual({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $context.token',
      })
    })

    test('body() sets request body object', () => {
      const step = api.post('createUser', '/api/users')
        .body({ name: '$state.name', email: '$state.email' })
        .build()
      expect(step.body).toEqual({ name: '$state.name', email: '$state.email' })
    })

    test('body() sets request body expression', () => {
      const step = api.post('createUser', '/api/users')
        .body('$state.formData')
        .build()
      expect(step.body).toBe('$state.formData')
    })

    test('adapter() sets adapter config', () => {
      const adapterConfig = adapter.legacy(
        { steps: [transform.rename('rename1', { userName: 'name' })] }
      )
      const step = api.post('createUser', '/api/legacy/users')
        .adapter(adapterConfig)
        .build()
      expect(step.adapter).toBe(adapterConfig)
    })

    test('outputAs() sets output key', () => {
      const step = api.get('fetchUser', '/api/users/:id')
        .outputAs('userData')
        .build()
      expect(step.outputKey).toBe('userData')
    })

    test('method chaining works correctly', () => {
      const step = api.post('createProduct', '/api/products')
        .headers({ 'Authorization': 'Bearer $context.token' })
        .body({ name: '$state.name', floors: '$state.floors' })
        .outputAs('createdProduct')
        .build()

      expect(step.method).toBe('POST')
      expect(step.endpoint).toBe('/api/products')
      expect(step.headers?.Authorization).toBe('Bearer $context.token')
      expect(step.body).toEqual({ name: '$state.name', floors: '$state.floors' })
      expect(step.outputKey).toBe('createdProduct')
    })
  })

  describe('Builder Immutability', () => {
    test('each method returns new builder instance', () => {
      const builder1 = api.get('fetch', '/api/data')
      const builder2 = builder1.headers({ 'X-Custom': 'value' })
      const builder3 = builder2.outputAs('result')

      const s1 = builder1.build()
      const s2 = builder2.build()
      const s3 = builder3.build()

      expect(s1.headers).toBeUndefined()
      expect(s2.headers).toEqual({ 'X-Custom': 'value' })
      expect(s2.outputKey).toBeUndefined()
      expect(s3.outputKey).toBe('result')
    })
  })

  describe('Transform Steps', () => {
    test('transform.map() creates map operation', () => {
      const step = transform.map('mapItems', {
        expression: ['CONCAT', '$item.firstName', ' ', '$item.lastName']
      })
      expect(step._step).toBe('transform')
      expect(step.id).toBe('mapItems')
      expect(step.operation).toBe('map')
      expect(step.config).toBeDefined()
    })

    test('transform.filter() creates filter operation', () => {
      const step = transform.filter('filterActive', {
        condition: ['==', '$item.status', 'active']
      })
      expect(step.operation).toBe('filter')
    })

    test('transform.reduce() creates reduce operation', () => {
      const step = transform.reduce('sumTotal', {
        initialValue: 0,
        expression: ['+', '$acc', '$item.amount']
      })
      expect(step.operation).toBe('reduce')
    })

    test('transform.pick() creates pick operation with fields', () => {
      const step = transform.pick('pickFields', ['id', 'name', 'email'])
      expect(step.operation).toBe('pick')
      expect(step.config).toEqual({ fields: ['id', 'name', 'email'] })
    })

    test('transform.omit() creates omit operation with fields', () => {
      const step = transform.omit('omitFields', ['password', 'internalId'])
      expect(step.operation).toBe('omit')
      expect(step.config).toEqual({ fields: ['password', 'internalId'] })
    })

    test('transform.rename() creates rename operation with mapping', () => {
      const step = transform.rename('renameFields', {
        user_name: 'userName',
        user_email: 'userEmail',
      })
      expect(step.operation).toBe('rename')
      expect(step.config).toEqual({
        mapping: {
          user_name: 'userName',
          user_email: 'userEmail',
        }
      })
    })

    test('transform.custom() creates custom operation', () => {
      const step = transform.custom('customTransform', {
        handler: 'myCustomHandler',
        options: { keepOriginal: true }
      })
      expect(step.operation).toBe('custom')
      expect(step.config.handler).toBe('myCustomHandler')
    })
  })

  describe('Condition Step', () => {
    test('condition() creates condition step with then branch', () => {
      const step = condition(
        'checkAuth',
        ['==', '$context.isAuthenticated', true],
        [api.get('fetchData', '/api/data').build()]
      )
      expect(step._step).toBe('condition')
      expect(step.id).toBe('checkAuth')
      expect(step.condition).toEqual(['==', '$context.isAuthenticated', true])
      expect(step.then).toHaveLength(1)
      expect(step.else).toBeUndefined()
    })

    test('condition() creates condition step with then and else branches', () => {
      const step = condition(
        'checkRole',
        ['==', '$user.role', 'admin'],
        [api.get('fetchAdminData', '/api/admin/data').build()],
        [api.get('fetchUserData', '/api/user/data').build()]
      )
      expect(step.then).toHaveLength(1)
      expect(step.else).toHaveLength(1)
    })

    test('condition() with multiple steps in branches', () => {
      const step = condition(
        'processOrder',
        ['>', '$state.total', 1000],
        [
          api.post('applyDiscount', '/api/discount').build(),
          setState('setDiscounted', { hasDiscount: true }),
        ],
        [
          setState('setNoDiscount', { hasDiscount: false }),
        ]
      )
      expect(step.then).toHaveLength(2)
      expect(step.else).toHaveLength(1)
    })

    test('nested condition steps', () => {
      const innerCondition = condition(
        'innerCheck',
        ['>', '$state.amount', 100],
        [setState('setHigh', { level: 'high' })],
        [setState('setLow', { level: 'low' })]
      )

      const outerCondition = condition(
        'outerCheck',
        ['==', '$state.enabled', true],
        [innerCondition],
        []
      )

      expect(outerCondition.then[0]._step).toBe('condition')
    })
  })

  describe('Parallel Step', () => {
    test('parallel.all() creates all mode', () => {
      const step = parallel.all('fetchAll', [
        api.get('fetchUsers', '/api/users').build(),
        api.get('fetchPosts', '/api/posts').build(),
        api.get('fetchComments', '/api/comments').build(),
      ])
      expect(step._step).toBe('parallel')
      expect(step.id).toBe('fetchAll')
      expect(step.mode).toBe('all')
      expect(step.steps).toHaveLength(3)
    })

    test('parallel.race() creates race mode', () => {
      const step = parallel.race('raceApis', [
        api.get('fetchPrimary', '/api/primary').build(),
        api.get('fetchBackup', '/api/backup').build(),
      ])
      expect(step.mode).toBe('race')
    })

    test('parallel.allSettled() creates allSettled mode', () => {
      const step = parallel.allSettled('fetchWithErrors', [
        api.get('fetch1', '/api/endpoint1').build(),
        api.get('fetch2', '/api/endpoint2').build(),
      ])
      expect(step.mode).toBe('allSettled')
    })

    test('parallel can contain different step types', () => {
      const step = parallel.all('mixedSteps', [
        api.get('fetchData', '/api/data').build(),
        transform.pick('pickData', ['id', 'name']),
        setState('setLoading', { loading: false }),
      ])
      expect(step.steps).toHaveLength(3)
      expect(step.steps[0]._step).toBe('apiCall')
      expect(step.steps[1]._step).toBe('transform')
      expect(step.steps[2]._step).toBe('setState')
    })
  })

  describe('SetState Step', () => {
    test('setState() creates setState step with literal values', () => {
      const step = setState('setValues', {
        isLoading: false,
        error: null,
        count: 0,
      })
      expect(step._step).toBe('setState')
      expect(step.id).toBe('setValues')
      expect(step.updates.isLoading).toBe(false)
      expect(step.updates.error).toBe(null)
      expect(step.updates.count).toBe(0)
    })

    test('setState() with expression values', () => {
      const step = setState('computeValues', {
        total: ['*', '$state.price', '$state.quantity'],
        formatted: ['CONCAT', '$', ['ROUND', '$state.total', 2]],
      })
      expect(step.updates.total).toEqual(['*', '$state.price', '$state.quantity'])
    })

    test('setState() with mixed values', () => {
      const step = setState('updateForm', {
        submitted: true,
        timestamp: ['NOW'],
        message: 'Form submitted successfully',
      })
      expect(step.updates.submitted).toBe(true)
      expect(step.updates.timestamp).toEqual(['NOW'])
      expect(step.updates.message).toBe('Form submitted successfully')
    })
  })

  describe('Navigate Step', () => {
    test('navigate() creates navigation step with path only', () => {
      const step = navigate('goHome', '/')
      expect(step._step).toBe('navigation')
      expect(step.id).toBe('goHome')
      expect(step.path).toBe('/')
      expect(step.params).toBeUndefined()
      expect(step.replace).toBeUndefined()
    })

    test('navigate() with params', () => {
      const step = navigate('goToUser', '/users/:id', {
        params: { id: '$state.userId' }
      })
      expect(step.params).toEqual({ id: '$state.userId' })
    })

    test('navigate() with replace option', () => {
      const step = navigate('replaceRoute', '/dashboard', {
        replace: true
      })
      expect(step.replace).toBe(true)
    })

    test('navigate() with params and replace', () => {
      const step = navigate('redirectToDetail', '/items/:id/detail', {
        params: { id: '$state.itemId' },
        replace: true
      })
      expect(step.params).toEqual({ id: '$state.itemId' })
      expect(step.replace).toBe(true)
    })
  })

  describe('Adapter Helpers', () => {
    test('adapter.legacy() creates legacy adapter', () => {
      const config = adapter.legacy()
      expect(config.type).toBe('legacy')
      expect(config.requestTransform).toBeUndefined()
      expect(config.responseTransform).toBeUndefined()
    })

    test('adapter.legacy() with request transform', () => {
      const config = adapter.legacy(
        { steps: [transform.rename('renameReq', { name: 'fullName' })] }
      )
      expect(config.requestTransform?.steps).toHaveLength(1)
    })

    test('adapter.legacy() with response transform', () => {
      const config = adapter.legacy(
        undefined,
        { steps: [transform.pick('pickResp', ['data', 'meta'])] }
      )
      expect(config.responseTransform?.steps).toHaveLength(1)
    })

    test('adapter.legacy() with both transforms', () => {
      const config = adapter.legacy(
        { steps: [transform.rename('renameReq', { name: 'fullName' })] },
        { steps: [transform.pick('pickResp', ['data'])] }
      )
      expect(config.requestTransform?.steps).toHaveLength(1)
      expect(config.responseTransform?.steps).toHaveLength(1)
    })

    test('adapter.graphql() creates graphql adapter', () => {
      const config = adapter.graphql()
      expect(config.type).toBe('graphql')
    })

    test('adapter.graphql() with transforms', () => {
      const config = adapter.graphql(
        { steps: [transform.custom('buildQuery', { queryTemplate: 'mutation CreateUser' })] },
        { steps: [transform.pick('extractData', ['data.createUser'])] }
      )
      expect(config.type).toBe('graphql')
      expect(config.requestTransform?.steps).toHaveLength(1)
      expect(config.responseTransform?.steps).toHaveLength(1)
    })

    test('adapter.soap() creates soap adapter', () => {
      const config = adapter.soap()
      expect(config.type).toBe('soap')
    })

    test('adapter.soap() with transforms', () => {
      const config = adapter.soap(
        { steps: [transform.custom('buildEnvelope', { action: 'CreateUser' })] },
        { steps: [transform.custom('parseEnvelope', {})] }
      )
      expect(config.type).toBe('soap')
      expect(config.requestTransform?.steps).toHaveLength(1)
    })
  })

  describe('Complex Action Scenarios', () => {
    test('creates form submission pipeline', () => {
      const submitPipeline = [
        setState('setSubmitting', { isSubmitting: true, error: null }),
        api.post('submitForm', '/api/forms')
          .headers({ 'Content-Type': 'application/json' })
          .body('$state.formData')
          .outputAs('submitResult')
          .build(),
        condition(
          'checkSuccess',
          ['==', '$result.submitResult.success', true],
          [
            setState('setSuccess', { isSubmitting: false, submitted: true }),
            navigate('goToSuccess', '/success'),
          ],
          [
            setState('setError', {
              isSubmitting: false,
              error: '$result.submitResult.error'
            }),
          ]
        ),
      ]

      expect(submitPipeline).toHaveLength(3)
      expect(submitPipeline[0]._step).toBe('setState')
      expect(submitPipeline[1]._step).toBe('apiCall')
      expect(submitPipeline[2]._step).toBe('condition')
    })

    test('creates data aggregation pipeline', () => {
      const aggregatePipeline = [
        parallel.all('fetchData', [
          api.get('fetchUsers', '/api/users').outputAs('users').build(),
          api.get('fetchOrders', '/api/orders').outputAs('orders').build(),
        ]),
        transform.map('mapData', {
          expression: {
            userId: '$item.id',
            orderCount: ['LENGTH', ['FILTER', '$orders', ['==', '$order.userId', '$item.id']]]
          }
        }),
        setState('setAggregated', { aggregatedData: '$result.mapData' }),
      ]

      expect(aggregatePipeline[0]._step).toBe('parallel')
      expect(aggregatePipeline[1]._step).toBe('transform')
      expect(aggregatePipeline[2]._step).toBe('setState')
    })

    test('creates legacy API integration', () => {
      const legacyApiCall = api.post('createLegacyUser', '/api/v1/legacy/users')
        .adapter(adapter.legacy(
          {
            steps: [
              transform.rename('req', { firstName: 'first_name', lastName: 'last_name' }),
              transform.pick('reqPick', ['first_name', 'last_name', 'email']),
            ]
          },
          {
            steps: [
              transform.rename('resp', { user_id: 'userId', created_at: 'createdAt' }),
            ]
          }
        ))
        .body({ firstName: '$state.firstName', lastName: '$state.lastName', email: '$state.email' })
        .outputAs('createdUser')
        .build()

      expect(legacyApiCall.adapter?.type).toBe('legacy')
      expect(legacyApiCall.adapter?.requestTransform?.steps).toHaveLength(2)
      expect(legacyApiCall.adapter?.responseTransform?.steps).toHaveLength(1)
    })
  })
})
