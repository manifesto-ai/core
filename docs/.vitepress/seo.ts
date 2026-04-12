import fs from 'node:fs'
import type { HeadConfig, PageData } from 'vitepress'

export const SITE_URL = 'https://docs.manifesto-ai.dev'
export const SITE_TITLE = 'Manifesto'
export const SITE_HANDLE = '@eggplantiny'
export const SITE_DESCRIPTION = 'Deterministic semantic layer for apps, backends, and agents. Define your domain once in MEL, run it through the SDK, and add approval or history only when needed.'
export const SITE_OG_IMAGE = `${SITE_URL}/og-image.png`
export const SITE_OG_IMAGE_ALT = 'Manifesto semantic layer for deterministic domain state'

const MAX_DESCRIPTION_LENGTH = 170
const DESCRIPTION_CACHE = new Map<string, string>()

const PAGE_DESCRIPTION_OVERRIDES: Record<string, string> = {
  'index.md': 'Manifesto is the deterministic semantic layer for apps, backends, and agents. Define your domain once in MEL and add approval or history only when needed.',
  'quickstart.md': 'Get a Manifesto app running fast with the base runtime path, then learn when to add governance, lineage, and sealed history later.',
  'guide/introduction.md': 'Learn Manifesto through the core model: deterministic domain state, typed intents, explicit effects, and a snapshot-first runtime path.',
  'guide/quick-start.md': 'Start a Manifesto app in minutes with the CLI or SDK, wire MEL into your bundler, and run your first deterministic domain.',
  'api/index.md': 'Browse the Manifesto API reference for SDK, runtime, intents, snapshots, effects, governance, compiler, CLI, Studio, and AI tooling.',
  'concepts/index.md': 'Understand Manifesto concepts including Snapshot, Intent, Flow, Effect, World, and the shared semantic model across every runtime surface.',
  'architecture/index.md': 'Study Manifesto architecture through deterministic compute, snapshot data flow, failure modeling, and layer boundaries across SDK, Host, Core, and governance.',
  'integration/index.md': 'Integrate Manifesto with React, agent workflows, CLI and Studio tooling, and later-stage approval or history flows on the same semantic model.',
  'guides/index.md': 'Use Manifesto guides for bundlers, effect handlers, debugging, code generation, developer tooling, governance setup, release hardening, and upgrades.',
  'tutorial/index.md': 'Follow step-by-step Manifesto tutorials to build a base runtime app, connect effects, and later add approval, lineage, and sealed history.',
  'mel/index.md': 'Learn MEL, the typed declarative language for Manifesto domains, and compile deterministic schemas for apps, services, and agent workflows.',
  'internals/index.md': 'Read contributor-facing Manifesto internals, glossary terms, documentation rules, current specs, ADRs, and implementation history.'
}

const NOINDEX_PREFIXES = [
  'internals/adr/archive/',
  'internals/retired/'
]

export function buildSeoPageData(pageData: PageData) {
  return {
    description: resolvePageDescription(pageData.relativePath)
  }
}

