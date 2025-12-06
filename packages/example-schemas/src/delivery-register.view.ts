/**
 * Delivery Method View Schema
 *
 * 배송 수단 등록 화면 (기존 로봇 다형성 → 배송 타입 다형성으로 치환)
 * - 배송 타입별 섹션 조건부 표시
 * - hidden/disabled 조합으로 필드 제어
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
} from '@manifesto-ai/schema'

import { fieldEquals } from '@manifesto-ai/schema'

// View Schema
export const deliveryRegisterView = view('delivery-register', 'Delivery Register', '0.1.0')
  .entityRef('delivery-method')
  .mode('create')
  .description('배송 수단 등록 화면 - 타입별 필드 제어')
  .layout(layout.form(2))
  .header(header('배송 수단 등록', {
    subtitle: '배송 타입에 따라 다른 필드를 설정합니다',
  }))
  .sections(
    // =========================================================================
    // 기본 정보 섹션 (공통)
    // =========================================================================
    section('basic')
      .title('기본 정보')
      .description('모든 배송 수단에 공통으로 적용되는 정보')
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField.textInput('name', 'name')
          .label('배송 수단명')
          .placeholder('예: 새벽 배송, 냉장 배송')
          .helpText('2~50자 이내로 입력')
          .span(2)
          .build(),

        viewField.textInput('serviceCode', 'serviceCode')
          .label('서비스 코드')
          .placeholder('예: EXP-2024-001')
          .helpText('영문 대문자, 숫자, 하이픈만 사용')
          .build(),

        viewField.select('status', 'status')
          .label('상태')
          .build(),

        viewField.select('deliveryMode', 'deliveryMode')
          .label('배송 타입')
          .placeholder('배송 타입을 선택하세요')
          .span(2)
          .build(),
      )
      .build(),

    // =========================================================================
    // 일반 택배 전용 섹션
    // =========================================================================
    section('parcel-spec')
      .title('일반 택배 설정')
      .description('표준 박스 배송 설정')
      .layout(layout.grid(2, '1rem'))
      .visible(fieldEquals('deliveryMode', 'PARCEL'))
      .fields(
        viewField.select('packageTier', 'packageTier')
          .label('포장 티어')
          .placeholder('포장 티어 선택')
          .build(),

        viewField.numberInput('maxParcelWeight', 'maxParcelWeight')
          .label('최대 중량 (kg)')
          .placeholder('0~100')
          .props({ min: 0, max: 100, step: 0.1 })
          .build(),

        viewField.checkbox('weatherProof', 'weatherProof')
          .label('방수/방풍 포장')
          .helpText('야외 이동 시 필요한 보호 여부')
          .build(),
      )
      .build(),

    // =========================================================================
    // 냉장/냉동 배송 전용 섹션
    // =========================================================================
    section('cold-chain-spec')
      .title('신선/냉장 배송 설정')
      .description('온도 관리가 필요한 배송 설정')
      .layout(layout.grid(2, '1rem'))
      .visible(fieldEquals('deliveryMode', 'COLD_CHAIN'))
      .fields(
        viewField.select('temperatureProfile', 'temperatureProfile')
          .label('온도 프로필')
          .placeholder('온도 프로필 선택')
          .build(),

        viewField.numberInput('coolingCapacity', 'coolingCapacity')
          .label('보냉 용량 (L)')
          .placeholder('0~50')
          .props({ min: 0, max: 50, step: 0.5 })
          .build(),

        viewField.numberInput('maxStopsPerTrip', 'maxStopsPerTrip')
          .label('경유지 수')
          .placeholder('1~100')
          .props({ min: 1, max: 100 })
          .build(),
      )
      .build(),

    // =========================================================================
    // 대형 화물/특수 취급 섹션
    // =========================================================================
    section('freight-spec')
      .title('대형/특수 화물 설정')
      .description('대형 화물 및 고가/위험물 취급 설정')
      .layout(layout.grid(2, '1rem'))
      .visible(fieldEquals('deliveryMode', 'FREIGHT'))
      .fields(
        viewField.select('handlingMethod', 'handlingMethod')
          .label('취급 방식')
          .placeholder('취급 방식을 선택하세요')
          .build(),

        viewField.numberInput('maxDimensionSum', 'maxDimensionSum')
          .label('3변 합 제한 (cm)')
          .placeholder('0~1000')
          .props({ min: 0, max: 1000 })
          .build(),

        viewField.numberInput('oversizeSurcharge', 'oversizeSurcharge')
          .label('대형 할증 (원)')
          .placeholder('0~500000')
          .props({ min: 0, max: 500000, step: 1000 })
          .build(),

        viewField.checkbox('hazardousMaterialsConsent', 'hazardousMaterialsConsent')
          .label('위험물 취급 동의')
          .helpText('위험물·고가품 취급 시 확인 필요')
          .span(2)
          .build(),
      )
      .build(),

    // =========================================================================
    // 픽업 전용 섹션
    // =========================================================================
    section('pickup-spec')
      .title('매장 픽업 설정')
      .description('픽업 정책 및 고객 커뮤니케이션 설정')
      .layout(layout.grid(2, '1rem'))
      .visible(fieldEquals('deliveryMode', 'PICKUP'))
      .fields(
        viewField.checkbox('needsSignature', 'needsSignature')
          .label('수령 시 서명 필요')
          .helpText('고가 상품은 서명 필수')
          .build(),

        viewField.checkbox('customerNotification', 'customerNotification')
          .label('픽업 알림 발송')
          .helpText('픽업 준비 완료 시 알림 발송')
          .build(),

        viewField.textInput('pickupRegions', 'pickupRegions')
          .label('픽업 가능 지역')
          .placeholder('예: 서울, 경기, 인천')
          .helpText('쉼표로 구분하여 입력')
          .span(2)
          .build(),
      )
      .build(),

    // =========================================================================
    // 출고 정보 섹션 (공통)
    // =========================================================================
    section('fulfillment')
      .title('출고 정보')
      .layout(layout.grid(2, '1rem'))
      .collapsible(true)
      .fields(
        viewField.textInput('warehouseId', 'warehouseId')
          .label('출고 창고')
          .placeholder('창고 ID를 입력하세요')
          .build(),

        viewField.textInput('zoneId', 'zoneId')
          .label('출고 존/랙')
          .placeholder('예: Z-01-A')
          .dependsOn('warehouseId')
          .build(),
      )
      .build(),

    // =========================================================================
    // 추가 정보 섹션 (공통)
    // =========================================================================
    section('extra')
      .title('추가 정보')
      .layout(layout.form())
      .collapsible(true)
      .fields(
        viewField.textarea('description', 'description')
          .label('설명')
          .placeholder('배송 수단에 대한 추가 설명')
          .props({ rows: 3 })
          .span(2)
          .build(),
      )
      .build(),
  )
  .footer(footer([
    viewAction.cancel('cancel', '취소')
      .build(),

    viewAction.submit('submit', '등록')
      .confirm(confirm(
        '배송 수단 등록',
        '입력한 정보로 배송 수단을 등록하시겠습니까?',
        { confirmLabel: '등록', cancelLabel: '취소' }
      ))
      .build(),
  ]))
  .build()
