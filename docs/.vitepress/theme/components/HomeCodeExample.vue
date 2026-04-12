<template>
  <div class="home-code-example">
    <div class="code-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="code-tab"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>
    <Transition name="code-fade" mode="out-in">
      <div :key="activeTab" class="code-content">
        <div v-if="activeTab === 'mel'" class="code-block">
          <div class="code-lang">mel</div>
          <pre><code><span class="kw">domain</span> Counter {
  <span class="kw">state</span> {
    count: <span class="type">number</span> = <span class="num">0</span>
  }

  <span class="kw">computed</span> doubled = <span class="fn">mul</span>(count, <span class="num">2</span>)

  <span class="kw">action</span> <span class="fn">increment</span>() {
    <span class="kw">onceIntent</span> {
      <span class="kw">patch</span> count = <span class="fn">add</span>(count, <span class="num">1</span>)
    }
  }
}</code></pre>
        </div>
        <div v-else class="code-block">
          <div class="code-lang">typescript</div>
          <pre><code><span class="kw">import</span> { createManifesto } <span class="kw">from</span> <span class="str">"@manifesto-ai/sdk"</span>;
<span class="kw">import</span> CounterSchema <span class="kw">from</span> <span class="str">"./counter.mel"</span>;

<span class="kw">const</span> app = <span class="fn">createManifesto</span>(CounterSchema, {}).<span class="fn">activate</span>();
<span class="kw">await</span> app.<span class="fn">dispatchAsync</span>(app.<span class="fn">createIntent</span>(app.MEL.actions.increment));

console.<span class="fn">log</span>(app.<span class="fn">getSnapshot</span>().data.count);        <span class="cmt">// 1</span>
console.<span class="fn">log</span>(app.<span class="fn">getSnapshot</span>().computed.doubled);  <span class="cmt">// 2</span></code></pre>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const activeTab = ref<'mel' | 'ts'>('mel')

const tabs = [
  { id: 'mel' as const, label: 'Define (MEL)' },
  { id: 'ts' as const, label: 'Run (TypeScript)' },
]
</script>

<style scoped>
.home-code-example {
  max-width: 680px;
  margin: 48px auto 0;
}

.code-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid rgba(124, 58, 237, 0.1);
}

.dark .code-tabs {
  border-bottom-color: rgba(167, 139, 250, 0.1);
}

.code-tab {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease;
}

.code-tab:hover {
  color: var(--vp-c-text-1);
}

.code-tab.active {
  color: var(--vp-c-brand-1);
  border-bottom-color: var(--vp-c-brand-1);
}

.code-content {
  margin-top: -1px;
}

.code-block {
  position: relative;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(124, 58, 237, 0.08);
  border-radius: 0 0 12px 12px;
  overflow: hidden;
}

.dark .code-block {
  background: rgba(26, 20, 41, 0.6);
  border-color: rgba(167, 139, 250, 0.08);
}

.code-lang {
  position: absolute;
  top: 8px;
  right: 12px;
  font-size: 11px;
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-3);
  opacity: 0.6;
}

pre {
  margin: 0;
  padding: 20px 24px;
  overflow-x: auto;
}

code {
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.7;
  color: var(--vp-c-text-1);
}

/* Syntax highlighting */
.kw { color: #7c3aed; }
.dark .kw { color: #c084fc; }

.type { color: #0ea5e9; }
.dark .type { color: #7dd3fc; }

.fn { color: #2563eb; }
.dark .fn { color: #93c5fd; }

.str { color: #16a34a; }
.dark .str { color: #86efac; }

.num { color: #ea580c; }
.dark .num { color: #fdba74; }

.cmt { color: var(--vp-c-text-3); font-style: italic; }

/* Tab transition */
.code-fade-enter-active,
.code-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.code-fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.code-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 640px) {
  .home-code-example {
    margin-top: 32px;
  }

  code {
    font-size: 12px;
  }

  pre {
    padding: 16px;
  }
}
</style>
