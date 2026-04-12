import fs from 'node:fs'
import { defineConfig } from 'vitepress'
import type { DefaultTheme, MarkdownRenderer } from 'vitepress'
import {
  buildSeoHead,
  buildSeoPageData,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
  transformSitemapItems,
} from './seo'

const markdownLanguages = loadMarkdownLanguages()
const guideSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: 'Getting Started',
    items: [
      { text: 'Introduction', link: '/guide/introduction' },
      { text: 'Quick Start', link: '/guide/quick-start' },
    ]
  },
  {
    text: 'Essentials',
    items: [
      { text: 'Creating an App', link: '/guide/essentials/creating-an-app' },
      { text: 'MEL Domain Basics', link: '/guide/essentials/mel-domain-basics' },
      { text: 'State', link: '/guide/essentials/state' },
      { text: 'Computed Values', link: '/guide/essentials/computed-values' },
      { text: 'Actions and Intents', link: '/guide/essentials/actions-and-intents' },
      { text: 'Reading Snapshots', link: '/guide/essentials/reading-snapshots' },
      { text: 'Subscriptions', link: '/guide/essentials/subscriptions' },
      { text: 'Effects', link: '/guide/essentials/effects' },
      { text: 'Availability', link: '/guide/essentials/availability' },
    ]
  },
  {
    text: 'Tutorial',
    items: [
      { text: 'Your First App', link: '/tutorial/01-your-first-app' },
      { text: 'Actions and State', link: '/tutorial/02-actions-and-state' },
      { text: 'Working with Effects', link: '/tutorial/03-effects' },
      { text: 'Building a Todo App', link: '/tutorial/04-todo-app' },
    ]
  },
  {
    text: 'Integrations',
    items: [
      { text: 'React', link: '/integration/react' },
      { text: 'AI Agents', link: '/integration/ai-agents' },
      { text: 'Effect Handlers', link: '/guides/effect-handlers' },
      { text: 'Code Generation', link: '/guides/code-generation' },
      { text: 'Tooling', link: '/guides/developer-tooling' },
      { text: 'Bundler Setup', link: '/guides/bundler-setup' },
    ]
  },
  {
    text: 'Scaling Up',
    items: [
      { text: 'When You Need Approval', link: '/guides/approval-and-history' },
      { text: 'Approval and History Setup', link: '/tutorial/05-governed-composition' },
      { text: 'Sealed History and Review', link: '/tutorial/06-governed-sealing-and-history' },
      { text: 'Advanced Runtime Assembly', link: '/guides/governed-composition' },
      { text: 'Release Hardening', link: '/guides/release-hardening' },
      { text: 'Upgrade Guide', link: '/guides/upgrade-next-major' },
    ]
  },
  {
    text: 'In-Depth',
    items: [
      { text: 'Shared Semantic Model', link: '/concepts/shared-semantic-model' },
      { text: 'Snapshot', link: '/concepts/snapshot' },
      { text: 'Intent', link: '/concepts/intent' },
      { text: 'Flow', link: '/concepts/flow' },
      { text: 'Effect Model', link: '/concepts/effect' },
      { text: 'World', link: '/concepts/world' },
      { text: 'Determinism', link: '/architecture/determinism' },
      { text: 'Data Flow', link: '/architecture/data-flow' },
      { text: 'Failure Model', link: '/architecture/failure-model' },
      { text: 'Layer Boundaries', link: '/architecture/layers' },
      { text: 'Re-entry Safety', link: '/guides/reentry-safe-flows' },
      { text: 'Debugging', link: '/guides/debugging' },
    ]
  },
]

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
  lang: 'en-US',
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico', sizes: 'any' }],
    ['link', { rel: 'icon', type: 'image/png', href: '/favicon-32x32.png', sizes: '32x32' }],
    ['link', { rel: 'icon', type: 'image/png', href: '/favicon-16x16.png', sizes: '16x16' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' }],
    ['link', { rel: 'manifest', href: '/site.webmanifest' }],
    ['meta', { name: 'theme-color', content: '#80b8f0' }],
    ['meta', { name: 'application-name', content: SITE_TITLE }],
    ['meta', { name: 'apple-mobile-web-app-title', content: SITE_TITLE }],
    ['script', { async: '', src: 'https://www.googletagmanager.com/gtag/js?id=G-FW564PKJWF' }],
    ['script', {}, `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());

gtag('config', 'G-FW564PKJWF');`],
  ],
  sitemap: {
    hostname: SITE_URL,
    transformItems: transformSitemapItems,
  },
  transformHead: buildSeoHead,
  transformPageData: buildSeoPageData,
  markdown: {
    languages: markdownLanguages,
    config: (md) => {
      addMermaidRenderer(md)
    }
  },

  themeConfig: {
    logo: '/logo-icon.png',

    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'API', link: '/api/' },
      { text: 'Reference', link: '/mel/' },
      { text: 'Internals', link: '/internals/' },
    ],

    sidebar: {
      '/quickstart': [],
      '/guide/': guideSidebar,
      '/tutorial/': guideSidebar,
      '/concepts/': guideSidebar,
      '/architecture/': guideSidebar,
      '/integration/': guideSidebar,
      '/guides/': guideSidebar,

      '/mel/': [
        {
          text: 'MEL Language',
          items: [
            { text: 'Overview', link: '/mel/' },
            { text: 'Reference', link: '/mel/REFERENCE' },
            { text: 'Syntax Cookbook', link: '/mel/SYNTAX' },
            { text: 'Examples', link: '/mel/EXAMPLES' },
            { text: 'Error Guide', link: '/mel/ERROR-GUIDE' },
            { text: 'LLM Context', link: '/mel/LLM-CONTEXT' },
          ]
        }
      ],

      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'Application', link: '/api/application' },
            { text: 'Runtime Instance', link: '/api/runtime' },
            { text: 'Actions and Availability', link: '/api/actions-and-availability' },
            { text: 'Intents', link: '/api/intents' },
            { text: 'Snapshots and Subscriptions', link: '/api/snapshots-and-subscriptions' },
            { text: 'Effects', link: '/api/effects' },
            { text: 'Governed Runtime', link: '/api/governed-runtime' },
            { text: 'Bundler Adapters', link: '/api/bundler-adapters' },
            { text: 'Public Surface Inventory', link: '/api/public-surface' },
          ]
        },
        {
          text: 'Package Overviews',
          items: [
            { text: '@manifesto-ai/sdk', link: '/api/sdk' },
            { text: '@manifesto-ai/lineage', link: '/api/lineage' },
            { text: '@manifesto-ai/governance', link: '/api/governance' },
            { text: '@manifesto-ai/compiler', link: '/api/compiler' },
            { text: '@manifesto-ai/codegen', link: '/api/codegen' },
            { text: '@manifesto-ai/core', link: '/api/core' },
            { text: '@manifesto-ai/host', link: '/api/host' },
          ]
        },
        {
          text: 'Tooling',
          items: [
            { text: '@manifesto-ai/cli', link: '/api/cli' },
            { text: '@manifesto-ai/skills', link: '/api/skills' },
            { text: '@manifesto-ai/mel-lsp', link: '/api/mel-lsp' },
            { text: '@manifesto-ai/studio-cli', link: '/api/studio-cli' },
            { text: '@manifesto-ai/studio-core', link: '/api/studio-core' },
            { text: '@manifesto-ai/studio-mcp', link: '/api/studio-mcp' },
          ]
        },
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
