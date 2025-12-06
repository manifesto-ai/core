<script setup lang="ts">
/**
 * Example App - FormRenderer 데모 (Vuetify)
 *
 * 모든 폼이 FormRenderer 기반으로 자동 렌더링됩니다.
 * - Product Form (빌딩 → 상품 치환)
 * - Schedule Form (배송/재고 스케줄)
 */
import { ref, markRaw } from 'vue'
import { FormRenderer, createFieldRegistry } from '@manifesto-ai/vue'
import {
  productCreateView,
  productEntity,
  scheduleView,
  scheduleEntity,
  subCategoriesByCategory,
  variantsByProduct,
} from '@manifesto-ai/example-schemas'
import type { FetchHandler } from '@manifesto-ai/engine'
import * as VuetifyInputs from './components/manifesto-vuetify'

// Create Vuetify field registry
const vuetifyRegistry = createFieldRegistry(false)
vuetifyRegistry.register('text-input', markRaw(VuetifyInputs.TextInput))
vuetifyRegistry.register('number-input', markRaw(VuetifyInputs.NumberInput))
vuetifyRegistry.register('textarea', markRaw(VuetifyInputs.TextareaInput))
vuetifyRegistry.register('checkbox', markRaw(VuetifyInputs.CheckboxInput))
vuetifyRegistry.register('toggle', markRaw(VuetifyInputs.ToggleInput))
vuetifyRegistry.register('select', markRaw(VuetifyInputs.SelectInput))
vuetifyRegistry.register('radio', markRaw(VuetifyInputs.RadioInput))
vuetifyRegistry.register('slider', markRaw(VuetifyInputs.SliderInput))
vuetifyRegistry.register('date-picker', markRaw(VuetifyInputs.DatePickerInput))
vuetifyRegistry.register('autocomplete', markRaw(VuetifyInputs.AutocompleteInput))
vuetifyRegistry.register('multi-select', markRaw(VuetifyInputs.MultiSelectInput))

// 탭 타입 정의
type TabType = 'product' | 'schedule'

const activeTab = ref<TabType>('product')

// ============= Product Form =============
const productInitialValues = {
  status: 'DRAFT',
  productTypeCode: 'PHYSICAL',
  fulfillmentTypeCode: 'STANDARD',
  discountRate: 0,
  stockQuantity: 0,
}

const productFormRef = ref<InstanceType<typeof FormRenderer> | null>(null)

const handleProductSubmit = (data: Record<string, unknown>) => {
  console.log('Product submit:', data)
  alert('상품이 등록되었습니다!\n\n' + JSON.stringify(data, null, 2))
}

// ============= Schedule Form =============
const scheduleInitialValues = {
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

const scheduleFormRef = ref<InstanceType<typeof FormRenderer> | null>(null)

// Mock Fetch Handler for Product/Schedule Form
const mockFetchHandler: FetchHandler = async (endpoint, _options) => {
  // SKU 중복 체크 시뮬레이션
  if (endpoint.startsWith('/api/sku-check')) {
    const url = new URL(endpoint, 'http://localhost')
    const sku = url.searchParams.get('sku') ?? ''

    await new Promise(resolve => setTimeout(resolve, 250))

    const takenSkus = ['SKU-001', 'SKU-123', 'DUP-001']
    const exists = takenSkus.includes(sku.toUpperCase())

    return {
      message: exists ? '이미 사용 중인 SKU입니다' : '사용 가능한 SKU입니다',
    }
  }

  // 서브 카테고리 목록
  if (endpoint.startsWith('/api/subcategories')) {
    const url = new URL(endpoint, 'http://localhost')
    const categoryId = url.searchParams.get('categoryId') ?? ''

    await new Promise(resolve => setTimeout(resolve, 200))

    const subcategories = subCategoriesByCategory[categoryId] ?? []
    return {
      data: subcategories.map(item => ({
        id: item.value,
        name: item.label,
      })),
    }
  }

  // 상품 목록 (스케줄 폼)
  if (endpoint.startsWith('/api/products')) {
    await new Promise(resolve => setTimeout(resolve, 200))
    return {
      data: [
        { id: 'prd-1', name: '무선 이어폰' },
        { id: 'prd-2', name: '프리미엄 커피원두' },
        { id: 'prd-3', name: '모던 소파 세트' },
      ],
    }
  }

  // 옵션 목록 (스케줄 폼)
  if (endpoint.startsWith('/api/variants')) {
    const url = new URL(endpoint, 'http://localhost')
    const productId = url.searchParams.get('productId')

    await new Promise(resolve => setTimeout(resolve, 250))

    if (productId && variantsByProduct[productId]) {
      return {
        data: variantsByProduct[productId].map(option => ({
          id: option.value,
          name: option.label,
        })),
      }
    }
    return { data: [] }
  }

  return { data: [] }
}

const handleScheduleSubmit = (data: Record<string, unknown>) => {
  console.log('Schedule submit:', data)
  alert('작업 스케줄이 저장되었습니다!\n\n' + JSON.stringify(data, null, 2))
}

// 에러 핸들러
const handleError = (error: unknown) => {
  console.error('Form error:', error)
}
</script>

<template>
  <v-app>
    <v-main>
      <div class="app">
        <!-- 탭 네비게이션 -->
        <nav class="tab-nav">
          <button
            :class="['tab-btn', { active: activeTab === 'product' }]"
            @click="activeTab = 'product'"
          >
            상품 등록
          </button>
          <button
            :class="['tab-btn', { active: activeTab === 'schedule' }]"
            @click="activeTab = 'schedule'"
          >
            작업 스케줄
          </button>
        </nav>

        <!-- Product Form -->
        <div v-if="activeTab === 'product'" class="tab-content">
          <header class="app-header">
            <h1>상품 등록</h1>
            <p>실물/디지털 상품 정보를 입력해주세요</p>
          </header>

          <FormRenderer
            ref="productFormRef"
            :schema="productCreateView"
            :entity-schema="productEntity"
            :initial-values="productInitialValues"
            :fetch-handler="mockFetchHandler"
            :field-registry="vuetifyRegistry"
            :debug="true"
            @submit="handleProductSubmit"
            @error="handleError"
          />
        </div>

        <!-- Schedule Form -->
        <div v-else-if="activeTab === 'schedule'" class="tab-content">
          <header class="app-header">
            <h1>작업 스케줄 등록</h1>
            <p>배송/재고 스케줄 정보를 입력하세요</p>
          </header>

          <FormRenderer
            ref="scheduleFormRef"
            :schema="scheduleView"
            :entity-schema="scheduleEntity"
            :initial-values="scheduleInitialValues"
            :fetch-handler="mockFetchHandler"
            :field-registry="vuetifyRegistry"
            :debug="true"
            @submit="handleScheduleSubmit"
            @error="handleError"
          />
        </div>
      </div>
    </v-main>
  </v-app>
</template>

<style>
.app {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}

/* Tab Navigation */
.tab-nav {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e0e0e0;
}

.tab-btn {
  padding: 0.75rem 1.25rem;
  border: 1px solid #ddd;
  border-radius: 8px 8px 0 0;
  background: #f5f5f5;
  color: #666;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: #e8e8e8;
}

.tab-btn.active {
  background: #4a90d9;
  color: white;
  border-color: #4a90d9;
}

.tab-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
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

@media (max-width: 768px) {
  .tab-nav {
    flex-direction: column;
  }

  .tab-btn {
    border-radius: 4px;
  }
}
</style>
