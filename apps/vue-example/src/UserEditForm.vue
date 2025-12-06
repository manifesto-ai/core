<script setup lang="ts">
/**
 * User Edit Form
 *
 * FormRenderer를 사용하여 자동으로 폼을 렌더링
 * 로그인 사용자 권한에 따라 수정 가능 범위가 달라지는 컨텍스트 검증
 */
import { ref, computed } from 'vue'
import { FormRenderer } from '@manifesto-ai/vue'
import { userEditView, userEditEntity } from '@manifesto-ai/example-schemas'

// Props - 로그인 사용자 정보
const props = withDefaults(defineProps<{
  currentUserRole?: string
  currentUserId?: string
}>(), {
  currentUserRole: 'ADMIN',
  currentUserId: 'current-user-1',
})

// 편집 대상 사용자 초기값 (실제로는 API에서 로드)
const initialValues = {
  userId: 'target_user_001',
  name: '홍길동',
  email: 'hong@example.com',
  phone: '010-1234-5678',
  targetRole: 'OPERATOR',
  targetStatus: 'ACTIVE',
  department: 'ENGINEERING',
  teamName: '플랫폼팀',
  position: '선임',
  isEmailVerified: true,
  isTwoFactorEnabled: false,
}

// Context 설정 - 로그인 사용자 정보
const context = computed(() => ({
  user: {
    id: props.currentUserId,
    name: 'Current User',
    role: props.currentUserRole,
  },
  context: {
    brandId: 'brand-1',
  },
}))

// 권한 체크 헬퍼
const isSuperAdmin = computed(() => props.currentUserRole === 'SUPER_ADMIN')
const isAdmin = computed(() => props.currentUserRole === 'ADMIN' || props.currentUserRole === 'SUPER_ADMIN')

// 폼 참조
const formRef = ref<InstanceType<typeof FormRenderer> | null>(null)


// 현재 폼 값 추적 (디버그용)
const currentValues = ref<Record<string, unknown>>({})
const handleValuesChange = (values: Record<string, unknown>) => {
  currentValues.value = values
}

// 퇴사자 여부
const isResigned = computed(() => currentValues.value.targetStatus === 'RESIGNED')

// Submit 핸들러
const handleSubmit = (data: Record<string, unknown>) => {
  console.log('Submit data:', data)
  alert('사용자 정보가 저장되었습니다!\n\n' + JSON.stringify(data, null, 2))
}

// 에러 핸들러
const handleError = (error: unknown) => {
  console.error('Form error:', error)
}
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>사용자 정보 수정</h1>
      <p>로그인 사용자 권한에 따라 수정 가능 범위가 달라집니다</p>
      <div class="role-badge">
        현재 로그인: {{ currentUserRole }}
        <span v-if="isSuperAdmin" class="badge badge-super">모든 권한</span>
        <span v-else-if="isAdmin" class="badge badge-admin">관리 권한</span>
        <span v-else class="badge badge-user">제한 권한</span>
      </div>
    </header>

    <!-- 퇴사자 경고 배너 -->
    <div v-if="isResigned" class="warning-banner">
      <strong>퇴사자 정보입니다.</strong> 모든 필드가 읽기 전용으로 잠금 처리됩니다.
    </div>

    <!-- 권한 안내 -->
    <div v-if="!isSuperAdmin" class="info-banner">
      <p v-if="!isSuperAdmin">슈퍼 관리자만 권한 등급을 변경할 수 있습니다.</p>
      <p v-if="!isAdmin">관리자 이상만 재직 상태를 변경할 수 있습니다.</p>
    </div>

    <FormRenderer
      ref="formRef"
      :schema="userEditView"
      :entity-schema="userEditEntity"
      :initial-values="initialValues"
      :context="context"
      :debug="true"
      @submit="handleSubmit"
      @error="handleError"
      @values-change="handleValuesChange"
    >
      <template #footer="{ reset, isValid, isDirty, isSubmitting }">
        <div class="form-footer">
          <button type="button" class="btn btn-secondary" @click="reset" :disabled="!isDirty">
            취소
          </button>
          <button type="submit" class="btn btn-primary" :disabled="!isValid || isSubmitting || isResigned">
            {{ isSubmitting ? '저장 중...' : '저장' }}
          </button>
        </div>
      </template>
    </FormRenderer>

    <!-- 디버그 정보 -->
    <aside class="debug-panel" role="complementary">
      <h3>Debug Context</h3>
      <pre>{{ JSON.stringify({
        currentUserRole: props.currentUserRole,
        isSuperAdmin: isSuperAdmin,
        isAdmin: isAdmin,
        isResigned: isResigned,
        isRoleFieldDisabled: !isSuperAdmin,
        isStatusFieldDisabled: !isAdmin,
      }, null, 2) }}</pre>
    </aside>
  </div>
</template>

<style>
.app {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}

.app-header {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e0e0e0;
}

.app-header h1 {
  font-size: 1.75rem;
  color: #1a1a1a;
  margin-bottom: 0.5rem;
}

.app-header p {
  color: #666;
  margin-bottom: 0.5rem;
}

.role-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #666;
}

.badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-super {
  background: #dcfce7;
  color: #166534;
}

.badge-admin {
  background: #dbeafe;
  color: #1e40af;
}

.badge-user {
  background: #f3f4f6;
  color: #6b7280;
}

.warning-banner {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.info-banner {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.info-banner p {
  margin: 0;
  font-size: 0.875rem;
}

.info-banner p + p {
  margin-top: 0.5rem;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1.5rem 0;
  border-top: 1px solid #e0e0e0;
  margin-top: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #4a90d9;
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: #3a7bc8;
}

.btn-secondary {
  background: white;
  color: #666;
  border: 1px solid #ddd;
}

.btn-secondary:hover:not(:disabled) {
  background: #f5f5f5;
}

.debug-panel {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  width: 300px;
  max-height: 300px;
  overflow: auto;
  background: #1a1a1a;
  color: #0f0;
  padding: 1rem;
  border-radius: 8px;
  font-family: monospace;
  font-size: 0.75rem;
}

.debug-panel h3 {
  margin-bottom: 0.5rem;
  color: #fff;
}

.debug-panel pre {
  white-space: pre-wrap;
  word-break: break-all;
}

@media (max-width: 768px) {
  .debug-panel {
    display: none;
  }
}
</style>
