import { describe, test, expect } from 'vitest'
import {
  viewField,
  on,
  actions,
  dataSource,
  type ViewFieldBuilder,
  type ReactionBuilder,
} from '../view'

describe('View Primitives', () => {
  describe('ViewField Constructors', () => {
    test('viewField.textInput() creates text-input component', () => {
      const f = viewField.textInput('nameInput', 'name').build()
      expect(f.id).toBe('nameInput')
      expect(f.entityFieldId).toBe('name')
      expect(f.component).toBe('text-input')
    })

    test('viewField.numberInput() creates number-input component', () => {
      const f = viewField.numberInput('ageInput', 'age').build()
      expect(f.component).toBe('number-input')
    })

    test('viewField.select() creates select component', () => {
      const f = viewField.select('statusSelect', 'status').build()
      expect(f.component).toBe('select')
    })

    test('viewField.multiSelect() creates multi-select component', () => {
      const f = viewField.multiSelect('tagsSelect', 'tags').build()
      expect(f.component).toBe('multi-select')
    })

    test('viewField.checkbox() creates checkbox component', () => {
      const f = viewField.checkbox('activeCheck', 'active').build()
      expect(f.component).toBe('checkbox')
    })

    test('viewField.radio() creates radio component', () => {
      const f = viewField.radio('typeRadio', 'type').build()
      expect(f.component).toBe('radio')
    })

    test('viewField.datePicker() creates date-picker component', () => {
      const f = viewField.datePicker('birthDatePicker', 'birthDate').build()
      expect(f.component).toBe('date-picker')
    })

    test('viewField.datetimePicker() creates datetime-picker component', () => {
      const f = viewField.datetimePicker('createdAtPicker', 'createdAt').build()
      expect(f.component).toBe('datetime-picker')
    })

    test('viewField.textarea() creates textarea component', () => {
      const f = viewField.textarea('descriptionArea', 'description').build()
      expect(f.component).toBe('textarea')
    })

    test('viewField.richEditor() creates rich-editor component', () => {
      const f = viewField.richEditor('contentEditor', 'content').build()
      expect(f.component).toBe('rich-editor')
    })

    test('viewField.fileUpload() creates file-upload component', () => {
      const f = viewField.fileUpload('documentUpload', 'document').build()
      expect(f.component).toBe('file-upload')
    })

    test('viewField.imageUpload() creates image-upload component', () => {
      const f = viewField.imageUpload('photoUpload', 'photo').build()
      expect(f.component).toBe('image-upload')
    })

    test('viewField.autocomplete() creates autocomplete component', () => {
      const f = viewField.autocomplete('cityAutocomplete', 'city').build()
      expect(f.component).toBe('autocomplete')
    })

    test('viewField.toggle() creates toggle component', () => {
      const f = viewField.toggle('enabledToggle', 'enabled').build()
      expect(f.component).toBe('toggle')
    })

    test('viewField.slider() creates slider component', () => {
      const f = viewField.slider('volumeSlider', 'volume').build()
      expect(f.component).toBe('slider')
    })

    test('viewField.colorPicker() creates color-picker component', () => {
      const f = viewField.colorPicker('themePicker', 'themeColor').build()
      expect(f.component).toBe('color-picker')
    })

    test('viewField.custom() creates custom component', () => {
      const f = viewField.custom('mapInput', 'location', 'MyMapComponent').build()
      expect(f.component).toBe('custom')
      expect(f.props?.customComponent).toBe('MyMapComponent')
    })
  })

  describe('ViewFieldBuilder Methods', () => {
    test('label() sets field label', () => {
      const f = viewField.textInput('nameInput', 'name')
        .label('Full Name')
        .build()
      expect(f.label).toBe('Full Name')
    })

    test('placeholder() sets placeholder text', () => {
      const f = viewField.textInput('emailInput', 'email')
        .placeholder('Enter your email')
        .build()
      expect(f.placeholder).toBe('Enter your email')
    })

    test('helpText() sets help text', () => {
      const f = viewField.textInput('passwordInput', 'password')
        .helpText('Minimum 8 characters')
        .build()
      expect(f.helpText).toBe('Minimum 8 characters')
    })

    test('props() sets component props', () => {
      const f = viewField.numberInput('ageInput', 'age')
        .props({ min: 0, max: 150, step: 1 })
        .build()
      expect(f.props?.min).toBe(0)
      expect(f.props?.max).toBe(150)
      expect(f.props?.step).toBe(1)
    })

    test('props() merges with existing props', () => {
      const f = viewField.custom('mapInput', 'location', 'MapComponent')
        .props({ zoom: 10 })
        .build()
      expect(f.props?.customComponent).toBe('MapComponent')
      expect(f.props?.zoom).toBe(10)
    })

    test('styles() sets style config', () => {
      const f = viewField.textInput('nameInput', 'name')
        .styles({ className: 'input-lg', width: '100%' })
        .build()
      expect(f.styles?.className).toBe('input-lg')
      expect(f.styles?.width).toBe('100%')
    })

    test('dependsOn() sets field dependencies', () => {
      const f = viewField.select('citySelect', 'city')
        .dependsOn('country')
        .build()
      expect(f.dependsOn).toContain('country')
    })

    test('dependsOn() accumulates multiple dependencies', () => {
      const f = viewField.select('districtSelect', 'district')
        .dependsOn('country')
        .dependsOn('city')
        .build()
      expect(f.dependsOn).toEqual(['country', 'city'])
    })

    test('dependsOn() accepts multiple fields at once', () => {
      const f = viewField.select('districtSelect', 'district')
        .dependsOn('country', 'city', 'state')
        .build()
      expect(f.dependsOn).toEqual(['country', 'city', 'state'])
    })

    test('reaction() adds a reaction', () => {
      const reaction = on.change().do(
        actions.setValue('total', ['*', '$state.price', '$state.quantity'])
      )
      const f = viewField.numberInput('priceInput', 'price')
        .reaction(reaction)
        .build()
      expect(f.reactions).toHaveLength(1)
      expect(f.reactions?.[0].trigger).toBe('change')
    })

    test('reaction() accumulates multiple reactions', () => {
      const f = viewField.numberInput('quantityInput', 'quantity')
        .reaction(on.change().do(actions.setValue('total', 100)))
        .reaction(on.blur().do(actions.validate(['quantity'])))
        .build()
      expect(f.reactions).toHaveLength(2)
    })

    test('hidden() creates hidden reaction', () => {
      const f = viewField.textInput('detailInput', 'detail')
        .hidden(['==', '$state.showDetail', false])
        .build()
      expect(f.reactions).toHaveLength(1)
      expect(f.reactions?.[0].trigger).toBe('change')
      expect(f.reactions?.[0].actions[0].type).toBe('updateProp')
      expect(f.reactions?.[0].actions[0].prop).toBe('hidden')
    })

    test('disabled() creates disabled reaction', () => {
      const f = viewField.textInput('editInput', 'editValue')
        .disabled(['==', '$state.isReadOnly', true])
        .build()
      expect(f.reactions).toHaveLength(1)
      expect(f.reactions?.[0].actions[0].type).toBe('updateProp')
      expect(f.reactions?.[0].actions[0].prop).toBe('disabled')
    })

    test('order() sets field order', () => {
      const f = viewField.textInput('firstInput', 'first')
        .order(1)
        .build()
      expect(f.order).toBe(1)
    })

    test('span() sets column span', () => {
      const f = viewField.textarea('descriptionArea', 'description')
        .span(2)
        .build()
      expect(f.colSpan).toBe(2)
      expect(f.rowSpan).toBeUndefined()
    })

    test('span() sets column and row span', () => {
      const f = viewField.textarea('descriptionArea', 'description')
        .span(2, 3)
        .build()
      expect(f.colSpan).toBe(2)
      expect(f.rowSpan).toBe(3)
    })

    test('method chaining works correctly', () => {
      const f = viewField.textInput('nameInput', 'name')
        .label('Name')
        .placeholder('Enter name')
        .helpText('Your full name')
        .props({ maxLength: 100 })
        .order(1)
        .span(2)
        .build()

      expect(f.label).toBe('Name')
      expect(f.placeholder).toBe('Enter name')
      expect(f.helpText).toBe('Your full name')
      expect(f.props?.maxLength).toBe(100)
      expect(f.order).toBe(1)
      expect(f.colSpan).toBe(2)
    })
  })

  describe('Builder Immutability', () => {
    test('each method returns new builder instance', () => {
      const builder1 = viewField.textInput('input', 'field')
      const builder2 = builder1.label('Label')
      const builder3 = builder2.placeholder('Placeholder')

      const f1 = builder1.build()
      const f2 = builder2.build()
      const f3 = builder3.build()

      expect(f1.label).toBeUndefined()
      expect(f2.label).toBe('Label')
      expect(f2.placeholder).toBeUndefined()
      expect(f3.label).toBe('Label')
      expect(f3.placeholder).toBe('Placeholder')
    })
  })

  describe('Reaction Builder (on)', () => {
    test('on.change() creates change trigger', () => {
      const reaction = on.change().do(actions.setValue('target', 'value'))
      expect(reaction.trigger).toBe('change')
    })

    test('on.blur() creates blur trigger', () => {
      const reaction = on.blur().do(actions.validate())
      expect(reaction.trigger).toBe('blur')
    })

    test('on.focus() creates focus trigger', () => {
      const reaction = on.focus().do(actions.emit('focused'))
      expect(reaction.trigger).toBe('focus')
    })

    test('on.mount() creates mount trigger', () => {
      const reaction = on.mount().do(actions.emit('mounted'))
      expect(reaction.trigger).toBe('mount')
    })

    test('on.unmount() creates unmount trigger', () => {
      const reaction = on.unmount().do(actions.emit('unmounted'))
      expect(reaction.trigger).toBe('unmount')
    })

    test('when() adds condition', () => {
      const reaction = on.change()
        .when(['>', '$state.value', 0])
        .do(actions.setValue('isPositive', true))
      expect(reaction.condition).toEqual(['>', '$state.value', 0])
    })

    test('debounce() sets debounce time', () => {
      const reaction = on.change()
        .debounce(300)
        .do(actions.validate())
      expect(reaction.debounce).toBe(300)
    })

    test('throttle() sets throttle time', () => {
      const reaction = on.change()
        .throttle(500)
        .do(actions.emit('typed'))
      expect(reaction.throttle).toBe(500)
    })

    test('do() accepts multiple actions', () => {
      const reaction = on.change().do(
        actions.setValue('target1', 'value1'),
        actions.setValue('target2', 'value2'),
        actions.validate(['target1', 'target2'])
      )
      expect(reaction.actions).toHaveLength(3)
    })

    test('chained reaction builder', () => {
      const reaction = on.change()
        .when(['!=', '$state.value', ''])
        .debounce(200)
        .do(
          actions.setValue('computed', ['UPPER', '$state.value']),
          actions.emit('valueChanged', { value: '$state.value' })
        )

      expect(reaction.trigger).toBe('change')
      expect(reaction.condition).toEqual(['!=', '$state.value', ''])
      expect(reaction.debounce).toBe(200)
      expect(reaction.actions).toHaveLength(2)
    })
  })

  describe('Actions Helper', () => {
    test('actions.setValue() creates setValue action', () => {
      const action = actions.setValue('targetField', '$state.sourceField')
      expect(action.type).toBe('setValue')
      expect(action.target).toBe('targetField')
      expect(action.value).toBe('$state.sourceField')
    })

    test('actions.setValue() with expression', () => {
      const action = actions.setValue('total', ['*', '$state.price', '$state.qty'])
      expect(action.value).toEqual(['*', '$state.price', '$state.qty'])
    })

    test('actions.setOptions() creates setOptions action', () => {
      const source = dataSource.api('/api/cities', { dependsOn: ['country'] })
      const action = actions.setOptions('citySelect', source)
      expect(action.type).toBe('setOptions')
      expect(action.target).toBe('citySelect')
      expect(action.source).toBe(source)
    })

    test('actions.updateProp() creates updateProp action', () => {
      const action = actions.updateProp('inputField', 'disabled', true)
      expect(action.type).toBe('updateProp')
      expect(action.target).toBe('inputField')
      expect(action.prop).toBe('disabled')
      expect(action.value).toBe(true)
    })

    test('actions.updateProp() with expression', () => {
      const action = actions.updateProp('field', 'hidden', ['==', '$state.mode', 'readonly'])
      expect(action.value).toEqual(['==', '$state.mode', 'readonly'])
    })

    test('actions.validate() creates validate action without targets', () => {
      const action = actions.validate()
      expect(action.type).toBe('validate')
      expect(action.targets).toBeUndefined()
      expect(action.mode).toBe('visible')
    })

    test('actions.validate() creates validate action with targets', () => {
      const action = actions.validate(['field1', 'field2'])
      expect(action.targets).toEqual(['field1', 'field2'])
    })

    test('actions.validate() creates silent validation', () => {
      const action = actions.validate(['field1'], 'silent')
      expect(action.mode).toBe('silent')
    })

    test('actions.navigate() creates navigate action', () => {
      const action = actions.navigate('/users/123')
      expect(action.type).toBe('navigate')
      expect(action.path).toBe('/users/123')
    })

    test('actions.navigate() with params', () => {
      const action = actions.navigate('/users/:id', { id: '$state.userId' })
      expect(action.params).toEqual({ id: '$state.userId' })
    })

    test('actions.emit() creates emit action', () => {
      const action = actions.emit('customEvent')
      expect(action.type).toBe('emit')
      expect(action.event).toBe('customEvent')
      expect(action.payload).toBeUndefined()
    })

    test('actions.emit() with payload', () => {
      const action = actions.emit('dataChanged', { id: '$state.id', value: '$state.value' })
      expect(action.payload).toEqual({ id: '$state.id', value: '$state.value' })
    })
  })

  describe('DataSource Helper', () => {
    test('dataSource.static() creates static data source', () => {
      const source = dataSource.static([
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ])
      expect(source.type).toBe('static')
      expect(source.static).toHaveLength(2)
      expect(source.static?.[0].value).toBe('active')
    })

    test('dataSource.api() creates api data source', () => {
      const source = dataSource.api('/api/options')
      expect(source.type).toBe('api')
      expect(source.api?.endpoint).toBe('/api/options')
    })

    test('dataSource.api() with options', () => {
      const source = dataSource.api('/api/cities', {
        dependsOn: ['countryId'],
        params: { countryId: '$state.countryId' },
        valueField: 'id',
        labelField: 'name',
        cache: true,
      })
      expect(source.api?.dependsOn).toEqual(['countryId'])
      expect(source.api?.params).toEqual({ countryId: '$state.countryId' })
      expect(source.api?.valueField).toBe('id')
      expect(source.api?.labelField).toBe('name')
      expect(source.api?.cache).toBe(true)
    })

    test('dataSource.derived() creates derived data source', () => {
      const source = dataSource.derived([
        'IF',
        ['==', '$state.type', 'A'],
        [{ value: 'a1', label: 'A1' }, { value: 'a2', label: 'A2' }],
        [{ value: 'b1', label: 'B1' }, { value: 'b2', label: 'B2' }],
      ])
      expect(source.type).toBe('derived')
      expect(source.derived).toBeDefined()
    })
  })

  describe('Complex View Field Scenarios', () => {
    test('creates cascading select with dependencies', () => {
      const cityField = viewField.select('citySelect', 'city')
        .label('City')
        .dependsOn('country')
        .reaction(
          on.mount().do(
            actions.setOptions('citySelect', dataSource.api('/api/cities', {
              dependsOn: ['country'],
              params: { countryId: '$state.country' },
            }))
          )
        )
        .build()

      expect(cityField.dependsOn).toContain('country')
      expect(cityField.reactions?.[0].trigger).toBe('mount')
    })

    test('creates conditional field with multiple reactions', () => {
      const detailField = viewField.textarea('detailInput', 'detail')
        .label('Additional Details')
        .hidden(['==', '$state.needsDetail', false])
        .reaction(
          on.change()
            .when(['==', '$state.needsDetail', true])
            .debounce(300)
            .do(actions.validate(['detail']))
        )
        .build()

      expect(detailField.reactions).toHaveLength(2) // hidden + change reaction
    })

    test('creates computed field with formula', () => {
      const totalField = viewField.numberInput('totalDisplay', 'total')
        .label('Total')
        .disabled(true)
        .reaction(
          on.change()
            .do(actions.setValue('total', ['*', '$state.quantity', '$state.unitPrice']))
        )
        .build()

      expect(totalField.reactions).toHaveLength(2) // disabled + change reaction
    })
  })
})
