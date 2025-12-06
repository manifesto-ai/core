import { describe, test, expect } from 'vitest'
import {
  section,
  view,
  layout,
  header,
  footer,
  viewAction,
  confirm,
  type SectionBuilder,
  type ViewBuilder,
  type ViewActionBuilder,
} from '../view'
import { viewField } from '../../primitives/view'

describe('View Combinator', () => {
  describe('section()', () => {
    test('creates section with id and default layout', () => {
      const s = section('basicInfo').build()
      expect(s.id).toBe('basicInfo')
      expect(s.layout).toEqual({ type: 'form' })
      expect(s.fields).toEqual([])
    })
  })

  describe('SectionBuilder Methods', () => {
    test('title() sets section title', () => {
      const s = section('basicInfo')
        .title('Basic Information')
        .build()
      expect(s.title).toBe('Basic Information')
    })

    test('description() sets section description', () => {
      const s = section('basicInfo')
        .description('Enter your basic information')
        .build()
      expect(s.description).toBe('Enter your basic information')
    })

    test('layout() sets section layout', () => {
      const s = section('gridSection')
        .layout(layout.grid(3, '16px'))
        .build()
      expect(s.layout).toEqual({ type: 'grid', columns: 3, gap: '16px' })
    })

    test('field() adds single field', () => {
      const s = section('basicInfo')
        .field(viewField.textInput('nameInput', 'name').build())
        .build()
      expect(s.fields).toHaveLength(1)
    })

    test('fields() adds multiple fields', () => {
      const s = section('basicInfo')
        .fields(
          viewField.textInput('nameInput', 'name').build(),
          viewField.textInput('emailInput', 'email').build(),
          viewField.numberInput('ageInput', 'age').build()
        )
        .build()
      expect(s.fields).toHaveLength(3)
    })

    test('visible() sets visibility condition', () => {
      const s = section('advancedOptions')
        .visible(['==', '$state.showAdvanced', true])
        .build()
      expect(s.visible).toEqual(['==', '$state.showAdvanced', true])
    })

    test('collapsible() makes section collapsible', () => {
      const s = section('optionalInfo')
        .collapsible()
        .build()
      expect(s.collapsible).toBe(true)
      expect(s.collapsed).toBe(false)
    })

    test('collapsible() with initial collapsed state', () => {
      const s = section('optionalInfo')
        .collapsible(true)
        .build()
      expect(s.collapsible).toBe(true)
      expect(s.collapsed).toBe(true)
    })

    test('method chaining works correctly', () => {
      const s = section('userInfo')
        .title('User Information')
        .description('Please fill in your details')
        .layout(layout.form(2))
        .collapsible()
        .fields(
          viewField.textInput('firstName', 'firstName').build(),
          viewField.textInput('lastName', 'lastName').build()
        )
        .build()

      expect(s.title).toBe('User Information')
      expect(s.description).toBe('Please fill in your details')
      expect(s.layout).toEqual({ type: 'form', columns: 2 })
      expect(s.collapsible).toBe(true)
      expect(s.fields).toHaveLength(2)
    })
  })

  describe('view()', () => {
    test('creates view with fluent API', () => {
      const v = view('user-create', 'Create User')
        .entityRef('user')
        .mode('create')
        .build()

      expect(v._type).toBe('view')
      expect(v.id).toBe('user-create')
      expect(v.name).toBe('Create User')
      expect(v.version).toBe('0.1.0')
      expect(v.entityRef).toBe('user')
      expect(v.mode).toBe('create')
      expect(v.layout).toEqual({ type: 'form' })
      expect(v.sections).toEqual([])
    })

    test('creates view with custom version', () => {
      const v = view('user-edit', 'Edit User', '1.0.0')
        .entityRef('user')
        .mode('edit')
        .build()

      expect(v.version).toBe('1.0.0')
    })

    test('supports different view modes', () => {
      const createView = view('user-create', 'Create')
        .entityRef('user').mode('create').build()
      const editView = view('user-edit', 'Edit')
        .entityRef('user').mode('edit').build()
      const viewView = view('user-view', 'View')
        .entityRef('user').mode('view').build()
      const listView = view('user-list', 'List')
        .entityRef('user').mode('list').build()

      expect(createView.mode).toBe('create')
      expect(editView.mode).toBe('edit')
      expect(viewView.mode).toBe('view')
      expect(listView.mode).toBe('list')
    })
  })

  describe('ViewBuilder Methods', () => {
    test('description() sets view description', () => {
      const v = view('user-create', 'Create User')
        .entityRef('user')
        .mode('create')
        .description('Form to create a new user')
        .build()
      expect(v.description).toBe('Form to create a new user')
    })

    test('tags() adds tags', () => {
      const v = view('user-create', 'Create User')
        .entityRef('user')
        .mode('create')
        .tags('user', 'form')
        .build()
      expect(v.tags).toEqual(['user', 'form'])
    })

    test('layout() sets view layout', () => {
      const v = view('user-wizard', 'User Wizard')
        .entityRef('user')
        .mode('create')
        .layout(layout.wizard())
        .build()
      expect(v.layout).toEqual({ type: 'wizard' })
    })

    test('section() adds single section', () => {
      const v = view('user-create', 'Create User')
        .entityRef('user')
        .mode('create')
        .section(section('basicInfo').title('Basic Info').build())
        .build()
      expect(v.sections).toHaveLength(1)
    })

    test('sections() adds multiple sections', () => {
      const v = view('user-create', 'Create User')
        .entityRef('user')
        .mode('create')
        .sections(
          section('basicInfo').build(),
          section('contactInfo').build(),
          section('preferences').build()
        )
        .build()
      expect(v.sections).toHaveLength(3)
    })

    test('header() sets view header', () => {
      const v = view('user-create', 'Create User')
        .entityRef('user')
        .mode('create')
        .header(header('Create New User', { subtitle: 'Fill in the form below' }))
        .build()
      expect(v.header?.title).toBe('Create New User')
      expect(v.header?.subtitle).toBe('Fill in the form below')
    })

    test('footer() sets view footer', () => {
      const v = view('user-create', 'Create User')
        .entityRef('user')
        .mode('create')
        .footer(footer([
          viewAction.cancel('cancelBtn', 'Cancel').build(),
          viewAction.submit('submitBtn', 'Save').build(),
        ]))
        .build()
      expect(v.footer?.actions).toHaveLength(2)
      expect(v.footer?.sticky).toBe(true)
    })
  })

  describe('Builder Immutability', () => {
    test('section builder returns new instance', () => {
      const builder1 = section('test')
      const builder2 = builder1.title('Title')
      const builder3 = builder2.description('Desc')

      const s1 = builder1.build()
      const s2 = builder2.build()
      const s3 = builder3.build()

      expect(s1.title).toBeUndefined()
      expect(s2.title).toBe('Title')
      expect(s2.description).toBeUndefined()
      expect(s3.description).toBe('Desc')
    })

    test('view builder returns new instance', () => {
      const builder1 = view('test', 'Test').entityRef('entity').mode('create')
      const builder2 = builder1.description('Description')
      const builder3 = builder2.tags('tag1')

      const v1 = builder1.build()
      const v2 = builder2.build()
      const v3 = builder3.build()

      expect(v1.description).toBeUndefined()
      expect(v2.description).toBe('Description')
      expect(v2.tags).toBeUndefined()
      expect(v3.tags).toEqual(['tag1'])
    })
  })

  describe('Layout Helpers', () => {
    test('layout.form() creates form layout', () => {
      expect(layout.form()).toEqual({ type: 'form' })
    })

    test('layout.form() with columns', () => {
      expect(layout.form(2)).toEqual({ type: 'form', columns: 2 })
    })

    test('layout.grid() creates grid layout', () => {
      expect(layout.grid(3)).toEqual({ type: 'grid', columns: 3 })
    })

    test('layout.grid() with gap', () => {
      expect(layout.grid(4, '20px')).toEqual({ type: 'grid', columns: 4, gap: '20px' })
    })

    test('layout.flex() creates flex layout', () => {
      expect(layout.flex()).toEqual({ type: 'flex', direction: 'row' })
    })

    test('layout.flex() with direction', () => {
      expect(layout.flex('column')).toEqual({ type: 'flex', direction: 'column' })
    })

    test('layout.flex() with direction and gap', () => {
      expect(layout.flex('row', '10px')).toEqual({ type: 'flex', direction: 'row', gap: '10px' })
    })

    test('layout.tabs() creates tabs layout', () => {
      expect(layout.tabs()).toEqual({ type: 'tabs' })
    })

    test('layout.accordion() creates accordion layout', () => {
      expect(layout.accordion()).toEqual({ type: 'accordion' })
    })

    test('layout.wizard() creates wizard layout', () => {
      expect(layout.wizard()).toEqual({ type: 'wizard' })
    })
  })

  describe('Header/Footer Helpers', () => {
    test('header() creates header with title only', () => {
      const h = header('Page Title')
      expect(h.title).toBe('Page Title')
      expect(h.subtitle).toBeUndefined()
      expect(h.actions).toBeUndefined()
    })

    test('header() with subtitle', () => {
      const h = header('Page Title', { subtitle: 'Page subtitle' })
      expect(h.title).toBe('Page Title')
      expect(h.subtitle).toBe('Page subtitle')
    })

    test('header() with expression title', () => {
      const h = header(['CONCAT', 'Edit ', '$state.name'])
      expect(h.title).toEqual(['CONCAT', 'Edit ', '$state.name'])
    })

    test('header() with actions', () => {
      const h = header('Users', {
        actions: [viewAction.custom('addBtn', 'Add User', 'addUser').build()]
      })
      expect(h.actions).toHaveLength(1)
    })

    test('footer() creates footer with actions', () => {
      const f = footer([
        viewAction.cancel('cancelBtn', 'Cancel').build(),
        viewAction.submit('saveBtn', 'Save').build(),
      ])
      expect(f.actions).toHaveLength(2)
      expect(f.sticky).toBe(true)
    })

    test('footer() with non-sticky', () => {
      const f = footer([viewAction.submit('saveBtn', 'Save').build()], false)
      expect(f.sticky).toBe(false)
    })
  })

  describe('ViewAction Builders', () => {
    test('viewAction.submit() creates submit action', () => {
      const a = viewAction.submit('submitBtn', 'Submit').build()
      expect(a.id).toBe('submitBtn')
      expect(a.label).toBe('Submit')
      expect(a.variant).toBe('primary')
      expect(a.action.type).toBe('submit')
    })

    test('viewAction.cancel() creates cancel action', () => {
      const a = viewAction.cancel('cancelBtn', 'Cancel').build()
      expect(a.variant).toBe('secondary')
      expect(a.action.type).toBe('cancel')
    })

    test('viewAction.custom() creates custom action', () => {
      const a = viewAction.custom('deleteBtn', 'Delete', 'deleteItem').build()
      expect(a.action.type).toBe('custom')
      expect(a.action.actionId).toBe('deleteItem')
    })

    test('variant() sets action variant', () => {
      const a = viewAction.custom('deleteBtn', 'Delete', 'deleteItem')
        .variant('danger')
        .build()
      expect(a.variant).toBe('danger')
    })

    test('icon() sets action icon', () => {
      const a = viewAction.submit('saveBtn', 'Save')
        .icon('save')
        .build()
      expect(a.icon).toBe('save')
    })

    test('disabled() sets disabled condition', () => {
      const a = viewAction.submit('saveBtn', 'Save')
        .disabled(['==', '$state.isValid', false])
        .build()
      expect(a.disabled).toEqual(['==', '$state.isValid', false])
    })

    test('visible() sets visible condition', () => {
      const a = viewAction.custom('adminBtn', 'Admin', 'adminAction')
        .visible(['==', '$user.role', 'admin'])
        .build()
      expect(a.visible).toEqual(['==', '$user.role', 'admin'])
    })

    test('confirm() sets confirm config', () => {
      const a = viewAction.custom('deleteBtn', 'Delete', 'deleteItem')
        .confirm(confirm('Confirm Delete', 'Are you sure?'))
        .build()
      expect(a.action.confirm?.title).toBe('Confirm Delete')
      expect(a.action.confirm?.message).toBe('Are you sure?')
    })

    test('method chaining works correctly', () => {
      const a = viewAction.custom('deleteBtn', 'Delete', 'deleteItem')
        .variant('danger')
        .icon('trash')
        .disabled(['==', '$state.hasSelection', false])
        .visible(['==', '$user.canDelete', true])
        .confirm(confirm('Delete Items', 'This cannot be undone', {
          confirmLabel: 'Delete',
          cancelLabel: 'Keep'
        }))
        .build()

      expect(a.variant).toBe('danger')
      expect(a.icon).toBe('trash')
      expect(a.disabled).toBeDefined()
      expect(a.visible).toBeDefined()
      expect(a.action.confirm?.confirmLabel).toBe('Delete')
    })
  })

  describe('confirm() Helper', () => {
    test('creates basic confirm config', () => {
      const c = confirm('Title', 'Message')
      expect(c.title).toBe('Title')
      expect(c.message).toBe('Message')
      expect(c.confirmLabel).toBeUndefined()
      expect(c.cancelLabel).toBeUndefined()
    })

    test('creates confirm with custom labels', () => {
      const c = confirm('Delete?', 'Are you sure?', {
        confirmLabel: 'Yes, delete',
        cancelLabel: 'No, keep it'
      })
      expect(c.confirmLabel).toBe('Yes, delete')
      expect(c.cancelLabel).toBe('No, keep it')
    })
  })

  describe('Complex View Scenarios', () => {
    test('creates complete product create view', () => {
      const productCreateView = view('product-create', 'Create Product', '1.0.0')
        .entityRef('product')
        .mode('create')
        .description('Form for creating a new product')
        .tags('product', 'form', 'create')
        .layout(layout.form(2))
        .header(header('Create New Product', {
          subtitle: 'Enter product information',
        }))
        .sections(
          section('basicInfo')
            .title('Basic Information')
            .fields(
              viewField.textInput('nameInput', 'name').label('Product Name').build(),
              viewField.select('typeSelect', 'type').label('Product Type').build()
            )
            .build(),
          section('details')
            .title('Details')
            .collapsible()
            .fields(
              viewField.numberInput('floorsInput', 'floors').label('Floors').build(),
              viewField.numberInput('areaInput', 'totalArea').label('Total Area').build()
            )
            .build()
        )
        .footer(footer([
          viewAction.cancel('cancelBtn', 'Cancel').build(),
          viewAction.submit('createBtn', 'Create Product')
            .icon('plus')
            .disabled(['==', '$state.isValid', false])
            .build(),
        ]))
        .build()

      expect(productCreateView._type).toBe('view')
      expect(productCreateView.sections).toHaveLength(2)
      expect(productCreateView.header?.title).toBe('Create New Product')
      expect(productCreateView.footer?.actions).toHaveLength(2)
      expect(productCreateView.tags).toEqual(['product', 'form', 'create'])
    })

    test('creates wizard view with multiple steps', () => {
      const wizardView = view('onboarding-wizard', 'Onboarding Wizard')
        .entityRef('userOnboarding')
        .mode('create')
        .layout(layout.wizard())
        .sections(
          section('step1')
            .title('Personal Info')
            .fields(
              viewField.textInput('name', 'name').build(),
              viewField.textInput('email', 'email').build()
            )
            .build(),
          section('step2')
            .title('Preferences')
            .fields(
              viewField.select('theme', 'theme').build(),
              viewField.checkbox('notifications', 'notifications').build()
            )
            .build(),
          section('step3')
            .title('Review')
            .fields()
            .build()
        )
        .build()

      expect(wizardView.layout).toEqual({ type: 'wizard' })
      expect(wizardView.sections).toHaveLength(3)
    })

    test('creates conditional section visibility', () => {
      const formView = view('dynamic-form', 'Dynamic Form')
        .entityRef('form')
        .mode('create')
        .sections(
          section('basic')
            .title('Basic')
            .fields(
              viewField.select('category', 'category').build()
            )
            .build(),
          section('categoryA')
            .title('Category A Options')
            .visible(['==', '$state.category', 'A'])
            .fields(
              viewField.textInput('optionA', 'optionA').build()
            )
            .build(),
          section('categoryB')
            .title('Category B Options')
            .visible(['==', '$state.category', 'B'])
            .fields(
              viewField.textInput('optionB', 'optionB').build()
            )
            .build()
        )
        .build()

      expect(formView.sections[1].visible).toEqual(['==', '$state.category', 'A'])
      expect(formView.sections[2].visible).toEqual(['==', '$state.category', 'B'])
    })
  })
})
