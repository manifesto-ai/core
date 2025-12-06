/**
 * User Edit View Schema
 *
 * 사용자 정보 수정 화면 구성 정의 (컨텍스트 검증)
 *
 * 검증 포인트:
 * - $user.role 컨텍스트 참조로 현재 로그인 사용자 권한 확인
 * - AND/OR 복합 논리 연산으로 필드 잠금 조건
 * - 퇴사자 상태면 모든 필드 잠금
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

import { fieldEquals } from '@manifesto-ai/schema'

// View Schema
export const userEditView = view('user-edit', 'User Edit', '0.1.0')
  .entityRef('user')
  .mode('edit')
  .description('사용자 정보 수정 화면 - 컨텍스트 검증')
  .layout(layout.form(2))
  .header(header('사용자 정보 수정', {
    subtitle: '로그인 사용자 권한에 따라 수정 가능 범위가 달라집니다',
  }))
  .sections(
    // =========================================================================
    // 기본 정보 섹션
    // =========================================================================
    section('basic')
      .title('기본 정보')
      .description('사용자의 기본 정보')
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField.textInput('userId', 'userId')
          .label('사용자 ID')
          .placeholder('예: user_001')
          .helpText('영문 소문자, 숫자, 언더스코어만 사용 (4~20자)')
          // 퇴사자면 잠금
          .reaction(
            on.mount()
              .when(fieldEquals('targetStatus', 'RESIGNED'))
              .do(actions.updateProp('userId', 'disabled', true))
          )
          .dependsOn('targetStatus')
          .build(),

        viewField.textInput('name', 'name')
          .label('이름')
          .placeholder('이름 입력')
          // 퇴사자면 잠금
          .reaction(
            on.mount()
              .when(fieldEquals('targetStatus', 'RESIGNED'))
              .do(actions.updateProp('name', 'disabled', true))
          )
          .dependsOn('targetStatus')
          .build(),

        viewField.textInput('email', 'email')
          .label('이메일')
          .placeholder('email@example.com')
          // 퇴사자면 잠금
          .reaction(
            on.mount()
              .when(fieldEquals('targetStatus', 'RESIGNED'))
              .do(actions.updateProp('email', 'disabled', true))
          )
          .dependsOn('targetStatus')
          .build(),

        viewField.textInput('phone', 'phone')
          .label('연락처')
          .placeholder('010-0000-0000')
          // 퇴사자면 잠금
          .reaction(
            on.mount()
              .when(fieldEquals('targetStatus', 'RESIGNED'))
              .do(actions.updateProp('phone', 'disabled', true))
          )
          .dependsOn('targetStatus')
          .build(),
      )
      .build(),

    // =========================================================================
    // 권한/조직 정보 섹션
    // =========================================================================
    section('permission')
      .title('권한/조직 정보')
      .description('권한 등급은 슈퍼 관리자만 수정 가능')
      .layout(layout.grid(2, '1rem'))
      .fields(
        viewField.select('targetRole', 'targetRole')
          .label('권한 등급')
          .placeholder('권한 등급 선택')
          .helpText('슈퍼 관리자만 수정 가능')
          // 슈퍼 관리자가 아니면 잠금 (런타임에서 처리)
          // OR 퇴사자면 잠금
          .reaction(
            on.mount()
              .when(fieldEquals('targetStatus', 'RESIGNED'))
              .do(actions.updateProp('targetRole', 'disabled', true))
          )
          .dependsOn('targetStatus')
          .build(),

        viewField.select('targetStatus', 'targetStatus')
          .label('재직 상태')
          .placeholder('상태 선택')
          // 슈퍼 관리자/관리자만 수정 가능 (런타임에서 처리)
          .build(),

        viewField.select('department', 'department')
          .label('부서')
          .placeholder('부서 선택')
          // 퇴사자면 잠금
          .reaction(
            on.mount()
              .when(fieldEquals('targetStatus', 'RESIGNED'))
              .do(actions.updateProp('department', 'disabled', true))
          )
          .dependsOn('targetStatus')
          .build(),

        viewField.textInput('teamName', 'teamName')
          .label('팀명')
          .placeholder('팀명 입력')
          // 퇴사자면 잠금
          .reaction(
            on.mount()
              .when(fieldEquals('targetStatus', 'RESIGNED'))
              .do(actions.updateProp('teamName', 'disabled', true))
          )
          .dependsOn('targetStatus')
          .build(),

        viewField.textInput('position', 'position')
          .label('직책')
          .placeholder('직책 입력')
          // 퇴사자면 잠금
          .reaction(
            on.mount()
              .when(fieldEquals('targetStatus', 'RESIGNED'))
              .do(actions.updateProp('position', 'disabled', true))
          )
          .dependsOn('targetStatus')
          .build(),
      )
      .build(),

    // =========================================================================
    // 계정 설정 섹션
    // =========================================================================
    section('account')
      .title('계정 설정')
      .description('보안 관련 설정')
      .layout(layout.grid(2, '1rem'))
      .collapsible(true)
      .fields(
        viewField.checkbox('isEmailVerified', 'isEmailVerified')
          .label('이메일 인증 완료')
          // 퇴사자면 잠금
          .reaction(
            on.mount()
              .when(fieldEquals('targetStatus', 'RESIGNED'))
              .do(actions.updateProp('isEmailVerified', 'disabled', true))
          )
          .dependsOn('targetStatus')
          .build(),

        viewField.checkbox('isTwoFactorEnabled', 'isTwoFactorEnabled')
          .label('2단계 인증 활성화')
          // 퇴사자면 잠금
          .reaction(
            on.mount()
              .when(fieldEquals('targetStatus', 'RESIGNED'))
              .do(actions.updateProp('isTwoFactorEnabled', 'disabled', true))
          )
          .dependsOn('targetStatus')
          .build(),

        viewField.datePicker('passwordExpiresAt', 'passwordExpiresAt')
          .label('비밀번호 만료일')
          // 퇴사자면 잠금
          .reaction(
            on.mount()
              .when(fieldEquals('targetStatus', 'RESIGNED'))
              .do(actions.updateProp('passwordExpiresAt', 'disabled', true))
          )
          .dependsOn('targetStatus')
          .build(),
      )
      .build(),

    // =========================================================================
    // 추가 정보 섹션
    // =========================================================================
    section('extra')
      .title('추가 정보')
      .layout(layout.form())
      .collapsible(true)
      .fields(
        viewField.textarea('notes', 'notes')
          .label('메모')
          .placeholder('추가 메모 입력')
          .props({ rows: 3 })
          // 퇴사자면 잠금
          .reaction(
            on.mount()
              .when(fieldEquals('targetStatus', 'RESIGNED'))
              .do(actions.updateProp('notes', 'disabled', true))
          )
          .dependsOn('targetStatus')
          .build(),
      )
      .build(),

    // =========================================================================
    // 퇴사자 경고 배너 섹션 - 퇴사자일 때만 표시
    // =========================================================================
    section('resigned-warning')
      .title('⚠️ 퇴사자 정보')
      .visible(fieldEquals('targetStatus', 'RESIGNED'))
      .fields(
        // 빈 섹션 - description으로 경고 메시지만 표시
      )
      .build(),
  )
  .footer(footer([
    viewAction.cancel('cancel', '취소')
      .build(),

    viewAction.submit('submit', '저장')
      .confirm(confirm(
        '사용자 정보 저장',
        '변경된 정보를 저장하시겠습니까?',
        { confirmLabel: '저장', cancelLabel: '취소' }
      ))
      .build(),
  ]))
  .build()
