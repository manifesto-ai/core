import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { FormViewSchema, EntitySchema } from '@manifesto-ai/schema'
import { FieldRendererRegistry } from '@manifesto-ai/ui'
import TextField from '../components/fields/TextField.vue'
import NumberField from '../components/fields/NumberField.vue'
import CheckboxField from '../components/fields/CheckboxField.vue'
import FormRenderer from '../components/form/FormRenderer.vue'

// ============================================================================
// Test Schemas
// ============================================================================

const simpleForm: FormViewSchema = {
  _type: 'view',
  id: 'simple-form',
  name: 'Simple Form',
  version: '1.0.0',
  entityRef: 'entity',
  mode: 'create',
  layout: { type: 'form' },
  sections: [
    {
      id: 'main',
      title: 'Main',
      layout: { type: 'grid', columns: 1 },
      fields: [
        {
          id: 'name',
          entityFieldId: 'name',
          component: 'text-input',
          label: 'Name',
          placeholder: 'Enter name',
        },
      ],
    },
  ],
}

const multiFieldForm: FormViewSchema = {
  _type: 'view',
  id: 'multi-field-form',
  name: 'Multi Field Form',
  version: '1.0.0',
  entityRef: 'user',
  mode: 'create',
  layout: { type: 'form' },
  sections: [
    {
      id: 'personal',
      title: 'Personal Info',
      layout: { type: 'grid', columns: 2 },
      fields: [
        {
          id: 'firstName',
          entityFieldId: 'firstName',
          component: 'text-input',
          label: 'First Name',
          placeholder: 'Enter first name',
        },
        {
          id: 'lastName',
          entityFieldId: 'lastName',
          component: 'text-input',
          label: 'Last Name',
          placeholder: 'Enter last name',
        },
        {
          id: 'email',
          entityFieldId: 'email',
          component: 'text-input',
          label: 'Email',
          placeholder: 'Enter email',
        },
      ],
    },
  ],
}

const validationFormEntity: EntitySchema = {
  _type: 'entity',
  id: 'contact',
  name: 'Contact',
  version: '1.0.0',
  fields: [
    {
      id: 'email',
      name: 'email',
      label: 'Email',
      dataType: 'string',
      constraints: [
        { type: 'required' },
        { type: 'pattern', value: '^[^@]+@[^@]+\\.[^@]+$' },
      ],
    },
    {
      id: 'age',
      name: 'age',
      label: 'Age',
      dataType: 'number',
      constraints: [
        { type: 'min', value: 0 },
        { type: 'max', value: 150 },
      ],
    },
  ],
}

const validationForm: FormViewSchema = {
  _type: 'view',
  id: 'validation-form',
  name: 'Validation Form',
  version: '1.0.0',
  entityRef: 'contact',
  mode: 'create',
  layout: { type: 'form' },
  sections: [
    {
      id: 'main',
      title: 'Contact',
      layout: { type: 'grid', columns: 1 },
      fields: [
        {
          id: 'email',
          entityFieldId: 'email',
          component: 'text-input',
          label: 'Email',
          placeholder: 'Enter email',
        },
        {
          id: 'age',
          entityFieldId: 'age',
          component: 'number-input',
          label: 'Age',
          placeholder: 'Enter age',
        },
      ],
    },
  ],
}

const conditionalVisibilityForm: FormViewSchema = {
  _type: 'view',
  id: 'conditional-form',
  name: 'Conditional Form',
  version: '1.0.0',
  entityRef: 'order',
  mode: 'create',
  layout: { type: 'form' },
  sections: [
    {
      id: 'main',
      title: 'Order',
      layout: { type: 'grid', columns: 1 },
      fields: [
        {
          id: 'hasDiscount',
          entityFieldId: 'hasDiscount',
          component: 'checkbox',
          label: 'Apply Discount',
        },
        {
          id: 'discountCode',
          entityFieldId: 'discountCode',
          component: 'text-input',
          label: 'Discount Code',
          placeholder: 'Enter discount code',
          visibility: {
            _expr: 'eq',
            field: 'hasDiscount',
            value: true,
          },
        },
      ],
    },
  ],
}

const sectionVisibilityForm: FormViewSchema = {
  _type: 'view',
  id: 'section-visibility-form',
  name: 'Section Visibility Form',
  version: '1.0.0',
  entityRef: 'order',
  mode: 'create',
  layout: { type: 'form' },
  sections: [
    {
      id: 'controls',
      title: 'Controls',
      layout: { type: 'grid', columns: 1 },
      fields: [
        {
          id: 'showAdvanced',
          entityFieldId: 'showAdvanced',
          component: 'checkbox',
          label: 'Show Advanced Options',
        },
      ],
    },
    {
      id: 'advanced',
      title: 'Advanced Options',
      layout: { type: 'grid', columns: 1 },
      visible: {
        _expr: 'eq',
        field: 'showAdvanced',
        value: true,
      },
      fields: [
        {
          id: 'advancedSetting',
          entityFieldId: 'advancedSetting',
          component: 'text-input',
          label: 'Advanced Setting',
          placeholder: 'Enter advanced setting',
        },
      ],
    },
  ],
}

