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
  description: 'Semantic layer for deterministic domain state — define meaning once, derive everything as projections',
  head: [
    ['meta', { property: 'og:title', content: 'Manifesto' }],
    ['meta', { property: 'og:description', content: 'Semantic layer for deterministic domain state — define meaning once, derive everything as projections' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:url', content: 'https://docs.manifesto-ai.dev' }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
    ['meta', { name: 'twitter:title', content: 'Manifesto' }],
    ['meta', { name: 'twitter:description', content: 'Semantic layer for deterministic domain state — define meaning once, derive everything as projections' }],
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
      { text: 'Concepts', link: '/concepts/' },
      { text: 'MEL', link: '/mel/' },
      { text: 'Guides', link: '/guides/' },
      { text: 'API', link: '/api/' },
      { text: 'Architecture', link: '/architecture/' },
      { text: 'Internals', link: '/internals/' },
    ],

    sidebar: {
      '/quickstart': [],

      '/tutorial/': [
        {
          text: 'Direct-dispatch Track',
          items: [
            { text: 'Overview', link: '/tutorial/' },
            { text: '1. Your First App', link: '/tutorial/01-your-first-app' },
            { text: '2. Actions and State', link: '/tutorial/02-actions-and-state' },
            { text: '3. Working with Effects', link: '/tutorial/03-effects' },
            { text: '4. Building a Todo App', link: '/tutorial/04-todo-app' },
          ]
        },
        {
          text: 'Governed Track',
          items: [
            { text: '5. Governed Composition', link: '/tutorial/05-governed-composition' },
            { text: '6. Governed Sealing and History', link: '/tutorial/06-governed-sealing-and-history' },
          ]
        },
        {
          text: 'Concepts',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/concepts/' },
            { text: 'Shared Semantic Model', link: '/concepts/shared-semantic-model' },
            { text: 'Snapshot', link: '/concepts/snapshot' },
            { text: 'Intent', link: '/concepts/intent' },
            { text: 'Flow', link: '/concepts/flow' },
            { text: 'Effect', link: '/concepts/effect' },
            { text: 'World', link: '/concepts/world' },
          ]
        },
      ],

      '/concepts/': [
        {
          text: 'Core Concepts',
          items: [
            { text: 'Overview', link: '/concepts/' },
            { text: 'Shared Semantic Model', link: '/concepts/shared-semantic-model' },
            { text: 'Snapshot', link: '/concepts/snapshot' },
            { text: 'Intent', link: '/concepts/intent' },
            { text: 'Flow', link: '/concepts/flow' },
            { text: 'Effect', link: '/concepts/effect' },
            { text: 'World', link: '/concepts/world' },
          ]
        }
      ],

      '/mel/': [
        {
          text: 'MEL Language',
          items: [
            { text: 'Overview', link: '/mel/' },
            { text: 'Reference', link: '/mel/REFERENCE' },
            { text: 'Syntax Cookbook', link: '/mel/SYNTAX' },
            { text: 'Examples', link: '/mel/EXAMPLES' },
            { text: 'Error Guide', link: '/mel/ERROR-GUIDE' },
          ]
        }
      ],

      '/guides/': [
        {
          text: 'How-to Guides',
          items: [
            { text: 'Overview', link: '/guides/' },
            { text: 'Governed Composition', link: '/guides/governed-composition' },
            { text: 'Bundler Setup', link: '/guides/bundler-setup' },
            { text: 'Effect Handlers', link: '/guides/effect-handlers' },
            { text: 'Re-entry Safety', link: '/guides/reentry-safe-flows' },
            { text: 'Debugging', link: '/guides/debugging' },
            { text: 'Typed Patch Ops', link: '/guides/typed-patch-ops' },
            { text: 'Code Generation', link: '/guides/code-generation' },
          ]
        },
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
            { text: '@manifesto-ai/world', link: '/api/world' },
            { text: '@manifesto-ai/governance', link: '/api/governance' },
            { text: '@manifesto-ai/lineage', link: '/api/lineage' },
            { text: '@manifesto-ai/core', link: '/api/core' },
            { text: '@manifesto-ai/host', link: '/api/host' },
            { text: '@manifesto-ai/compiler', link: '/api/compiler' },
            { text: '@manifesto-ai/codegen', link: '/api/codegen' },
          ]
        }
      ],

      '/architecture/': [
        {
          text: 'Architecture',
          items: [
            { text: 'Overview', link: '/architecture/' },
            { text: 'Layer Boundaries', link: '/architecture/layers' },
            { text: 'Data Flow', link: '/architecture/data-flow' },
            { text: 'Determinism', link: '/architecture/determinism' },
            { text: 'Failure Model', link: '/architecture/failure-model' },
          ]
        }
      ],

      '/internals/': [
        {
          text: 'Internals',
          items: [
            { text: 'Overview', link: '/internals/' },
            { text: 'Glossary', link: '/internals/glossary' },
            { text: 'Test Conventions', link: '/internals/test-conventions' },
            { text: 'Documentation Governance', link: '/internals/documentation-governance' },
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
            { text: 'ADR-005: Snapshot Path DSL (Withdrawn)', link: '/internals/adr/005-dx-improvement-snapshot-path-dsl' },
            { text: 'ADR-009: Structured PatchPath', link: '/internals/adr/009-structured-patch-path' },
            { text: 'ADR-010: Protocol-First SDK Reconstruction', link: '/internals/adr/010-major-hard-cut' },
            { text: 'ADR-011: Host Boundary Reset', link: '/internals/adr/011-host-boundary-reset-and-executionkey-serialization' },
            { text: 'ADR-012: Remove Computed Prefix', link: '/internals/adr/012-remove-computed-prefix' },
            { text: 'ADR-013a: flow/include', link: '/internals/adr/013a-mel-statement-composition-flow-and-include' },
            { text: 'ADR-013b: Entity Primitives', link: '/internals/adr/013b-entity-collection-primitives' },
          ]
        },
        {
          text: 'Retired',
          collapsed: true,
          items: [
            { text: 'App Facade', link: '/internals/retired/app' },
            { text: 'Runtime', link: '/internals/retired/runtime' },
            { text: 'Migration: App → SDK', link: '/guides/migrate-app-to-sdk' },
            { text: 'Performance Report', link: '/guides/performance-report' },
          ]
        },
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
