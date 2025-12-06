<script setup lang="ts">
/**
 * Delivery Method Form
 *
 * FormRenderer를 사용하여 배송 타입별 동적 필드 전환을 검증
 */
import { ref } from 'vue'
import { FormRenderer } from '@manifesto-ai/vue'
import { deliveryRegisterView, deliveryRegisterEntity } from '@manifesto-ai/example-schemas'

// 초기값
const initialValues = {
  status: 'DRAFT',
  weatherProof: false,
  hazardousMaterialsConsent: false,
  needsSignature: true,
  customerNotification: true,
}

// 폼 참조
const formRef = ref<InstanceType<typeof FormRenderer> | null>(null)

// Submit 핸들러
const handleSubmit = (data: Record<string, unknown>) => {
  console.log('Submit data:', data)
  alert('배송 수단이 등록되었습니다!\n\n' + JSON.stringify(data, null, 2))
}

// 에러 핸들러
const handleError = (error: unknown) => {
  console.error('Form error:', error)
}
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>배송 수단 등록</h1>
      <p>배송 타입에 따라 다른 필드가 표시됩니다</p>
    </header>

    <FormRenderer
      ref="formRef"
      :schema="deliveryRegisterView"
      :entity-schema="deliveryRegisterEntity"
      :initial-values="initialValues"
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
            {{ isSubmitting ? '등록 중...' : '등록' }}
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
