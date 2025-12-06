<script setup lang="ts">
/**
 * Schedule Form
 *
 * FormRenderer를 사용하여 자동으로 폼을 렌더링
 * ViewSchema 기반 자동 렌더링으로 800+ 줄 코드가 100줄 이하로 감소
 */
import { ref } from 'vue'
import { FormRenderer } from '@manifesto-ai/vue'
import { scheduleView, products, variantsByProduct, scheduleEntity } from '@manifesto-ai/example-schemas'
import type { FetchHandler } from '@manifesto-ai/engine'

// Mock Fetch Handler - API 호출을 시뮬레이션
const mockFetchHandler: FetchHandler = async (endpoint, _options) => {
  // 상품 목록 API
  if (endpoint.startsWith('/api/products')) {
    await new Promise(resolve => setTimeout(resolve, 200))
    return {
      data: products.map(p => ({
        id: p.value,
        name: p.label,
      })),
    }
  }

  // 옵션 목록 API
  if (endpoint.startsWith('/api/variants')) {
    const url = new URL(endpoint, 'http://localhost')
    const productId = url.searchParams.get('productId')

    await new Promise(resolve => setTimeout(resolve, 300))

    if (productId && variantsByProduct[productId]) {
      return {
        data: variantsByProduct[productId].map(v => ({
          id: v.value,
          name: v.label,
        })),
      }
    }
    return { data: [] }
  }
  return { data: [] }
}

// 초기값
const initialValues = {
  status: 'ACTIVE',
  missionType: 'FULFILLMENT',
  repeatType: 'DAILY',
  repeatInterval: 1,
  weekday_mon: false,
  weekday_tue: false,
  weekday_wed: false,
  weekday_thu: false,
  weekday_fri: false,
  weekday_sat: false,
  weekday_sun: false,
}

// 폼 참조
const formRef = ref<InstanceType<typeof FormRenderer> | null>(null)

// Submit 핸들러
const handleSubmit = (data: Record<string, unknown>) => {
  console.log('Submit data:', data)
  alert('스케줄이 저장되었습니다!\n\n' + JSON.stringify(data, null, 2))
}

// 에러 핸들러
const handleError = (error: unknown) => {
  console.error('Form error:', error)
}
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>작업 스케줄 등록</h1>
      <p>배송/재고 작업 스케줄 정보를 입력하세요</p>
    </header>

    <FormRenderer
      ref="formRef"
      :schema="scheduleView"
      :entity-schema="scheduleEntity"
      :initial-values="initialValues"
      :fetch-handler="mockFetchHandler"
      :debug="true"
      @submit="handleSubmit"
      @error="handleError"
    >
      <template #footer="{ reset, isValid, isDirty, isSubmitting }">
        <div class="form-footer">
          <button type="button" class="btn btn-secondary" @click="reset" :disabled="!isDirty">
            취소
          </button>
          <button type="submit" class="btn btn-primary" :disabled="!isValid || isSubmitting">
            {{ isSubmitting ? '저장 중...' : '저장' }}
          </button>
        </div>
      </template>
    </FormRenderer>
  </div>
</template>

<style>
.app {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}

.app-header {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e0e0e0;
}

.app-header h1 {
  font-size: 1.75rem;
  color: #1a1a1a;
  margin-bottom: 0.5rem;
}

.app-header p {
  color: #666;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1.5rem 0;
  border-top: 1px solid #e0e0e0;
  margin-top: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #4a90d9;
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: #3a7bc8;
}

.btn-secondary {
  background: white;
  color: #666;
  border: 1px solid #ddd;
}

.btn-secondary:hover:not(:disabled) {
  background: #f5f5f5;
}
</style>
