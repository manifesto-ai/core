<script setup lang="ts">
/**
 * DebugPanel - 폼 디버깅을 위한 개발자 도구 패널
 *
 * PRD 요구사항: DevTools
 * - 현재 필드의 평가 결과 (True/False) 시각화
 * - 실행된 액션 로그 시각화
 * - 폼 상태 실시간 표시
 * - 의존성 그래프 시각화
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { FormViewSchema, ViewField, Expression } from '@manifesto-ai/schema'
import type { FieldMeta } from '@manifesto-ai/engine'
import type { UseFormRuntimeReturn } from '../../composables/useFormRuntime'

// 표현식 평가 결과 타입
interface ExpressionInfo {
  fieldId: string
  type: 'hidden' | 'disabled' | 'value'
  expression: Expression
  result: unknown
}

// 의존성 정보 타입
interface DependencyInfo {
  fieldId: string
  dependsOn: string[]
  dependents: string[]
}

interface Props {
  /** 폼 런타임 인스턴스 */
  runtime: UseFormRuntimeReturn
  /** 뷰 스키마 */
  schema: FormViewSchema
  /** 초기 접힘 상태 */
  collapsed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  collapsed: true,
})

// 런타임에서 필요한 상태 추출
const state = computed(() => props.runtime.getState())
const values = computed(() => props.runtime.values)
const schemaName = computed(() => props.schema.name || 'Form')

// 패널 접힘 상태
const isCollapsed = ref(props.collapsed)

// 현재 탭
const activeTab = ref<'state' | 'fields' | 'expressions' | 'deps' | 'actions'>('state')

// 액션 로그 (실행된 액션 기록)
const actionLogs = ref<Array<{
  timestamp: number
  type: string
  target?: string
  value?: unknown
}>>([])

// 액션 로그 최대 개수
const MAX_LOGS = 50

// 값 변경 기록
const valueChanges = ref<Array<{
  timestamp: number
  fieldId: string
  oldValue: unknown
  newValue: unknown
}>>([])

// 이전 값 저장
let previousValues: Record<string, unknown> = {}

// 값 변경 감지
watch(
  values,
  (newValues) => {
    for (const key of Object.keys(newValues)) {
      if (previousValues[key] !== newValues[key]) {
        valueChanges.value.unshift({
          timestamp: Date.now(),
          fieldId: key,
          oldValue: previousValues[key],
          newValue: newValues[key],
        })
        // 최대 개수 유지
        if (valueChanges.value.length > MAX_LOGS) {
          valueChanges.value.pop()
        }
      }
    }
    previousValues = { ...newValues }
  },
  { deep: true }
)

// 필드 메타 배열로 변환
const fieldsArray = computed<FieldMeta[]>(() => {
  const stateValue = state.value
  if (!stateValue?.fields) return []
  return Array.from(stateValue.fields.values())
})

// 숨겨진 필드 수
const hiddenFieldsCount = computed(() => {
  return fieldsArray.value.filter(f => f.hidden).length
})

// 비활성화된 필드 수
const disabledFieldsCount = computed(() => {
  return fieldsArray.value.filter(f => f.disabled).length
})

// 에러 있는 필드 수
const errorFieldsCount = computed(() => {
  return fieldsArray.value.filter(f => f.errors.length > 0).length
})

// 모든 필드를 평면화하여 가져오기
const allSchemaFields = computed<ViewField[]>(() => {
  const fields: ViewField[] = []
  for (const section of props.schema.sections) {
    fields.push(...section.fields)
  }
  return fields
})

// 표현식 평가 결과 목록
const expressionResults = computed<ExpressionInfo[]>(() => {
  const results: ExpressionInfo[] = []

  for (const field of allSchemaFields.value) {
    const meta = fieldsArray.value.find(f => f.id === field.id)

    // hidden 표현식이 있는 경우
    if (field.props?.hidden && isExpression(field.props.hidden)) {
      results.push({
        fieldId: field.id,
        type: 'hidden',
        expression: field.props.hidden as Expression,
        result: meta?.hidden ?? false,
      })
    }

    // disabled 표현식이 있는 경우
    if (field.props?.disabled && isExpression(field.props.disabled)) {
      results.push({
        fieldId: field.id,
        type: 'disabled',
        expression: field.props.disabled as Expression,
        result: meta?.disabled ?? false,
      })
    }
  }

  return results
})

