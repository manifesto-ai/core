/**
 * User Edit Entity Schema
 *
 * 사용자 정보 데이터 구조 정의 (컨텍스트 검증용)
 */

import { entity, field, enumValue } from '@manifesto-ai/schema'

// 사용자 상태
export const userStatuses = [
  enumValue('ACTIVE', '재직'),
  enumValue('ON_LEAVE', '휴직'),
  enumValue('RESIGNED', '퇴사'),
] as const

// 사용자 권한 등급
export const userRoles = [
  enumValue('SUPER_ADMIN', '슈퍼 관리자', { description: '모든 권한 보유' }),
  enumValue('ADMIN', '관리자', { description: '일반 관리 권한' }),
  enumValue('MANAGER', '매니저', { description: '팀 관리 권한' }),
  enumValue('OPERATOR', '운영자', { description: '운영 권한만' }),
  enumValue('VIEWER', '뷰어', { description: '조회 권한만' }),
] as const

// 부서
export const departments = [
  enumValue('ENGINEERING', '개발팀'),
  enumValue('OPERATIONS', '운영팀'),
  enumValue('SUPPORT', '지원팀'),
  enumValue('MANAGEMENT', '경영지원팀'),
  enumValue('SALES', '영업팀'),
] as const

// Entity Schema
export const userEditEntity = entity('user', 'User', '0.1.0')
  .description('사용자 정보를 정의하는 엔티티 (컨텍스트 검증)')
  .tags('user', 'auth')
  .fields(
    // === 기본 정보 ===
    field.string('id', 'ID').build(),

    field.string('userId', '사용자 ID')
      .required('사용자 ID를 입력해주세요')
      .pattern('^[a-z0-9_]+$', '영문 소문자, 숫자, 언더스코어만 사용 가능')
      .min(4, '사용자 ID는 4자 이상이어야 합니다')
      .max(20, '사용자 ID는 20자 이하여야 합니다')
      .build(),

    field.string('name', '이름')
      .required('이름을 입력해주세요')
      .max(50)
      .build(),

    field.string('email', '이메일')
      .required('이메일을 입력해주세요')
      .pattern('^[^@]+@[^@]+\\.[^@]+$', '올바른 이메일 형식이 아닙니다')
      .build(),

    field.string('phone', '연락처')
      .pattern('^\\d{2,3}-\\d{3,4}-\\d{4}$', '올바른 전화번호 형식이 아닙니다')
      .build(),

    // === 권한/조직 정보 ===
    field.enum('targetRole', '권한 등급', userRoles)
      .required('권한 등급을 선택해주세요')
      .build(),

    field.enum('targetStatus', '재직 상태', userStatuses)
      .required('재직 상태를 선택해주세요')
      .defaultValue('ACTIVE')
      .build(),

    field.enum('department', '부서', departments)
      .required('부서를 선택해주세요')
      .build(),

    field.string('teamName', '팀명')
      .max(50)
      .build(),

    field.string('position', '직책')
      .max(50)
      .build(),

    // === 계정 설정 ===
    field.boolean('isEmailVerified', '이메일 인증 여부')
      .defaultValue(false)
      .build(),

    field.boolean('isTwoFactorEnabled', '2FA 활성화')
      .defaultValue(false)
      .build(),

    field.date('passwordExpiresAt', '비밀번호 만료일').build(),

    // === 메타 정보 ===
    field.string('notes', '메모')
      .max(1000)
      .build(),

    field.datetime('lastLoginAt', '마지막 로그인').build(),
    field.datetime('createdAt', '생성일시').build(),
    field.datetime('updatedAt', '수정일시').build(),
  )
  .build()

export type UserStatus = typeof userStatuses[number]['value']
export type UserRole = typeof userRoles[number]['value']
export type Department = typeof departments[number]['value']
