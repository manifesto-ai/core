<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

const props = defineProps<{
  code: string
}>()

const container = ref<HTMLDivElement | null>(null)
let diagramId = 0
let mermaidPromise: Promise<typeof import('mermaid').default> | null = null
let initialized = false

const getMermaid = () => {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => mod.default)
  }
  return mermaidPromise
}

const decode = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const renderDiagram = async () => {
  if (!container.value || typeof window === 'undefined') {
    return
  }

  const mermaid = await getMermaid()
  if (!initialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'strict'
    })
    initialized = true
  }

  const id = `mermaid-${diagramId++}`
  const source = decode(props.code)

  try {
    const { svg, bindFunctions } = await mermaid.render(id, source)
    container.value.innerHTML = svg
    if (bindFunctions) {
      bindFunctions(container.value)
    }
  } catch {
    container.value.innerHTML = ''
    const pre = document.createElement('pre')
    pre.className = 'mermaid-fallback'
    pre.textContent = source
    container.value.appendChild(pre)
  }
}

onMounted(() => {
  void renderDiagram()
})

watch(
  () => props.code,
  () => {
    void renderDiagram()
  }
)
</script>

<template>
  <div ref="container" class="mermaid-diagram"></div>
</template>

<style>
.mermaid-diagram {
  margin: 1.5rem 0;
}

.mermaid-diagram svg {
  height: auto;
  max-width: 100%;
}

.mermaid-fallback {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  font-family: var(--vp-font-family-mono);
  font-size: 0.9rem;
  overflow-x: auto;
  padding: 0.75rem 1rem;
}
</style>
