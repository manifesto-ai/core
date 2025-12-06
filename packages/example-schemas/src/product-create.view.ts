/**
 * Product Create View Schema
 *
 * 쇼핑몰 상품 등록 화면으로 도메인 메타포를 건물→상품, 층→옵션으로 치환
 * - productType: 실물/디지털 여부에 따라 배송/재고 필드 토글
 * - category → subCategory: 기존 Company → Organization 캐스케이딩 셀렉트 치환
 * - freight(대형 화물) 시 최소 무게 50kg 강제 (고층 건물 층수 검증 로직 치환)
 * - price/discount → finalPrice 자동 계산
 * - SKU 입력 시 async 중복 체크 시뮬레이션
 */

import {
  view,
  section,
  layout,
  header,
  footer,
  viewAction,
  confirm,
  on,
  dataSource,
  createTypedExpression,
  createTypedView,
} from '@manifesto-ai/schema'

// 카테고리/서브카테고리 정적 옵션 (Company → Category 치환)
export const categories = [
  { value: 'apparel', label: '패션' },
  { value: 'electronics', label: '전자제품' },
  { value: 'grocery', label: '식품' },
] as const

export const subCategoriesByCategory: Record<string, Array<{ value: string; label: string }>> = {
  apparel: [
    { value: 'outer', label: '아우터' },
    { value: 'top', label: '상의' },
    { value: 'bottom', label: '하의' },
  ],
  electronics: [
    { value: 'mobile', label: '모바일' },
    { value: 'appliance', label: '가전' },
    { value: 'computer', label: '컴퓨팅' },
  ],
  grocery: [
    { value: 'fresh', label: '신선식품' },
    { value: 'snack', label: '간식/디저트' },
    { value: 'beverage', label: '음료' },
  ],
}

type ProductFormState = {
  name: string
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
  productTypeCode: 'PHYSICAL' | 'DIGITAL' | 'HYBRID'
  fulfillmentTypeCode: 'STANDARD' | 'BULK' | 'FREIGHT'
  categoryId: string
  subCategoryId: string
  price: number
  discountRate: number
  finalPrice: number
  shippingWeight: number
  shippingFee: number
  warehouseId: string
  sku: string
  thumbnailUrl: string
  description: string
  skuCheckMessage: string
  tags: string
  brandId: string
  stockQuantity: number
}

const productExpr = createTypedExpression<ProductFormState>()
const productView = createTypedView<ProductFormState>()
const priceState = productExpr.field('price').build()
const discountRateState = productExpr.field('discountRate').build()
const categoryIdState = productExpr.field('categoryId').build()
const skuState = productExpr.field('sku').build()
const isDigital = productExpr.field('productTypeCode').is('DIGITAL').build()
const notDigital = productExpr.field('productTypeCode').not('DIGITAL').build()
const notFreight = productExpr.field('fulfillmentTypeCode').not('FREIGHT').build()
const isFreightAndLight = productExpr
  .field('fulfillmentTypeCode')
  .is('FREIGHT')
  .and(productExpr.field('shippingWeight').lt(50))
  .build()
const categoryIsEmpty = productExpr.raw(['IS_EMPTY', categoryIdState]).build()
const finalPriceExpr = productExpr
  .raw(['*', priceState, ['-', 1, ['/', discountRateState, 100]]])
  .build()

