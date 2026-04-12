<template>
  <div class="hero-typer">
    <code class="typer-code">
      <span class="typer-text">{{ displayText }}</span>
      <span class="typer-cursor" :class="{ 'typer-cursor--done': isDone }" />
    </code>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const fullText = 'const app = createManifesto(schema).activate()'
const displayText = ref(fullText) // SSR: show full text
const isDone = ref(true) // SSR: cursor idle

onMounted(() => {
  displayText.value = ''
  isDone.value = false

  let i = 0
  const speed = 35 // ms per char

  function type() {
    if (i < fullText.length) {
      displayText.value = fullText.slice(0, i + 1)
      i++
      setTimeout(type, speed)
    } else {
      isDone.value = true
    }
  }

  // Small delay before starting
  setTimeout(type, 800)
})
</script>

<style scoped>
.hero-typer {
  margin-top: 24px;
}

.typer-code {
  display: inline-flex;
  align-items: center;
  padding: 10px 20px;
  font-family: var(--vp-font-family-mono);
  font-size: 14px;
  line-height: 1.6;
  color: var(--vp-c-brand-1);
  background: rgba(124, 58, 237, 0.06);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(124, 58, 237, 0.1);
  border-radius: 8px;
}

.dark .typer-code {
  color: var(--vp-c-brand-1);
  background: rgba(167, 139, 250, 0.06);
  border-color: rgba(167, 139, 250, 0.1);
}

.typer-cursor {
  display: inline-block;
  width: 2px;
  height: 1.2em;
  margin-left: 2px;
  background: var(--vp-c-brand-1);
  animation: cursor-blink 0.8s step-end infinite;
}

.typer-cursor--done {
  animation: cursor-blink 1.2s step-end infinite;
}

@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@media (max-width: 640px) {
  .typer-code {
    font-size: 12px;
    padding: 8px 14px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .typer-cursor {
    animation: none;
    opacity: 1;
  }
}
</style>
