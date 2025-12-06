<script setup lang="ts">
/**
 * FileUploadInput - 파일 업로드 컴포넌트
 */
import { ref, computed } from 'vue'

interface FileInfo {
  name: string
  size: number
  type: string
  file?: File
}

interface Props {
  fieldId: string
  modelValue?: FileInfo | FileInfo[] | null
  disabled?: boolean
  readonly?: boolean
  componentProps?: Record<string, unknown>
  hasError?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  readonly: false,
  hasError: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: FileInfo | FileInfo[] | null): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

// 옵션
const multiple = computed(() => (props.componentProps?.multiple as boolean) ?? false)
const accept = computed(() => (props.componentProps?.accept as string) ?? '')
const maxSize = computed(() => (props.componentProps?.maxSize as number) ?? 10 * 1024 * 1024) // 10MB

// 현재 파일 목록
const files = computed<FileInfo[]>(() => {
  if (!props.modelValue) return []
  return Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue]
})

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (!target.files?.length) return

  const newFiles = processFiles(Array.from(target.files))
  emitFiles(newFiles)

  // 같은 파일 재선택 허용
  target.value = ''
}

const processFiles = (fileList: File[]): FileInfo[] => {
  return fileList
    .filter((file) => file.size <= maxSize.value)
    .map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      file,
    }))
}

const emitFiles = (newFiles: FileInfo[]) => {
  if (multiple.value) {
    emit('update:modelValue', [...files.value, ...newFiles])
  } else {
    emit('update:modelValue', newFiles[0] ?? null)
  }
}

const removeFile = (index: number) => {
  if (props.disabled || props.readonly) return

  if (multiple.value) {
    const newFiles = files.value.filter((_, i) => i !== index)
    emit('update:modelValue', newFiles.length > 0 ? newFiles : null)
  } else {
    emit('update:modelValue', null)
  }
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (!props.disabled && !props.readonly) {
    isDragging.value = true
  }
}

const handleDragLeave = () => {
  isDragging.value = false
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = false

  if (props.disabled || props.readonly) return

  const droppedFiles = event.dataTransfer?.files
  if (!droppedFiles?.length) return

  const newFiles = processFiles(Array.from(droppedFiles))
  emitFiles(newFiles)
}

const openFilePicker = () => {
  if (!props.disabled && !props.readonly) {
    inputRef.value?.click()
  }
}
</script>

<template>
  <div
    class="input-file"
    :class="{
      'input-file--error': hasError,
      'input-file--disabled': disabled,
      'input-file--dragging': isDragging,
    }"
  >
    <!-- Hidden file input -->
    <input
      ref="inputRef"
      type="file"
      :id="fieldId"
      :accept="accept"
      :multiple="multiple"
      :disabled="disabled || readonly"
      class="input-file__input"
      @change="handleFileChange"
      @focus="emit('focus')"
      @blur="emit('blur')"
    />

    <!-- Drop zone -->
    <div
      class="input-file__dropzone"
      @click="openFilePicker"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <div class="input-file__icon">📁</div>
      <p class="input-file__text">
        Click to upload or drag and drop
      </p>
      <p v-if="accept" class="input-file__hint">
        Accepted: {{ accept }}
      </p>
      <p class="input-file__hint">
        Max size: {{ formatSize(maxSize) }}
      </p>
    </div>

    <!-- File list -->
    <ul v-if="files.length > 0" class="input-file__list">
      <li
        v-for="(file, index) in files"
        :key="index"
        class="input-file__item"
      >
        <span class="input-file__name">{{ file.name }}</span>
        <span class="input-file__size">{{ formatSize(file.size) }}</span>
        <button
          v-if="!disabled && !readonly"
          type="button"
          class="input-file__remove"
          @click="removeFile(index)"
        >
          ×
        </button>
      </li>
    </ul>
  </div>
</template>

<style>
.input-file {
  width: 100%;
}

.input-file__input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.input-file__dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  border: 2px dashed #d1d5db;
  border-radius: 0.375rem;
  background-color: #f9fafb;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}

.input-file__dropzone:hover {
  border-color: #3b82f6;
  background-color: #eff6ff;
}

.input-file--dragging .input-file__dropzone {
  border-color: #3b82f6;
  background-color: #eff6ff;
}

.input-file--error .input-file__dropzone {
  border-color: #dc2626;
}

.input-file--disabled .input-file__dropzone {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-file__icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.input-file__text {
  margin: 0;
  font-size: 0.875rem;
  color: #374151;
}

.input-file__hint {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  color: #6b7280;
}

.input-file__list {
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
}

.input-file__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  margin-bottom: 0.25rem;
  background-color: #f3f4f6;
  border-radius: 0.25rem;
}

.input-file__name {
  flex: 1;
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.input-file__size {
  font-size: 0.75rem;
  color: #6b7280;
}

.input-file__remove {
  padding: 0.125rem 0.375rem;
  border: none;
  background: none;
  font-size: 1.25rem;
  line-height: 1;
  color: #6b7280;
  cursor: pointer;
}

.input-file__remove:hover {
  color: #dc2626;
}
</style>
