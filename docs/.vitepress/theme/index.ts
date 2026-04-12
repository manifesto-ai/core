import { defineAsyncComponent } from 'vue'
import DefaultTheme from 'vitepress/theme'
import { inject } from '@vercel/analytics'
import MermaidDiagram from './MermaidDiagram.vue'
import MyLayout from './MyLayout.vue'
import './custom.css'

export default {
  ...DefaultTheme,
  Layout: MyLayout,
  enhanceApp({ app }) {
    DefaultTheme.enhanceApp?.({ app })
    app.component('MermaidDiagram', MermaidDiagram)
    app.component('HomeCodeExample', defineAsyncComponent(() => import('./components/HomeCodeExample.vue')))

    // Initialize Vercel Analytics (only in browser)
    if (typeof window !== 'undefined') {
      inject()
    }
  }
}
