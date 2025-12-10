import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { isObjectType, isNonNullType, printSchema } from 'graphql';

import {
  generateGraphQLSchema,
  generateTypeDefs,
  buildSchemaFromDomain,
  clearTypeCache,
} from '../../src/schema/index.js';

// Mock domain for testing
const createTestDomain = () => ({
  id: 'order',
  name: 'Order Management',
  dataSchema: z.object({
    customerId: z.string(),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().int(),
      price: z.number(),
    })),
    shippingAddress: z.string().optional(),
  }),
  stateSchema: z.object({
    status: z.enum(['draft', 'confirmed', 'shipped']),
    isProcessing: z.boolean(),
  }),
  paths: {
    sources: {
      'data.customerId': {
        semantic: { type: 'input', description: 'Customer ID' },
      },
    },
    derived: {
      'derived.totalAmount': {
        expression: 'SUM(data.items, "price * quantity")',
        semantic: { type: 'computed', description: 'Total order amount' },
      },
      'derived.itemCount': {
        expression: 'LENGTH(data.items)',
        semantic: { type: 'computed', description: 'Number of items' },
      },
    },
  },
  actions: {
    confirm: {
      description: 'Confirm the order',
      effect: { _tag: 'SetValue', path: 'state.status', value: 'confirmed' },
    },
    ship: {
      description: 'Ship the order',
      effect: { _tag: 'SetValue', path: 'state.status', value: 'shipped' },
    },
  },
});

describe('Schema Builder', () => {
  beforeEach(() => {
    clearTypeCache();
  });

  describe('generateGraphQLSchema', () => {
    it('should generate a valid GraphQL schema', () => {
      const domain = createTestDomain() as any;
      const result = generateGraphQLSchema(domain);

      expect(result.schema).toBeDefined();
      expect(result.typeDefs).toBeDefined();
      expect(result.resolvers).toBeDefined();
      expect(result.domainTypes).toBeDefined();
    });

    it('should include Query type', () => {
      const domain = createTestDomain() as any;
      const result = generateGraphQLSchema(domain);

      const queryType = result.schema.getQueryType();
      expect(queryType).toBeDefined();

      const fields = queryType?.getFields();
      expect(fields?.order).toBeDefined();
      expect(fields?.orderField).toBeDefined();
      expect(fields?.orderPolicies).toBeDefined();
      expect(fields?.orderActions).toBeDefined();
    });

    it('should include Mutation type', () => {
      const domain = createTestDomain() as any;
      const result = generateGraphQLSchema(domain);

      const mutationType = result.schema.getMutationType();
      expect(mutationType).toBeDefined();

      const fields = mutationType?.getFields();
      expect(fields?.setOrderField).toBeDefined();
      expect(fields?.orderConfirm).toBeDefined();
      expect(fields?.orderShip).toBeDefined();
    });

    it('should include Subscription type by default', () => {
      const domain = createTestDomain() as any;
      const result = generateGraphQLSchema(domain);

      const subscriptionType = result.schema.getSubscriptionType();
      expect(subscriptionType).toBeDefined();

      const fields = subscriptionType?.getFields();
      expect(fields?.orderChanged).toBeDefined();
      expect(fields?.orderFieldChanged).toBeDefined();
    });

    it('should exclude Subscription type when disabled', () => {
      const domain = createTestDomain() as any;
      const result = generateGraphQLSchema(domain, { enableSubscriptions: false });

      const subscriptionType = result.schema.getSubscriptionType();
      expect(subscriptionType).toBeUndefined();
    });

    it('should generate domain type with correct fields', () => {
      const domain = createTestDomain() as any;
      const result = generateGraphQLSchema(domain);

      const domainType = result.domainTypes.domainType;
      expect(domainType).toBeDefined();
      expect(domainType.name).toBe('Order');

      const fields = domainType.getFields();
      expect(fields.customerId).toBeDefined();
      expect(fields.items).toBeDefined();
      expect(fields.shippingAddress).toBeDefined();
      expect(fields.status).toBeDefined();
      expect(fields.isProcessing).toBeDefined();
    });

    it('should include derived fields', () => {
      const domain = createTestDomain() as any;
      const result = generateGraphQLSchema(domain);

      const domainType = result.domainTypes.domainType;
      const fields = domainType.getFields();

      expect(fields.totalAmount).toBeDefined();
      expect(fields.itemCount).toBeDefined();
    });
  });

  describe('generateTypeDefs', () => {
    it('should generate SDL string', () => {
      const domain = createTestDomain() as any;
      const typeDefs = generateTypeDefs(domain);

      expect(typeof typeDefs).toBe('string');
      expect(typeDefs).toContain('type Query');
      expect(typeDefs).toContain('type Mutation');
      expect(typeDefs).toContain('type Order');
    });

    it('should include directive definitions', () => {
      const domain = createTestDomain() as any;
      const typeDefs = generateTypeDefs(domain);

      expect(typeDefs).toContain('directive @semantic');
      expect(typeDefs).toContain('directive @policy');
    });
  });

  describe('buildSchemaFromDomain', () => {
    it('should return executable schema', () => {
      const domain = createTestDomain() as any;
      const schema = buildSchemaFromDomain(domain);

      expect(schema).toBeDefined();
      expect(schema.getQueryType()).toBeDefined();
      expect(schema.getMutationType()).toBeDefined();
    });
  });

  describe('Configuration Options', () => {
    it('should apply type prefix', () => {
      const domain = createTestDomain() as any;
      const result = generateGraphQLSchema(domain, { typePrefix: 'Api' });

      const domainType = result.domainTypes.domainType;
      // sanitizeTypeName applies PascalCase to each part separately
      expect(domainType.name).toBe('Apiorder');
    });

    it('should apply type suffix', () => {
      const domain = createTestDomain() as any;
      const result = generateGraphQLSchema(domain, { typeSuffix: 'Type' });

      const domainType = result.domainTypes.domainType;
      expect(domainType.name).toBe('OrderType');
    });
  });

  describe('Common Types', () => {
    it('should include FieldValue type', () => {
      const domain = createTestDomain() as any;
      const result = generateGraphQLSchema(domain);

      const fieldValueType = result.schema.getType('FieldValue');
      expect(fieldValueType).toBeDefined();
      expect(isObjectType(fieldValueType)).toBe(true);
    });

    it('should include ActionInfo type', () => {
      const domain = createTestDomain() as any;
      const result = generateGraphQLSchema(domain);

      const actionInfoType = result.schema.getType('ActionInfo');
      expect(actionInfoType).toBeDefined();
      expect(isObjectType(actionInfoType)).toBe(true);
    });

    it('should include ActionResult type', () => {
      const domain = createTestDomain() as any;
      const result = generateGraphQLSchema(domain);

      const actionResultType = result.schema.getType('ActionResult');
      expect(actionResultType).toBeDefined();
      expect(isObjectType(actionResultType)).toBe(true);
    });

    it('should include JSON scalar', () => {
      const domain = createTestDomain() as any;
      const result = generateGraphQLSchema(domain);

      const jsonType = result.schema.getType('JSON');
      expect(jsonType).toBeDefined();
    });

    it('should include DateTime scalar', () => {
      const domain = createTestDomain() as any;
      const result = generateGraphQLSchema(domain);

      const dateTimeType = result.schema.getType('DateTime');
      expect(dateTimeType).toBeDefined();
    });
  });
});