// 의존성 맵 구축
const dependencyMap = computed<DependencyInfo[]>(() => {
  const map: DependencyInfo[] = []
  const dependentsMap: Map<string, Set<string>> = new Map()

  for (const field of allSchemaFields.value) {
    const dependsOn = field.dependsOn ?? []

    // dependsOn에 있는 필드들의 dependents에 현재 필드 추가
    for (const dep of dependsOn) {
      if (!dependentsMap.has(dep)) {
        dependentsMap.set(dep, new Set())
      }
      dependentsMap.get(dep)!.add(field.id)
    }

    map.push({
      fieldId: field.id,
      dependsOn: [...dependsOn],
      dependents: [],
    })
  }

  // dependents 채우기
  for (const info of map) {
    info.dependents = [...(dependentsMap.get(info.fieldId) ?? [])]
  }

  return map.filter(d => d.dependsOn.length > 0 || d.dependents.length > 0)
})

// 표현식인지 확인
const isExpression = (value: unknown): boolean => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string' && value.startsWith('$')) return true
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') return true
  return false
}

// 표현식 포맷
const formatExpression = (expr: Expression): string => {
  if (typeof expr === 'string') return expr
  if (Array.isArray(expr)) {
    return JSON.stringify(expr)
  }
  return String(expr)
}

