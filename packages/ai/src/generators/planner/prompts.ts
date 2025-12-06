/**
 * Planner Generator Prompts
 *
 * 자연어 요구사항을 시스템 계획으로 변환하기 위한 프롬프트
 */

import type { IndustryType } from '../../types'

// ============================================================================
// System Prompts
// ============================================================================

const BASE_SYSTEM_PROMPT = `You are an expert system architect specializing in enterprise application design.
Your task is to analyze natural language requirements and generate a comprehensive system plan including:
1. Entity identification and their roles
2. View plans for each entity
3. Entity relationships

## Entity Roles

Each entity should be assigned one of these roles:
- **core**: Main business entities (Customer, Product) - requires full CRUD (list + create + edit + detail views)
- **master**: Reference data (Category, Status) - requires management views (list + create + edit)
- **transaction**: Business transactions (Order, Payment) - requires process views (list + wizard + detail)
- **analytics**: Reporting entities (Report, Dashboard) - requires analytics views (dashboard + list)
- **config**: Configuration entities (Settings) - requires settings views (form only)

## View Types

Available view types:
- **list**: Table/grid view for searching and browsing records
- **form**: Form view for creating or editing a single record
- **detail**: Read-only detail view for viewing a record
- **dashboard**: Analytics dashboard with charts and KPIs
- **wizard**: Multi-step form for complex data entry

## View Purposes

Each view has a purpose:
- **search**: For finding and filtering records
- **create**: For creating new records
- **edit**: For modifying existing records
- **view**: For viewing record details
- **analytics**: For data analysis
- **overview**: For system/entity overview

## Output Guidelines

1. **Entity Names**: Use PascalCase, singular form (Customer, not customers)
2. **Entity Roles**: Assign appropriate roles based on business context
3. **View Plans**: Generate logical view combinations based on entity role
4. **Priorities**: Assign priorities based on importance (1 = most important)
5. **Relationships**: Identify common relationships (oneToOne, oneToMany, manyToMany)`

const INDUSTRY_PROMPTS: Record<IndustryType, string> = {
  finance: `
## Finance Industry Context

Common entities: Account, Transaction, Customer, Ledger, Report
Common patterns:
- Account management with balance tracking
- Transaction history with audit trail
- Compliance and reporting dashboards
- Customer KYC/AML workflows`,

  commerce: `
## E-commerce Industry Context

Common entities: Product, Category, Order, Customer, Cart, Payment
Common patterns:
- Product catalog with categories
- Order management workflow
- Customer accounts and history
- Inventory tracking
- Payment processing`,

  healthcare: `
## Healthcare Industry Context

Common entities: Patient, Doctor, Appointment, Prescription, Record
Common patterns:
- Patient management with medical history
- Appointment scheduling
- Medical records (HIPAA compliant)
- Provider management`,

  saas: `
## SaaS Industry Context

Common entities: User, Organization, Subscription, Feature, Usage
Common patterns:
- Multi-tenant architecture
- User/role management
- Subscription and billing
- Usage analytics and metrics`,

  logistics: `
## Logistics Industry Context

Common entities: Shipment, Warehouse, Vehicle, Route, Package
Common patterns:
- Shipment tracking
- Warehouse management
- Route optimization
- Delivery scheduling`,

  general: `
## General Business Context

Apply standard business patterns based on the requirements.
Focus on identifying core business entities and their relationships.`,
}

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * 시스템 프롬프트 생성
 */
export const buildSystemPrompt = (industry?: IndustryType): string => {
  const industryPrompt = INDUSTRY_PROMPTS[industry ?? 'general']
  return BASE_SYSTEM_PROMPT + industryPrompt
}

/**
 * 유저 프롬프트 생성
 */
export const buildUserPrompt = (input: {
  readonly prompt: string
  readonly hints?: readonly string[]
  readonly excludeViewTypes?: readonly string[]
  readonly maxEntities?: number
  readonly maxViews?: number
}): string => {
  let prompt = `Analyze the following system requirements and generate a comprehensive plan:

**Requirements:**
${input.prompt}

**Constraints:**
- Maximum entities: ${input.maxEntities ?? 10}
- Maximum views: ${input.maxViews ?? 20}`

  if (input.excludeViewTypes && input.excludeViewTypes.length > 0) {
    prompt += `\n- Exclude view types: ${input.excludeViewTypes.join(', ')}`
  }

  if (input.hints && input.hints.length > 0) {
    prompt += `\n\n**Additional Hints:**\n${input.hints.map(h => `- ${h}`).join('\n')}`
  }

  prompt += `

Generate a structured plan with:
1. System name and description
2. List of entities with their roles
3. View plans for each entity
4. Entity relationships (if applicable)`

  return prompt
}