// View Schema
export const productCreateView = view('product-create', 'Product Create', '0.1.0')
  .entityRef('product')
  .mode('create')
  .description('상품 등록 화면')
  .layout(layout.form(2))
  .header(header('상품 등록', {
    subtitle: '실물/디지털 상품 모두 관리할 수 있는 등록 화면',
  }))
  .sections(
    // 기본 정보 섹션
    section('basic')
      .title('기본 정보')
      .description('상품의 핵심 정보를 입력합니다')
      .layout(layout.grid(2, '1rem'))
      .fields(
        productView.field('name').textInput('상품명')
          .placeholder('상품명을 입력하세요')
          .helpText('2자 이상 100자 이하로 입력해주세요')
          .span(2)
          .build(),

        productView.field('sku').textInput('상품 코드 (SKU)')
          .placeholder('예: SKU-001')
          .helpText('영문 대문자, 숫자, 하이픈만 사용')
          // SKU 입력 후 서버 중복 체크 시뮬레이션
          .reaction(
            on.blur()
              .do(
                productView.actions.setValue('skuCheckMessage', dataSource.api('/api/sku-check', {
                  method: 'GET',
                  params: { sku: skuState },
                  transform: { path: 'message' },
                }))
              )
          )
          .build(),

        productView.field('status').select('상태')
          .build(),

        productView.field('productTypeCode').select('상품 타입')
          .placeholder('상품 타입을 선택하세요')
          // 디지털 상품이면 배송/재고 위치 필드 숨김
          .reaction(
            on.change()
              .when(isDigital)
              .do(
                productView.actions.updateProp('shippingWeight', 'hidden', true),
                productView.actions.updateProp('shippingFee', 'hidden', true),
                productView.actions.updateProp('warehouseId', 'hidden', true)
              )
          )
          .reaction(
            on.change()
              .when(notDigital)
              .do(
                productView.actions.updateProp('shippingWeight', 'hidden', false),
                productView.actions.updateProp('shippingFee', 'hidden', false),
                productView.actions.updateProp('warehouseId', 'hidden', false)
              )
          )
          .build(),

        productView.field('fulfillmentTypeCode').select('배송 타입')
          .placeholder('배송 타입을 선택하세요')
          // 배송 타입 변경 시 무게/재고 기본값 조정
          .reaction(
            on.change()
              .when(notFreight)
              .do(
                productView.actions.updateProp('shippingWeight', 'disabled', false),
                productView.actions.updateProp('shippingWeight', 'hidden', false)
              )
          )
          .build(),

        productView.field('categoryId').select('카테고리')
          .placeholder('카테고리를 선택하세요')
          .reaction(
            // 폼 마운트 시 카테고리 옵션 로드
            on.mount()
              .do(productView.actions.setOptions('categoryId', dataSource.static(categories)))
          )
          // 카테고리 변경 시 서브 카테고리 옵션 업데이트
          .reaction(
            on.change()
              .do(
                productView.actions.setValue('subCategoryId', ''),
                productView.actions.setOptions('subCategoryId', dataSource.api('/api/subcategories', {
                  method: 'GET',
                  params: { categoryId: categoryIdState },
                  transform: {
                    path: 'data',
                    map: { value: 'id', label: 'name' },
                  },
                }))
              )
          )
          .build(),

        productView.field('subCategoryId').select('서브 카테고리')
          .placeholder('상위 카테고리를 먼저 선택하세요')
          .dependsOn('categoryId')
          .disabled(categoryIsEmpty)
          .build(),

        productView.field('brandId').textInput('브랜드')
          .placeholder('브랜드/벤더명을 입력하세요')
          .build(),
      )
      .build(),

    // 가격 섹션 - 할인/최종가 자동 계산
    section('pricing')
      .title('가격 정보')
      .layout(layout.grid(3, '1rem'))
      .fields(
        productView.field('price').numberInput('판매가')
          .placeholder('0')
          .props({ min: 0, step: 1 })
          .reaction(
            on.change()
              .do(
                productView.actions.setValue('finalPrice', finalPriceExpr)
              )
          )
          .build(),

        productView.field('discountRate').numberInput('할인율 (%)')
          .placeholder('0~100')
          .props({ min: 0, max: 100, step: 1 })
          .reaction(
            on.change()
              .do(
                productView.actions.setValue('finalPrice', finalPriceExpr)
              )
          )
          .build(),

        productView.field('finalPrice').numberInput('최종 가격')
          .placeholder('자동 계산')
          .props({ min: 0, step: 1, readonly: true })
          .helpText('판매가와 할인율로 자동 계산됩니다')
          .build(),
      )
      .build(),

    // 재고/배송 정보 섹션 - 디지털 상품이면 숨김
    section('inventory')
      .title('재고 및 배송')
      .layout(layout.grid(2, '1rem'))
      .fields(
        productView.field('stockQuantity').numberInput('재고 수량')
          .placeholder('0')
          .props({ min: 0, max: 100000, step: 1 })
          .build(),

        productView.field('shippingWeight').numberInput('배송 무게 (kg)')
          .placeholder('0')
          .props({ min: 0, max: 2000, step: 0.1 })
          .dependsOn('productTypeCode', 'fulfillmentTypeCode')
          // 대형 화물은 50kg 이상 강제 (고층 검증 로직 치환)
          .reaction(
            on.change()
              .when(isFreightAndLight)
              .do(productView.actions.setValue('shippingWeight', 50))
          )
          .build(),

        productView.field('shippingFee').numberInput('배송비')
          .placeholder('0')
          .props({ min: 0, step: 100 })
          .dependsOn('productTypeCode')
          .build(),

        productView.field('warehouseId').textInput('재고 위치 (창고)')
          .placeholder('예: WH-SEOUL-01')
          .dependsOn('productTypeCode')
          .build(),
      )
      .build(),

    // 미디어/설명 섹션
    section('media')
      .title('미디어 및 설명')
      .layout(layout.grid(1, '1rem'))
      .collapsible(true)
      .fields(
        productView.field('thumbnailUrl').textInput('대표 이미지 URL')
          .placeholder('https://...')
          .build(),

        productView.field('description').textarea('상세 설명')
          .placeholder('상품 상세 내용을 입력하세요')
          .props({ rows: 4 })
          .build(),
      )
      .build(),

    // 검증 결과/메모 섹션
    section('validation')
      .title('검증 및 메모')
      .layout(layout.grid(2, '1rem'))
      .fields(
        productView.field('skuCheckMessage').textInput('SKU 검증 결과')
          .placeholder('중복 여부를 확인 중입니다')
          .props({ readonly: true })
          .build(),

        productView.field('tags').textInput('태그')
          .placeholder('콤마로 구분해 입력 (예: 세일,MD추천)')
          .build(),
      )
      .build(),
  )
  .footer(footer([
    viewAction.cancel('cancel', '취소')
      .build(),

    viewAction.submit('submit', '등록')
      .confirm(confirm(
        '상품 등록',
        '입력한 정보로 상품을 등록하시겠습니까?',
        { confirmLabel: '등록', cancelLabel: '취소' }
      ))
      .build(),
  ]))
  .build()
