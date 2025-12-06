<script setup lang="ts">
/**
 * SectionRenderer - 섹션 렌더러 컴포넌트
 *
 * ViewSection을 렌더링하고 그리드 레이아웃 처리
 * visible/collapsible 상태 관리
 */
import { inject, computed, ref } from 'vue'
import type { ViewSection, Expression } from '@manifesto-ai/schema'
import type { UseFormRuntimeReturn } from '../../composables/useFormRuntime'
import { FORM_RUNTIME_KEY } from '../../types/component'
import { evaluate, createContext } from '@manifesto-ai/engine'
import FieldRenderer from './FieldRenderer.vue'

interface Props {
  /** 섹션 정의 */
  section: ViewSection
}

const props = defineProps<Props>()

const runtime = inject<UseFormRuntimeReturn>(FORM_RUNTIME_KEY)

// 접기 상태 (기본값: section.collapsed 또는 false)
const isCollapsed = ref((props.section as { collapsed?: boolean }).collapsed ?? false)

const toggleCollapse = () => {
  if ((props.section as { collapsible?: boolean }).collapsible) {
    isCollapsed.value = !isCollapsed.value
  }
}

// Grid 스타일 계산
const gridStyle = computed(() => {
  const layout = props.section.layout
  if (!layout) return {}

  // layout 타입 확인
  const layoutType = (layout as { type?: string }).type
  if (layoutType !== 'grid' && layoutType !== 'form') return {}

  const columns = (layout as { columns?: number }).columns ?? 2
  const gap = (layout as { gap?: string }).gap ?? '1rem'

  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap,
  }
})

// 표시할 필드 (hidden 제외)
const visibleFields = computed(() => {
  return props.section.fields.filter((field) => {
    if (!runtime) return true
    return !runtime.isFieldHidden(field.id)
  })
})

// 섹션 visible 여부 (Expression 평가)
const isVisible = computed(() => {
  const visibleExpr = props.section.visible

  // visible 표현식이 없으면 항상 표시
  if (!visibleExpr) {
    return true
  }

  // 런타임이 없으면 표시
  if (!runtime) {
    return true
  }

  // 평가 컨텍스트 생성 (폼 값을 state로)
  const ctx = createContext({
    state: { ...runtime.values },
  })

  // 표현식 평가
  const result = evaluate(visibleExpr as Expression, ctx)

  if (result._tag === 'Err') {
    console.warn(`Section visibility evaluation error for ${props.section.id}:`, result.error)
    return true // 에러 시 표시
  }

  return Boolean(result.value)
})

// collapsible 여부
const isCollapsible = computed(() => {
  return (props.section as { collapsible?: boolean }).collapsible ?? false
})
</script>

<template>
  <section
    v-if="isVisible"
    class="section-renderer"
    :class="{ 'section-renderer--collapsed': isCollapsed }"
    :data-section-id="section.id"
  >
    <!-- Section Header -->
    <header
      v-if="section.title"
      class="section-renderer__header"
      :class="{ 'section-renderer__header--collapsible': isCollapsible }"
      @click="toggleCollapse"
    >
      <slot name="header">
        <div class="section-renderer__header-content">
          <h2 class="section-renderer__title">{{ section.title }}</h2>
          <p
            v-if="section.description"
            class="section-renderer__description"
          >
            {{ section.description }}
          </p>
        </div>
      </slot>

      <button
        v-if="isCollapsible"
        type="button"
        class="section-renderer__toggle"
        :aria-expanded="!isCollapsed"
      >
        <span class="section-renderer__toggle-icon">
          {{ isCollapsed ? '▼' : '▲' }}
        </span>
      </button>
    </header>

    <!-- Section Content -->
    <div
      v-show="!isCollapsed"
      class="section-renderer__content"
      :style="gridStyle"
    >
      <template v-for="field in visibleFields" :key="field.id">
        <!-- 슬롯으로 오버라이드 가능 -->
        <slot :name="`field-${field.id}`" :field="field">
          <FieldRenderer :field="field" />
        </slot>
      </template>
    </div>

    <!-- Section Footer -->
    <footer v-if="$slots.footer" class="section-renderer__footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<style>
.section-renderer {
  margin-bottom: 1.5rem;
}

.section-renderer__header {
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.section-renderer__header--collapsible {
  cursor: pointer;
  user-select: none;
}

.section-renderer__header-content {
  flex: 1;
}

.section-renderer__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
}

.section-renderer__description {
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
  color: #6b7280;
}

.section-renderer__toggle {
  padding: 0.25rem;
  background: none;
  border: none;
  cursor: pointer;
  color: #6b7280;
}

.section-renderer__toggle:hover {
  color: #111827;
}

.section-renderer__toggle-icon {
  font-size: 0.75rem;
}

.section-renderer__content {
  /* Grid 스타일은 computed로 동적 적용 */
}

.section-renderer__footer {
  margin-top: 1rem;
}

/* 접힌 상태 */
.section-renderer--collapsed .section-renderer__header {
  margin-bottom: 0;
}
</style>
