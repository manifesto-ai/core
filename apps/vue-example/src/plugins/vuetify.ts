import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

export const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'light',
  },
  defaults: {
    VTextField: {
      variant: 'outlined',
      density: 'compact',
      hideDetails: 'auto',
    },
    VTextarea: {
      variant: 'outlined',
      density: 'compact',
      hideDetails: 'auto',
    },
    VSelect: {
      variant: 'outlined',
      density: 'compact',
      hideDetails: 'auto',
    },
    VAutocomplete: {
      variant: 'outlined',
      density: 'compact',
      hideDetails: 'auto',
    },
    VCheckbox: {
      density: 'compact',
      hideDetails: 'auto',
    },
    VSwitch: {
      density: 'compact',
      hideDetails: 'auto',
    },
    VRadioGroup: {
      density: 'compact',
      hideDetails: 'auto',
    },
    VSlider: {
      density: 'compact',
      hideDetails: 'auto',
    },
  },
})
