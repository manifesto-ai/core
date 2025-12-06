/**
 * Delivery Method Entity Schema
 *
 * 배송 수단/정책 정보를 정의 (기존 로봇 다형성 시나리오를 배송 메타포로 치환)
 */

import { entity, field, enumValue } from '@manifesto-ai/schema'

// 배송 모드 (기존 로봇 모델 → 배송 타입)
export const deliveryModes = [
  enumValue('PARCEL', '일반 택배', { description: '박스 단위 표준 배송' }),
  enumValue('COLD_CHAIN', '신선/냉장', { description: '온도 관리가 필요한 배송' }),
  enumValue('FREIGHT', '대형 화물', { description: '중량·부피가 큰 배송' }),
  enumValue('PICKUP', '매장 픽업', { description: '매장에서 바로 수령' }),
] as const

// 배송 설정 상태
export const deliveryStatuses = [
  enumValue('DRAFT', '임시저장'),
  enumValue('PENDING', '승인대기'),
  enumValue('ACTIVE', '운영중'),
  enumValue('MAINTENANCE', '점검중'),
  enumValue('INACTIVE', '비활성'),
] as const

// 패키징 티어 (trayType 매핑)
export const packageTiers = [
  enumValue('SINGLE', '단일 박스'),
  enumValue('DOUBLE', '2중 포장'),
  enumValue('TRIPLE', '3중 포장'),
] as const

// 보관 온도 범주 (cleaning 섹션 매핑)
export const temperatureProfiles = [
  enumValue('AMBIENT', '상온'),
  enumValue('CHILLED', '냉장'),
  enumValue('FROZEN', '냉동'),
] as const

// 화물 처리 방식 (disinfection 섹션 매핑)
export const handlingMethods = [
  enumValue('STANDARD', '일반 화물'),
  enumValue('HAZARDOUS', '위험물/고가품'),
  enumValue('OVERSIZED', '대형/벌크'),
] as const

// Entity Schema
export const deliveryRegisterEntity = entity('delivery-method', 'Delivery Method', '0.1.0')
  .description('배송 수단 구성을 정의하는 엔티티 (다형성 검증)')
  .tags('delivery', 'fulfillment')
  .fields(
    // === 공통 필드 ===
    field.string('id', 'ID').build(),

    field.string('name', '배송 수단명')
      .required('배송 수단명을 입력해주세요')
      .min(2, '배송 수단명은 2자 이상이어야 합니다')
      .max(50, '배송 수단명은 50자 이하여야 합니다')
      .build(),

    field.string('serviceCode', '서비스 코드')
      .required('서비스 코드를 입력해주세요')
      .pattern('^[A-Z0-9-]+$', '영문 대문자, 숫자, 하이픈만 사용 가능')
      .build(),

    field.enum('deliveryMode', '배송 타입', deliveryModes)
      .required('배송 타입을 선택해주세요')
      .build(),

    field.enum('status', '상태', deliveryStatuses)
      .defaultValue('DRAFT')
      .build(),

    field.string('warehouseId', '출고 창고').build(),

    field.string('zoneId', '출고 존/랙').build(),

    // === 일반 택배 전용 필드 (기존 서빙형) ===
    field.enum('packageTier', '포장 티어', packageTiers).build(),

    field.number('maxParcelWeight', '최대 중량 (kg)')
      .min(0)
      .max(100)
      .build(),

    field.boolean('weatherProof', '방수/방풍 포장')
      .defaultValue(false)
      .build(),

    // === 냉장/냉동 배송 전용 필드 (기존 청소형) ===
    field.enum('temperatureProfile', '온도 프로필', temperatureProfiles).build(),

    field.number('coolingCapacity', '보냉 용량 (L)')
      .min(0)
      .max(50)
      .build(),

    field.number('maxStopsPerTrip', '배송 경유지 수')
      .min(1)
      .max(100)
      .build(),

    // === 대형 화물/특수 취급 전용 필드 (기존 방역형) ===
    field.enum('handlingMethod', '취급 방식', handlingMethods).build(),

    field.number('maxDimensionSum', '3변 합 제한 (cm)')
      .min(0)
      .max(1000)
      .build(),

    field.number('oversizeSurcharge', '대형 할증 (원)')
      .min(0)
      .max(500000)
      .build(),

    field.boolean('hazardousMaterialsConsent', '위험물 취급 동의')
      .defaultValue(false)
      .build(),

    // === 픽업 전용 필드 (기존 안내형) ===
    field.boolean('needsSignature', '수령 시 서명 필요')
      .defaultValue(true)
      .build(),

    field.boolean('customerNotification', '알림 발송')
      .defaultValue(true)
      .build(),

    field.array('pickupRegions', '픽업 가능 지역', 'string')
      .build(),

    // === 공통 메타 정보 ===
    field.string('description', '설명')
      .max(500)
      .build(),

    field.datetime('createdAt', '생성일시').build(),
    field.datetime('updatedAt', '수정일시').build(),
  )
  .build()

export type DeliveryMode = typeof deliveryModes[number]['value']
export type DeliveryStatus = typeof deliveryStatuses[number]['value']
export type PackageTier = typeof packageTiers[number]['value']
export type TemperatureProfile = typeof temperatureProfiles[number]['value']
export type HandlingMethod = typeof handlingMethods[number]['value']
