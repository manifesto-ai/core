/**
 * Alert Rule Entity Schema
 *
 * 알림 규칙 데이터 구조 정의 (배열 로직 검증용)
 */

import { entity, field, enumValue } from '@manifesto-ai/schema'

// 알림 트리거 타입
export const triggerTypes = [
  enumValue('ERROR', '에러 발생'),
  enumValue('WARNING', '경고 발생'),
  enumValue('EMERGENCY', '긴급 정지', { description: '로봇 긴급 정지 시 알림' }),
  enumValue('BATTERY_LOW', '배터리 부족'),
  enumValue('MISSION_COMPLETE', '미션 완료'),
  enumValue('OFFLINE', '오프라인'),
] as const

// 알림 채널
export const channelTypes = [
  enumValue('EMAIL', '이메일'),
  enumValue('SMS', 'SMS'),
  enumValue('SLACK', 'Slack'),
  enumValue('WEBHOOK', 'Webhook'),
  enumValue('PUSH', '푸시 알림'),
] as const

// 알림 우선순위
export const priorityTypes = [
  enumValue('LOW', '낮음'),
  enumValue('NORMAL', '보통'),
  enumValue('HIGH', '높음'),
  enumValue('CRITICAL', '긴급'),
] as const

// 알림 상태
export const alertStatuses = [
  enumValue('ACTIVE', '활성'),
  enumValue('INACTIVE', '비활성'),
  enumValue('PAUSED', '일시중지'),
] as const

// Entity Schema
export const alertRuleEntity = entity('alertRule', 'Alert Rule', '0.1.0')
  .description('알림 규칙을 정의하는 엔티티 (배열 로직 검증)')
  .tags('alert', 'notification')
  .fields(
    // === 기본 정보 ===
    field.string('id', 'ID').build(),

    field.string('name', '규칙명')
      .required('규칙명을 입력해주세요')
      .min(2, '규칙명은 2자 이상이어야 합니다')
      .max(100, '규칙명은 100자 이하여야 합니다')
      .build(),

    field.string('description', '설명')
      .max(500)
      .build(),

    field.enum('status', '상태', alertStatuses)
      .defaultValue('ACTIVE')
      .build(),

    // === 트리거 설정 ===
    field.enum('triggerType', '트리거 유형', triggerTypes)
      .required('트리거 유형을 선택해주세요')
      .build(),

    field.enum('priority', '우선순위', priorityTypes)
      .defaultValue('NORMAL')
      .build(),

    // === 알림 채널 (멀티셀렉트 - 배열) ===
    field.array('channels', '알림 채널', 'string')
      .required('최소 하나의 채널을 선택해주세요')
      .build(),

    // === 이메일 설정 ===
    field.string('emailRecipients', '수신자 이메일')
      .max(500)
      .build(),

    field.string('emailSubjectTemplate', '이메일 제목 템플릿')
      .max(200)
      .build(),

    // === SMS 설정 ===
    field.string('smsRecipients', 'SMS 수신자')
      .max(500)
      .build(),

    // === Slack 설정 ===
    field.string('slackWebhook', 'Slack Webhook URL')
      .max(500)
      .build(),

    field.string('slackChannel', 'Slack 채널')
      .max(100)
      .build(),

    // === Webhook 설정 ===
    field.string('webhookUrl', 'Webhook URL')
      .max(500)
      .build(),

    field.string('webhookHeaders', 'Webhook Headers (JSON)')
      .max(1000)
      .build(),

    // === 조건 설정 ===
    field.number('cooldownMinutes', '재알림 대기 시간 (분)')
      .min(0)
      .max(1440)
      .defaultValue(5)
      .build(),

    field.number('thresholdCount', '발생 횟수 임계값')
      .min(1)
      .max(100)
      .defaultValue(1)
      .build(),

    // === 채널 체크박스 ===
    field.boolean('smsCheckbox', 'SMS 체크').defaultValue(false).build(),
    field.boolean('emailCheckbox', '이메일 체크').defaultValue(false).build(),
    field.boolean('slackCheckbox', 'Slack 체크').defaultValue(false).build(),
    field.boolean('webhookCheckbox', 'Webhook 체크').defaultValue(false).build(),
    field.boolean('pushCheckbox', '푸시 체크').defaultValue(false).build(),

    // === 메타 정보 ===
    field.datetime('createdAt', '생성일시').build(),
    field.datetime('updatedAt', '수정일시').build(),
  )
  .build()

export type TriggerType = typeof triggerTypes[number]['value']
export type ChannelType = typeof channelTypes[number]['value']
export type PriorityType = typeof priorityTypes[number]['value']
export type AlertStatus = typeof alertStatuses[number]['value']
