<script setup lang="ts">
/**
 * RichEditorInput - 리치 텍스트 에디터 컴포넌트
 *
 * 기본 구현은 contenteditable 기반
 * 실제 사용 시 Tiptap, Quill 등으로 교체 권장
 */
import { ref, watch, onMounted } from 'vue'

interface Props {
  fieldId: string
  modelValue?: string
  disabled?: boolean
  readonly?: boolean
  placeholder?: string
  componentProps?: Record<string, unknown>
  hasError?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  disabled: false,
  readonly: false,
  hasError: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()

const editorRef = ref<HTMLDivElement | null>(null)
const isFocused = ref(false)

// 외부 값 변경 시 에디터 업데이트
watch(
  () => props.modelValue,
  (newValue) => {
    if (editorRef.value && editorRef.value.innerHTML !== newValue) {
      editorRef.value.innerHTML = newValue || ''
    }
  }
)

onMounted(() => {
  if (editorRef.value && props.modelValue) {
    editorRef.value.innerHTML = props.modelValue
  }
})

const handleInput = () => {
  if (editorRef.value) {
    emit('update:modelValue', editorRef.value.innerHTML)
  }
}

const handleFocus = () => {
  isFocused.value = true
  emit('focus')
}

const handleBlur = () => {
  isFocused.value = false
  emit('blur')
}

// 기본 포맷팅 명령어
const execCommand = (command: string, value?: string) => {
  if (props.disabled || props.readonly) return
  document.execCommand(command, false, value)
  editorRef.value?.focus()
}

// 툴바 표시 여부
const showToolbar = (props.componentProps?.showToolbar as boolean) ?? true
const minHeight = (props.componentProps?.minHeight as string) ?? '150px'
</script>

<template>
  <div
    class="input-richeditor"
    :class="{
      'input-richeditor--error': hasError,
      'input-richeditor--disabled': disabled,
      'input-richeditor--focused': isFocused,
    }"
  >
    <!-- Toolbar -->
    <div v-if="showToolbar && !readonly" class="input-richeditor__toolbar">
      <button
        type="button"
        class="input-richeditor__btn"
        :disabled="disabled"
        title="Bold"
        @click="execCommand('bold')"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        class="input-richeditor__btn"
        :disabled="disabled"
        title="Italic"
        @click="execCommand('italic')"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        class="input-richeditor__btn"
        :disabled="disabled"
        title="Underline"
        @click="execCommand('underline')"
      >
        <u>U</u>
      </button>
      <span class="input-richeditor__separator" />
      <button
        type="button"
        class="input-richeditor__btn"
        :disabled="disabled"
        title="Bulleted List"
        @click="execCommand('insertUnorderedList')"
      >
        •
      </button>
      <button
        type="button"
        class="input-richeditor__btn"
        :disabled="disabled"
        title="Numbered List"
        @click="execCommand('insertOrderedList')"
      >
        1.
      </button>
      <span class="input-richeditor__separator" />
      <button
        type="button"
        class="input-richeditor__btn"
        :disabled="disabled"
        title="Clear Formatting"
        @click="execCommand('removeFormat')"
      >
        ✕
      </button>
    </div>

    <!-- Editor -->
    <div
      ref="editorRef"
      :id="fieldId"
      class="input-richeditor__content"
      :style="{ minHeight }"
      :contenteditable="!disabled && !readonly"
      :data-placeholder="placeholder"
      v-bind="componentProps"
      @input="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
    />
  </div>
</template>

<style>
.input-richeditor {
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: #fff;
  overflow: hidden;
}

.input-richeditor--focused {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-richeditor--error {
  border-color: #dc2626;
}

.input-richeditor--disabled {
  background-color: #f3f4f6;
}

.input-richeditor__toolbar {
  display: flex;
  gap: 0.25rem;
  padding: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
  background-color: #f9fafb;
}

.input-richeditor__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: none;
  border-radius: 0.25rem;
  background: none;
  font-size: 0.875rem;
  cursor: pointer;
}

.input-richeditor__btn:hover:not(:disabled) {
  background-color: #e5e7eb;
}

.input-richeditor__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-richeditor__separator {
  width: 1px;
  margin: 0 0.25rem;
  background-color: #d1d5db;
}

.input-richeditor__content {
  padding: 0.75rem;
  outline: none;
  font-size: 1rem;
  line-height: 1.5;
}

.input-richeditor__content:empty::before {
  content: attr(data-placeholder);
  color: #9ca3af;
  pointer-events: none;
}

.input-richeditor--disabled .input-richeditor__content {
  cursor: not-allowed;
}
</style>