// 시간 포맷
const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// 값 포맷
const formatValue = (value: unknown): string => {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (typeof value === 'string') return `"${value}"`
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (Array.isArray(value)) return `[${value.length} items]`
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// 로그 클리어
const clearLogs = () => {
  valueChanges.value = []
  actionLogs.value = []
}

// 토글 패널
const togglePanel = () => {
  isCollapsed.value = !isCollapsed.value
}

// 글로벌 액션 로그 리스너 (window 이벤트 활용)
const handleActionLog = (event: Event) => {
  const customEvent = event as CustomEvent<{
    type: string
    target?: string
    value?: unknown
  }>
  actionLogs.value.unshift({
    timestamp: Date.now(),
    ...customEvent.detail,
  })
  if (actionLogs.value.length > MAX_LOGS) {
    actionLogs.value.pop()
  }
}

onMounted(() => {
  window.addEventListener('manifesto-ai:action', handleActionLog)
})

onUnmounted(() => {
  window.removeEventListener('manifesto-ai:action', handleActionLog)
})
</script>

<template>
  <div
    class="debug-panel"
    :class="{ 'debug-panel--collapsed': isCollapsed }"
  >
    <!-- Header -->
    <div class="debug-panel__header" @click="togglePanel">
      <div class="debug-panel__title">
        <span class="debug-panel__icon">🔧</span>
        <span>{{ schemaName }} DevTools</span>
      </div>
      <div class="debug-panel__badges">
        <span v-if="!state.isValid" class="debug-panel__badge debug-panel__badge--error">
          {{ errorFieldsCount }} errors
        </span>
        <span v-if="state.isDirty" class="debug-panel__badge debug-panel__badge--warning">
          dirty
        </span>
        <span class="debug-panel__badge">
          {{ fieldsArray.length }} fields
        </span>
      </div>
      <button type="button" class="debug-panel__toggle" :aria-label="isCollapsed ? 'Expand' : 'Collapse'">
        {{ isCollapsed ? '▼' : '▲' }}
      </button>
    </div>

    <!-- Body -->
    <div v-show="!isCollapsed" class="debug-panel__body">
      <!-- Tabs -->
      <div class="debug-panel__tabs">
        <button
          type="button"
          class="debug-panel__tab"
          :class="{ 'debug-panel__tab--active': activeTab === 'state' }"
          @click="activeTab = 'state'"
        >
          State
        </button>
        <button
          type="button"
          class="debug-panel__tab"
          :class="{ 'debug-panel__tab--active': activeTab === 'fields' }"
          @click="activeTab = 'fields'"
        >
          Fields
        </button>
        <button
          type="button"
          class="debug-panel__tab"
          :class="{ 'debug-panel__tab--active': activeTab === 'expressions' }"
          @click="activeTab = 'expressions'"
        >
          Expr
        </button>
        <button
          type="button"
          class="debug-panel__tab"
          :class="{ 'debug-panel__tab--active': activeTab === 'deps' }"
          @click="activeTab = 'deps'"
        >
          Deps
        </button>
        <button
          type="button"
          class="debug-panel__tab"
          :class="{ 'debug-panel__tab--active': activeTab === 'actions' }"
          @click="activeTab = 'actions'"
        >
          Log
        </button>
      </div>

      <!-- Tab Content -->
      <div class="debug-panel__content">
        <!-- State Tab -->
        <div v-if="activeTab === 'state'" class="debug-panel__state">
          <div class="debug-panel__state-row">
            <span class="debug-panel__state-label">Valid:</span>
            <span
              class="debug-panel__state-value"
              :class="state.isValid ? 'debug-panel__state-value--success' : 'debug-panel__state-value--error'"
            >
              {{ state.isValid }}
            </span>
          </div>
          <div class="debug-panel__state-row">
            <span class="debug-panel__state-label">Dirty:</span>
            <span class="debug-panel__state-value">{{ state.isDirty }}</span>
          </div>
          <div class="debug-panel__state-row">
            <span class="debug-panel__state-label">Submitting:</span>
            <span class="debug-panel__state-value">{{ state.isSubmitting }}</span>
          </div>
          <div class="debug-panel__state-row">
            <span class="debug-panel__state-label">Hidden Fields:</span>
            <span class="debug-panel__state-value">{{ hiddenFieldsCount }}</span>
          </div>
          <div class="debug-panel__state-row">
            <span class="debug-panel__state-label">Disabled Fields:</span>
            <span class="debug-panel__state-value">{{ disabledFieldsCount }}</span>
          </div>
          <div class="debug-panel__state-row">
            <span class="debug-panel__state-label">Error Fields:</span>
            <span
              class="debug-panel__state-value"
              :class="{ 'debug-panel__state-value--error': errorFieldsCount > 0 }"
            >
              {{ errorFieldsCount }}
            </span>
          </div>

          <!-- Values -->
          <div class="debug-panel__values">
            <div class="debug-panel__values-header">Values:</div>
            <pre class="debug-panel__values-content">{{ JSON.stringify(values, null, 2) }}</pre>
          </div>
        </div>

        <!-- Fields Tab -->
        <div v-if="activeTab === 'fields'" class="debug-panel__fields">
          <div
            v-for="field in fieldsArray"
            :key="field.id"
            class="debug-panel__field"
            :class="{
              'debug-panel__field--hidden': field.hidden,
              'debug-panel__field--disabled': field.disabled,
              'debug-panel__field--error': field.errors.length > 0,
            }"
          >
            <div class="debug-panel__field-header">
              <span class="debug-panel__field-id">{{ field.id }}</span>
              <div class="debug-panel__field-tags">
                <span v-if="field.hidden" class="debug-panel__field-tag debug-panel__field-tag--hidden">
                  hidden
                </span>
                <span v-if="field.disabled" class="debug-panel__field-tag debug-panel__field-tag--disabled">
                  disabled
                </span>
                <span v-if="field.errors.length > 0" class="debug-panel__field-tag debug-panel__field-tag--error">
                  {{ field.errors.length }} error(s)
                </span>
              </div>
            </div>
            <div class="debug-panel__field-value">
              Value: <code>{{ formatValue(values[field.id]) }}</code>
            </div>
            <div v-if="field.errors.length > 0" class="debug-panel__field-errors">
              <div v-for="(error, idx) in field.errors" :key="idx" class="debug-panel__field-error">
                {{ error }}
              </div>
            </div>
          </div>
        </div>

        <!-- Expressions Tab -->
        <div v-if="activeTab === 'expressions'" class="debug-panel__expressions">
          <div v-if="expressionResults.length === 0" class="debug-panel__empty">
            No expressions with reactive evaluation
          </div>
          <div
            v-for="(expr, idx) in expressionResults"
            :key="idx"
            class="debug-panel__expr"
            :class="{
              'debug-panel__expr--true': expr.result === true,
              'debug-panel__expr--false': expr.result === false,
            }"
          >
            <div class="debug-panel__expr-header">
              <span class="debug-panel__expr-field">{{ expr.fieldId }}</span>
              <span class="debug-panel__expr-type">{{ expr.type }}</span>
              <span
                class="debug-panel__expr-result"
                :class="{
                  'debug-panel__expr-result--true': expr.result === true,
                  'debug-panel__expr-result--false': expr.result === false,
                }"
              >
                {{ expr.result }}
              </span>
            </div>
            <code class="debug-panel__expr-code">{{ formatExpression(expr.expression) }}</code>
          </div>
        </div>

        <!-- Dependencies Tab -->
        <div v-if="activeTab === 'deps'" class="debug-panel__deps">
          <div v-if="dependencyMap.length === 0" class="debug-panel__empty">
            No field dependencies defined
          </div>
          <div
            v-for="dep in dependencyMap"
            :key="dep.fieldId"
            class="debug-panel__dep"
          >
            <div class="debug-panel__dep-field">{{ dep.fieldId }}</div>
            <div v-if="dep.dependsOn.length > 0" class="debug-panel__dep-row">
              <span class="debug-panel__dep-label">depends on:</span>
              <div class="debug-panel__dep-items">
                <span
                  v-for="d in dep.dependsOn"
                  :key="d"
                  class="debug-panel__dep-item debug-panel__dep-item--upstream"
                >
                  {{ d }}
                </span>
              </div>
            </div>
            <div v-if="dep.dependents.length > 0" class="debug-panel__dep-row">
              <span class="debug-panel__dep-label">affects:</span>
              <div class="debug-panel__dep-items">
                <span
                  v-for="d in dep.dependents"
                  :key="d"
                  class="debug-panel__dep-item debug-panel__dep-item--downstream"
                >
                  {{ d }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions Tab -->
        <div v-if="activeTab === 'actions'" class="debug-panel__actions">
          <div class="debug-panel__actions-header">
            <span>Value Changes</span>
            <button type="button" class="debug-panel__clear-btn" @click="clearLogs">Clear</button>
          </div>
          <div v-if="valueChanges.length === 0" class="debug-panel__empty">
            No changes recorded yet
          </div>
          <div
            v-for="(change, idx) in valueChanges"
            :key="idx"
            class="debug-panel__action"
          >
            <span class="debug-panel__action-time">{{ formatTime(change.timestamp) }}</span>
            <span class="debug-panel__action-field">{{ change.fieldId }}</span>
            <span class="debug-panel__action-arrow">→</span>
            <code class="debug-panel__action-value">{{ formatValue(change.newValue) }}</code>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.debug-panel {
  position: fixed;
  bottom: 0;
  right: 16px;
  width: 400px;
  max-height: 50vh;
  background: #1e1e1e;
  border: 1px solid #333;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-size: 12px;
  color: #e0e0e0;
  z-index: 9999;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
}

.debug-panel--collapsed {
  max-height: auto;
}

.debug-panel__header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #2d2d2d;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  user-select: none;
}