// ============================================================================
// Few-shot Examples
// ============================================================================

export const FEW_SHOT_EXAMPLES = {
  ecommerce: {
    input: '온라인 쇼핑몰 관리 시스템',
    output: {
      systemName: '온라인 쇼핑몰 관리 시스템',
      description: '상품, 주문, 고객을 관리하는 이커머스 백오피스 시스템',
      entities: [
        { name: 'Product', description: '판매 상품', role: 'core', suggestedFields: ['id', 'name', 'price', 'stock', 'category'] },
        { name: 'Category', description: '상품 카테고리', role: 'master', suggestedFields: ['id', 'name', 'parentId'] },
        { name: 'Order', description: '고객 주문', role: 'transaction', suggestedFields: ['id', 'customerId', 'total', 'status'] },
        { name: 'Customer', description: '쇼핑몰 고객', role: 'core', suggestedFields: ['id', 'name', 'email', 'phone'] },
      ],
      viewPlans: [
        { viewType: 'list', purpose: 'search', entity: 'Product', priority: 1 },
        { viewType: 'form', purpose: 'create', entity: 'Product', priority: 2 },
        { viewType: 'form', purpose: 'edit', entity: 'Product', priority: 3 },
        { viewType: 'list', purpose: 'search', entity: 'Order', priority: 4 },
        { viewType: 'wizard', purpose: 'create', entity: 'Order', priority: 5 },
        { viewType: 'detail', purpose: 'view', entity: 'Order', priority: 6 },
        { viewType: 'list', purpose: 'search', entity: 'Customer', priority: 7 },
        { viewType: 'form', purpose: 'create', entity: 'Customer', priority: 8 },
        { viewType: 'detail', purpose: 'view', entity: 'Customer', priority: 9 },
        { viewType: 'list', purpose: 'search', entity: 'Category', priority: 10 },
        { viewType: 'form', purpose: 'create', entity: 'Category', priority: 11 },
      ],
      entityRelations: [
        { from: 'Product', to: 'Category', type: 'manyToMany' },
        { from: 'Order', to: 'Customer', type: 'manyToMany' },
        { from: 'Order', to: 'Product', type: 'manyToMany' },
      ],
    },
  },

  crm: {
    input: '고객 관리 시스템 (CRM)',
    output: {
      systemName: '고객 관리 시스템',
      description: '고객 정보, 상담 이력, 영업 기회를 관리하는 CRM 시스템',
      entities: [
        { name: 'Customer', description: '고객 정보', role: 'core' },
        { name: 'Contact', description: '상담/연락 이력', role: 'transaction' },
        { name: 'Opportunity', description: '영업 기회', role: 'transaction' },
        { name: 'Task', description: '할일/태스크', role: 'core' },
      ],
      viewPlans: [
        { viewType: 'list', purpose: 'search', entity: 'Customer', priority: 1 },
        { viewType: 'form', purpose: 'create', entity: 'Customer', priority: 2 },
        { viewType: 'detail', purpose: 'view', entity: 'Customer', priority: 3 },
        { viewType: 'dashboard', purpose: 'overview', entity: 'Customer', priority: 4 },
        { viewType: 'list', purpose: 'search', entity: 'Contact', priority: 5 },
        { viewType: 'form', purpose: 'create', entity: 'Contact', priority: 6 },
        { viewType: 'list', purpose: 'search', entity: 'Opportunity', priority: 7 },
        { viewType: 'wizard', purpose: 'create', entity: 'Opportunity', priority: 8 },
      ],
      entityRelations: [
        { from: 'Contact', to: 'Customer', type: 'manyToMany' },
        { from: 'Opportunity', to: 'Customer', type: 'manyToMany' },
        { from: 'Task', to: 'Customer', type: 'manyToMany' },
      ],
    },
  },
}

/**
 * Few-shot 예제를 프롬프트 형식으로 변환
 */
export const formatFewShotExample = (key: keyof typeof FEW_SHOT_EXAMPLES): string => {
  const example = FEW_SHOT_EXAMPLES[key]
  return `Input: "${example.input}"
Output:
\`\`\`json
${JSON.stringify(example.output, null, 2)}
\`\`\``
}
