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
  description: 'Deterministic state protocol for humans and AI — with built-in history, approval, and traceability',
  head: [
    ['meta', { property: 'og:title', content: 'Manifesto' }],
    ['meta', { property: 'og:description', content: 'Deterministic state protocol for humans and AI — with built-in history, approval, and traceability' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:url', content: 'https://docs.manifesto-ai.dev' }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
    ['meta', { name: 'twitter:title', content: 'Manifesto' }],
    ['meta', { name: 'twitter:description', content: 'Deterministic state protocol for humans and AI — with built-in history, approval, and traceability' }],
  ],
  markdown: {
    languages: markdownLanguages,
    config: (md) => {
      addMermaidRenderer(md)
    }
  },

  themeConfig: {
    nav: [
      { text: 'Quickstart', link: '/quickstart' },
      { text: 'Tutorial', link: '/tutorial/' },
      { text: 'Guides', link: '/guides/' },
      { text: 'Integration', link: '/integration/' },
      { text: 'Architecture', link: '/architecture/' },
      { text: 'API', link: '/api/' },
      { text: 'MEL', link: '/mel/' },
      { text: 'Internals', link: '/internals/' },
    ],

    sidebar: {
      '/quickstart': [],  // Single page, no sidebar

      '/tutorial/': [
        {
          text: 'Tutorial',
          items: [
            { text: 'Overview', link: '/tutorial/' },
            { text: '1. Your First App', link: '/tutorial/01-your-first-app' },
            { text: '2. Actions and State', link: '/tutorial/02-actions-and-state' },
            { text: '3. Working with Effects', link: '/tutorial/03-effects' },
            { text: '4. Building a Todo App', link: '/tutorial/04-todo-app' },
          ]
        },
        {
          text: 'Concepts',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/concepts/' },
            { text: 'AI and Manifesto', link: '/concepts/ai-native-os-layer' },
            { text: 'Snapshot', link: '/concepts/snapshot' },
            { text: 'Intent', link: '/concepts/intent' },
            { text: 'Flow', link: '/concepts/flow' },
            { text: 'Effect', link: '/concepts/effect' },
            { text: 'World', link: '/concepts/world' },
          ]
        },
      ],

      '/architecture/': [
        {
          text: 'Architecture',
          items: [
            { text: 'Overview', link: '/architecture/' },
            { text: 'Layers', link: '/internals/architecture' },
            { text: 'Data Flow', link: '/architecture/data-flow' },
            { text: 'Determinism', link: '/architecture/determinism' },
            { text: 'Failure Model', link: '/architecture/failure-model' },
          ]
        }
      ],

      '/concepts/': [
        {
          text: 'Core Concepts',
          items: [
            { text: 'Overview', link: '/concepts/' },
            { text: 'AI and Manifesto', link: '/concepts/ai-native-os-layer' },
            { text: 'Snapshot', link: '/concepts/snapshot' },
            { text: 'Intent', link: '/concepts/intent' },
            { text: 'Flow', link: '/concepts/flow' },
            { text: 'Effect', link: '/concepts/effect' },
            { text: 'World', link: '/concepts/world' },
          ]
        }
      ],

      '/integration/': [
        {
          text: 'Integration',
          items: [
            { text: 'Overview', link: '/integration/' },
            { text: 'React', link: '/integration/react' },
            { text: 'AI Agents', link: '/integration/ai-agents' },
          ]
        }
      ],

      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: '@manifesto-ai/sdk', link: '/api/sdk' },
            { text: 'App Facade (Removed Legacy)', link: '/api/app' },
            { text: '@manifesto-ai/runtime', link: '/api/runtime' },
            { text: '@manifesto-ai/core', link: '/api/core' },
            { text: '@manifesto-ai/host', link: '/api/host' },
            { text: '@manifesto-ai/world', link: '/api/world' },
            { text: '@manifesto-ai/compiler', link: '/api/compiler' },
            { text: '@manifesto-ai/codegen', link: '/api/codegen' },
            { text: '@manifesto-ai/intent-ir', link: '/api/intent-ir' },
          ]
        }
      ],

      '/guides/': [
        {
          text: 'How-to Guides',
          items: [
            { text: 'Overview', link: '/guides/' },
            { text: 'Effect Handlers', link: '/guides/effect-handlers' },
            { text: 'Re-entry Safety', link: '/guides/reentry-safe-flows' },
            { text: 'Debugging', link: '/guides/debugging' },
            { text: 'Migrate App to SDK', link: '/guides/migrate-app-to-sdk' },
            { text: 'Performance Report', link: '/guides/performance-report' },
            { text: 'Code Generation', link: '/guides/code-generation' },
          ]
        },
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

      '/internals/': [
        {
          text: 'Internals',
          items: [
            { text: 'Overview', link: '/internals/' },
            { text: 'Architecture', link: '/internals/architecture' },
            { text: 'Glossary', link: '/internals/glossary' },
          ]
        },
        {
          text: 'Specifications',
          link: '/internals/spec/',
        },
        {
          text: 'Design Rationale (FDR)',
          link: '/internals/fdr/',
        },
        {
          text: 'Architecture Decisions (ADR)',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/internals/adr/' },
            { text: 'ADR-001: Layer Separation', link: '/internals/adr/001-layer-separation' },
            { text: 'ADR-002: DX Improvements', link: '/internals/adr/002-dx-improvement-mel-namespace-onceIntent' },
            { text: 'ADR-003: World Owns Persistence', link: '/internals/adr/003-world-owns-persistence' },
            { text: 'ADR-004: App Internal Decomposition', link: '/internals/adr/004-app-package-internal-decomposition' },
            { text: 'ADR-005: Snapshot Path DSL (Withdrawn)', link: '/internals/adr/005-dx-improvement-snapshot-path-dsl' },
            { text: 'ADR-006: Runtime Reframing', link: '/internals/adr/006-runtime-reframing' },
            { text: 'ADR-007: SDK/Runtime Split', link: '/internals/adr/007-sdk-runtime-split-kickoff' },
            { text: 'ADR-008: SDK-First + App Retirement', link: '/internals/adr/008-sdk-first-transition-and-app-retirement' },
          ]
        },
        {
          text: 'Research',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/internals/research/' },
            { text: 'Intent IR Research', link: '/internals/research/intent-ir/' },
            { text: 'Theory', link: '/internals/research/intent-ir/theory' },
            { text: 'Comparison', link: '/internals/research/intent-ir/comparison' },
            { text: 'Formal Definitions', link: '/internals/research/intent-ir/formal' },
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
