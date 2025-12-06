/**
 * Complex Conditions Entity Schema
 *
 * 복합 조건 로직을 테스트하기 위한 엔티티
 *
 * 검증 포인트:
 * - AND 조건: 여러 필드가 모두 특정 값일 때
 * - OR 조건: 여러 필드 중 하나라도 특정 값일 때
 * - 중첩 조건: (A AND B) OR C 형태의 복합 조건
 */

import { entity, field, enumValue } from '@manifesto-ai/schema'

// Yes/No 옵션
export const yesNoOptions = [
  enumValue('YES', '예'),
  enumValue('NO', '아니오'),
] as const

// 상품 타입
export const itemTypes = [
  enumValue('NONE', '선택 안함'),
  enumValue('PHYSICAL', '실물 상품'),
  enumValue('DIGITAL', '디지털 상품'),
  enumValue('SERVICE', '서비스'),
] as const

// 결제 방식
export const paymentMethods = [
  enumValue('NONE', '선택 안함'),
  enumValue('CARD', '신용카드'),
  enumValue('BANK', '계좌이체'),
  enumValue('VIRTUAL', '가상계좌'),
  enumValue('MOBILE', '휴대폰 결제'),
] as const

// Entity Schema
export const complexConditionsEntity = entity(
  'complexConditions',
  'Complex Conditions',
  '0.1.0'
)
  .description('복합 조건 로직 데모 엔티티')
  .tags('demo', 'conditions')
  .fields(
    // =========================================================================
    // 기본 조건 필드 (A, B, C)
    // =========================================================================
    field
      .enum('conditionA', '조건 A', yesNoOptions)
      .defaultValue('NO')
      .build(),

    field
      .enum('conditionB', '조건 B', yesNoOptions)
      .defaultValue('NO')
      .build(),

    field
      .enum('conditionC', '조건 C', yesNoOptions)
      .defaultValue('NO')
      .build(),

    // =========================================================================
    // AND 조건 결과 필드 (A=YES AND B=YES 일 때 표시)
    // =========================================================================
    field.string('andResultField', 'AND 결과').build(),

    // =========================================================================
    // OR 조건 결과 필드 (A=YES OR C=YES 일 때 표시)
    // =========================================================================
    field.string('orResultField', 'OR 결과').build(),

    // =========================================================================
    // 중첩 조건 결과 필드 ((A=YES AND B=YES) OR C=YES 일 때 표시)
    // =========================================================================
    field.string('nestedResultField', '중첩 결과').build(),

    // =========================================================================
    // 실제 시나리오: 상품 유형별 분기
    // =========================================================================
    field
      .enum('itemType', '상품 유형', itemTypes)
      .defaultValue('NONE')
      .build(),

    // 실물 상품 전용 필드
    field.number('weight', '무게 (kg)').min(0).build(),
    field.string('shippingAddress', '배송 주소').build(),

    // 디지털 상품 전용 필드
    field.string('downloadUrl', '다운로드 URL').build(),
    field.number('fileSize', '파일 크기 (MB)').min(0).build(),

    // 서비스 전용 필드
    field.string('serviceDate', '서비스 일시').build(),
    field.string('serviceLocation', '서비스 장소').build(),

    // =========================================================================
    // 실제 시나리오: 결제 방식별 분기
    // =========================================================================
    field
      .enum('paymentMethod', '결제 방식', paymentMethods)
      .defaultValue('NONE')
      .build(),

    // 카드 결제 전용
    field.string('cardNumber', '카드 번호').build(),
    field.number('installmentMonths', '할부 개월').min(1).max(36).build(),

    // 계좌이체 전용
    field.string('bankName', '은행명').build(),
    field.string('accountNumber', '계좌번호').build(),

    // 가상계좌 전용
    field.string('virtualAccountBank', '가상계좌 은행').build(),
    field.string('depositorName', '입금자명').build(),

    // 휴대폰 결제 전용
    field.string('mobileCarrier', '통신사').build(),
    field.string('mobileNumber', '휴대폰 번호').build(),

    // =========================================================================
    // 복합 시나리오: 상품+결제 조합
    // =========================================================================
    // 실물 상품 + 카드 결제 시에만 표시
    field.boolean('usePointsForShipping', '포인트로 배송비 결제').build()
  )
  .build()

export type YesNoOption = (typeof yesNoOptions)[number]['value']
export type ItemType = (typeof itemTypes)[number]['value']
export type PaymentMethod = (typeof paymentMethods)[number]['value']