.debug-panel__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: #fff;
}

.debug-panel__icon {
  font-size: 14px;
}

.debug-panel__badges {
  display: flex;
  gap: 6px;
  margin-left: auto;
  margin-right: 8px;
}

.debug-panel__badge {
  padding: 2px 6px;
  background: #444;
  border-radius: 4px;
  font-size: 10px;
  color: #aaa;
}

.debug-panel__badge--error {
  background: #5c2323;
  color: #ff6b6b;
}

.debug-panel__badge--warning {
  background: #5c4a23;
  color: #ffc107;
}

.debug-panel__toggle {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 4px;
  font-size: 10px;
}

.debug-panel__body {
  max-height: calc(50vh - 40px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.debug-panel__tabs {
  display: flex;
  background: #252525;
  border-bottom: 1px solid #333;
}

.debug-panel__tab {
  flex: 1;
  padding: 8px;
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 11px;
  font-family: inherit;
  transition: all 0.2s;
}

.debug-panel__tab:hover {
  background: #333;
  color: #fff;
}

.debug-panel__tab--active {
  background: #333;
  color: #4fc3f7;
  border-bottom: 2px solid #4fc3f7;
}

.debug-panel__content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

/* State Tab */
.debug-panel__state-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px solid #333;
}

.debug-panel__state-label {
  color: #888;
}

.debug-panel__state-value {
  color: #e0e0e0;
}

.debug-panel__state-value--success {
  color: #4caf50;
}

.debug-panel__state-value--error {
  color: #ff6b6b;
}

.debug-panel__values {
  margin-top: 12px;
}

.debug-panel__values-header {
  color: #888;
  margin-bottom: 4px;
}

.debug-panel__values-content {
  background: #252525;
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 10px;
  max-height: 200px;
  overflow-y: auto;
  margin: 0;
}

/* Fields Tab */
.debug-panel__field {
  padding: 8px;
  margin-bottom: 8px;
  background: #252525;
  border-radius: 4px;
  border-left: 3px solid #4fc3f7;
}

.debug-panel__field--hidden {
  border-left-color: #888;
  opacity: 0.6;
}

.debug-panel__field--disabled {
  border-left-color: #ffc107;
}

.debug-panel__field--error {
  border-left-color: #ff6b6b;
}

.debug-panel__field-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.debug-panel__field-id {
  font-weight: 600;
  color: #fff;
}

.debug-panel__field-tags {
  display: flex;
  gap: 4px;
}

.debug-panel__field-tag {
  padding: 2px 4px;
  border-radius: 2px;
  font-size: 9px;
}

.debug-panel__field-tag--hidden {
  background: #555;
  color: #aaa;
}

.debug-panel__field-tag--disabled {
  background: #5c4a23;
  color: #ffc107;
}

.debug-panel__field-tag--error {
  background: #5c2323;
  color: #ff6b6b;
}

.debug-panel__field-value {
  font-size: 11px;
  color: #aaa;
}

.debug-panel__field-value code {
  color: #ce9178;
}

.debug-panel__field-errors {
  margin-top: 4px;
}

.debug-panel__field-error {
  font-size: 10px;
  color: #ff6b6b;
  padding-left: 8px;
  border-left: 2px solid #ff6b6b;
}

/* Actions Tab */
.debug-panel__actions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  color: #888;
}

