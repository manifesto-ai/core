/**
 * Entity Generator Prompts
 *
 * Entity 생성을 위한 시스템 프롬프트 및 유저 프롬프트 빌더
 */

import type { IndustryType, GeneratorContext } from '../../types'

// ============================================================================
// System Prompts
// ============================================================================

const BASE_SYSTEM_PROMPT = `You are an expert database schema designer and domain modeler.
Your task is to generate a well-structured entity schema from a natural language description.

## Core Principles

1. **Naming Conventions**
   - Entity ID: kebab-case (e.g., "product-order", "customer-support")
   - Field ID: camelCase (e.g., "productName", "createdAt")
   - Labels: Human-readable with proper capitalization

2. **Essential Fields**
   - Always include an 'id' field (string type) as the primary identifier
   - Include 'createdAt' and 'updatedAt' datetime fields for audit
   - Add 'name' or equivalent display field when appropriate

3. **Data Type Selection**
   - string: Text, codes, identifiers
   - number: Quantities, amounts, percentages
   - boolean: Yes/No flags, toggles
   - date: Dates without time (birthDate, expiryDate)
   - datetime: Timestamps (createdAt, updatedAt)
   - enum: Fixed set of options (status, type, category)
   - reference: Foreign key to another entity

4. **Constraints**
   - Mark essential fields as required
   - Add min/max for numbers where appropriate
   - Add pattern (regex) for formatted strings (email, phone)

5. **Relationships**
   - belongsTo: This entity references another (has foreign key)
   - hasOne: One-to-one relationship
   - hasMany: One-to-many relationship
   - manyToMany: Many-to-many (requires through table)

## Output Format

Generate a complete entity schema with:
- Meaningful id and name
- Appropriate fields with correct types
- Validation constraints
- Relations to other entities (if mentioned)`

const INDUSTRY_PROMPTS: Record<IndustryType, string> = {
  finance: `
## Finance Industry Conventions

- Use standard financial terminology
- Include audit fields (createdBy, approvedBy)
- Add status fields with proper enum values (pending, approved, rejected)
- Consider compliance fields (kycStatus, amlChecked)
- Currency amounts should be numbers with proper precision
- Include transaction reference numbers`,

  commerce: `
## Commerce/E-commerce Conventions

- Product fields: sku, barcode, price, stock
- Order fields: orderNumber, status, total, subtotal
- Customer fields: email (required), phone, address
- Include shipping and billing address structures
- Status enums: pending, processing, shipped, delivered, cancelled`,

  healthcare: `
## Healthcare Industry Conventions

- Use HIPAA-compliant field naming
- Patient identifiers should be carefully structured
- Include consent and privacy fields
- Medical record numbers (MRN) for patients
- Date fields for appointments, procedures
- Provider reference fields`,

  saas: `
## SaaS/Software Conventions

- Tenant/Organization reference fields
- User role and permission structures
- Subscription and billing fields
- Feature flags as boolean fields
- API key and token fields
- Usage metrics fields`,

  logistics: `
## Logistics/Supply Chain Conventions

- Tracking numbers and codes
- Location fields (origin, destination)
- Weight, dimensions for packages
- Status tracking with timestamps
- Carrier and route references
- Delivery window fields`,

  general: `
## General Conventions

- Follow standard business entity patterns
- Include common audit fields
- Use intuitive field naming`,
}

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * 시스템 프롬프트 생성
 */
export const buildSystemPrompt = (context: GeneratorContext): string => {
  const industryType = context.industry?.type ?? 'general'
  const industryPrompt = INDUSTRY_PROMPTS[industryType]

  let prompt = BASE_SYSTEM_PROMPT + industryPrompt

  if (context.customPrompt) {
    prompt += `\n\n## Custom Instructions\n${context.customPrompt}`
  }

  return prompt
}

/**
 * 유저 프롬프트 생성
 */
export const buildUserPrompt = (input: {
  domainDescription: string
  hints?: readonly string[]
  relatedEntities?: readonly string[]
}): string => {
  let prompt = `Generate an entity schema for the following domain:\n\n${input.domainDescription}`

  if (input.hints && input.hints.length > 0) {
    prompt += `\n\n## Additional Hints\n${input.hints.map((h) => `- ${h}`).join('\n')}`
  }

  if (input.relatedEntities && input.relatedEntities.length > 0) {
    prompt += `\n\n## Related Entities (for relations)\n${input.relatedEntities.map((e) => `- ${e}`).join('\n')}`
  }

  return prompt
}

// ============================================================================
// Few-shot Examples (for improved generation quality)
// ============================================================================

export const FEW_SHOT_EXAMPLES = {
  customer: {
    input: 'A customer entity for an e-commerce platform',
    output: {
      id: 'customer',
      name: 'Customer',
      description: 'E-commerce platform customer',
      fields: [
        { id: 'id', dataType: 'string', label: 'ID', required: true },
        { id: 'email', dataType: 'string', label: 'Email', required: true },
        { id: 'name', dataType: 'string', label: 'Full Name', required: true },
        { id: 'phone', dataType: 'string', label: 'Phone Number' },
        {
          id: 'status',
          dataType: 'enum',
          label: 'Status',
          enumValues: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'suspended', label: 'Suspended' },
          ],
        },
        { id: 'createdAt', dataType: 'datetime', label: 'Created At', required: true },
        { id: 'updatedAt', dataType: 'datetime', label: 'Updated At', required: true },
      ],
    },
  },

  order: {
    input: 'An order entity for tracking customer purchases',
    output: {
      id: 'order',
      name: 'Order',
      description: 'Customer purchase order',
      fields: [
        { id: 'id', dataType: 'string', label: 'ID', required: true },
        { id: 'orderNumber', dataType: 'string', label: 'Order Number', required: true },
        { id: 'customerId', dataType: 'reference', label: 'Customer', required: true },
        { id: 'totalAmount', dataType: 'number', label: 'Total Amount', required: true },
        {
          id: 'status',
          dataType: 'enum',
          label: 'Status',
          enumValues: [
            { value: 'pending', label: 'Pending' },
            { value: 'paid', label: 'Paid' },
            { value: 'shipped', label: 'Shipped' },
            { value: 'delivered', label: 'Delivered' },
            { value: 'cancelled', label: 'Cancelled' },
          ],
        },
        { id: 'createdAt', dataType: 'datetime', label: 'Created At', required: true },
        { id: 'updatedAt', dataType: 'datetime', label: 'Updated At', required: true },
      ],
      relations: [{ type: 'belongsTo', target: 'customer', foreignKey: 'customerId' }],
    },
  },
}
