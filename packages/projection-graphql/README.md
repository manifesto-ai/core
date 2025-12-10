# @manifesto-ai/projection-graphql

> GraphQL Projection Layer for Manifesto AI - Auto-generate GraphQL schemas from domain definitions

Transform your Manifesto domains into fully-typed GraphQL APIs with automatic schema generation, resolvers, and real-time subscriptions.

## Installation

```bash
pnpm add @manifesto-ai/projection-graphql @manifesto-ai/core graphql
```

## Quick Start

```typescript
import { createRuntime, defineDomain, defineDerived, defineAction, z } from '@manifesto-ai/core';
import {
  generateGraphQLSchema,
  createResolvers,
  createGraphQLContext,
  SimplePubSub
} from '@manifesto-ai/projection-graphql';

// Define domain
const orderDomain = defineDomain('order', {
  dataSchema: z.object({
    id: z.string(),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number(),
      price: z.number()
    })),
    status: z.enum(['draft', 'pending', 'confirmed', 'shipped'])
  }),

  derived: {
    'derived.total': defineDerived(
      { $sum: { $map: [{ $get: 'data.items' }, { $multiply: ['$item.price', '$item.quantity'] }] } },
      z.number()
    ),
    'derived.itemCount': defineDerived(
      { $size: { $get: 'data.items' } },
      z.number()
    )
  },

  actions: {
    confirm: defineAction({
      precondition: { $eq: [{ $get: 'data.status' }, 'draft'] },
      effect: setValue('data.status', 'pending')
    })
  }
});

// Generate GraphQL schema
const schema = generateGraphQLSchema(orderDomain, {
  generateSubscriptions: true,
  generateMutations: true
});

// Create runtime and context
const runtime = createRuntime(orderDomain);
const pubsub = new SimplePubSub();

const context = createGraphQLContext({
  runtime,
  domain: orderDomain,
  pubsub
});

// Create resolvers
const resolvers = createResolvers(orderDomain, { context });

// Use with your GraphQL server (Apollo, Yoga, etc.)
```

## Generated Schema

For a domain named `order`, the following GraphQL schema is generated:

```graphql
type Query {
  # Get full domain state
  order: Order!

  # Get specific field value
  orderField(path: String!): JSON

  # Get all field policies
  orderPolicies: [FieldPolicy!]!

  # Get all actions with availability
  orderActions: [ActionInfo!]!
}

type Mutation {
  # Set a field value
  setOrderField(path: String!, value: JSON!): SetFieldResult!

  # Execute domain actions
  orderConfirm: ActionResult!
}

type Subscription {
  # Subscribe to any domain changes
  orderChanged: OrderChangeEvent!

  # Subscribe to specific field changes
  orderFieldChanged(path: String!): FieldChangeEvent!
}

type Order {
  id: String!
  items: [OrderItem!]!
  status: OrderStatus!
  total: Float!
  itemCount: Int!
}

enum OrderStatus {
  DRAFT
  PENDING
  CONFIRMED
  SHIPPED
}

type OrderItem {
  productId: String!
  quantity: Int!
  price: Float!
}
```

## API Reference

### Schema Generation

#### `generateGraphQLSchema(domain, config?)`

Generates a complete GraphQL schema from a domain definition.

```typescript
interface GraphQLProjectionConfig {
  // Generate subscription types (default: true)
  generateSubscriptions?: boolean;

  // Generate mutation types (default: true)
  generateMutations?: boolean;

  // Type name prefix (default: none)
  typePrefix?: string;

  // Custom type mappings
  customTypeMappings?: Record<string, GraphQLType>;

  // Include field metadata in schema
  includeMetadata?: boolean;
}

const schema = generateGraphQLSchema(domain, {
  generateSubscriptions: true,
  generateMutations: true,
  typePrefix: 'Api'
});
```

#### `buildSchemaFromDomain(domain, config?)`

Lower-level function that returns schema components separately.

```typescript
const { schema, typeDefs, resolvers } = buildSchemaFromDomain(domain);
```

### Type Mapping

Zod types are automatically mapped to GraphQL types:

| Zod Type | GraphQL Type |
|----------|--------------|
| `z.string()` | `String!` |
| `z.number()` | `Float!` |
| `z.boolean()` | `Boolean!` |
| `z.enum([...])` | `enum` |
| `z.array(...)` | `[Type!]!` |
| `z.object({...})` | Custom type |
| `z.optional(...)` | Nullable |
| `z.date()` | `DateTime` |
| `z.any()` | `JSON` |

