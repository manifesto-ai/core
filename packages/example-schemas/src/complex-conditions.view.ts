/**
 * Complex Conditions View Schema
 *
 * 복합 조건 로직 데모 화면 구성 정의
 *
 * 섹션 구성:
 * - 기본 조건: A, B, C 선택
 * - AND 결과: A AND B 일 때 표시
 * - OR 결과: A OR C 일 때 표시
 * - 중첩 결과: (A AND B) OR C 일 때 표시
 * - 상품 유형별: 선택에 따른 동적 필드
 * - 결제 방식별: 선택에 따른 동적 필드
 */

import {
  view,
  section,
  layout,
  header,
  footer,
  viewAction,
  viewField,
} from '@manifesto-ai/schema'

import { fieldEquals } from '@manifesto-ai/schema'

// View Schema
export const complexConditionsView = view(
  'complex-conditions',
  'Complex Conditions',
  '0.1.0'
)
  .entityRef('complexConditions')
  .mode('create')
  .description('복합 조건 로직 데모 화면')
  .layout(layout.form(2))
  .header(
    header('복합 조건 테스트', {
      subtitle: '다양한 조건 조합에 따른 동적 UI 변경',
    })
  )
  .sections(
    // =========================================================================
    // 기본 조건 선택 섹션
    // =========================================================================
    section('basic-conditions')
      .title('기본 조건')
      .description('A, B, C 조건을 선택하세요')
      .layout(layout.grid(3, '1rem'))
      .fields(
        viewField
          .select('conditionA', 'conditionA')
          .label('조건 A')
          .build(),

        viewField
          .select('conditionB', 'conditionB')
          .label('조건 B')
          .build(),

        viewField
          .select('conditionC', 'conditionC')
          .label('조건 C')
          .build()
      )
      .build(),

    // =========================================================================
    // AND 결과 섹션 (A=YES AND B=YES)
    // =========================================================================
    section('and-result')
      .title('AND 결과')
      .description('조건 A와 B가 모두 YES일 때 표시됩니다')
      .layout(layout.grid(1, '1rem'))
      .visible([
        'AND',
        fieldEquals('conditionA', 'YES'),
        fieldEquals('conditionB', 'YES'),
      ])
      .fields(
        viewField
          .textInput('andResultField', 'andResultField')
          .label('AND 조건 충족 필드')
          .placeholder('A AND B가 모두 YES입니다')
          .build()
      )
      .build(),

    // =========================================================================
    // OR 결과 섹션 (A=YES OR C=YES)
    // =========================================================================
    section('or-result')
      .title('OR 결과')
      .description('조건 A 또는 C가 YES일 때 표시됩니다')
      .layout(layout.grid(1, '1rem'))
      .visible([
        'OR',
        fieldEquals('conditionA', 'YES'),
        fieldEquals('conditionC', 'YES'),
      ])
      .fields(
        viewField
          .textInput('orResultField', 'orResultField')
          .label('OR 조건 충족 필드')
          .placeholder('A 또는 C가 YES입니다')
          .build()
      )
      .build(),

    // =========================================================================
    // 중첩 결과 섹션 ((A=YES AND B=YES) OR C=YES)
    // =========================================================================
    section('nested-result')
      .title('중첩 조건 결과')
      .description('(A AND B) 또는 C가 YES일 때 표시됩니다')
      .layout(layout.grid(1, '1rem'))
      .visible([
        'OR',
        ['AND', fieldEquals('conditionA', 'YES'), fieldEquals('conditionB', 'YES')],
        fieldEquals('conditionC', 'YES'),
      ])
      .fields(
        viewField
          .textInput('nestedResultField', 'nestedResultField')
          .label('중첩 조건 충족 필드')
          .placeholder('(A AND B) OR C 조건 충족')
          .build()
      )
      .build(),

    // =========================================================================
    // 상품 유형 선택 섹션
    // =========================================================================
    section('item-type')
      .title('상품 유형 선택')
      .description('상품 유형에 따라 추가 필드가 표시됩니다')
      .layout(layout.grid(1, '1rem'))
      .fields(
        viewField.select('itemType', 'itemType').label('상품 유형').build()
      )
      .build(),

    // =========================================================================
    // 실물 상품 섹션
    // =========================================================================
    section('physical-item')
      .title('실물 상품 정보')
      .description('배송에 필요한 정보를 입력하세요')
      .layout(layout.grid(2, '1rem'))
      .visible(fieldEquals('itemType', 'PHYSICAL'))
      .fields(
        viewField
          .numberInput('weight', 'weight')
          .label('무게 (kg)')
          .placeholder('0.5')
          .props({ min: 0, step: 0.1 })
          .build(),

        viewField
          .textInput('shippingAddress', 'shippingAddress')
          .label('배송 주소')
          .placeholder('배송받을 주소')
          .build()
      )
      .build(),

    // =========================================================================
    // 디지털 상품 섹션
    // =========================================================================
    section('digital-item')
      .title('디지털 상품 정보')
      .description('다운로드 정보를 입력하세요')
      .layout(layout.grid(2, '1rem'))
      .visible(fieldEquals('itemType', 'DIGITAL'))
      .fields(
        viewField
          .textInput('downloadUrl', 'downloadUrl')
          .label('다운로드 URL')
          .placeholder('https://example.com/download')
          .build(),

        viewField
          .numberInput('fileSize', 'fileSize')
          .label('파일 크기 (MB)')
          .placeholder('100')
          .props({ min: 0 })
          .build()
      )
      .build(),

    // =========================================================================
    // 서비스 섹션
    // =========================================================================
    section('service-item')
      .title('서비스 정보')
      .description('서비스 일정 정보를 입력하세요')
      .layout(layout.grid(2, '1rem'))
      .visible(fieldEquals('itemType', 'SERVICE'))
      .fields(
        viewField
          .textInput('serviceDate', 'serviceDate')
          .label('서비스 일시')
          .placeholder('2024-01-15 14:00')
          .build(),

        viewField
          .textInput('serviceLocation', 'serviceLocation')
          .label('서비스 장소')
          .placeholder('서비스를 제공할 장소')
          .build()
      )
      .build(),

    // =========================================================================
    // 결제 방식 선택 섹션
    // =========================================================================
    section('payment-method')
      .title('결제 방식')
      .description('결제 방식에 따라 추가 필드가 표시됩니다')
      .layout(layout.grid(1, '1rem'))
      .fields(
        viewField
          .select('paymentMethod', 'paymentMethod')
          .label('결제 방식')
          .build()
      )
      .build(),

    // =========================================================================
    // 카드 결제 섹션
    // =========================================================================
    section('card-payment')
      .title('카드 결제 정보')
      .layout(layout.grid(2, '1rem'))
      .visible(fieldEquals('paymentMethod', 'CARD'))
      .fields(
        viewField
          .textInput('cardNumber', 'cardNumber')
          .label('카드 번호')
          .placeholder('0000-0000-0000-0000')
          .build(),

        viewField
          .numberInput('installmentMonths', 'installmentMonths')
          .label('할부 개월')
          .placeholder('1')
          .props({ min: 1, max: 36 })
          .build()
      )
      .build(),

    // =========================================================================
    // 계좌이체 섹션
    // =========================================================================
    section('bank-payment')
      .title('계좌이체 정보')
      .layout(layout.grid(2, '1rem'))
      .visible(fieldEquals('paymentMethod', 'BANK'))
      .fields(
        viewField
          .textInput('bankName', 'bankName')
          .label('은행명')
          .placeholder('예: 국민은행')
          .build(),

        viewField
          .textInput('accountNumber', 'accountNumber')
          .label('계좌번호')
          .placeholder('000-000-000000')
          .build()
      )
      .build(),

    // =========================================================================
    // 가상계좌 섹션
    // =========================================================================
    section('virtual-payment')
      .title('가상계좌 정보')
      .layout(layout.grid(2, '1rem'))
      .visible(fieldEquals('paymentMethod', 'VIRTUAL'))
      .fields(
        viewField
          .textInput('virtualAccountBank', 'virtualAccountBank')
          .label('가상계좌 은행')
          .placeholder('예: 신한은행')
          .build(),

        viewField
          .textInput('depositorName', 'depositorName')
          .label('입금자명')
          .placeholder('입금자 이름')
          .build()
      )
      .build(),

    // =========================================================================
    // 휴대폰 결제 섹션
    // =========================================================================
    section('mobile-payment')
      .title('휴대폰 결제 정보')
      .layout(layout.grid(2, '1rem'))
      .visible(fieldEquals('paymentMethod', 'MOBILE'))
      .fields(
        viewField
          .textInput('mobileCarrier', 'mobileCarrier')
          .label('통신사')
          .placeholder('예: SKT, KT, LGU+')
          .build(),

        viewField
          .textInput('mobileNumber', 'mobileNumber')
          .label('휴대폰 번호')
          .placeholder('010-0000-0000')
          .build()
      )
      .build(),

    // =========================================================================
    // 복합 조건 섹션 (실물 상품 + 카드 결제)
    // =========================================================================
    section('combo-option')
      .title('추가 옵션')
      .description('실물 상품을 카드로 결제할 때만 표시됩니다')
      .layout(layout.grid(1, '1rem'))
      .visible([
        'AND',
        fieldEquals('itemType', 'PHYSICAL'),
        fieldEquals('paymentMethod', 'CARD'),
      ])
      .fields(
        viewField
          .checkbox('usePointsForShipping', 'usePointsForShipping')
          .label('포인트로 배송비 결제')
          .helpText('적립된 포인트를 배송비에 사용합니다')
          .build()
      )
      .build()
  )
  .footer(
    footer([
      viewAction.cancel('cancel', '취소').build(),
      viewAction.submit('submit', '제출').build(),
    ])
  )
  .build()