export function buildSeoHead(context: {
  pageData: PageData
  title: string
  description: string
}): HeadConfig[] {
  const path = toCanonicalPath(context.pageData.relativePath)
  const url = `${SITE_URL}${path}`
  const description = context.description || SITE_DESCRIPTION
  const isHome = path === '/'
  const isIndexPage = isHome || isSectionIndexPage(context.pageData.relativePath)
  const isNoIndex = shouldNoIndex(context.pageData)
  const robots = isNoIndex
    ? (context.pageData.isNotFound ? 'noindex, nofollow' : 'noindex, follow')
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'

  return [
    ['link', { rel: 'canonical', href: url }],
    ['meta', { property: 'og:site_name', content: SITE_TITLE }],
    ['meta', { property: 'og:title', content: context.title }],
    ['meta', { property: 'og:description', content: description }],
    ['meta', { property: 'og:type', content: isIndexPage ? 'website' : 'article' }],
    ['meta', { property: 'og:url', content: url }],
    ['meta', { property: 'og:image', content: SITE_OG_IMAGE }],
    ['meta', { property: 'og:image:alt', content: SITE_OG_IMAGE_ALT }],
    ['meta', { property: 'og:image:type', content: 'image/png' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:site', content: SITE_HANDLE }],
    ['meta', { name: 'twitter:creator', content: SITE_HANDLE }],
    ['meta', { name: 'twitter:title', content: context.title }],
    ['meta', { name: 'twitter:description', content: description }],
    ['meta', { name: 'twitter:image', content: SITE_OG_IMAGE }],
    ['meta', { name: 'twitter:image:alt', content: SITE_OG_IMAGE_ALT }],
    ['meta', { name: 'robots', content: robots }],
    ['meta', { name: 'googlebot', content: robots }],
    ['script', { type: 'application/ld+json' }, JSON.stringify(buildStructuredData({
      relativePath: context.pageData.relativePath,
      title: context.pageData.title || context.title,
      description,
      url,
      isHome,
    }))]
  ]
}

export function transformSitemapItems(items: { url: string }[]) {
  return items
    .filter((item) => !shouldNoIndexPath(toSitemapRoute(item.url)))
    .map((item) => {
      const { priority, changefreq } = getSitemapHints(toSitemapRoute(item.url))
      return {
        ...item,
        priority,
        changefreq
      }
    })
}

function resolvePageDescription(relativePath: string): string {
  const cached = DESCRIPTION_CACHE.get(relativePath)
  if (cached) {
    return cached
  }

  const description = truncateDescription(
    PAGE_DESCRIPTION_OVERRIDES[relativePath]
      ?? extractDescriptionFromMarkdown(relativePath)
      ?? SITE_DESCRIPTION
  )

  DESCRIPTION_CACHE.set(relativePath, description)
  return description
}

function extractDescriptionFromMarkdown(relativePath: string): string | null {
  try {
    const source = fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8')
    const withoutFrontmatter = source.replace(/^---\n[\s\S]*?\n---\n*/u, '')
    const candidate = findDescriptionCandidate(withoutFrontmatter)
    return candidate ? normalizeMarkdown(candidate) : null
  } catch {
    return null
  }
}

function findDescriptionCandidate(source: string): string | null {
  const lines = source.split('\n')
  const blocks: string[] = []
  const current: string[] = []
  let inFence = false

  const flush = () => {
    if (current.length > 0) {
      blocks.push(current.join(' '))
      current.length = 0
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (line.startsWith('```') || line.startsWith('~~~')) {
      inFence = !inFence
      flush()
      continue
    }

    if (inFence) {
      continue
    }

    if (!line || line === '---') {
      flush()
      continue
    }

    if (
      line.startsWith('#')
      || line.startsWith(':::')
      || line.startsWith('|')
      || line.startsWith('<')
      || line.startsWith('![')
      || line.startsWith('import ')
      || line.startsWith('export ')
      || line === '---'
      || /^\d+\.\s/u.test(line)
      || /^[-*+]\s/u.test(line)
    ) {
      flush()
      continue
    }

    current.push(line.startsWith('>') ? line.replace(/^>\s?/u, '') : line)
  }

  flush()

  return blocks.find((block) => normalizeMarkdown(block).length >= 40) ?? null
}

function normalizeMarkdown(source: string): string {
  return source
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1')
    .replace(/`([^`]+)`/gu, '$1')
    .replace(/\*\*([^*]+)\*\*/gu, '$1')
    .replace(/\*([^*]+)\*/gu, '$1')
    .replace(/_([^_]+)_/gu, '$1')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

function truncateDescription(source: string): string {
  if (source.length <= MAX_DESCRIPTION_LENGTH) {
    return source
  }

  const truncated = source.slice(0, MAX_DESCRIPTION_LENGTH)
  const lastSpace = truncated.lastIndexOf(' ')
  return `${truncated.slice(0, lastSpace > 0 ? lastSpace : MAX_DESCRIPTION_LENGTH).trim()}...`
}

function toCanonicalPath(relativePath: string): string {
  if (!relativePath) {
    return '/'
  }

  const withoutExtension = relativePath.replace(/\.md$/u, '')
  if (withoutExtension === 'index') {
    return '/'
  }

  if (withoutExtension.endsWith('/index')) {
    return `/${withoutExtension.slice(0, -'/index'.length)}/`
  }

  return `/${withoutExtension}`
}

function shouldNoIndex(pageData: PageData): boolean {
  return Boolean(pageData.isNotFound) || shouldNoIndexPath(pageData.relativePath)
}

function shouldNoIndexPath(path: string): boolean {
  return NOINDEX_PREFIXES.some((prefix) => path.includes(prefix))
}

function getSitemapHints(url: string) {
  if (url === '/') {
    return { priority: 1, changefreq: 'weekly' }
  }

  if (url === '/guide/introduction' || url === '/guide/quick-start' || url === '/quickstart') {
    return { priority: 0.95, changefreq: 'weekly' }
  }

  if (/^\/(guide|tutorial|api|concepts|architecture|integration|guides|mel)(\/|$)/u.test(url)) {
    return { priority: 0.8, changefreq: 'weekly' }
  }

  if (/^\/internals\//u.test(url)) {
    return { priority: 0.45, changefreq: 'monthly' }
  }

  return { priority: 0.7, changefreq: 'monthly' }
}

function toSitemapRoute(url: string): string {
  const pathname = new URL(url, SITE_URL).pathname
  if (pathname === '/') {
    return '/'
  }

  if (pathname.endsWith('/')) {
    return pathname
  }

  if (pathname.endsWith('.html')) {
    const withoutHtml = pathname.slice(0, -'.html'.length)
    const segments = withoutHtml.split('/').filter(Boolean)
    const lastSegment = segments.at(-1)
    const looksLikeIndex = lastSegment === 'index'
    return looksLikeIndex ? `${withoutHtml.slice(0, -'/index'.length)}/` || '/' : withoutHtml
  }

  return pathname
}

function buildStructuredData(input: {
  relativePath: string
  title: string
  description: string
  url: string
  isHome: boolean
}) {
  if (input.isHome) {
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_TITLE,
        url: SITE_URL,
        description: SITE_DESCRIPTION
      },
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareSourceCode',
        name: SITE_TITLE,
        url: SITE_URL,
        codeRepository: 'https://github.com/manifesto-ai/core',
        description: SITE_DESCRIPTION,
        programmingLanguage: ['TypeScript', 'MEL'],
        license: 'https://github.com/manifesto-ai/core/blob/main/LICENSE'
      }
    ]
  }

  return {
    '@context': 'https://schema.org',
    '@type': isSectionIndexPage(input.relativePath) ? 'CollectionPage' : 'TechArticle',
    headline: input.title,
    description: input.description,
    url: input.url,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_TITLE,
      url: SITE_URL
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_TITLE,
      url: SITE_URL
    }
  }
}

function isSectionIndexPage(relativePath: string): boolean {
  return relativePath.endsWith('/index.md') || relativePath === 'quickstart.md'
}
