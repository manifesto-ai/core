import { createApp } from 'vue'
import App from './App.vue'
import { vuetify } from './plugins/vuetify'
import '@manifesto-ai/vue/dist/index.css'

createApp(App).use(vuetify).mount('#app')
