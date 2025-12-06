<script setup lang="ts">
/**
 * ImageUploadInput - 이미지 업로드 컴포넌트
 *
 * 미리보기 지원
 */
import { ref, computed } from 'vue'

interface ImageInfo {
  name: string
  size: number
  type: string
  url?: string
  file?: File
}

interface Props {
  fieldId: string
  modelValue?: ImageInfo | ImageInfo[] | null
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
  (e: 'update:modelValue', value: ImageInfo | ImageInfo[] | null): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

// 옵션
const multiple = computed(() => (props.componentProps?.multiple as boolean) ?? false)
const accept = computed(() => (props.componentProps?.accept as string) ?? 'image/*')
const maxSize = computed(() => (props.componentProps?.maxSize as number) ?? 5 * 1024 * 1024) // 5MB

// 현재 이미지 목록
const images = computed<ImageInfo[]>(() => {
  if (!props.modelValue) return []
  return Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue]
})

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  if (!target.files?.length) return

  const newImages = await processFiles(Array.from(target.files))
  emitImages(newImages)

  target.value = ''
}

const processFiles = async (fileList: File[]): Promise<ImageInfo[]> => {
  const validFiles = fileList.filter(
    (file) => file.type.startsWith('image/') && file.size <= maxSize.value
  )

  return Promise.all(
    validFiles.map(async (file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      url: await readFileAsDataURL(file),
      file,
    }))
  )
}

const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.readAsDataURL(file)
  })
}

const emitImages = (newImages: ImageInfo[]) => {
  if (multiple.value) {
    emit('update:modelValue', [...images.value, ...newImages])
  } else {
    emit('update:modelValue', newImages[0] ?? null)
  }
}

const removeImage = (index: number) => {
  if (props.disabled || props.readonly) return

  if (multiple.value) {
    const newImages = images.value.filter((_, i) => i !== index)
    emit('update:modelValue', newImages.length > 0 ? newImages : null)
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

const handleDrop = async (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = false

  if (props.disabled || props.readonly) return

  const droppedFiles = event.dataTransfer?.files
  if (!droppedFiles?.length) return

  const newImages = await processFiles(Array.from(droppedFiles))
  emitImages(newImages)
}

const openFilePicker = () => {
  if (!props.disabled && !props.readonly) {
    inputRef.value?.click()
  }
}
</script>

<template>
  <div
    class="input-image"
    :class="{
      'input-image--error': hasError,
      'input-image--disabled': disabled,
      'input-image--dragging': isDragging,
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
      class="input-image__input"
      @change="handleFileChange"
      @focus="emit('focus')"
      @blur="emit('blur')"
    />

    <!-- Image preview grid -->
    <div class="input-image__grid">
      <!-- Existing images -->
      <div
        v-for="(image, index) in images"
        :key="index"
        class="input-image__preview"
      >
        <img
          :src="image.url"
          :alt="image.name"
          class="input-image__img"
        />
        <button
          v-if="!disabled && !readonly"
          type="button"
          class="input-image__remove"
          @click="removeImage(index)"
        >
          ×
        </button>
        <span class="input-image__info">
          {{ formatSize(image.size) }}
        </span>
      </div>

      <!-- Upload button -->
      <div
        v-if="multiple || images.length === 0"
        class="input-image__add"
        @click="openFilePicker"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
      >
        <span class="input-image__icon">+</span>
        <span class="input-image__label">Upload</span>
      </div>
    </div>

    <p class="input-image__hint">
      Max size: {{ formatSize(maxSize) }}
    </p>
  </div>
</template>

<style>
.input-image {
  width: 100%;
}

.input-image__input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.input-image__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.input-image__preview {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 0.375rem;
  overflow: hidden;
}

.input-image__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.input-image__remove {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: none;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
}

.input-image__remove:hover {
  background-color: #dc2626;
}

.input-image__info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.25rem;
  background-color: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 0.625rem;
  text-align: center;
}

.input-image__add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100px;
  height: 100px;
  border: 2px dashed #d1d5db;
  border-radius: 0.375rem;
  background-color: #f9fafb;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}

.input-image__add:hover {
  border-color: #3b82f6;
  background-color: #eff6ff;
}

.input-image--dragging .input-image__add {
  border-color: #3b82f6;
  background-color: #eff6ff;
}

.input-image--error .input-image__add {
  border-color: #dc2626;
}

.input-image--disabled .input-image__add {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-image__icon {
  font-size: 1.5rem;
  color: #6b7280;
}

.input-image__label {
  font-size: 0.75rem;
  color: #6b7280;
}

.input-image__hint {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  color: #6b7280;
}
</style>
