import DefaultTheme from 'vitepress/theme'
import { inject } from '@vercel/analytics'
import MermaidDiagram from './MermaidDiagram.vue'

export default {
  ...DefaultTheme,
  enhanceApp({ app }) {
    DefaultTheme.enhanceApp?.({ app })
    app.component('MermaidDiagram', MermaidDiagram)

    // Initialize Vercel Analytics (only in browser)
    if (typeof window !== 'undefined') {
      inject()
    }
  }
}
