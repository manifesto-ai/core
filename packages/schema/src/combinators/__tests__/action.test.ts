import { describe, test, expect } from 'vitest'
import {
  action,
  trigger,
  pipeline,
  condition,
  parallel,
  type ActionBuilder,
} from '../action'
import {
  api,
  transform,
  setState,
  navigate,
} from '../../primitives/action'

describe('Action Combinator', () => {
  describe('action()', () => {
    test('creates action with id, name, and default version', () => {
      const a = action('createUser', 'Create User')
        .trigger(trigger.manual())
        .build()
      expect(a._type).toBe('action')
      expect(a.id).toBe('createUser')
      expect(a.name).toBe('Create User')
      expect(a.version).toBe('0.1.0')
      expect(a.steps).toEqual([])
    })

    test('creates action with custom version', () => {
      const a = action('createUser', 'Create User', '1.0.0')
        .trigger(trigger.manual())
        .build()
      expect(a.version).toBe('1.0.0')
    })
  })

  describe('Trigger Helpers', () => {
    test('trigger.manual() creates manual trigger', () => {
      const t = trigger.manual()
      expect(t.type).toBe('manual')
    })

    test('trigger.event() creates event trigger', () => {
      const t = trigger.event('userCreated')
      expect(t.type).toBe('event')
      expect(t.event).toBe('userCreated')
    })

    test('trigger.schedule() creates schedule trigger', () => {
      const t = trigger.schedule('0 0 * * *')
      expect(t.type).toBe('schedule')
      expect(t.cron).toBe('0 0 * * *')
    })
  })

  describe('ActionBuilder Methods', () => {
    test('description() sets action description', () => {
      const a = action('createUser', 'Create User')
        .trigger(trigger.manual())
        .description('Creates a new user account')
        .build()
      expect(a.description).toBe('Creates a new user account')
    })

    test('tags() adds tags', () => {
      const a = action('createUser', 'Create User')
        .trigger(trigger.manual())
        .tags('user', 'create')
        .build()
      expect(a.tags).toEqual(['user', 'create'])
    })

    test('tags() accumulates multiple calls', () => {
      const a = action('createUser', 'Create User')
        .trigger(trigger.manual())
        .tags('user')
        .tags('create', 'v1')
        .build()
      expect(a.tags).toEqual(['user', 'create', 'v1'])
    })

    test('step() adds single step', () => {
      const a = action('fetchData', 'Fetch Data')
        .trigger(trigger.manual())
        .step(api.get('fetchUsers', '/api/users').build())
        .build()
      expect(a.steps).toHaveLength(1)
    })

    test('steps() adds multiple steps', () => {
      const a = action('processData', 'Process Data')
        .trigger(trigger.manual())
        .steps(
          api.get('fetchUsers', '/api/users').build(),
          transform.pick('pickFields', ['id', 'name']),
          setState('setUsers', { users: '$result.pickFields' })
        )
        .build()
      expect(a.steps).toHaveLength(3)
    })

    test('step() and steps() can be combined', () => {
      const a = action('processData', 'Process Data')
        .trigger(trigger.manual())
        .step(setState('setLoading', { loading: true }))
        .steps(
          api.get('fetchData', '/api/data').build(),
          transform.pick('pick', ['data'])
        )
        .step(setState('setLoading', { loading: false }))
        .build()
      expect(a.steps).toHaveLength(4)
    })

    test('rollback() adds rollback steps', () => {
      const a = action('createUser', 'Create User')
        .trigger(trigger.manual())
        .steps(
          api.post('createUser', '/api/users').build()
        )
        .rollback(
          api.delete('deleteUser', '/api/users/:id').build(),
          setState('resetState', { user: null })
        )
        .build()
      expect(a.rollback).toHaveLength(2)
    })

    test('timeout() sets timeout', () => {
      const a = action('longProcess', 'Long Process')
        .trigger(trigger.manual())
        .timeout(30000)
        .build()
      expect(a.timeout).toBe(30000)
    })

    test('retries() sets retry count', () => {
      const a = action('fetchWithRetry', 'Fetch with Retry')
        .trigger(trigger.manual())
        .retries(3)
        .build()
      expect(a.retries).toBe(3)
    })

    test('method chaining works correctly', () => {
      const a = action('complexAction', 'Complex Action', '1.0.0')
        .trigger(trigger.event('dataReady'))
        .description('A complex workflow')
        .tags('workflow', 'complex')
        .steps(
          api.get('fetchData', '/api/data').build(),
          transform.map('processData', { expression: '$item' })
        )
        .rollback(
          setState('reset', { data: null })
        )
        .timeout(60000)
        .retries(2)
        .build()

      expect(a.trigger.type).toBe('event')
      expect(a.description).toBe('A complex workflow')
      expect(a.tags).toEqual(['workflow', 'complex'])
      expect(a.steps).toHaveLength(2)
      expect(a.rollback).toHaveLength(1)
      expect(a.timeout).toBe(60000)
      expect(a.retries).toBe(2)
    })
  })

  describe('Builder Immutability', () => {
    test('each method returns new builder instance', () => {
      const builder1 = action('test', 'Test').trigger(trigger.manual())
      const builder2 = builder1.description('Description')
      const builder3 = builder2.step(api.get('fetch', '/api/data').build())

      const a1 = builder1.build()
      const a2 = builder2.build()
      const a3 = builder3.build()

      expect(a1.description).toBeUndefined()
      expect(a2.description).toBe('Description')
      expect(a2.steps).toHaveLength(0)
      expect(a3.steps).toHaveLength(1)
    })
  })

  describe('pipeline() Helper', () => {
    test('pipeline() creates array of steps', () => {
      const steps = pipeline(
        setState('setLoading', { loading: true }),
        api.get('fetchData', '/api/data').build(),
        setState('setLoading', { loading: false })
      )
      expect(steps).toHaveLength(3)
      expect(steps[0]._step).toBe('setState')
      expect(steps[1]._step).toBe('apiCall')
      expect(steps[2]._step).toBe('setState')
    })

    test('pipeline() can be used with steps()', () => {
      const fetchPipeline = pipeline(
        setState('setLoading', { loading: true }),
        api.get('fetchData', '/api/data').build(),
        setState('setLoading', { loading: false })
      )

      const a = action('fetchAction', 'Fetch Action')
        .trigger(trigger.manual())
        .steps(...fetchPipeline)
        .build()

      expect(a.steps).toHaveLength(3)
    })
  })

  describe('condition() Re-export', () => {
    test('condition() creates conditional step', () => {
      const step = condition(
        'checkAuth',
        ['==', '$context.isAuthenticated', true],
        [api.get('fetchData', '/api/secure').build()],
        [navigate('redirect', '/login')]
      )
      expect(step._step).toBe('condition')
      expect(step.then).toHaveLength(1)
      expect(step.else).toHaveLength(1)
    })
  })

  describe('parallel() Re-export', () => {
    test('parallel.all() creates parallel step', () => {
      const step = parallel.all('fetchAll', [
        api.get('fetchUsers', '/api/users').build(),
        api.get('fetchPosts', '/api/posts').build()
      ])
      expect(step._step).toBe('parallel')
      expect(step.mode).toBe('all')
      expect(step.steps).toHaveLength(2)
    })
  })

  describe('Complex Action Scenarios', () => {
    test('creates CRUD create action', () => {
      const createProductAction = action('createProduct', 'Create Product', '1.0.0')
        .trigger(trigger.manual())
        .description('Creates a new product record')
        .tags('product', 'create', 'crud')
        .steps(
          setState('setSubmitting', { isSubmitting: true, error: null }),
          api.post('createProduct', '/api/products')
            .headers({ 'Content-Type': 'application/json' })
            .body('$state.formData')
            .outputAs('createdProduct')
            .build(),
          condition(
            'checkSuccess',
            ['!=', '$result.createdProduct', null],
            [
              setState('setSuccess', { isSubmitting: false, created: true }),
              navigate('goToDetail', '/products/:id', {
                params: { id: '$result.createdProduct.id' }
              })
            ],
            [
              setState('setError', {
                isSubmitting: false,
                error: 'Failed to create product'
              })
            ]
          )
        )
        .rollback(
          setState('resetState', { isSubmitting: false, error: null })
        )
        .timeout(30000)
        .retries(1)
        .build()

      expect(createProductAction._type).toBe('action')
      expect(createProductAction.steps).toHaveLength(3)
      expect(createProductAction.rollback).toHaveLength(1)
    })

    test('creates data sync action with parallel fetch', () => {
      const syncDataAction = action('syncData', 'Sync Data')
        .trigger(trigger.schedule('0 */6 * * *'))
        .description('Synchronizes data from multiple sources every 6 hours')
        .tags('sync', 'scheduled')
        .steps(
          setState('setSyncing', { syncing: true }),
          parallel.all('fetchAllData', [
            api.get('fetchUsers', '/api/external/users').outputAs('users').build(),
            api.get('fetchOrders', '/api/external/orders').outputAs('orders').build(),
            api.get('fetchProducts', '/api/external/products').outputAs('products').build()
          ]),
          transform.map('transformData', {
            users: '$result.users',
            orders: '$result.orders',
            products: '$result.products'
          }),
          api.post('saveSync', '/api/sync/batch')
            .body('$result.transformData')
            .build(),
          setState('setSyncComplete', {
            syncing: false,
            lastSyncAt: ['NOW']
          })
        )
        .timeout(300000) // 5 minutes
        .build()

      expect(syncDataAction.trigger.type).toBe('schedule')
      expect(syncDataAction.steps).toHaveLength(5)
      expect(syncDataAction.steps[1]._step).toBe('parallel')
    })

    test('creates event-driven action', () => {
      const onUserCreatedAction = action('onUserCreated', 'On User Created')
        .trigger(trigger.event('user.created'))
        .description('Sends welcome email when a user is created')
        .tags('user', 'email', 'event')
        .steps(
          api.get('fetchUserDetails', '/api/users/:id')
            .outputAs('user')
            .build(),
          condition(
            'checkEmailVerified',
            ['==', '$result.user.emailVerified', true],
            [
              api.post('sendWelcomeEmail', '/api/emails/send')
                .body({
                  to: '$result.user.email',
                  template: 'welcome',
                  data: { name: '$result.user.name' }
                })
                .build()
            ]
          )
        )
        .build()

      expect(onUserCreatedAction.trigger.type).toBe('event')
      expect(onUserCreatedAction.trigger.event).toBe('user.created')
    })

    test('creates multi-step workflow with rollback', () => {
      const orderProcessAction = action('processOrder', 'Process Order')
        .trigger(trigger.manual())
        .description('Processes an order: validate, charge, fulfill')
        .steps(
          // Validate inventory
          api.post('validateInventory', '/api/inventory/validate')
            .body({ items: '$state.order.items' })
            .outputAs('inventoryCheck')
            .build(),
          condition(
            'checkInventory',
            ['==', '$result.inventoryCheck.available', true],
            [
              // Charge payment
              api.post('chargePayment', '/api/payments/charge')
                .body({
                  orderId: '$state.order.id',
                  amount: '$state.order.total'
                })
                .outputAs('payment')
                .build(),
              condition(
                'checkPayment',
                ['==', '$result.payment.success', true],
                [
                  // Create shipment
                  api.post('createShipment', '/api/shipments')
                    .body({ orderId: '$state.order.id' })
                    .outputAs('shipment')
                    .build(),
                  setState('setComplete', { status: 'completed' })
                ],
                [
                  setState('setPaymentFailed', { status: 'payment_failed' })
                ]
              )
            ],
            [
              setState('setOutOfStock', { status: 'out_of_stock' })
            ]
          )
        )
        .rollback(
          // Refund if payment was made
          condition(
            'checkRefund',
            ['!=', '$result.payment', null],
            [
              api.post('refundPayment', '/api/payments/refund')
                .body({ paymentId: '$result.payment.id' })
                .build()
            ]
          ),
          // Release inventory hold
          api.post('releaseInventory', '/api/inventory/release')
            .body({ orderId: '$state.order.id' })
            .build()
        )
        .timeout(120000)
        .retries(0)
        .build()

      expect(orderProcessAction.steps).toHaveLength(2)
      expect(orderProcessAction.rollback).toHaveLength(2)
      expect(orderProcessAction.timeout).toBe(120000)
      expect(orderProcessAction.retries).toBe(0)
    })
  })
})
