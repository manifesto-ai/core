/**
 * Alert Rule View Schema
 *
 * 알림 규칙 설정 화면 구성 정의 (배열 로직 검증)
 *
 * 검증 포인트:
 * - CONTAINS 연산자로 배열 내 특정 값 존재 확인
 * - 채널별 추가 필드 조건부 표시
 * - 긴급 정지 시 SMS 강제 선택 + disabled
 */

import {
  view,
  section,
  layout,
  header,
  footer,
  viewAction,
  confirm,
  viewField,
  on,
  actions,
} from '@manifesto-ai/schema'

import { $, fieldEquals } from '@manifesto-ai/schema'

// View Schema
export const alertRuleView = view('alert-rule', 'Alert Rule', '0.1.0')
  .entityRef('alertRule')
  .mode('create')
  .description('알림 규칙 설정 화면 - 배열 로직 검증')
  .layout(layout.form(2))
  .header(header('알림 규칙 설정', {
    subtitle: '채널 선택에 따라 추가 설정 필드가 표시됩니다',
  }))
  .sections(
    // =========================================================================
    // 기본 정보 섹션
    // =========================================================================
    section('basic')
      .title('기본 정보')
      .description('알림 규칙의 기본 정보')
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField.textInput('name', 'name')
          .label('규칙명')
          .placeholder('예: 배송 도착 알림')
          .span(2)
          .build(),

        viewField.select('status', 'status')
          .label('상태')
          .build(),

        viewField.select('priority', 'priority')
          .label('우선순위')
          .build(),

        viewField.textarea('description', 'description')
          .label('설명')
          .placeholder('규칙에 대한 설명')
          .props({ rows: 2 })
          .span(2)
          .build(),
      )
      .build(),

    // =========================================================================
    // 트리거 설정 섹션
    // =========================================================================
    section('trigger')
      .title('트리거 설정')
      .description('알림을 발생시킬 조건')
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField.select('triggerType', 'triggerType')
          .label('트리거 유형')
          .placeholder('트리거 유형을 선택하세요')
          // 긴급 정지 선택 시 SMS 강제 체크 + 우선순위 긴급으로 설정
          // NOTE: 배열 리터럴 값은 표현식으로 해석되므로 smsCheckbox만 제어
          .reaction(
            on.change()
              .when(fieldEquals('triggerType', 'EMERGENCY'))
              .do(
                actions.setValue('smsCheckbox', true),
                actions.setValue('priority', 'CRITICAL'),
                actions.updateProp('smsCheckbox', 'disabled', true)
              )
          )
          // 긴급 정지 해제 시 SMS 잠금 해제
          .reaction(
            on.change()
              .when(['!=', $.state('triggerType'), 'EMERGENCY'])
              .do(
                actions.updateProp('smsCheckbox', 'disabled', false)
              )
          )
          .build(),

        viewField.numberInput('thresholdCount', 'thresholdCount')
          .label('발생 횟수 임계값')
          .placeholder('1~100')
          .props({ min: 1, max: 100 })
          .helpText('이 횟수 이상 발생 시 알림')
          .build(),

        viewField.numberInput('cooldownMinutes', 'cooldownMinutes')
          .label('재알림 대기 시간 (분)')
          .placeholder('0~1440')
          .props({ min: 0, max: 1440 })
          .helpText('동일 알림 재발송 방지 시간')
          .build(),
      )
      .build(),

    // =========================================================================
    // 알림 채널 섹션
    // =========================================================================
    section('channels')
      .title('알림 채널')
      .description('알림을 받을 채널을 선택하세요 (복수 선택 가능)')
      .layout(layout.grid(3, '1rem'))
      .fields(
        // 각 채널을 개별 체크박스로 표현
        viewField.checkbox('smsCheckbox', 'smsCheckbox')
          .label('SMS')
          .helpText('문자 메시지로 알림')
          .build(),

        viewField.checkbox('emailCheckbox', 'emailCheckbox')
          .label('이메일')
          .helpText('이메일로 알림')
          .build(),

        viewField.checkbox('slackCheckbox', 'slackCheckbox')
          .label('Slack')
          .helpText('Slack 채널로 알림')
          .build(),

        viewField.checkbox('webhookCheckbox', 'webhookCheckbox')
          .label('Webhook')
          .helpText('외부 시스템 연동')
          .build(),

        viewField.checkbox('pushCheckbox', 'pushCheckbox')
          .label('푸시 알림')
          .helpText('모바일 앱 푸시')
          .build(),
      )
      .build(),

    // =========================================================================
    // 이메일 설정 섹션 - 이메일 체크 시만 표시
    // =========================================================================
    section('email-config')
      .title('이메일 설정')
      .description('이메일 알림 세부 설정')
      .layout(layout.grid(1, '1rem'))
      .visible(fieldEquals('emailCheckbox', true))
      .fields(
        viewField.textInput('emailRecipients', 'emailRecipients')
          .label('수신자 이메일')
          .placeholder('email1@example.com, email2@example.com')
          .helpText('쉼표로 구분하여 여러 명 입력 가능')
          .build(),

        viewField.textInput('emailSubjectTemplate', 'emailSubjectTemplate')
          .label('이메일 제목 템플릿')
          .placeholder('예: [{{priority}}] {{triggerType}} 알림')
          .helpText('{{변수}} 형식으로 동적 값 삽입 가능')
          .build(),
      )
      .build(),

    // =========================================================================
    // SMS 설정 섹션 - SMS 체크 시만 표시
    // =========================================================================
    section('sms-config')
      .title('SMS 설정')
      .description('SMS 알림 세부 설정')
      .layout(layout.grid(1, '1rem'))
      .visible(fieldEquals('smsCheckbox', true))
      .fields(
        viewField.textInput('smsRecipients', 'smsRecipients')
          .label('SMS 수신자')
          .placeholder('010-1234-5678, 010-9876-5432')
          .helpText('쉼표로 구분하여 여러 번호 입력 가능')
          .build(),
      )
      .build(),

    // =========================================================================
    // Slack 설정 섹션 - Slack 체크 시만 표시
    // =========================================================================
    section('slack-config')
      .title('Slack 설정')
      .description('Slack 알림 세부 설정')
      .layout(layout.grid(2, '1rem'))
      .visible(fieldEquals('slackCheckbox', true))
      .fields(
        viewField.textInput('slackWebhook', 'slackWebhook')
          .label('Slack Webhook URL')
          .placeholder('https://hooks.slack.com/services/...')
          .span(2)
          .build(),

        viewField.textInput('slackChannel', 'slackChannel')
          .label('Slack 채널')
          .placeholder('#alerts')
          .build(),
      )
      .build(),

    // =========================================================================
    // Webhook 설정 섹션 - Webhook 체크 시만 표시
    // =========================================================================
    section('webhook-config')
      .title('Webhook 설정')
      .description('외부 시스템 연동을 위한 Webhook 설정')
      .layout(layout.grid(1, '1rem'))
      .visible(fieldEquals('webhookCheckbox', true))
      .fields(
        viewField.textInput('webhookUrl', 'webhookUrl')
          .label('Webhook URL')
          .placeholder('https://api.example.com/webhook')
          .build(),

        viewField.textarea('webhookHeaders', 'webhookHeaders')
          .label('Headers (JSON)')
          .placeholder('{"Authorization": "Bearer xxx"}')
          .props({ rows: 3 })
          .helpText('JSON 형식으로 입력')
          .build(),
      )
      .build(),
  )
  .footer(footer([
    viewAction.cancel('cancel', '취소')
      .build(),

    viewAction.submit('submit', '저장')
      .confirm(confirm(
        '알림 규칙 저장',
        '입력한 정보로 알림 규칙을 저장하시겠습니까?',
        { confirmLabel: '저장', cancelLabel: '취소' }
      ))
      .build(),
  ]))
  .build()
