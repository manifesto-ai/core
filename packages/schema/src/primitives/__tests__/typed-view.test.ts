import { describe, expect, test } from 'vitest'
import { createTypedView } from '../typed-view'

type Person = {
  name: string
  age: number
  active: boolean
}

const v = createTypedView<Person>()

// @ts-expect-error field id must exist on schema
v.field('unknown')

describe('Typed View Builder', () => {
  test('produces view fields with id/entity binding', () => {
    const nameField = v.field('name').textInput('이름').placeholder('이름을 입력하세요').build()
    const ageField = v.field('age').numberInput('나이').props({ min: 0 }).build()

    expect(nameField.id).toBe('name')
    expect(nameField.entityFieldId).toBe('name')
    expect(nameField.label).toBe('이름')

    expect(ageField.id).toBe('age')
    expect(ageField.entityFieldId).toBe('age')
    expect(ageField.label).toBe('나이')
    expect(ageField.props).toEqual({ min: 0 })
  })

  test('supports overriding entityFieldId', () => {
    const field = v.field('name', 'fullName').textInput('성명').build()
    expect(field.entityFieldId).toBe('fullName')
  })

  test('typed actions enforce value types', () => {
    const setAge = v.actions.setValue('age', 20)
    expect(setAge).toEqual({ type: 'setValue', target: 'age', value: 20 })

    const toggleActive = v.actions.toggle('active')
    expect(toggleActive).toEqual({
      type: 'setValue',
      target: 'active',
      value: ['NOT', '$state.active'],
    })

    // @ts-expect-error wrong value type
    v.actions.setValue('age', 'not-a-number')

    // @ts-expect-error toggle only allows boolean fields
    v.actions.toggle('name')

    const setOptions = v.actions.setOptions('name', { type: 'static', static: [] })
    expect(setOptions).toEqual({
      type: 'setOptions',
      target: 'name',
      source: { type: 'static', static: [] },
    })

    const updateHidden = v.actions.updateProp('name', 'hidden', true)
    expect(updateHidden).toEqual({
      type: 'updateProp',
      target: 'name',
      prop: 'hidden',
      value: true,
    })

    // @ts-expect-error updateProp prop must be supported
    v.actions.updateProp('name', 'unknown' as any, true)
  })
})
