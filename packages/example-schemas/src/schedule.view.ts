/**
 * Schedule View Schema
 *
 * 배송/재고 작업 스케줄 등록 화면 (날짜/시간 검증)
 *
 * 검증 포인트:
 * - 반복 유형별 필드 전환 (매주 → 요일, 매월 → 날짜)
 * - 종료일 없음 시 경고 배너 표시 (IS_NULL)
 * - 상품/옵션 종속 셀렉트 (Product → Variant)
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
  dataSource,
} from '@manifesto-ai/schema'

import { $, fieldEquals } from '@manifesto-ai/schema'

// 상품 목록 (static으로 제공)
export const products = [
  { value: 'prd-1', label: '무선 이어폰' },
  { value: 'prd-2', label: '프리미엄 커피원두' },
  { value: 'prd-3', label: '모던 소파 세트' },
] as const

// 상품별 옵션 데이터 (실제로는 API에서 로드)
export const variantsByProduct: Record<string, Array<{ value: string; label: string }>> = {
  'prd-1': [
    { value: 'v1-1', label: '화이트 / 기본 패키지' },
    { value: 'v1-2', label: '블랙 / 노이즈캔슬링 강화' },
  ],
  'prd-2': [
    { value: 'v2-1', label: '200g / 라이트 로스트' },
    { value: 'v2-2', label: '500g / 다크 로스트' },
  ],
  'prd-3': [
    { value: 'v3-1', label: '3인용 / 패브릭' },
    { value: 'v3-2', label: '4인용 / 가죽' },
    { value: 'v3-3', label: '코너형 / 패브릭' },
  ],
}

// View Schema
export const scheduleView = view('schedule', 'Schedule', '0.1.0')
  .entityRef('schedule')
  .mode('create')
  .description('스케줄 등록 화면 - 날짜/시간 검증')
  .layout(layout.form(2))
  .header(header('스케줄 등록', {
    subtitle: '반복 유형에 따라 다른 옵션이 표시됩니다',
  }))
  .sections(
    // =========================================================================
    // 기본 정보 섹션
    // =========================================================================
    section('basic')
      .title('기본 정보')
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField.textInput('name', 'name')
          .label('스케줄명')
          .placeholder('예: 오전 배달 스케줄')
          .span(2)
          .build(),

        viewField.select('status', 'status')
          .label('상태')
          .build(),

        viewField.select('missionType', 'missionType')
          .label('미션 유형')
          .placeholder('미션 유형 선택')
          .build(),

        viewField.textarea('description', 'description')
          .label('설명')
          .placeholder('스케줄 설명')
          .props({ rows: 2 })
          .span(2)
          .build(),
      )
      .build(),

    // =========================================================================
    // 시간 설정 섹션
    // =========================================================================
    section('time')
      .title('시간 설정')
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField.datePicker('startDate', 'startDate')
          .label('시작일')
          .helpText('스케줄 시작 날짜')
          .build(),

        viewField.datePicker('endDate', 'endDate')
          .label('종료일')
          .helpText('비워두면 무기한 반복')
          .build(),

        viewField.textInput('startTime', 'startTime')
          .label('시작 시간')
          .placeholder('09:00')
          .helpText('HH:MM 형식')
          .build(),

        viewField.textInput('endTime', 'endTime')
          .label('종료 시간')
          .placeholder('18:00')
          .helpText('HH:MM 형식 (선택)')
          .build(),
      )
      .build(),

    // =========================================================================
    // 종료일 없음 경고 배너 - 종료일이 null이면 표시
    // =========================================================================
    section('no-end-date-warning')
      .title('⚠️ 무기한 스케줄')
      .visible(['IS_NULL', $.state('endDate')])
      .fields()
      .build(),

    // =========================================================================
    // 반복 설정 섹션
    // =========================================================================
    section('repeat')
      .title('반복 설정')
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField.select('repeatType', 'repeatType')
          .label('반복 유형')
          .placeholder('반복 유형 선택')
          .build(),

        viewField.numberInput('repeatInterval', 'repeatInterval')
          .label('반복 간격')
          .placeholder('1')
          .props({ min: 1, max: 100 })
          .helpText('매 N번째 반복')
          .build(),
      )
      .build(),

    // =========================================================================
    // 매주 반복 옵션 - repeatType이 WEEKLY일 때만 표시
    // =========================================================================
    section('weekly-options')
      .title('요일 선택')
      .description('스케줄을 실행할 요일을 선택하세요')
      .layout(layout.grid(7, '0.5rem'))
      .visible(fieldEquals('repeatType', 'WEEKLY'))
      .fields(
        // 각 요일을 개별 체크박스로 표현
        viewField.checkbox('weekday_mon', 'weekday_mon')
          .label('월')
          .build(),
        viewField.checkbox('weekday_tue', 'weekday_tue')
          .label('화')
          .build(),
        viewField.checkbox('weekday_wed', 'weekday_wed')
          .label('수')
          .build(),
        viewField.checkbox('weekday_thu', 'weekday_thu')
          .label('목')
          .build(),
        viewField.checkbox('weekday_fri', 'weekday_fri')
          .label('금')
          .build(),
        viewField.checkbox('weekday_sat', 'weekday_sat')
          .label('토')
          .build(),
        viewField.checkbox('weekday_sun', 'weekday_sun')
          .label('일')
          .build(),
      )
      .build(),

    // =========================================================================
    // 매월 반복 옵션 - repeatType이 MONTHLY일 때만 표시
    // =========================================================================
    section('monthly-options')
      .title('날짜 선택')
      .description('매월 실행할 날짜를 선택하세요')
      .layout(layout.grid(1, '1rem'))
      .visible(fieldEquals('repeatType', 'MONTHLY'))
      .fields(
        viewField.numberInput('monthDay', 'monthDay')
          .label('매월 반복일')
          .placeholder('1~31')
          .props({ min: 1, max: 31 })
          .helpText('매월 이 날짜에 실행됩니다')
          .build(),
      )
      .build(),

    // =========================================================================
    // 1회 실행 안내 - repeatType이 ONCE일 때만 표시
    // =========================================================================
    section('once-info')
      .title('ℹ️ 1회 실행')
      .visible(fieldEquals('repeatType', 'ONCE'))
      .fields()
      .build(),

    // =========================================================================
    // 상품/옵션 설정 섹션 - Cascade Select (Product → Variant)
    // =========================================================================
    section('location')
      .title('상품/옵션 설정')
      .description('상품을 선택하면 해당 상품의 옵션이 로드됩니다')
      .layout(layout.grid(2, '1rem'))
      .fields(
        // 상품 선택 - mount 시 API로 옵션 로드
        viewField.select('productId', 'productId')
          .label('상품')
          .placeholder('상품 선택')
          .reaction(
            // 폼 마운트 시 상품 목록 로드
            on.mount()
              .do(
                actions.setOptions('productId', dataSource.api('/api/products', {
                  method: 'GET',
                  transform: {
                    path: 'data',
                    map: { value: 'id', label: 'name' },
                  },
                }))
              )
          )
          // 상품 선택 시 옵션 목록 로드 (API 호출)
          .reaction(
            on.change()
              .do(
                // 옵션 선택 초기화
                actions.setValue('variantId', ''),
                // API를 통해 옵션 목록 로드
                actions.setOptions('variantId', dataSource.api('/api/variants', {
                  method: 'GET',
                  params: { productId: $.state('productId') },
                  transform: {
                    path: 'data',
                    map: { value: 'id', label: 'name' },
                  },
                }))
              )
          )
          .build(),

        // 옵션 선택 - 상품 선택 전에는 비활성화
        viewField.select('variantId', 'variantId')
          .label('옵션/버전')
          .placeholder('옵션 선택')
          .disabled(['IS_EMPTY', $.state('productId')])
          .dependsOn('productId')
          .build(),
      )
      .build(),

    // =========================================================================
    // 배송 설정 섹션
    // =========================================================================
    section('delivery')
      .title('배송 설정')
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField.textInput('deliveryMethodId', 'deliveryMethodId')
          .label('배송 수단')
          .placeholder('예: 익일 배송, 퀵 배송 등')
          .build(),

        viewField.textInput('routeId', 'routeId')
          .label('배송 경로')
          .placeholder('경로/허브 경유 정보를 입력하세요')
          .build(),
      )
      .build(),
  )
  .footer(footer([
    viewAction.cancel('cancel', '취소')
      .build(),

    viewAction.submit('submit', '저장')
      .confirm(confirm(
        '스케줄 저장',
        '입력한 정보로 스케줄을 저장하시겠습니까?',
        { confirmLabel: '저장', cancelLabel: '취소' }
      ))
      .build(),
  ]))
  .build()
