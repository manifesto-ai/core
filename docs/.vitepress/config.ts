import fs from 'node:fs'
import { defineConfig } from 'vitepress'
import type { MarkdownRenderer } from 'vitepress'

const markdownLanguages = loadMarkdownLanguages()

function loadMarkdownLanguages() {
  const languagesDir = new URL('./languages/', import.meta.url)
  return fs.readdirSync(languagesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tmLanguage.json'))
    .map((entry) => {
      const fileUrl = new URL(entry.name, languagesDir)
      return JSON.parse(fs.readFileSync(fileUrl, 'utf-8'))
    })
}

function addMermaidRenderer(md: MarkdownRenderer) {
  const defaultFence = md.renderer.rules.fence
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const info = token.info.trim().split(/\s+/)[0]
    if (info === 'mermaid') {
      const code = encodeURIComponent(token.content)
      return `<MermaidDiagram code="${code}"></MermaidDiagram>`
    }
    if (defaultFence) {
      return defaultFence(tokens, idx, options, env, self)
    }
    return self.renderToken(tokens, idx, options)
  }
}

export default defineConfig({
  title: 'Manifesto',
  description: 'Accountable state management for AI-powered applications',
  markdown: {
    languages: markdownLanguages,
    config: (md) => {
      addMermaidRenderer(md)
    }
  },

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guides/' },
      { text: 'MEL', link: '/mel/' },
      { text: 'Packages', link: '/packages/app/' },
      { text: 'Concepts', link: '/core-concepts/' },
      { text: 'Architecture', link: '/architecture/' },
      { text: 'Specifications', link: '/specifications/' },
      { text: 'Rationale', link: '/rationale/' },
    ],

    sidebar: {
      '/packages/app/': [
        {
          text: '@manifesto-ai/app',
          items: [
            { text: 'Overview', link: '/packages/app/' },
            { text: 'Getting Started', link: '/packages/app/getting-started' },
            { text: 'API Reference', link: '/packages/app/api-reference' },
            { text: 'Service Handlers', link: '/packages/app/services' },
            { text: 'Subscriptions', link: '/packages/app/subscriptions' },
            { text: 'Actions', link: '/packages/app/actions' },
            { text: 'Branch Management', link: '/packages/app/branches' },
            { text: 'Advanced Topics', link: '/packages/app/advanced' },
            { text: 'Examples', link: '/packages/app/examples' },
          ]
        }
      ],

      '/what-is-manifesto/': [
        {
          text: 'What is Manifesto',
          items: [
            { text: 'Overview', link: '/what-is-manifesto/' },
            { text: 'The Problem', link: '/what-is-manifesto/problem' },
            { text: 'vs Others', link: '/what-is-manifesto/manifesto-vs-others' },
            { text: 'In One Sentence', link: '/what-is-manifesto/one-sentence' },
          ]
        }
      ],

      '/core-concepts/': [
        {
          text: 'Core Concepts',
          items: [
            { text: 'Overview', link: '/core-concepts/' },
            { text: 'Snapshot', link: '/core-concepts/snapshot' },
            { text: 'Intent', link: '/core-concepts/intent' },
            { text: 'Effect', link: '/core-concepts/effect' },
            { text: 'Flow', link: '/core-concepts/flow' },
            { text: 'Host', link: '/core-concepts/host' },
            { text: 'World', link: '/core-concepts/world' },
          ]
        }
      ],

      '/mel/': [
        {
          text: 'MEL',
          items: [
            { text: 'Overview', link: '/mel/' },
            { text: 'Syntax', link: '/mel/SYNTAX' },
            { text: 'Examples', link: '/mel/EXAMPLES' },
            { text: 'Error Guide', link: '/mel/ERROR-GUIDE' },
            { text: 'LLM Context', link: '/mel/LLM-CONTEXT' },
          ]
        }
      ],

      '/architecture/': [
        {
          text: 'Architecture',
          items: [
            { text: 'Overview', link: '/architecture/' },
            { text: 'Layers', link: '/architecture/layers' },
            { text: 'Data Flow', link: '/architecture/data-flow' },
            { text: 'Determinism', link: '/architecture/determinism' },
            { text: 'Failure Model', link: '/architecture/failure-model' },
          ]
        }
      ],

      '/specifications/': [
        {
          text: 'Specifications',
          items: [
            { text: 'Overview', link: '/specifications/' },
            { text: 'App Spec', link: '/specifications/app-spec' },
            { text: 'Core Spec', link: '/specifications/core-spec' },
            { text: 'Compiler Spec', link: '/specifications/compiler-spec' },
            { text: 'Host Spec', link: '/specifications/host-spec' },
            { text: 'World Spec', link: '/specifications/world-spec' },
            { text: 'Bridge Spec', link: '/specifications/bridge-spec' },
            { text: 'Builder Spec', link: '/specifications/builder-spec' },
            { text: 'React Spec', link: '/specifications/react-spec' },
            { text: 'Memory Spec', link: '/specifications/memory-spec' },
            { text: 'Translator Spec', link: '/specifications/translator-spec' },
            { text: 'Effect Utils Spec', link: '/specifications/effect-utils-spec' },
            { text: 'Lab Spec', link: '/specifications/lab-spec' },
          ]
        }
      ],

      '/guides/': [
        {
          text: 'Guides',
          items: [
            { text: 'Overview', link: '/guides/' },
            { text: 'Getting Started', link: '/guides/getting-started' },
            { text: 'Todo Example', link: '/guides/todo-example' },
            { text: 'Re-entry Safe Flows', link: '/guides/reentry-safe-flows' },
            { text: 'Effect Handlers', link: '/guides/effect-handlers' },
            { text: 'Using Memory', link: '/guides/using-memory' },
            { text: 'Debugging', link: '/guides/debugging' },
            { text: 'Performance Report', link: '/guides/performance-report' },
          ]
        }
      ],

      '/rationale/': [
        {
          text: 'Design Rationale',
          items: [
            { text: 'Overview', link: '/rationale/' },
            { text: 'App FDR', link: '/rationale/app-fdr' },
            { text: 'Core FDR', link: '/rationale/core-fdr' },
            { text: 'Compiler FDR', link: '/rationale/compiler-fdr' },
            { text: 'Host FDR', link: '/rationale/host-fdr' },
            { text: 'World FDR', link: '/rationale/world-fdr' },
            { text: 'Bridge FDR', link: '/rationale/bridge-fdr' },
            { text: 'Builder FDR', link: '/rationale/builder-fdr' },
            { text: 'React FDR', link: '/rationale/react-fdr' },
            { text: 'Memory FDR', link: '/rationale/memory-fdr' },
            { text: 'Translator FDR', link: '/rationale/translator-fdr' },
            { text: 'Effect Utils FDR', link: '/rationale/effect-utils-fdr' },
            { text: 'Lab FDR', link: '/rationale/lab-fdr' },
          ]
        }
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/manifesto-ai/core' }
    ],

    search: {
      provider: 'local'
    }
  }
})
