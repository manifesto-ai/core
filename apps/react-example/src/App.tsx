import { useMemo, useState, type ReactElement } from 'react'
import { FormRenderer, createFieldRegistry } from '@manifesto-ai/react'
import type { FetchHandler } from '@manifesto-ai/engine'
import {
  productCreateView,
  productEntity,
  scheduleView,
  scheduleEntity,
  subCategoriesByCategory,
  variantsByProduct,
} from '@manifesto-ai/example-schemas'
import * as ShadcnInputs from '@/components/manifesto-shadcn'

// Create field registry with shadcn components
const shadcnRegistry = createFieldRegistry(false)
shadcnRegistry.register('text-input', ShadcnInputs.TextInput)
shadcnRegistry.register('number-input', ShadcnInputs.NumberInput)
shadcnRegistry.register('textarea', ShadcnInputs.TextareaInput)
shadcnRegistry.register('checkbox', ShadcnInputs.CheckboxInput)
shadcnRegistry.register('toggle', ShadcnInputs.ToggleInput)
shadcnRegistry.register('select', ShadcnInputs.SelectInput)
shadcnRegistry.register('radio', ShadcnInputs.RadioInput)
shadcnRegistry.register('slider', ShadcnInputs.SliderInput)
shadcnRegistry.register('date-picker', ShadcnInputs.DatePickerInput)

type Tab = 'product' | 'schedule'

const productInitialValues = {
  status: 'DRAFT',
  productTypeCode: 'PHYSICAL',
  fulfillmentTypeCode: 'STANDARD',
  discountRate: 0,
  stockQuantity: 0,
}

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

const useMockFetchHandler = (): FetchHandler =>
  useMemo(
    () => async (endpoint, _options) => {
      if (endpoint.startsWith('/api/sku-check')) {
        const url = new URL(endpoint, 'http://localhost')
        const sku = url.searchParams.get('sku') ?? ''
        await new Promise((resolve) => setTimeout(resolve, 250))
        const takenSkus = ['SKU-001', 'SKU-123', 'DUP-001']
        const exists = takenSkus.includes(sku.toUpperCase())
        return { message: exists ? '이미 사용 중인 SKU입니다' : '사용 가능한 SKU입니다' }
      }

      if (endpoint.startsWith('/api/subcategories')) {
        const url = new URL(endpoint, 'http://localhost')
        const categoryId = url.searchParams.get('categoryId') ?? ''
        await new Promise((resolve) => setTimeout(resolve, 200))
        const subcategories = subCategoriesByCategory[categoryId] ?? []
        return {
          data: subcategories.map((item) => ({ id: item.value, name: item.label })),
        }
      }

      if (endpoint.startsWith('/api/products')) {
        await new Promise((resolve) => setTimeout(resolve, 200))
        return {
          data: [
            { id: 'prd-1', name: '무선 이어폰' },
            { id: 'prd-2', name: '프리미엄 커피원두' },
            { id: 'prd-3', name: '모던 소파 세트' },
          ],
        }
      }

      if (endpoint.startsWith('/api/variants')) {
        const url = new URL(endpoint, 'http://localhost')
        const productId = url.searchParams.get('productId')
        await new Promise((resolve) => setTimeout(resolve, 250))
        if (productId && variantsByProduct[productId]) {
          return {
            data: variantsByProduct[productId].map((option) => ({
              id: option.value,
              name: option.label,
            })),
          }
        }
        return { data: [] }
      }

      return { data: [] }
    },
    []
  )

export default function App(): ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('product')
  const mockFetchHandler = useMockFetchHandler()

  const handleProductSubmit = (data: Record<string, unknown>) => {
    console.log('Product submit:', data)
    alert('상품이 등록되었습니다!\n\n' + JSON.stringify(data, null, 2))
  }

  const handleScheduleSubmit = (data: Record<string, unknown>) => {
    console.log('Schedule submit:', data)
    alert('작업 스케줄이 저장되었습니다!\n\n' + JSON.stringify(data, null, 2))
  }

  const handleError = (error: unknown) => {
    console.error('Form error:', error)
  }

  return (
    <div className="app">
      <nav className="tab-nav">
        <button className={`tab-btn ${activeTab === 'product' ? 'active' : ''}`} onClick={() => setActiveTab('product')}>
          상품 등록
        </button>
        <button className={`tab-btn ${activeTab === 'schedule' ? 'active' : ''}`} onClick={() => setActiveTab('schedule')}>
          작업 스케줄
        </button>
      </nav>

      {activeTab === 'product' ? (
        <div className="tab-content">
          <header className="app-header">
            <h1>상품 등록</h1>
            <p>실물/디지털 상품 정보를 입력해주세요</p>
          </header>

          <FormRenderer
            schema={productCreateView}
            entitySchema={productEntity}
            initialValues={productInitialValues}
            fetchHandler={mockFetchHandler}
            fieldRegistry={shadcnRegistry}
            debug
            onSubmit={handleProductSubmit}
            onError={handleError}
          />
        </div>
      ) : null}

      {activeTab === 'schedule' ? (
        <div className="tab-content">
          <header className="app-header">
            <h1>작업 스케줄 등록</h1>
            <p>배송/재고 스케줄 정보를 입력하세요</p>
          </header>

          <FormRenderer
            schema={scheduleView}
            entitySchema={scheduleEntity}
            initialValues={scheduleInitialValues}
            fetchHandler={mockFetchHandler}
            fieldRegistry={shadcnRegistry}
            debug
            onSubmit={handleScheduleSubmit}
            onError={handleError}
          />
        </div>
      ) : null}
    </div>
  )
}
