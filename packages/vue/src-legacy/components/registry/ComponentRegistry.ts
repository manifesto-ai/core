/**
 * Component Registry
 *
 * 컴포넌트 타입 → Vue 컴포넌트 매핑을 관리하는 레지스트리
 * Headless 패턴으로 UI 라이브러리 독립적 설계
 */

import type { Component } from 'vue'
import type { IComponentRegistry, ComponentRegistration } from '../../types/component'

/**
 * ComponentRegistry 구현
 */
export class ComponentRegistry implements IComponentRegistry {
  private registry = new Map<string, ComponentRegistration>()

  /**
   * 컴포넌트 등록
   * @param type 컴포넌트 타입 (e.g., 'text-input', 'select')
   * @param registration 컴포넌트 또는 등록 정보
   */
  register(type: string, registration: ComponentRegistration | Component): void {
    if (this.isComponent(registration)) {
      this.registry.set(type, { component: registration })
    } else {
      this.registry.set(type, registration)
    }
  }

  /**
   * 컴포넌트 조회
   */
  get(type: string): ComponentRegistration | undefined {
    return this.registry.get(type)
  }

  /**
   * 등록 여부 확인
   */
  has(type: string): boolean {
    return this.registry.has(type)
  }

  /**
   * 전체 등록된 타입 목록
   */
  getTypes(): string[] {
    return Array.from(this.registry.keys())
  }

  /**
   * 레지스트리 복제 (확장용)
   */
  clone(): IComponentRegistry {
    const cloned = new ComponentRegistry()
    for (const [type, registration] of this.registry) {
      cloned.register(type, registration)
    }
    return cloned
  }

  /**
   * Component 타입 가드
   */
  private isComponent(value: ComponentRegistration | Component): value is Component {
    return typeof value === 'object' && !('component' in value)
  }
}

/**
 * 기본 레지스트리 인스턴스 (lazy initialization)
 */
let _defaultRegistry: ComponentRegistry | null = null

/**
 * 기본 레지스트리 가져오기
 * 최초 호출 시 기본 컴포넌트들이 등록됨
 */
export function getDefaultRegistry(): IComponentRegistry {
  if (!_defaultRegistry) {
    _defaultRegistry = new ComponentRegistry()
    registerDefaultComponents(_defaultRegistry)
  }
  return _defaultRegistry
}

/**
 * 새 레지스트리 생성
 * @param includeDefaults 기본 컴포넌트 포함 여부 (기본: true)
 */
export function createComponentRegistry(includeDefaults = true): IComponentRegistry {
  const registry = new ComponentRegistry()
  if (includeDefaults) {
    registerDefaultComponents(registry)
  }
  return registry
}

/**
 * 기본 컴포넌트 등록
 * 동적 import로 필요 시점에 로드
 */
function registerDefaultComponents(registry: ComponentRegistry): void {
  // 기본 입력 컴포넌트들 - 동기적으로 import
  // (실제 번들링 시 tree-shaking 됨)

  // 쉬운 난이도 (6개)
  registry.register('text-input', {
    component: () => import('../inputs/TextInput.vue').then(m => m.default),
  })
  registry.register('number-input', {
    component: () => import('../inputs/NumberInput.vue').then(m => m.default),
  })
  registry.register('select', {
    component: () => import('../inputs/SelectInput.vue').then(m => m.default),
  })
  registry.register('checkbox', {
    component: () => import('../inputs/CheckboxInput.vue').then(m => m.default),
  })
  registry.register('textarea', {
    component: () => import('../inputs/TextareaInput.vue').then(m => m.default),
  })
  registry.register('toggle', {
    component: () => import('../inputs/ToggleInput.vue').then(m => m.default),
  })

  // 보통 난이도 (6개)
  registry.register('radio', {
    component: () => import('../inputs/RadioInput.vue').then(m => m.default),
  })
  registry.register('multi-select', {
    component: () => import('../inputs/MultiSelectInput.vue').then(m => m.default),
  })
  registry.register('date-picker', {
    component: () => import('../inputs/DatePickerInput.vue').then(m => m.default),
  })
  registry.register('datetime-picker', {
    component: () => import('../inputs/DatetimePickerInput.vue').then(m => m.default),
  })
  registry.register('slider', {
    component: () => import('../inputs/SliderInput.vue').then(m => m.default),
  })
  registry.register('color-picker', {
    component: () => import('../inputs/ColorPickerInput.vue').then(m => m.default),
  })

  // 어려운 난이도 (4개)
  registry.register('autocomplete', {
    component: () => import('../inputs/AutocompleteInput.vue').then(m => m.default),
  })
  registry.register('rich-editor', {
    component: () => import('../inputs/RichEditorInput.vue').then(m => m.default),
  })
  registry.register('file-upload', {
    component: () => import('../inputs/FileUploadInput.vue').then(m => m.default),
  })
  registry.register('image-upload', {
    component: () => import('../inputs/ImageUploadInput.vue').then(m => m.default),
  })

  // 커스텀 컴포넌트 (1개)
  registry.register('custom', {
    component: () => import('../inputs/CustomInput.vue').then(m => m.default),
  })
}