// Helper to create field registry
function createRegistry() {
  const registry = new FieldRendererRegistry()
  registry.register('text-input', TextField)
  registry.register('number-input', NumberField)
  registry.register('checkbox', CheckboxField)
  return registry
}

// Helper to wait for runtime initialization
async function waitForRuntime(wrapper: ReturnType<typeof mount>) {
  const runtime = (wrapper.vm as any).runtime
  for (let i = 0; i < 10; i++) {
    await flushPromises()
    await wrapper.vm.$nextTick()
    if (runtime.isInitialized?.value) break
  }
  return runtime
}

// ============================================================================
// Tests
// ============================================================================

describe('FormRenderer (Vue)', () => {
  describe('Basic Rendering', () => {
    it('renders and submits values', async () => {
      const onSubmit = vi.fn()
      const registry = createRegistry()

      const wrapper = mount(FormRenderer, {
        props: {
          schema: simpleForm,
          onSubmit,
          fieldRegistry: registry,
        },
      })

      const runtime = await waitForRuntime(wrapper)
      expect(runtime.isInitialized?.value).toBe(true)
      runtime.setFieldValue('name', 'Bob')

      const form = wrapper.find('form')
      expect(form.exists()).toBe(true)
      await form.trigger('submit')

      await wrapper.vm.$nextTick()
      expect(onSubmit).toHaveBeenCalledWith({ name: 'Bob' })
    })

    it('renders multiple sections and fields', async () => {
      const onSubmit = vi.fn()
      const registry = createRegistry()

      const wrapper = mount(FormRenderer, {
        props: {
          schema: multiFieldForm,
          onSubmit,
          fieldRegistry: registry,
        },
      })

      const runtime = await waitForRuntime(wrapper)
      expect(runtime.isInitialized?.value).toBe(true)

      // Set all field values
      runtime.setFieldValue('firstName', 'John')
      runtime.setFieldValue('lastName', 'Doe')
      runtime.setFieldValue('email', 'john@example.com')

      await flushPromises()
      await wrapper.vm.$nextTick()

      // Submit
      await wrapper.find('form').trigger('submit')
      await wrapper.vm.$nextTick()

      expect(onSubmit).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      })
    })

    it('renders with initial values', async () => {
      const registry = createRegistry()

      const wrapper = mount(FormRenderer, {
        props: {
          schema: simpleForm,
          initialValues: { name: 'Pre-filled' },
          fieldRegistry: registry,
        },
      })

      const runtime = await waitForRuntime(wrapper)
      expect(runtime.values.value.name).toBe('Pre-filled')
    })
  })

  describe('onChange Callback', () => {
    it('emits change event when field value changes', async () => {
      const registry = createRegistry()

      const wrapper = mount(FormRenderer, {
        props: {
          schema: simpleForm,
          fieldRegistry: registry,
        },
      })

      const runtime = await waitForRuntime(wrapper)

      runtime.setFieldValue('name', 'Test')
      await flushPromises()
      await wrapper.vm.$nextTick()

      const changeEvents = wrapper.emitted('change')
      expect(changeEvents).toBeTruthy()
      expect(changeEvents![0]).toEqual(['name', 'Test'])
    })
  })

  describe('Validation', () => {
    it('shows validation errors for pattern constraints', async () => {
      const onSubmit = vi.fn()
      const registry = createRegistry()

      const wrapper = mount(FormRenderer, {
        props: {
          schema: validationForm,
          entitySchema: validationFormEntity,
          onSubmit,
          fieldRegistry: registry,
        },
      })

      const runtime = await waitForRuntime(wrapper)

      // Enter invalid email
      runtime.setFieldValue('email', 'invalid-email')
      await flushPromises()

      // Submit
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('submits when all validations pass', async () => {
      const onSubmit = vi.fn()
      const registry = createRegistry()

      const wrapper = mount(FormRenderer, {
        props: {
          schema: validationForm,
          entitySchema: validationFormEntity,
          onSubmit,
          fieldRegistry: registry,
        },
      })

      const runtime = await waitForRuntime(wrapper)

      // Enter valid email
      runtime.setFieldValue('email', 'valid@example.com')
      await flushPromises()

      // Submit
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      const validateEvents = wrapper.emitted('validate')
      expect(validateEvents).toBeTruthy()
      expect(validateEvents![0]).toEqual([true])
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'valid@example.com' })
      )
    })

    it('shows validation errors for min/max constraints', async () => {
      const onSubmit = vi.fn()
      const registry = createRegistry()

      const wrapper = mount(FormRenderer, {
        props: {
          schema: validationForm,
          entitySchema: validationFormEntity,
          onSubmit,
          fieldRegistry: registry,
        },
      })

      const runtime = await waitForRuntime(wrapper)

      // Enter valid email
      runtime.setFieldValue('email', 'test@example.com')
      // Enter invalid age (negative)
      runtime.setFieldValue('age', -5)
      await flushPromises()

      // Submit
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(onSubmit).not.toHaveBeenCalled()
    })
  })

  describe('Runtime Ready Callback', () => {
    it('emits runtime-ready event when runtime is initialized', async () => {
      const registry = createRegistry()

      const wrapper = mount(FormRenderer, {
        props: {
          schema: simpleForm,
          fieldRegistry: registry,
        },
      })

      await waitForRuntime(wrapper)

      const runtimeReadyEvents = wrapper.emitted('runtime-ready')
      expect(runtimeReadyEvents).toBeTruthy()
      expect(runtimeReadyEvents![0][0]).toHaveProperty('dispatch')
      expect(runtimeReadyEvents![0][0]).toHaveProperty('subscribe')
    })
  })

  describe('Loading and Error States', () => {
    it('displays loading state before initialization', async () => {
      const registry = createRegistry()

      // Mount without waiting for runtime - check immediate state
      const wrapper = mount(FormRenderer, {
        props: {
          schema: simpleForm,
          fieldRegistry: registry,
        },
      })

      // Initially might show loading
      // After initialization completes, loading should disappear
      await waitForRuntime(wrapper)

      // Should not show loading after initialization
      expect(wrapper.find('.mvs-form__loading').exists()).toBe(false)
    })

    it('shows form content after initialization', async () => {
      const registry = createRegistry()

      const wrapper = mount(FormRenderer, {
        props: {
          schema: simpleForm,
          fieldRegistry: registry,
        },
      })

      await waitForRuntime(wrapper)

      // Wait for semantic tree rebuild
      for (let i = 0; i < 5; i++) {
        await flushPromises()
        await wrapper.vm.$nextTick()
      }

      // Should show form content
      expect(wrapper.find('form').exists()).toBe(true)
      expect(wrapper.find('input').exists()).toBe(true)
      expect(wrapper.find('.mvs-form__error').exists()).toBe(false)
    })
  })

  describe('Readonly Mode', () => {
    it('renders in readonly mode', async () => {
      const registry = createRegistry()

      const wrapper = mount(FormRenderer, {
        props: {
          schema: simpleForm,
          initialValues: { name: 'Read Only Value' },
          readonly: true,
          fieldRegistry: registry,
        },
      })

      const runtime = await waitForRuntime(wrapper)
      expect(runtime.isInitialized?.value).toBe(true)

      // Wait for semantic tree rebuild
      for (let i = 0; i < 5; i++) {
        await flushPromises()
        await wrapper.vm.$nextTick()
      }

      // Check that form exists
      const form = wrapper.find('form')
      expect(form.exists()).toBe(true)

      // Check that the input is readonly
      const input = wrapper.find('input')
      expect(input.exists()).toBe(true)
      // readonly attribute should be set
      expect(input.attributes('readonly')).toBe('')
    })
  })

  describe('Conditional Visibility', () => {
    it('shows field when visibility condition is met (includeHiddenFields=false)', async () => {
      const registry = createRegistry()

      const wrapper = mount(FormRenderer, {
        props: {
          schema: conditionalVisibilityForm,
          includeHiddenFields: false,
          fieldRegistry: registry,
        },
      })

      const runtime = await waitForRuntime(wrapper)
      expect(runtime.isInitialized?.value).toBe(true)

      // Wait for semantic tree rebuild
      for (let i = 0; i < 5; i++) {
        await flushPromises()
        await wrapper.vm.$nextTick()
      }

      // Initially discount code should be hidden (not in DOM)
      expect(wrapper.find('input[placeholder="Enter discount code"]').exists()).toBe(false)

      // Check the checkbox to show discount code
      runtime.setFieldValue('hasDiscount', true)

      // Wait for re-render
      for (let i = 0; i < 5; i++) {
        await flushPromises()
        await wrapper.vm.$nextTick()
      }

      // Discount code should now be visible
      expect(wrapper.find('input[placeholder="Enter discount code"]').exists()).toBe(true)
    })

    it('hides field when visibility condition is not met (includeHiddenFields=false)', async () => {
      const registry = createRegistry()

      const wrapper = mount(FormRenderer, {
        props: {
          schema: conditionalVisibilityForm,
          initialValues: { hasDiscount: true },
          includeHiddenFields: false,
          fieldRegistry: registry,
        },
      })

      const runtime = await waitForRuntime(wrapper)
      expect(runtime.isInitialized?.value).toBe(true)

      // Wait for semantic tree rebuild
      for (let i = 0; i < 5; i++) {
        await flushPromises()
        await wrapper.vm.$nextTick()
      }

      // Discount code should be visible initially
      expect(wrapper.find('input[placeholder="Enter discount code"]').exists()).toBe(true)

      // Uncheck to hide discount code
      runtime.setFieldValue('hasDiscount', false)

      // Wait for re-render
      for (let i = 0; i < 5; i++) {
        await flushPromises()
        await wrapper.vm.$nextTick()
      }

      // Discount code should be hidden
      expect(wrapper.find('input[placeholder="Enter discount code"]').exists()).toBe(false)
    })

    it('includes hidden fields in DOM when includeHiddenFields=true (default)', async () => {
      const registry = createRegistry()

      const wrapper = mount(FormRenderer, {
        props: {
          schema: conditionalVisibilityForm,
          fieldRegistry: registry,
        },
      })

      const runtime = await waitForRuntime(wrapper)
      expect(runtime.isInitialized?.value).toBe(true)

      // Wait for semantic tree rebuild
      for (let i = 0; i < 5; i++) {
        await flushPromises()
        await wrapper.vm.$nextTick()
      }

      // With includeHiddenFields=true (default), field is in DOM even when hidden
      const field = wrapper.find('input[placeholder="Enter discount code"]')
      expect(field.exists()).toBe(true)

      // But it should have hidden styling
      const fieldRow = wrapper.find('[data-field-id="discountCode"]')
      expect(fieldRow.attributes('data-hidden')).toBe('true')
    })
  })

  describe('Section Visibility', () => {
    it('hides section when visible condition is not met', async () => {
      const registry = createRegistry()

      const wrapper = mount(FormRenderer, {
        props: {
          schema: sectionVisibilityForm,
          fieldRegistry: registry,
        },
      })

      await waitForRuntime(wrapper)

      // Wait for render
      for (let i = 0; i < 5; i++) {
        await flushPromises()
        await wrapper.vm.$nextTick()
      }

      // Controls section should be visible (check by section title in header)
      expect(wrapper.find('[data-section-id="controls"]').exists()).toBe(true)

      // Advanced section should be hidden initially (no section element or no advanced input)
      const advancedSection = wrapper.find('[data-section-id="advanced"]')
      expect(advancedSection.exists()).toBe(false)
      expect(wrapper.find('input[placeholder="Enter advanced setting"]').exists()).toBe(false)
    })

    it('shows section when visible condition is met', async () => {
      const registry = createRegistry()

      const wrapper = mount(FormRenderer, {
        props: {
          schema: sectionVisibilityForm,
          fieldRegistry: registry,
        },
      })

      const runtime = await waitForRuntime(wrapper)

      // Set showAdvanced to true
      runtime.setFieldValue('showAdvanced', true)

      // Wait for render
      for (let i = 0; i < 5; i++) {
        await flushPromises()
        await wrapper.vm.$nextTick()
      }

      // Advanced section should now be visible
      const advancedSection = wrapper.find('[data-section-id="advanced"]')
      expect(advancedSection.exists()).toBe(true)
      expect(wrapper.find('input[placeholder="Enter advanced setting"]').exists()).toBe(true)
    })

    it('hides section when visible condition becomes false', async () => {
      const registry = createRegistry()

      const wrapper = mount(FormRenderer, {
        props: {
          schema: sectionVisibilityForm,
          fieldRegistry: registry,
          initialValues: { showAdvanced: true },
        },
      })

      const runtime = await waitForRuntime(wrapper)

      // Wait for render
      for (let i = 0; i < 5; i++) {
        await flushPromises()
        await wrapper.vm.$nextTick()
      }

      // Advanced section should be visible initially
      expect(wrapper.find('[data-section-id="advanced"]').exists()).toBe(true)

      // Set showAdvanced to false
      runtime.setFieldValue('showAdvanced', false)

      // Wait for render
      for (let i = 0; i < 5; i++) {
        await flushPromises()
        await wrapper.vm.$nextTick()
      }

      // Advanced section should now be hidden
      expect(wrapper.find('[data-section-id="advanced"]').exists()).toBe(false)
    })
  })
})