.debug-panel__clear-btn {
  padding: 2px 8px;
  background: #333;
  border: 1px solid #444;
  border-radius: 4px;
  color: #aaa;
  cursor: pointer;
  font-size: 10px;
}

.debug-panel__clear-btn:hover {
  background: #444;
  color: #fff;
}

.debug-panel__empty {
  color: #666;
  text-align: center;
  padding: 20px;
}

.debug-panel__action {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  margin-bottom: 4px;
  background: #252525;
  border-radius: 4px;
}

.debug-panel__action-time {
  color: #666;
  font-size: 10px;
}

.debug-panel__action-field {
  color: #4fc3f7;
  font-weight: 500;
}

.debug-panel__action-arrow {
  color: #666;
}

.debug-panel__action-value {
  color: #ce9178;
  font-size: 11px;
}

/* Expressions Tab */
.debug-panel__expr {
  padding: 8px;
  margin-bottom: 8px;
  background: #252525;
  border-radius: 4px;
  border-left: 3px solid #888;
}

.debug-panel__expr--true {
  border-left-color: #4caf50;
}

.debug-panel__expr--false {
  border-left-color: #888;
}

.debug-panel__expr-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.debug-panel__expr-field {
  font-weight: 600;
  color: #fff;
}

.debug-panel__expr-type {
  padding: 2px 6px;
  background: #444;
  border-radius: 4px;
  font-size: 9px;
  color: #aaa;
}

.debug-panel__expr-result {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

.debug-panel__expr-result--true {
  background: #1b5e20;
  color: #4caf50;
}

.debug-panel__expr-result--false {
  background: #444;
  color: #888;
}

.debug-panel__expr-code {
  display: block;
  font-size: 10px;
  color: #ce9178;
  background: #1a1a1a;
  padding: 6px 8px;
  border-radius: 4px;
  overflow-x: auto;
  white-space: nowrap;
}

/* Dependencies Tab */
.debug-panel__dep {
  padding: 8px;
  margin-bottom: 8px;
  background: #252525;
  border-radius: 4px;
}

.debug-panel__dep-field {
  font-weight: 600;
  color: #fff;
  margin-bottom: 6px;
}

.debug-panel__dep-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 4px;
}

.debug-panel__dep-label {
  color: #888;
  font-size: 10px;
  flex-shrink: 0;
  width: 70px;
}

.debug-panel__dep-items {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.debug-panel__dep-item {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
}

.debug-panel__dep-item--upstream {
  background: #1a237e;
  color: #7986cb;
}

.debug-panel__dep-item--downstream {
  background: #004d40;
  color: #4db6ac;
}
</style>
