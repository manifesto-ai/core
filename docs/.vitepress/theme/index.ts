import DefaultTheme from 'vitepress/theme'
import MermaidDiagram from './MermaidDiagram.vue'

export default {
  ...DefaultTheme,
  enhanceApp({ app }) {
    DefaultTheme.enhanceApp?.({ app })
    app.component('MermaidDiagram', MermaidDiagram)
  }
}
