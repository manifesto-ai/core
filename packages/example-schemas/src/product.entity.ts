/**
 * Product Entity Schema
 *
 * 쇼핑몰 상품 데이터 구조를 정의하며 기존 공간/층 메타포를 상품/옵션으로 치환
 * - sideType → productType (physical/digital)
 * - floorCount → stockQuantity
 * - 지역/위치 관계 → product/variant relations
 */

import {
  entity,
  field,
  enumValue,
  relation,
  uniqueIndex,
} from '@manifesto-ai/schema'

// 상품 유형 (실물/디지털/묶음)
export const productTypes = [
  enumValue('PHYSICAL', '실물 상품'),
  enumValue('DIGITAL', '디지털 상품'),
  enumValue('HYBRID', '묶음 상품', { description: '실물+디지털 번들' }),
] as const

// 배송/패키징 타입 (기존 건물 유형 → 배송 난이도)
export const fulfillmentTypes = [
  enumValue('STANDARD', '일반 배송'),
  enumValue('BULK', '대형 화물'),
  enumValue('FREIGHT', '특수 화물', { description: '50kg 이상 화물' }),
] as const

export const statusTypes = [
  enumValue('DRAFT', '임시저장'),
  enumValue('ACTIVE', '판매중'),
  enumValue('INACTIVE', '판매중지'),
  enumValue('ARCHIVED', '보관'),
] as const

// Entity Schema
export const productEntity = entity('product', 'Product', '0.1.0')
  .description('상품 정보를 정의하는 엔티티')
  .tags('catalog', 'product')
  .fields(
    // 기본 정보
    field.string('id', 'ID').build(),

    field.string('name', '상품명')
      .required('상품명을 입력해주세요')
      .min(2, '상품명은 2자 이상이어야 합니다')
      .max(100, '상품명은 100자 이하여야 합니다')
      .build(),

    field.string('sku', 'SKU')
      .required('상품 코드를 입력해주세요')
      .pattern('^[A-Z0-9-]+$', '영문 대문자, 숫자, 하이픈만 사용 가능합니다')
      .build(),

    field.enum('productTypeCode', '상품 타입', productTypes)
      .required('상품 타입을 선택해주세요')
      .defaultValue('PHYSICAL')
      .build(),

    field.enum('fulfillmentTypeCode', '배송 타입', fulfillmentTypes)
      .required('배송 타입을 선택해주세요')
      .build(),

    field.enum('status', '상태', statusTypes)
      .defaultValue('DRAFT')
      .build(),

    // 카테고리/브랜드
    field.string('categoryId', '카테고리').build(),
    field.string('subCategoryId', '서브 카테고리').build(),
    field.string('brandId', '브랜드').build(),

    // 가격 정보
    field.number('price', '판매가')
      .required('판매가를 입력해주세요')
      .min(0)
      .build(),

    field.number('discountRate', '할인율 (%)')
      .min(0)
      .max(100)
      .defaultValue(0)
      .build(),

    field.number('finalPrice', '최종 가격')
      .min(0)
      .build(),

    // 재고/배송 정보 (floorCount → stockQuantity 매핑)
    field.number('stockQuantity', '재고 수량')
      .min(0)
      .max(100000)
      .defaultValue(0)
      .build(),

    field.number('shippingWeight', '배송 무게 (kg)')
      .min(0)
      .max(2000)
      .build(),

    field.number('shippingFee', '배송비')
      .min(0)
      .build(),

    field.string('warehouseId', '보관 창고').build(),

    // 부가 정보
    field.string('thumbnailUrl', '대표 이미지 URL').build(),
    field.string('description', '설명')
      .max(1000)
      .build(),

    field.string('tags', '태그').build(),

    // SKU 중복 체크 결과 저장용 (Async Validation 표시)
    field.string('skuCheckMessage', 'SKU 검증 메세지').build(),

    field.datetime('createdAt', '생성일시').build(),
    field.datetime('updatedAt', '수정일시').build(),
  )
  // 옵션/묶음 관계 (기존 상위 엔티티 → 상품 치환)
  .relation(relation.hasMany('variant', 'productId'))
  .relation(relation.hasMany('option', 'productId'))
  .relation(relation.belongsTo('brand', 'brandId'))
  .index(uniqueIndex('sku'))
  .build()

export type ProductType = typeof productTypes[number]['value']
export type FulfillmentType = typeof fulfillmentTypes[number]['value']
export type StatusType = typeof statusTypes[number]['value']
