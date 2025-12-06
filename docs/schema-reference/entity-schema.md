# Entity Schema Reference

The Entity Schema defines your **data structure** and **validation rules**. It represents the "what" layer in Manifesto's 3-layer architecture.

## Table of Contents

- [Overview](#overview)
- [EntitySchema Interface](#entityschema-interface)
- [Data Types](#data-types)
- [Constraints](#constraints)
- [Relations](#relations)
- [Indexes](#indexes)
- [Builder API](#builder-api)
- [Complete Example](#complete-example)

---

## Overview

The Entity Schema is analogous to a database schema or TypeScript interface. It defines:

- **Fields**: What data exists
- **Types**: What type each field is
- **Constraints**: What rules apply (required, min, max, pattern)
- **Relations**: How entities connect to each other

```typescript
import { field, enumValue } from '@manifesto-ai/schema'

const productEntity = {
  _type: 'entity' as const,
  id: 'product',
  name: 'Product',
  version: '1.0.0',
  fields: [
    field.string('name', 'Product Name').required().max(100).build(),
    field.number('price', 'Price').min(0).build(),
    field.enum('category', 'Category', [
      enumValue('electronics', 'Electronics'),
      enumValue('clothing', 'Clothing'),
    ]).required().build(),
  ],
}
```

---

## EntitySchema Interface

```typescript
interface EntitySchema {
  readonly _type: 'entity'
  readonly id: string
  readonly name: string
  readonly version: `${number}.${number}.${number}`
  readonly description?: string
  readonly tags?: readonly string[]
  readonly fields: readonly EntityField[]
  readonly relations?: readonly Relation[]
  readonly indexes?: readonly IndexConfig[]
}
```

### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `_type` | `'entity'` | Yes | Schema type discriminator |
| `id` | `string` | Yes | Unique identifier (snake_case recommended) |
| `name` | `string` | Yes | Human-readable name |
| `version` | `string` | Yes | Semantic version (e.g., "1.0.0") |
| `description` | `string` | No | Documentation |
| `tags` | `string[]` | No | Classification tags |
| `fields` | `EntityField[]` | Yes | Field definitions |
| `relations` | `Relation[]` | No | Relationship definitions |
| `indexes` | `IndexConfig[]` | No | Index definitions |

---

## Data Types

Manifesto supports the following primitive data types:

### String

Text data.

```typescript
field.string('name', 'Name')
  .required()
  .min(2)        // Minimum length
  .max(100)      // Maximum length
  .pattern('^[A-Za-z]+$')  // Regex validation
  .build()
```

### Number

Numeric data (integers and floats).

```typescript
field.number('price', 'Price')
  .required()
  .min(0)        // Minimum value
  .max(999999)   // Maximum value
  .defaultValue(0)
  .build()
```

### Boolean

True/false values.

```typescript
field.boolean('isActive', 'Active')
  .defaultValue(true)
  .build()
```

### Date

Date only (no time).

```typescript
field.date('birthDate', 'Birth Date')
  .required()
  .build()
```

### DateTime

Date with time.

```typescript
field.datetime('createdAt', 'Created At')
  .defaultValue('$now')  // Special value for current time
  .build()
```

### Enum

Predefined set of values.

```typescript
import { enumValue, enumValues } from '@manifesto-ai/schema'

// Using enumValue helper
field.enum('status', 'Status', [
  enumValue('draft', 'Draft'),
  enumValue('published', 'Published', { description: 'Visible to users' }),
  enumValue('archived', 'Archived', { disabled: true }),
]).build()

// Using enumValues shorthand
field.enum('priority', 'Priority',
  enumValues({ low: 'Low', medium: 'Medium', high: 'High' })
).build()
```

### Reference

Foreign key to another entity.

```typescript
field.reference('categoryId', 'Category', {
  entity: 'category',
  displayField: 'name',
  valueField: 'id',
  cascade: 'nullify',  // 'none' | 'delete' | 'nullify'
}).build()
```

### Array

List of values.

```typescript
field.array('tags', 'Tags', 'string')
  .min(1)   // Minimum items
  .max(10)  // Maximum items
  .build()
```

### Object

Nested structure.

```typescript
field.object('address', 'Address', [
  field.string('street', 'Street').build(),
  field.string('city', 'City').required().build(),
  field.string('zipCode', 'ZIP Code').pattern('^\\d{5}$').build(),
]).build()
```

---

## Constraints

Constraints define validation rules for fields.

### Constraint Types

| Type | Applicable To | Description |
|------|---------------|-------------|
| `required` | All types | Field must have a value |
| `min` | string, number, array | Minimum length/value/items |
| `max` | string, number, array | Maximum length/value/items |
| `pattern` | string | Regex pattern validation |
| `custom` | All types | Expression-based validation |

### Required

```typescript
field.string('email', 'Email')
  .required('Email is required')
  .build()
```

### Min/Max

```typescript
// For strings (length)
field.string('password', 'Password')
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .build()

// For numbers (value)
field.number('age', 'Age')
  .min(0, 'Age cannot be negative')
  .max(150, 'Invalid age')
  .build()
```

### Pattern

```typescript
field.string('phone', 'Phone')
  .pattern('^\\+?[1-9]\\d{1,14}$', 'Invalid phone format')
  .build()
```

### Custom Constraint

```typescript
field.string('username', 'Username')
  .constraint({
    type: 'custom',
    expression: ['NOT', ['IN', '$value', ['admin', 'root', 'system']]],
    message: 'This username is reserved',
  })
  .build()
```

---

## Relations

Relations define how entities connect to each other.

### Relation Types

| Type | Description | Example |
|------|-------------|---------|
| `hasOne` | One-to-one | User has one Profile |
| `hasMany` | One-to-many | User has many Posts |
| `belongsTo` | Inverse of hasOne/hasMany | Post belongs to User |
| `manyToMany` | Many-to-many | Post has many Tags |

### Relation Interface

```typescript
interface Relation {
  readonly type: 'hasOne' | 'hasMany' | 'belongsTo' | 'manyToMany'
  readonly target: string      // Target entity ID
  readonly foreignKey?: string // Foreign key field
  readonly through?: string    // Junction table (for manyToMany)
}
```

### Examples

```typescript
// User entity
const userEntity = {
  _type: 'entity',
  id: 'user',
  name: 'User',
  version: '1.0.0',
  fields: [
    field.string('id', 'ID').required().build(),
    field.string('name', 'Name').required().build(),
  ],
  relations: [
    { type: 'hasOne', target: 'profile' },
    { type: 'hasMany', target: 'post', foreignKey: 'authorId' },
  ],
}

// Post entity
const postEntity = {
  _type: 'entity',
  id: 'post',
  name: 'Post',
  version: '1.0.0',
  fields: [
    field.string('id', 'ID').required().build(),
    field.string('title', 'Title').required().build(),
    field.string('authorId', 'Author').required().build(),
  ],
  relations: [
    { type: 'belongsTo', target: 'user', foreignKey: 'authorId' },
    { type: 'manyToMany', target: 'tag', through: 'post_tags' },
  ],
}
```

---

## Indexes

Indexes optimize query performance.

### IndexConfig Interface

```typescript
interface IndexConfig {
  readonly fields: readonly string[]
  readonly unique?: boolean
  readonly name?: string
}
```

### Examples

```typescript
const productEntity = {
  _type: 'entity',
  id: 'product',
  name: 'Product',
  version: '1.0.0',
  fields: [
    field.string('sku', 'SKU').required().build(),
    field.string('name', 'Name').required().build(),
    field.string('category', 'Category').build(),
  ],
  indexes: [
    { fields: ['sku'], unique: true, name: 'idx_product_sku' },
    { fields: ['category', 'name'] },
  ],
}
```

---

## Builder API

The field builder provides a fluent API for defining fields.

### FieldBuilder Interface

```typescript
interface FieldBuilder<T extends DataType> {
  label(label: string): FieldBuilder<T>
  description(desc: string): FieldBuilder<T>
  defaultValue(value: unknown): FieldBuilder<T>
  required(message?: string): FieldBuilder<T>
  min(value: number, message?: string): FieldBuilder<T>
  max(value: number, message?: string): FieldBuilder<T>
  pattern(regex: string, message?: string): FieldBuilder<T>
  constraint(constraint: Constraint): FieldBuilder<T>
  build(): EntityField
}
```

### Field Constructors

| Constructor | Type | Parameters |
|-------------|------|------------|
| `field.string` | string | `(id, label)` |
| `field.number` | number | `(id, label)` |
| `field.boolean` | boolean | `(id, label)` |
| `field.date` | date | `(id, label)` |
| `field.datetime` | datetime | `(id, label)` |
| `field.enum` | enum | `(id, label, values)` |
| `field.reference` | reference | `(id, label, config)` |
| `field.array` | array | `(id, label, itemType)` |
| `field.object` | object | `(id, label, fields)` |

### Chaining Example

```typescript
const emailField = field.string('email', 'Email Address')
  .description('User primary email')
  .required('Email is required')
  .pattern(
    '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
    'Invalid email format'
  )
  .build()
```

---

## Complete Example

Here's a complete entity schema for a blog post:

```typescript
import { field, enumValue } from '@manifesto-ai/schema'

export const postEntity = {
  _type: 'entity' as const,
  id: 'post',
  name: 'Blog Post',
  version: '1.0.0',
  description: 'A blog post with title, content, and metadata',
  tags: ['content', 'blog'],

  fields: [
    // Primary key
    field.string('id', 'ID')
      .required()
      .build(),

    // Basic fields
    field.string('title', 'Title')
      .required()
      .min(5)
      .max(200)
      .build(),

    field.string('slug', 'URL Slug')
      .required()
      .pattern('^[a-z0-9-]+$', 'Slug can only contain lowercase letters, numbers, and hyphens')
      .build(),

    field.string('content', 'Content')
      .required()
      .min(100, 'Content must be at least 100 characters')
      .build(),

    field.string('excerpt', 'Excerpt')
      .max(500)
      .build(),

    // Enum field
    field.enum('status', 'Status', [
      enumValue('draft', 'Draft'),
      enumValue('review', 'In Review'),
      enumValue('published', 'Published'),
      enumValue('archived', 'Archived'),
    ])
      .required()
      .defaultValue('draft')
      .build(),

    // Reference field
    field.reference('authorId', 'Author', {
      entity: 'user',
      displayField: 'name',
      valueField: 'id',
    })
      .required()
      .build(),

    // Array field
    field.array('tags', 'Tags', 'string')
      .max(10)
      .build(),

    // Nested object
    field.object('seo', 'SEO Settings', [
      field.string('metaTitle', 'Meta Title').max(60).build(),
      field.string('metaDescription', 'Meta Description').max(160).build(),
      field.array('keywords', 'Keywords', 'string').max(10).build(),
    ]).build(),

    // Date fields
    field.datetime('publishedAt', 'Published At')
      .build(),

    field.datetime('createdAt', 'Created At')
      .required()
      .build(),

    field.datetime('updatedAt', 'Updated At')
      .required()
      .build(),

    // Boolean field
    field.boolean('featured', 'Featured')
      .defaultValue(false)
      .build(),
  ],

  relations: [
    { type: 'belongsTo', target: 'user', foreignKey: 'authorId' },
    { type: 'manyToMany', target: 'category', through: 'post_categories' },
  ],

  indexes: [
    { fields: ['slug'], unique: true },
    { fields: ['status', 'publishedAt'] },
    { fields: ['authorId'] },
  ],
} as const
```

---

## Type Safety

When using TypeScript, the entity schema provides full type inference:

```typescript
import type { EntitySchema, EntityField } from '@manifesto-ai/schema'

// Type-safe schema definition
const schema: EntitySchema = {
  _type: 'entity',
  id: 'user',
  name: 'User',
  version: '1.0.0',
  fields: [
    // TypeScript ensures field structure is correct
  ],
}

// Type guard
import { isEntitySchema } from '@manifesto-ai/schema'

if (isEntitySchema(schema)) {
  // TypeScript knows schema is EntitySchema
  console.log(schema.fields)
}
```

---

## Best Practices

1. **Use semantic IDs**: Use snake_case for entity and field IDs (e.g., `user_profile`, `created_at`)

2. **Define all constraints**: Be explicit about validation rules to catch errors early

3. **Use default values**: Provide sensible defaults to reduce required user input

4. **Document with descriptions**: Add descriptions to fields for auto-generated documentation

5. **Keep entities focused**: One entity should represent one concept (Single Responsibility)

6. **Use references for relationships**: Instead of embedding, use references to maintain normalization

---

[Back to Schema Reference](../README.md) | [Next: View Schema](./view-schema.md)
