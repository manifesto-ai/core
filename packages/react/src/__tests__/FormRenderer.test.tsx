import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent, waitFor, screen } from '@testing-library/react'
import type { FormViewSchema, EntitySchema } from '@manifesto-ai/schema'
import { FormRenderer } from '../components/form/FormRenderer'

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
    {
      id: 'preferences',
      title: 'Preferences',
      layout: { type: 'grid', columns: 1 },
      fields: [
        {
          id: 'newsletter',
          entityFieldId: 'newsletter',
          component: 'checkbox',
          label: 'Subscribe to newsletter',
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
      // Section visible when showAdvanced is true
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

const conditionalDisabledForm: FormViewSchema = {
  _type: 'view',
  id: 'disabled-form',
  name: 'Disabled Form',
  version: '1.0.0',
  entityRef: 'settings',
  mode: 'edit',
  layout: { type: 'form' },
  sections: [
    {
      id: 'main',
      title: 'Settings',
      layout: { type: 'grid', columns: 1 },
      fields: [
        {
          id: 'isLocked',
          entityFieldId: 'isLocked',
          component: 'checkbox',
          label: 'Lock Settings',
        },
        {
          id: 'configValue',
          entityFieldId: 'configValue',
          component: 'text-input',
          label: 'Config Value',
          placeholder: 'Enter value',
          disabled: {
            _expr: 'eq',
            field: 'isLocked',
            value: true,
          },
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

// ============================================================================
// Tests
// ============================================================================

describe('FormRenderer', () => {
  describe('Basic Rendering', () => {
    it('renders fields and submits values', async () => {
      const handleSubmit = vi.fn()
      const { getByPlaceholderText, getByText } = render(
        <FormRenderer schema={simpleForm} onSubmit={handleSubmit} />
      )

      const input = await waitFor(() => getByPlaceholderText('Enter name'))
      fireEvent.change(input, { target: { value: 'Alice' } })

      const submit = getByText('Submit')
      fireEvent.click(submit)

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith({ name: 'Alice' })
      })
    })

    it('renders multiple sections and fields', async () => {
      const handleSubmit = vi.fn()
      render(<FormRenderer schema={multiFieldForm} onSubmit={handleSubmit} />)

      // Wait for form to initialize
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter first name')).toBeTruthy()
      })

      // Fill all fields
      fireEvent.change(screen.getByPlaceholderText('Enter first name'), {
        target: { value: 'John' },
      })
      fireEvent.change(screen.getByPlaceholderText('Enter last name'), {
        target: { value: 'Doe' },
      })
      fireEvent.change(screen.getByPlaceholderText('Enter email'), {
        target: { value: 'john@example.com' },
      })

      // Submit
      fireEvent.click(screen.getByText('Submit'))

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        })
      })
    })

    it('renders with initial values', async () => {
      render(
        <FormRenderer
          schema={simpleForm}
          initialValues={{ name: 'Pre-filled' }}
        />
      )

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Enter name') as HTMLInputElement
        expect(input.value).toBe('Pre-filled')
      })
    })
  })

  describe('onChange Callback', () => {
    it('calls onChange when field value changes', async () => {
      const handleChange = vi.fn()
      render(<FormRenderer schema={simpleForm} onChange={handleChange} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter name')).toBeTruthy()
      })

      fireEvent.change(screen.getByPlaceholderText('Enter name'), {
        target: { value: 'Test' },
      })

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledWith('name', 'Test')
      })
    })

    it('calls onChange for each field change', async () => {
      const handleChange = vi.fn()
      render(<FormRenderer schema={multiFieldForm} onChange={handleChange} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter first name')).toBeTruthy()
      })

      fireEvent.change(screen.getByPlaceholderText('Enter first name'), {
        target: { value: 'Jane' },
      })
      fireEvent.change(screen.getByPlaceholderText('Enter last name'), {
        target: { value: 'Smith' },
      })

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledWith('firstName', 'Jane')
        expect(handleChange).toHaveBeenCalledWith('lastName', 'Smith')
      })
    })
  })

  describe('Conditional Visibility', () => {
    it('shows field when visibility condition is met (includeHiddenFields=false)', async () => {
      render(
        <FormRenderer
          schema={conditionalVisibilityForm}
          includeHiddenFields={false}
        />
      )

      await waitFor(() => {
        expect(screen.getByLabelText('Apply Discount')).toBeTruthy()
      })

      // Initially discount code should be hidden
      expect(screen.queryByPlaceholderText('Enter discount code')).toBeNull()

      // Check the checkbox
      const checkbox = screen.getByLabelText('Apply Discount')
      fireEvent.click(checkbox)

      // Discount code should now be visible
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter discount code')).toBeTruthy()
      })
    })

    it('hides field when visibility condition is not met (includeHiddenFields=false)', async () => {
      render(
        <FormRenderer
          schema={conditionalVisibilityForm}
          initialValues={{ hasDiscount: true }}
          includeHiddenFields={false}
        />
      )

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter discount code')).toBeTruthy()
      })

      // Uncheck the checkbox
      const checkbox = screen.getByLabelText('Apply Discount')
      fireEvent.click(checkbox)

      // Discount code should be hidden
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Enter discount code')).toBeNull()
      })
    })

    it('excludes hidden fields from submit data', async () => {
      const handleSubmit = vi.fn()
      render(
        <FormRenderer
          schema={conditionalVisibilityForm}
          initialValues={{ hasDiscount: true, discountCode: 'SAVE10' }}
          includeHiddenFields={false}
          onSubmit={handleSubmit}
        />
      )

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter discount code')).toBeTruthy()
      })

      // Uncheck to hide discount code
      fireEvent.click(screen.getByLabelText('Apply Discount'))

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Enter discount code')).toBeNull()
      })

      // Submit
      fireEvent.click(screen.getByText('Submit'))

      await waitFor(() => {
        // discountCode should NOT be in the submit data because it's hidden
        expect(handleSubmit).toHaveBeenCalled()
        const submitData = handleSubmit.mock.calls[0][0]
        expect(submitData).not.toHaveProperty('discountCode')
      })
    })

    it('includes hidden fields in DOM when includeHiddenFields=true (default)', async () => {
      render(<FormRenderer schema={conditionalVisibilityForm} />)

      await waitFor(() => {
        expect(screen.getByLabelText('Apply Discount')).toBeTruthy()
      })

      // With includeHiddenFields=true (default), field is in DOM even when hidden
      // The field should be present but potentially with hidden styling
      const field = screen.queryByPlaceholderText('Enter discount code')
      // Field exists in DOM (semantic tree includes it)
      expect(field).toBeTruthy()
    })
  })

  describe('Conditional Disabled', () => {
    it('disables field when disabled condition is met', async () => {
      render(<FormRenderer schema={conditionalDisabledForm} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter value')).toBeTruthy()
      })

      // Initially should be enabled
      const input = screen.getByPlaceholderText('Enter value') as HTMLInputElement
      expect(input.disabled).toBe(false)

      // Check the lock checkbox
      fireEvent.click(screen.getByLabelText('Lock Settings'))

      // Input should now be disabled
      await waitFor(() => {
        expect(input.disabled).toBe(true)
      })
    })

    it('enables field when disabled condition is not met', async () => {
      render(
        <FormRenderer
          schema={conditionalDisabledForm}
          initialValues={{ isLocked: true }}
        />
      )

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Enter value') as HTMLInputElement
        expect(input.disabled).toBe(true)
      })

      // Uncheck the lock
      fireEvent.click(screen.getByLabelText('Lock Settings'))

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Enter value') as HTMLInputElement
        expect(input.disabled).toBe(false)
      })
    })
  })

  describe('Validation', () => {
    it('shows validation errors for required fields on submit', async () => {
      const handleSubmit = vi.fn()
      render(
        <FormRenderer
          schema={validationForm}
          entitySchema={validationFormEntity}
          onSubmit={handleSubmit}
        />
      )

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter email')).toBeTruthy()
      })

      // Submit without filling required field
      fireEvent.click(screen.getByText('Submit'))

      // Check that error message is displayed
      await waitFor(() => {
        expect(screen.getByText('필수 항목입니다')).toBeTruthy()
      })

      // Submit should not be called when validation fails
      expect(handleSubmit).not.toHaveBeenCalled()
    })

    it('shows validation errors for pattern constraints', async () => {
      const handleSubmit = vi.fn()
      render(
        <FormRenderer
          schema={validationForm}
          entitySchema={validationFormEntity}
          onSubmit={handleSubmit}
        />
      )

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter email')).toBeTruthy()
      })

      // Enter invalid email
      fireEvent.change(screen.getByPlaceholderText('Enter email'), {
        target: { value: 'invalid-email' },
      })

      fireEvent.click(screen.getByText('Submit'))

      await waitFor(() => {
        expect(handleSubmit).not.toHaveBeenCalled()
      })
    })

    it('submits when all validations pass', async () => {
      const handleSubmit = vi.fn()
      const handleValidate = vi.fn()
      render(
        <FormRenderer
          schema={validationForm}
          entitySchema={validationFormEntity}
          onSubmit={handleSubmit}
          onValidate={handleValidate}
        />
      )

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter email')).toBeTruthy()
      })

      // Enter valid email
      fireEvent.change(screen.getByPlaceholderText('Enter email'), {
        target: { value: 'valid@example.com' },
      })

      fireEvent.click(screen.getByText('Submit'))

      await waitFor(() => {
        expect(handleValidate).toHaveBeenCalledWith(true)
        expect(handleSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ email: 'valid@example.com' })
        )
      })
    })

    it('shows validation errors for min/max constraints', async () => {
      const handleSubmit = vi.fn()
      render(
        <FormRenderer
          schema={validationForm}
          entitySchema={validationFormEntity}
          onSubmit={handleSubmit}
        />
      )

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter email')).toBeTruthy()
      })

      // Enter valid email
      fireEvent.change(screen.getByPlaceholderText('Enter email'), {
        target: { value: 'test@example.com' },
      })

      // Enter invalid age (negative)
      fireEvent.change(screen.getByPlaceholderText('Enter age'), {
        target: { value: '-5' },
      })

      fireEvent.click(screen.getByText('Submit'))

      await waitFor(() => {
        expect(handleSubmit).not.toHaveBeenCalled()
      })
    })

    it('disables submit button when form is invalid', async () => {
      render(
        <FormRenderer
          schema={validationForm}
          entitySchema={validationFormEntity}
        />
      )

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter email')).toBeTruthy()
      })

      // Submit to trigger validation
      fireEvent.click(screen.getByText('Submit'))

      await waitFor(() => {
        const submitButton = screen.getByText('Submit') as HTMLButtonElement
        expect(submitButton.disabled).toBe(true)
      })
    })
  })

  describe('Runtime Ready Callback', () => {
    it('calls onRuntimeReady when runtime is initialized', async () => {
      const handleRuntimeReady = vi.fn()
      render(
        <FormRenderer schema={simpleForm} onRuntimeReady={handleRuntimeReady} />
      )

      await waitFor(() => {
        expect(handleRuntimeReady).toHaveBeenCalled()
        expect(handleRuntimeReady.mock.calls[0][0]).toHaveProperty('dispatch')
        expect(handleRuntimeReady.mock.calls[0][0]).toHaveProperty('subscribe')
      })
    })
  })

  describe('Error Handling', () => {
    it('displays loading state before initialization', () => {
      // Use a null schema to prevent initialization
      const { container } = render(
        <FormRenderer schema={null as unknown as FormViewSchema} />
      )

      expect(container.querySelector('.mfs-form__loading')).toBeTruthy()
    })
  })

  describe('Readonly Mode', () => {
    it('renders in readonly mode', async () => {
      render(
        <FormRenderer
          schema={simpleForm}
          initialValues={{ name: 'Read Only Value' }}
          readonly={true}
        />
      )

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Enter name') as HTMLInputElement
        expect(input.readOnly || input.disabled).toBe(true)
      })
    })
  })

  describe('Section Visibility', () => {
    it('hides section when visible condition is not met', async () => {
      render(<FormRenderer schema={sectionVisibilityForm} />)

      await waitFor(() => {
        expect(screen.getByLabelText('Show Advanced Options')).toBeTruthy()
      })

      // Advanced section should be hidden initially (showAdvanced is false)
      expect(screen.queryByText('Advanced Options')).toBeNull()
      expect(screen.queryByPlaceholderText('Enter advanced setting')).toBeNull()
    })

    it('shows section when visible condition is met', async () => {
      render(<FormRenderer schema={sectionVisibilityForm} />)

      await waitFor(() => {
        expect(screen.getByLabelText('Show Advanced Options')).toBeTruthy()
      })

      // Check the checkbox to show advanced section
      fireEvent.click(screen.getByLabelText('Show Advanced Options'))

      // Advanced section should now be visible
      await waitFor(() => {
        expect(screen.getByText('Advanced Options')).toBeTruthy()
        expect(screen.getByPlaceholderText('Enter advanced setting')).toBeTruthy()
      })
    })

    it('hides section when visible condition becomes false', async () => {
      render(
        <FormRenderer
          schema={sectionVisibilityForm}
          initialValues={{ showAdvanced: true }}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Advanced Options')).toBeTruthy()
      })

      // Uncheck the checkbox
      fireEvent.click(screen.getByLabelText('Show Advanced Options'))

      // Advanced section should be hidden
      await waitFor(() => {
        expect(screen.queryByText('Advanced Options')).toBeNull()
      })
    })
  })
})