#### Custom Scalars

```typescript
import { GraphQLJSON, GraphQLDateTime } from '@manifesto-ai/projection-graphql';

// JSON scalar for arbitrary data
// DateTime scalar for Date objects
```

### Resolvers

#### `createResolvers(domain, options)`

Creates all resolvers for a domain.

```typescript
const resolvers = createResolvers(domain, {
  context: graphqlContext
});

// Includes Query, Mutation, Subscription resolvers
```

#### `createQueryResolvers(domain)`

Creates query resolvers only.

```typescript
const queryResolvers = createQueryResolvers(domain);

// {
//   order: (parent, args, context) => runtime.getSnapshot(),
//   orderField: (parent, { path }, context) => runtime.get(path),
//   orderPolicies: (parent, args, context) => getAllPolicies(runtime),
//   orderActions: (parent, args, context) => getAllActions(runtime)
// }
```

#### `createMutationResolvers(domain)`

Creates mutation resolvers.

```typescript
const mutationResolvers = createMutationResolvers(domain);

// {
//   setOrderField: async (parent, { path, value }, context) => {
//     runtime.set(path, value);
//     return { success: true, path, value };
//   },
//   orderConfirm: async (parent, args, context) => {
//     return runtime.executeAction('confirm', args);
//   }
// }
```

#### `createSubscriptionResolvers(domain)`

Creates subscription resolvers with real-time updates.

```typescript
const subscriptionResolvers = createSubscriptionResolvers(domain, {
  pubsub
});

// orderChanged: {
//   subscribe: () => pubsub.asyncIterator('ORDER_CHANGED'),
//   resolve: (payload) => payload
// }
```

### Context

#### `createGraphQLContext(options)`

Creates a GraphQL context with runtime and pubsub.

```typescript
interface ContextOptions {
  runtime: DomainRuntime;
  domain: ManifestoDomain;
  pubsub: PubSubEngine;
  user?: { id: string; roles: string[] };
}

const context = createGraphQLContext({
  runtime,
  domain,
  pubsub,
  user: { id: 'user-123', roles: ['admin'] }
});
```

#### `SimplePubSub`

Built-in PubSub implementation for subscriptions.

```typescript
const pubsub = new SimplePubSub();

// Publish event
pubsub.publish('ORDER_CHANGED', { order: { id: '123', status: 'confirmed' } });

// Subscribe
const iterator = pubsub.asyncIterator('ORDER_CHANGED');
```

#### Context Helpers

```typescript
import {
  getRuntimeFromContext,
  getDomainFromContext,
  getPubSubFromContext,
  isAuthenticated,
  getUserFromContext
} from '@manifesto-ai/projection-graphql';

// In resolver
const myResolver = (parent, args, context) => {
  const runtime = getRuntimeFromContext(context);
  const user = getUserFromContext(context);

  if (!isAuthenticated(context)) {
    throw new Error('Not authenticated');
  }

  return runtime.get('data.items');
};
```

### Subscription Helpers

#### `withFilter(asyncIterator, filterFn)`

Filters subscription events.

```typescript
const resolvers = {
  Subscription: {
    orderFieldChanged: {
      subscribe: withFilter(
        () => pubsub.asyncIterator('FIELD_CHANGED'),
        (payload, variables) => {
          return payload.path === variables.path;
        }
      )
    }
  }
};
```

#### `setupRuntimeSubscriptions(runtime, pubsub, domain)`

Automatically publishes events when runtime state changes.

```typescript
setupRuntimeSubscriptions(runtime, pubsub, domain);

// Now when runtime.set() is called, events are automatically published
runtime.set('data.status', 'confirmed');
// Publishes to 'ORDER_CHANGED' and 'FIELD_CHANGED'
```

### Error Handling

```typescript
import {
  ErrorCodes,
  createValidationError,
  createAuthenticationError,
  createFieldNotFoundError,
  formatError
} from '@manifesto-ai/projection-graphql';

// Create typed errors
throw createValidationError('data.email', 'Invalid email format');
throw createAuthenticationError('Token expired');
throw createFieldNotFoundError('data.unknownField');

// Error codes
ErrorCodes.VALIDATION_ERROR      // 'VALIDATION_ERROR'
ErrorCodes.AUTHENTICATION_ERROR  // 'AUTHENTICATION_ERROR'
ErrorCodes.FIELD_NOT_FOUND      // 'FIELD_NOT_FOUND'
ErrorCodes.PRECONDITION_FAILED  // 'PRECONDITION_FAILED'
```

