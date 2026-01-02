import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Manifesto',
  description: 'Accountable state management for AI-powered applications',

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guides/' },
      { text: 'Concepts', link: '/core-concepts/' },
      { text: 'Architecture', link: '/architecture/' },
      { text: 'Specifications', link: '/specifications/' },
      { text: 'Rationale', link: '/rationale/' },
    ],

    sidebar: {
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
            { text: 'Schema Spec', link: '/specifications/schema-spec' },
            { text: 'Host Contract', link: '/specifications/host-contract' },
            { text: 'World Protocol', link: '/specifications/world-protocol' },
            { text: 'Intent Projection', link: '/specifications/intent-projection' },
            { text: 'Compiler Spec', link: '/specifications/compiler-spec' },
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
            { text: 'Debugging', link: '/guides/debugging' },
          ]
        }
      ],

      '/rationale/': [
        {
          text: 'Design Rationale',
          items: [
            { text: 'Overview', link: '/rationale/' },
            { text: 'Core FDR', link: '/rationale/core-fdr' },
            { text: 'Host FDR', link: '/rationale/host-fdr' },
            { text: 'World FDR', link: '/rationale/world-fdr' },
            { text: 'Compiler FDR', link: '/rationale/compiler-fdr' },
          ]
        }
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/manifesto-ai/manifesto' }
    ],

    search: {
      provider: 'local'
    }
  }
})
