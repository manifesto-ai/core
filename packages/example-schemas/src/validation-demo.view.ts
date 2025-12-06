/**
 * Validation Demo View Schema
 *
 * 유효성 검증 데모 화면 구성 정의
 *
 * 섹션 구성:
 * - 필수 입력: required 검증 테스트
 * - 범위 검증: min/max 숫자 범위 테스트
 * - 패턴 검증: 정규식 패턴 테스트
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

// View Schema
export const validationDemoView = view('validation-demo', 'Validation Demo', '0.1.0')
  .entityRef('validationDemo')
  .mode('create')
  .description('유효성 검증 데모 화면')
  .layout(layout.form(2))
  .header(
    header('유효성 검증 데모', {
      subtitle: '다양한 검증 규칙 테스트',
    })
  )
  .sections(
    // =========================================================================
    // 필수 입력 섹션
    // =========================================================================
    section('required')
      .title('필수 입력')
      .description('required 검증 테스트')
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField
          .textInput('requiredText', 'requiredText')
          .label('필수 텍스트')
          .placeholder('필수로 입력해야 합니다')
          .build(),

        viewField
          .textInput('requiredEmail', 'requiredEmail')
          .label('필수 이메일')
          .placeholder('example@email.com')
          .build(),

        viewField
          .textInput('username', 'username')
          .label('사용자명')
          .placeholder('영문, 숫자, 밑줄만 가능')
          .helpText('4-20자, 영문/숫자/밑줄만')
          .build(),

        viewField
          .textInput('password', 'password')
          .label('비밀번호')
          .placeholder('대문자와 숫자 포함 8자 이상')
          .props({ type: 'password' })
          .build(),
      )
      .build(),

    // =========================================================================
    // 범위 검증 섹션
    // =========================================================================
    section('range')
      .title('범위 검증')
      .description('min/max 숫자 범위 테스트')
      .layout(layout.grid(3, '1rem'))
      .fields(
        viewField
          .numberInput('numberRange', 'numberRange')
          .label('숫자 범위 (10-100)')
          .placeholder('10 ~ 100')
          .props({ min: 10, max: 100 })
          .build(),

        viewField
          .numberInput('age', 'age')
          .label('나이')
          .placeholder('0 ~ 150')
          .props({ min: 0, max: 150 })
          .build(),

        viewField
          .numberInput('quantity', 'quantity')
          .label('수량')
          .placeholder('1 ~ 1000')
          .props({ min: 1, max: 1000 })
          .build(),
      )
      .build(),

    // =========================================================================
    // 문자열 길이 검증 섹션
    // =========================================================================
    section('length')
      .title('문자열 길이')
      .description('minLength/maxLength 테스트')
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField
          .textInput('shortText', 'shortText')
          .label('짧은 텍스트 (3-10자)')
          .placeholder('3자 이상, 10자 이하')
          .helpText('3-10자 사이로 입력')
          .build(),

        viewField
          .textInput('productCode', 'productCode')
          .label('상품 코드')
          .placeholder('AB-12345')
          .helpText('형식: XX-숫자 (5-15자)')
          .build(),
      )
      .build(),

    // =========================================================================
    // 패턴 검증 섹션
    // =========================================================================
    section('pattern')
      .title('패턴 검증')
      .description('정규식 패턴 테스트')
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField
          .textInput('phoneNumber', 'phoneNumber')
          .label('전화번호')
          .placeholder('010-1234-5678')
          .helpText('형식: 010-XXXX-XXXX')
          .build(),

        viewField
          .textInput('postalCode', 'postalCode')
          .label('우편번호')
          .placeholder('12345')
          .helpText('5자리 숫자')
          .build(),

        viewField
          .textInput('websiteUrl', 'websiteUrl')
          .label('웹사이트 URL')
          .placeholder('https://example.com')
          .span(2)
          .build(),
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