### Path Utilities

```typescript
import {
  pathToFieldName,
  fieldNameToPath,
  pathToTypeName,
  sanitizeGraphQLName
} from '@manifesto-ai/projection-graphql';

pathToFieldName('data.user.name');    // 'dataUserName'
fieldNameToPath('dataUserName');       // 'data.user.name'
pathToTypeName('order', 'data.items'); // 'OrderDataItems'
sanitizeGraphQLName('123abc');         // '_123abc'
```

## Full Example: Apollo Server

```typescript
import { ApolloServer } from '@apollo/server';
import { createRuntime, defineDomain, z } from '@manifesto-ai/core';
import {
  generateGraphQLSchema,
  createResolvers,
  createGraphQLContext,
  SimplePubSub,
  setupRuntimeSubscriptions
} from '@manifesto-ai/projection-graphql';

// Define domain
const todosDomain = defineDomain('todos', {
  dataSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      text: z.string(),
      completed: z.boolean()
    }))
  }),

  derived: {
    'derived.activeCount': defineDerived(
      { $size: { $filter: [{ $get: 'data.items' }, { $eq: ['$item.completed', false] }] } },
      z.number()
    )
  },

  actions: {
    addTodo: defineAction({
      precondition: true,
      effect: setValue('data.items', {
        $concat: [{ $get: 'data.items' }, [{
          id: { $get: 'input.id' },
          text: { $get: 'input.text' },
          completed: false
        }]]
      })
    }),
    toggleTodo: defineAction({
      precondition: true,
      effect: setValue('data.items', {
        $map: [{ $get: 'data.items' }, {
          $if: [
            { $eq: ['$item.id', { $get: 'input.id' }] },
            {
              id: '$item.id',
              text: '$item.text',
              completed: { $not: '$item.completed' }
            },
            '$item'
          ]
        }]
      })
    })
  }
});

// Create runtime
const runtime = createRuntime(todosDomain);

// Create pubsub and setup subscriptions
const pubsub = new SimplePubSub();
setupRuntimeSubscriptions(runtime, pubsub, todosDomain);

// Generate schema and resolvers
const schema = generateGraphQLSchema(todosDomain);
const resolvers = createResolvers(todosDomain);

// Create context factory
const contextFactory = () => createGraphQLContext({
  runtime,
  domain: todosDomain,
  pubsub
});

// Create Apollo Server
const server = new ApolloServer({
  typeDefs: schema,
  resolvers,
  context: contextFactory
});

// Start server
await server.listen({ port: 4000 });
console.log('GraphQL server running at http://localhost:4000');
```

### Example Queries

```graphql
# Get full state
query GetTodos {
  todos {
    items {
      id
      text
      completed
    }
    activeCount
  }
}

# Get specific field
query GetActiveCount {
  todosField(path: "derived.activeCount")
}

# Add a todo
mutation AddTodo {
  todosAddTodo(input: { id: "1", text: "Learn GraphQL" }) {
    success
    error
  }
}

# Toggle a todo
mutation ToggleTodo {
  todosToggleTodo(input: { id: "1" }) {
    success
  }
}

# Subscribe to changes
subscription OnTodosChanged {
  todosChanged {
    path
    previousValue
    newValue
    timestamp
  }
}
```

## Custom Directives

The package includes semantic directives for enhanced schema metadata:

```graphql
directive @semantic(
  path: String!
  type: SemanticType!
  importance: ImportanceLevel!
  description: String
) on FIELD_DEFINITION

directive @policy(
  relevance: String
  editability: String
  requirement: String
) on FIELD_DEFINITION

directive @computed(
  expression: String!
  dependencies: [String!]!
) on FIELD_DEFINITION

directive @asyncField(
  trigger: String!
  dependencies: [String!]!
) on FIELD_DEFINITION
```

## Related Packages

- [@manifesto-ai/core](../core) - Core runtime and domain definitions
- [@manifesto-ai/projection-ui](../projection-ui) - UI state projection
- [@manifesto-ai/projection-agent](../projection-agent) - AI agent context projection

## License

MIT
