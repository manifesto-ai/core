<script setup lang="ts">
/**
 * SliderInput - 슬라이더 컴포넌트
 */
import { computed } from 'vue'

interface Props {
  fieldId: string
  modelValue?: number
  disabled?: boolean
  readonly?: boolean
  componentProps?: Record<string, unknown>
  hasError?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: 0,
  disabled: false,
  readonly: false,
  hasError: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', Number(target.value))
}

// 슬라이더 옵션
const min = computed(() => (props.componentProps?.min as number) ?? 0)
const max = computed(() => (props.componentProps?.max as number) ?? 100)
const step = computed(() => (props.componentProps?.step as number) ?? 1)
const showValue = computed(() => (props.componentProps?.showValue as boolean) ?? true)

// 진행률 계산 (배경 그라데이션용)
const progress = computed(() => {
  const range = max.value - min.value
  if (range === 0) return 0
  return ((props.modelValue - min.value) / range) * 100
})
</script>

<template>
  <div
    class="input-slider"
    :class="{
      'input-slider--error': hasError,
      'input-slider--disabled': disabled,
    }"
  >
    <input
      type="range"
      :id="fieldId"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled || readonly"
      class="input-slider__range"
      :style="{ '--progress': `${progress}%` }"
      v-bind="componentProps"
      @input="handleInput"
      @focus="emit('focus')"
      @blur="emit('blur')"
    />
    <output v-if="showValue" class="input-slider__value">
      {{ modelValue }}
    </output>
  </div>
</template>

<style>
.input-slider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
}

.input-slider__range {
  flex: 1;
  height: 0.5rem;
  appearance: none;
  background: linear-gradient(
    to right,
    #3b82f6 0%,
    #3b82f6 var(--progress, 0%),
    #e5e7eb var(--progress, 0%),
    #e5e7eb 100%
  );
  border-radius: 0.25rem;
  cursor: pointer;
}

.input-slider__range:focus {
  outline: none;
}

/* Webkit (Chrome, Safari) */
.input-slider__range::-webkit-slider-thumb {
  appearance: none;
  width: 1.25rem;
  height: 1.25rem;
  background-color: #fff;
  border: 2px solid #3b82f6;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: transform 0.15s;
}

.input-slider__range::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.input-slider__range:focus::-webkit-slider-thumb {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Firefox */
.input-slider__range::-moz-range-thumb {
  width: 1.25rem;
  height: 1.25rem;
  background-color: #fff;
  border: 2px solid #3b82f6;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.input-slider__range::-moz-range-track {
  background: transparent;
}

.input-slider--error .input-slider__range {
  background: linear-gradient(
    to right,
    #dc2626 0%,
    #dc2626 var(--progress, 0%),
    #fecaca var(--progress, 0%),
    #fecaca 100%
  );
}

.input-slider--error .input-slider__range::-webkit-slider-thumb {
  border-color: #dc2626;
}

.input-slider--disabled {
  opacity: 0.5;
}

.input-slider--disabled .input-slider__range {
  cursor: not-allowed;
}

.input-slider__value {
  min-width: 2.5rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  text-align: center;
  background-color: #f3f4f6;
  border-radius: 0.25rem;
}
</style>
