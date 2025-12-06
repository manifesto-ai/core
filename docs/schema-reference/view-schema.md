# View Schema Reference

The View Schema defines **UI layout** and **component configuration**. It represents the "how" layer in Manifesto's 3-layer architecture, determining how entity data is presented and edited.

## Table of Contents

- [Overview](#overview)
- [ViewSchema Interface](#viewschema-interface)
- [Layout System](#layout-system)
- [View Sections](#view-sections)
- [View Fields](#view-fields)
- [Component Types](#component-types)
- [Styling](#styling)
- [Header and Footer](#header-and-footer)
- [Builder API](#builder-api)
- [Complete Example](#complete-example)
- [ListView Schema](#listview-schema)

---

## Overview

The View Schema maps entity fields to UI components and defines:

- **Layout**: How sections and fields are arranged
- **Components**: Which UI component renders each field
- **Styling**: Visual customization
- **Reactions**: Dynamic behavior (covered in [Reaction DSL](./reaction-dsl.md))

```typescript
import { viewField } from '@manifesto-ai/schema'

const productView = {
  _type: 'view' as const,
  id: 'product-form',
  name: 'Product Form',
  version: '1.0.0',
  entityRef: 'product',
  mode: 'create',
  layout: { type: 'form' },
  sections: [
    {
      id: 'basic',
      title: 'Basic Information',
      layout: { type: 'grid', columns: 2 },
      fields: [
        viewField.textInput('name', 'name').placeholder('Product name').build(),
        viewField.numberInput('price', 'price').placeholder('0.00').build(),
      ],
    },
  ],
}
```

---

## ViewSchema Interface

```typescript
interface ViewSchema {
  readonly _type: 'view'
  readonly id: string
  readonly name: string
  readonly version: `${number}.${number}.${number}`
  readonly description?: string
  readonly entityRef: string
  readonly mode: 'create' | 'edit' | 'view' | 'list'
  readonly layout: LayoutConfig
  readonly sections: readonly ViewSection[]
  readonly header?: ViewHeader
  readonly footer?: ViewFooter
}
```

### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `_type` | `'view'` | Yes | Schema type discriminator |
| `id` | `string` | Yes | Unique identifier |
| `name` | `string` | Yes | Human-readable name |
| `version` | `string` | Yes | Semantic version |
| `entityRef` | `string` | Yes | Reference to entity schema ID |
| `mode` | `string` | Yes | Form mode: create, edit, view, or list |
| `layout` | `LayoutConfig` | Yes | Root layout configuration |
| `sections` | `ViewSection[]` | Yes | Form sections |
| `header` | `ViewHeader` | No | Header configuration |
| `footer` | `ViewFooter` | No | Footer with actions |

### Form Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `create` | New record creation | New product form |
| `edit` | Existing record modification | Edit product page |
| `view` | Read-only display | Product detail page |
| `list` | Multiple records display | Product list/table |

> **Note:** For `list` mode, use `ListViewSchema` instead of `ViewSchema`. See [ListView Schema](#listview-schema) section below.

---

## Layout System

Manifesto supports multiple layout types for organizing content.

### LayoutConfig Interface

```typescript
interface LayoutConfig {
  readonly type: 'form' | 'grid' | 'flex' | 'tabs' | 'accordion' | 'wizard'
  readonly columns?: number
  readonly gap?: string
  readonly direction?: 'row' | 'column'
}
```

### Layout Types

#### Form Layout

Single-column form layout (default).

```typescript
layout: { type: 'form' }
```

#### Grid Layout

Multi-column grid layout.

```typescript
layout: {
  type: 'grid',
  columns: 3,     // Number of columns
  gap: '1rem'     // Gap between items
}
```

#### Flex Layout

Flexible layout with direction control.

```typescript
layout: {
  type: 'flex',
  direction: 'row',  // or 'column'
  gap: '1rem'
}
```

#### Tabs Layout

Tabbed sections.

```typescript
layout: { type: 'tabs' }
// Each section becomes a tab
```

#### Accordion Layout

Collapsible sections.

```typescript
layout: { type: 'accordion' }
```

#### Wizard Layout

Step-by-step form.

```typescript
layout: { type: 'wizard' }
// Each section becomes a step
```

---

## View Sections

Sections group related fields together.

### ViewSection Interface

```typescript
interface ViewSection {
  readonly id: string
  readonly title?: string
  readonly description?: string
  readonly layout: LayoutConfig
  readonly fields: readonly ViewField[]
  readonly visible?: Expression
  readonly collapsible?: boolean
  readonly collapsed?: boolean
}
```

### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Unique section identifier |
| `title` | `string` | No | Section heading |
| `description` | `string` | No | Section description |
| `layout` | `LayoutConfig` | Yes | Section layout |
| `fields` | `ViewField[]` | Yes | Fields in section |
| `visible` | `Expression` | No | Conditional visibility |
| `collapsible` | `boolean` | No | Can be collapsed |
| `collapsed` | `boolean` | No | Initially collapsed |

### Example

```typescript
{
  id: 'shipping',
  title: 'Shipping Information',
  description: 'Enter shipping details',
  layout: { type: 'grid', columns: 2 },
  visible: ['!=', '$state.productType', 'digital'],
  collapsible: true,
  collapsed: false,
  fields: [
    viewField.numberInput('weight', 'weight').build(),
    viewField.textInput('dimensions', 'dimensions').build(),
  ],
}
```

---

## View Fields

View fields map entity fields to UI components.

### ViewField Interface

```typescript
interface ViewField {
  readonly id: string
  readonly entityFieldId: string
  readonly component: ComponentType
  readonly label?: string
  readonly placeholder?: string
  readonly helpText?: string
  readonly props?: Record<string, unknown>
  readonly styles?: StyleConfig
  readonly reactions?: readonly Reaction[]
  readonly dependsOn?: readonly string[]
  readonly order?: number
  readonly colSpan?: number
  readonly rowSpan?: number
}
```

### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | View field identifier |
| `entityFieldId` | `string` | Yes | Reference to entity field |
| `component` | `ComponentType` | Yes | UI component type |
| `label` | `string` | No | Override entity field label |
| `placeholder` | `string` | No | Placeholder text |
| `helpText` | `string` | No | Help text below field |
| `props` | `object` | No | Component-specific props |
| `styles` | `StyleConfig` | No | Custom styling |
| `reactions` | `Reaction[]` | No | Dynamic behaviors |
| `dependsOn` | `string[]` | No | Field dependencies |
| `order` | `number` | No | Display order |
| `colSpan` | `number` | No | Grid column span |
| `rowSpan` | `number` | No | Grid row span |

---

## Component Types

Manifesto provides 17 built-in component types.

### Text Input Components

| Component | Description | Entity Type |
|-----------|-------------|-------------|
| `text-input` | Single-line text | string |
| `textarea` | Multi-line text | string |
| `rich-editor` | WYSIWYG editor | string |

```typescript
viewField.textInput('title', 'title')
  .placeholder('Enter title')
  .props({ maxLength: 100 })
  .build()

viewField.textarea('description', 'description')
  .props({ rows: 5 })
  .build()

viewField.richEditor('content', 'content')
  .props({ toolbar: ['bold', 'italic', 'link'] })
  .build()
```

### Numeric Input Components

| Component | Description | Entity Type |
|-----------|-------------|-------------|
| `number-input` | Number field | number |
| `slider` | Range slider | number |

```typescript
viewField.numberInput('price', 'price')
  .props({ min: 0, step: 0.01, prefix: '$' })
  .build()

viewField.slider('quantity', 'quantity')
  .props({ min: 1, max: 100, step: 1 })
  .build()
```

### Selection Components

| Component | Description | Entity Type |
|-----------|-------------|-------------|
| `select` | Dropdown select | enum, reference |
| `multi-select` | Multiple selection | array |
| `radio` | Radio buttons | enum |
| `autocomplete` | Searchable select | enum, reference |

```typescript
viewField.select('category', 'category')
  .placeholder('Select category')
  .build()

viewField.multiSelect('tags', 'tags')
  .placeholder('Select tags')
  .build()

viewField.radio('priority', 'priority')
  .props({ direction: 'horizontal' })
  .build()

viewField.autocomplete('author', 'authorId')
  .props({ minChars: 2, debounce: 300 })
  .build()
```

### Boolean Components

| Component | Description | Entity Type |
|-----------|-------------|-------------|
| `checkbox` | Checkbox | boolean |
| `toggle` | Toggle switch | boolean |

```typescript
viewField.checkbox('acceptTerms', 'acceptTerms')
  .label('I accept the terms and conditions')
  .build()

viewField.toggle('isActive', 'isActive')
  .props({ onLabel: 'Active', offLabel: 'Inactive' })
  .build()
```

### Date/Time Components

| Component | Description | Entity Type |
|-----------|-------------|-------------|
| `date-picker` | Date selector | date |
| `datetime-picker` | Date and time | datetime |

```typescript
viewField.datePicker('birthDate', 'birthDate')
  .props({ format: 'YYYY-MM-DD', minDate: '1900-01-01' })
  .build()

viewField.datetimePicker('scheduledAt', 'scheduledAt')
  .props({ format: 'YYYY-MM-DD HH:mm' })
  .build()
```

### File Components

| Component | Description | Entity Type |
|-----------|-------------|-------------|
| `file-upload` | File uploader | string, array |
| `image-upload` | Image uploader | string, array |

```typescript
viewField.fileUpload('document', 'documentUrl')
  .props({
    accept: '.pdf,.doc,.docx',
    maxSize: 10 * 1024 * 1024  // 10MB
  })
  .build()

viewField.imageUpload('avatar', 'avatarUrl')
  .props({
    accept: 'image/*',
    aspectRatio: 1,
    preview: true
  })
  .build()
```

### Special Components

| Component | Description | Entity Type |
|-----------|-------------|-------------|
| `color-picker` | Color selector | string |
| `custom` | Custom component | any |

```typescript
viewField.colorPicker('brandColor', 'brandColor')
  .props({ format: 'hex' })
  .build()

viewField.custom('map', 'location', 'MapPicker')
  .props({ defaultZoom: 12 })
  .build()
```

---

## Styling

Customize field appearance with StyleConfig.

### StyleConfig Interface

```typescript
interface StyleConfig {
  readonly className?: string
  readonly style?: Record<string, string | number>
  readonly variants?: Record<string, StyleConfig>
}
```

### Examples

```typescript
// Using CSS classes
viewField.textInput('name', 'name')
  .styles({ className: 'form-input-lg highlighted' })
  .build()

// Using inline styles
viewField.textInput('name', 'name')
  .styles({
    style: {
      backgroundColor: '#f0f0f0',
      borderRadius: '8px',
    }
  })
  .build()

// Using variants (state-based styling)
viewField.textInput('name', 'name')
  .styles({
    className: 'form-input',
    variants: {
      error: { className: 'form-input-error' },
      disabled: { className: 'form-input-disabled' },
    }
  })
  .build()
```

---

## Header and Footer

### ViewHeader

```typescript
interface ViewHeader {
  readonly title: string | Expression
  readonly subtitle?: string | Expression
  readonly actions?: readonly ViewAction[]
}
```

```typescript
header: {
  title: 'Edit Product',
  subtitle: ['CONCAT', 'Last updated: ', '$state.updatedAt'],
  actions: [
    {
      id: 'preview',
      label: 'Preview',
      variant: 'secondary',
      action: { type: 'custom', actionId: 'preview-product' },
    },
  ],
}
```

### ViewFooter

```typescript
interface ViewFooter {
  readonly actions: readonly ViewAction[]
  readonly sticky?: boolean
}
```

```typescript
footer: {
  sticky: true,
  actions: [
    {
      id: 'cancel',
      label: 'Cancel',
      variant: 'ghost',
      action: { type: 'cancel' },
    },
    {
      id: 'save',
      label: 'Save',
      variant: 'primary',
      disabled: ['NOT', '$form.isValid'],
      action: {
        type: 'submit',
        confirm: {
          title: 'Save Changes',
          message: 'Are you sure you want to save?',
          confirmLabel: 'Save',
          cancelLabel: 'Cancel',
        },
      },
    },
  ],
}
```

### ViewAction

```typescript
interface ViewAction {
  readonly id: string
  readonly label: string
  readonly variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  readonly icon?: string
  readonly disabled?: Expression
  readonly visible?: Expression
  readonly action: ActionReference
}

interface ActionReference {
  readonly type: 'submit' | 'cancel' | 'custom'
  readonly actionId?: string
  readonly confirm?: ConfirmConfig
}
```

---

## Builder API

The ViewField builder provides a fluent API.

### ViewFieldBuilder Methods

| Method | Description |
|--------|-------------|
| `label(label)` | Override entity field label |
| `placeholder(text)` | Set placeholder text |
| `helpText(text)` | Set help text |
| `props(props)` | Set component props |
| `styles(styles)` | Set styling |
| `dependsOn(...fields)` | Declare dependencies |
| `reaction(reaction)` | Add reaction |
| `hidden(condition)` | Conditional hide |
| `disabled(condition)` | Conditional disable |
| `order(order)` | Set display order |
| `span(col, row?)` | Set grid span |
| `build()` | Build ViewField |

### Example

```typescript
viewField.textInput('email', 'email')
  .label('Email Address')
  .placeholder('user@example.com')
  .helpText('We will never share your email')
  .props({ type: 'email', autoComplete: 'email' })
  .styles({ className: 'email-input' })
  .disabled(['==', '$state.status', 'verified'])
  .span(2)
  .build()
```

---

## Complete Example

```typescript
import { viewField, on, actions, dataSource } from '@manifesto-ai/schema'

export const productView = {
  _type: 'view' as const,
  id: 'product-form',
  name: 'Product Form',
  version: '1.0.0',
  entityRef: 'product',
  mode: 'create' as const,
  layout: { type: 'form' as const },

  header: {
    title: 'Create New Product',
    subtitle: 'Fill in the product details below',
  },

  sections: [
    // Basic Information Section
    {
      id: 'basic',
      title: 'Basic Information',
      layout: { type: 'grid' as const, columns: 2, gap: '1rem' },
      fields: [
        viewField.textInput('name', 'name')
          .placeholder('Product name')
          .span(2)
          .build(),

        viewField.numberInput('price', 'price')
          .placeholder('0.00')
          .props({ min: 0, step: 0.01 })
          .build(),

        viewField.select('category', 'categoryId')
          .placeholder('Select category')
          .dependsOn()
          .reaction(
            on.change()
              .do(actions.setValue('subcategoryId', null))
          )
          .build(),

        viewField.select('subcategory', 'subcategoryId')
          .placeholder('Select subcategory')
          .dependsOn('categoryId')
          .reaction(
            on.mount()
              .when(['!=', '$state.categoryId', null])
              .do(actions.setOptions('subcategory',
                dataSource.api('/api/subcategories', {
                  params: { categoryId: '$state.categoryId' }
                })
              ))
          )
          .disabled(['==', '$state.categoryId', null])
          .build(),
      ],
    },

    // Description Section
    {
      id: 'description',
      title: 'Description',
      layout: { type: 'form' as const },
      fields: [
        viewField.textarea('shortDescription', 'shortDescription')
          .placeholder('Brief product description (max 200 chars)')
          .props({ rows: 2, maxLength: 200 })
          .build(),

        viewField.richEditor('fullDescription', 'fullDescription')
          .helpText('Detailed product description with formatting')
          .build(),
      ],
    },

    // Media Section
    {
      id: 'media',
      title: 'Product Images',
      layout: { type: 'form' as const },
      fields: [
        viewField.imageUpload('mainImage', 'mainImageUrl')
          .props({ aspectRatio: 1, preview: true })
          .build(),

        viewField.imageUpload('gallery', 'galleryUrls')
          .props({ multiple: true, maxFiles: 5 })
          .build(),
      ],
    },

    // Inventory Section
    {
      id: 'inventory',
      title: 'Inventory',
      layout: { type: 'grid' as const, columns: 3 },
      fields: [
        viewField.textInput('sku', 'sku')
          .placeholder('SKU-12345')
          .build(),

        viewField.numberInput('stock', 'stockQuantity')
          .props({ min: 0 })
          .build(),

        viewField.toggle('trackInventory', 'trackInventory')
          .build(),
      ],
    },

    // Shipping Section (conditional)
    {
      id: 'shipping',
      title: 'Shipping',
      layout: { type: 'grid' as const, columns: 2 },
      visible: ['!=', '$state.productType', 'digital'],
      collapsible: true,
      fields: [
        viewField.numberInput('weight', 'weight')
          .props({ suffix: 'kg' })
          .build(),

        viewField.textInput('dimensions', 'dimensions')
          .placeholder('L x W x H cm')
          .build(),
      ],
    },

    // Settings Section
    {
      id: 'settings',
      title: 'Settings',
      layout: { type: 'form' as const },
      collapsible: true,
      collapsed: true,
      fields: [
        viewField.toggle('isActive', 'isActive')
          .label('Active')
          .build(),

        viewField.toggle('featured', 'featured')
          .label('Featured Product')
          .build(),

        viewField.datePicker('publishDate', 'publishDate')
          .helpText('Leave empty to publish immediately')
          .build(),
      ],
    },
  ],

  footer: {
    sticky: true,
    actions: [
      {
        id: 'cancel',
        label: 'Cancel',
        variant: 'ghost' as const,
        action: { type: 'cancel' as const },
      },
      {
        id: 'saveDraft',
        label: 'Save Draft',
        variant: 'secondary' as const,
        action: { type: 'custom' as const, actionId: 'save-draft' },
      },
      {
        id: 'publish',
        label: 'Publish',
        variant: 'primary' as const,
        disabled: ['NOT', '$form.isValid'],
        action: {
          type: 'submit' as const,
          confirm: {
            title: 'Publish Product',
            message: 'This will make the product visible to customers.',
            confirmLabel: 'Publish',
            cancelLabel: 'Cancel',
          },
        },
      },
    ],
  },
} as const
```

---

## Best Practices

1. **Group related fields**: Use sections to organize fields logically

2. **Declare dependencies**: Always use `dependsOn` for fields that depend on other values

3. **Provide help text**: Use `helpText` for complex fields that need explanation

4. **Use appropriate components**: Match component types to data types and use cases

5. **Handle loading states**: Use disabled/hidden expressions for loading scenarios

6. **Keep sections focused**: Each section should address one aspect of the entity

7. **Use grid layouts wisely**: Consider mobile responsiveness when using multi-column grids

---

## ListView Schema

ListView Schema is used for displaying data in tables/lists with features like pagination, sorting, filtering, and row selection.

### ListViewSchema Interface

```typescript
interface ListViewSchema {
  readonly _type: 'list-view'
  readonly id: string
  readonly name: string
  readonly version: `${number}.${number}.${number}`
  readonly description?: string
  readonly entityRef: string
  readonly columns: readonly ListColumn[]
  readonly dataSource?: DataSourceConfig
  readonly pagination?: PaginationConfig
  readonly selection?: SelectionConfig
  readonly toolbar?: ToolbarConfig
  readonly rowActions?: readonly RowAction[]
  readonly bulkActions?: readonly BulkAction[]
}
```

### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `_type` | `'list-view'` | Yes | Schema type discriminator |
| `id` | `string` | Yes | Unique identifier |
| `name` | `string` | Yes | Human-readable name |
| `version` | `string` | Yes | Semantic version |
| `entityRef` | `string` | Yes | Reference to entity schema ID |
| `columns` | `ListColumn[]` | Yes | Column definitions |
| `dataSource` | `DataSourceConfig` | No | Data fetching configuration |
| `pagination` | `PaginationConfig` | No | Pagination settings |
| `selection` | `SelectionConfig` | No | Row selection settings |
| `toolbar` | `ToolbarConfig` | No | Toolbar configuration |
| `rowActions` | `RowAction[]` | No | Per-row action buttons |
| `bulkActions` | `BulkAction[]` | No | Multi-select action buttons |

### ListColumn Interface

```typescript
interface ListColumn {
  readonly id: string
  readonly field: string
  readonly label: string
  readonly type: CellType
  readonly width?: string | number
  readonly minWidth?: number
  readonly sortable?: boolean
  readonly hidden?: Expression
  readonly format?: ColumnFormat
}

type CellType = 'text' | 'number' | 'date' | 'datetime' | 'boolean' | 'badge' | 'link' | 'image' | 'enum'
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Column identifier |
| `field` | `string` | Yes | Entity field to display |
| `label` | `string` | Yes | Column header text |
| `type` | `CellType` | Yes | Cell renderer type |
| `width` | `string \| number` | No | Column width |
| `minWidth` | `number` | No | Minimum column width |
| `sortable` | `boolean` | No | Enable sorting |
| `hidden` | `Expression` | No | Conditional visibility |
| `format` | `ColumnFormat` | No | Formatting options |

### Column Format Options

```typescript
interface ColumnFormat {
  // Number formatting
  decimals?: number
  prefix?: string
  suffix?: string
  locale?: string

  // Date formatting
  dateFormat?: string

  // Badge formatting
  badgeMap?: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'info' | 'default' }>

  // Enum formatting
  enumLabels?: Record<string, string>
}
```

### Row Actions

```typescript
interface RowAction {
  readonly id: string
  readonly label: string
  readonly icon?: string
  readonly variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  readonly visible?: Expression
  readonly disabled?: Expression
}
```

### Bulk Actions

```typescript
interface BulkAction {
  readonly id: string
  readonly label: string
  readonly icon?: string
  readonly variant?: 'primary' | 'secondary' | 'danger'
  readonly confirm?: ConfirmConfig
}
```

### Pagination Config

```typescript
interface PaginationConfig {
  readonly enabled: boolean
  readonly defaultPageSize?: number
  readonly pageSizeOptions?: number[]
}
```

### Selection Config

```typescript
interface SelectionConfig {
  readonly enabled: boolean
  readonly mode?: 'single' | 'multiple'
}
```

### Complete ListView Example

```typescript
import { listView, column } from '@manifesto-ai/schema'

export const productsListView = {
  _type: 'list-view' as const,
  id: 'products-list',
  name: 'Products List',
  version: '1.0.0',
  entityRef: 'product',

  columns: [
    {
      id: 'name',
      field: 'name',
      label: 'Product Name',
      type: 'text',
      sortable: true,
    },
    {
      id: 'price',
      field: 'price',
      label: 'Price',
      type: 'number',
      sortable: true,
      format: {
        prefix: '$',
        decimals: 2,
      },
    },
    {
      id: 'status',
      field: 'status',
      label: 'Status',
      type: 'badge',
      format: {
        badgeMap: {
          active: { label: 'Active', variant: 'success' },
          draft: { label: 'Draft', variant: 'warning' },
          archived: { label: 'Archived', variant: 'default' },
        },
      },
    },
    {
      id: 'createdAt',
      field: 'createdAt',
      label: 'Created',
      type: 'date',
      sortable: true,
      format: { dateFormat: 'MMM DD, YYYY' },
    },
    {
      id: 'adminOnly',
      field: 'internalNotes',
      label: 'Notes',
      type: 'text',
      hidden: ['!=', '$context.user.role', 'admin'],
    },
  ],

  dataSource: {
    type: 'api',
    endpoint: '/api/products',
  },

  pagination: {
    enabled: true,
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50, 100],
  },

  selection: {
    enabled: true,
    mode: 'multiple',
  },

  toolbar: {
    search: { enabled: true, placeholder: 'Search products...' },
    filters: [
      { id: 'status', label: 'Status', type: 'select', field: 'status' },
      { id: 'category', label: 'Category', type: 'select', field: 'categoryId' },
    ],
  },

  rowActions: [
    { id: 'view', label: 'View', icon: 'eye' },
    { id: 'edit', label: 'Edit', icon: 'edit' },
    {
      id: 'delete',
      label: 'Delete',
      icon: 'trash',
      variant: 'danger',
      visible: ['==', '$context.user.role', 'admin'],
    },
  ],

  bulkActions: [
    { id: 'export', label: 'Export Selected', icon: 'download' },
    {
      id: 'bulk-delete',
      label: 'Delete Selected',
      icon: 'trash',
      variant: 'danger',
      confirm: {
        title: 'Delete Products',
        message: 'Are you sure you want to delete the selected products?',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
      },
    },
  ],
} as const
```

### ListView Best Practices

1. **Define sortable columns**: Mark frequently sorted columns as sortable for better UX

2. **Use appropriate cell types**: Match cell types to data for proper formatting (badge for status, number for prices)

3. **Conditional columns**: Use `hidden` expression to show/hide columns based on user role or context

4. **Pagination defaults**: Set reasonable default page sizes (10-25) to optimize initial load

5. **Confirm destructive actions**: Always use confirm dialogs for delete and bulk delete actions

6. **Row action visibility**: Use `visible` expression to control which users see which actions

---

[Back to Schema Reference](../README.md) | [Previous: Entity Schema](./entity-schema.md) | [Next: Reaction DSL](./reaction-dsl.md)
