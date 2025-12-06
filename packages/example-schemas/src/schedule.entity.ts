/**
 * Schedule Entity Schema
 *
 * 스케줄 데이터 구조 정의 (날짜/시간 연산 검증용)
 */

import { entity, field, enumValue } from '@manifesto-ai/schema'

// 반복 유형
export const repeatTypes = [
  enumValue('ONCE', '1회'),
  enumValue('DAILY', '매일'),
  enumValue('WEEKLY', '매주'),
  enumValue('MONTHLY', '매월'),
] as const

// 요일
export const weekdays = [
  enumValue('MON', '월'),
  enumValue('TUE', '화'),
  enumValue('WED', '수'),
  enumValue('THU', '목'),
  enumValue('FRI', '금'),
  enumValue('SAT', '토'),
  enumValue('SUN', '일'),
] as const

// 스케줄 상태
export const scheduleStatuses = [
  enumValue('ACTIVE', '활성'),
  enumValue('PAUSED', '일시중지'),
  enumValue('COMPLETED', '완료'),
  enumValue('EXPIRED', '만료'),
] as const

// 작업 유형 (이커머스 배송/재고 시나리오)
export const missionTypes = [
  enumValue('FULFILLMENT', '배송 준비'),
  enumValue('RESTOCK', '재입고'),
  enumValue('RETURN', '반품 수거'),
  enumValue('QC', '품질 검수'),
] as const

// Entity Schema
export const scheduleEntity = entity('schedule', 'Schedule', '0.1.0')
  .description('배송/재고 스케줄 정보를 정의하는 엔티티 (날짜/시간 검증)')
  .tags('schedule', 'fulfillment')
  .fields(
    // === 기본 정보 ===
    field.string('id', 'ID').build(),

    field.string('name', '스케줄명')
      .required('스케줄명을 입력해주세요')
      .min(2)
      .max(100)
      .build(),

    field.string('description', '설명')
      .max(500)
      .build(),

    field.enum('status', '상태', scheduleStatuses)
      .defaultValue('ACTIVE')
      .build(),

    field.enum('missionType', '작업 유형', missionTypes)
      .required('작업 유형을 선택해주세요')
      .build(),

    // === 시간 설정 ===
    field.date('startDate', '시작일')
      .required('시작일을 입력해주세요')
      .build(),

    field.date('endDate', '종료일').build(),

    field.string('startTime', '시작 시간')
      .required('시작 시간을 입력해주세요')
      .build(),

    field.string('endTime', '종료 시간').build(),

    // === 반복 설정 ===
    field.enum('repeatType', '반복 유형', repeatTypes)
      .required('반복 유형을 선택해주세요')
      .build(),

    // 매주 반복 시 요일 선택 (배열)
    field.array('weekdays', '요일', 'string').build(),

    // 매월 반복 시 날짜
    field.number('monthDay', '매월 반복일')
      .min(1)
      .max(31)
      .build(),

    field.number('repeatInterval', '반복 간격')
      .min(1)
      .max(100)
      .defaultValue(1)
      .build(),

    // === 상품/옵션 설정 ===
    field.string('productId', '상품')
      .required('상품을 선택해주세요')
      .build(),

    field.string('variantId', '옵션/버전')
      .required('옵션을 선택해주세요')
      .build(),

    // === 배송 설정 ===
    field.string('deliveryMethodId', '배송 수단')
      .required('배송 수단을 선택해주세요')
      .build(),

    field.string('routeId', '배송 경로').build(),

    // === 메타 정보 ===
    field.datetime('lastExecutedAt', '마지막 실행').build(),
    field.datetime('nextExecutionAt', '다음 실행').build(),
    field.datetime('createdAt', '생성일시').build(),
    field.datetime('updatedAt', '수정일시').build(),
  )
  .build()

export type RepeatType = typeof repeatTypes[number]['value']
export type Weekday = typeof weekdays[number]['value']
export type ScheduleStatus = typeof scheduleStatuses[number]['value']
export type MissionType = typeof missionTypes[number]['value']
