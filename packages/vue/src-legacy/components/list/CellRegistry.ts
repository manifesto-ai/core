/**
 * Cell Registry
 *
 * 셀 타입 → Vue 컴포넌트 매핑을 관리하는 레지스트리
 * ComponentRegistry와 동일한 패턴이지만 List Cell 렌더러용
 */

import type { Component } from 'vue'
import type { ICellRegistry, CellRegistration } from '../../types/list'

/**
 * CellRegistry 구현
 */
export class CellRegistry implements ICellRegistry {
  private registry = new Map<string, CellRegistration>()

  /**
   * Cell 컴포넌트 등록
   * @param type 셀 타입 (e.g., 'text', 'number', 'badge')
   * @param registration 컴포넌트 또는 등록 정보
   */
  register(
    type: string,
    registration: CellRegistration | Component | (() => Promise<{ default: Component }>)
  ): void {
    if (this.isAsyncImport(registration)) {
      this.registry.set(type, { component: registration })
    } else if (this.isComponent(registration)) {
      this.registry.set(type, { component: registration })
    } else {
      this.registry.set(type, registration)
    }
  }

  /**
   * Cell 컴포넌트 조회
   */
  get(type: string): CellRegistration | undefined {
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
  clone(): ICellRegistry {
    const cloned = new CellRegistry()
    for (const [type, registration] of this.registry) {
      cloned.registry.set(type, registration)
    }
    return cloned
  }

  /**
   * Async import 함수 타입 가드
   */
  private isAsyncImport(
    value: CellRegistration | Component | (() => Promise<{ default: Component }>)
  ): value is () => Promise<{ default: Component }> {
    return typeof value === 'function'
  }

  /**
   * Component 타입 가드
   */
  private isComponent(value: CellRegistration | Component): value is Component {
    return typeof value === 'object' && !('component' in value)
  }
}

/**
 * 기본 레지스트리 인스턴스 (lazy initialization)
 */
let _defaultCellRegistry: CellRegistry | null = null

/**
 * 기본 Cell 레지스트리 가져오기
 * 최초 호출 시 기본 Cell 컴포넌트들이 등록됨
 */
export function getDefaultCellRegistry(): ICellRegistry {
  if (!_defaultCellRegistry) {
    _defaultCellRegistry = new CellRegistry()
    registerDefaultCells(_defaultCellRegistry)
  }
  return _defaultCellRegistry
}

/**
 * 새 Cell 레지스트리 생성
 * @param includeDefaults 기본 Cell 컴포넌트 포함 여부 (기본: true)
 */
export function createCellRegistry(includeDefaults = true): ICellRegistry {
  const registry = new CellRegistry()
  if (includeDefaults) {
    registerDefaultCells(registry)
  }
  return registry
}

/**
 * 기본 Cell 컴포넌트 등록
 * 동적 import로 필요 시점에 로드
 */
function registerDefaultCells(registry: CellRegistry): void {
  // 기본 Cell 렌더러들 - 동적 import로 lazy load

  // 텍스트 타입
  registry.register('text', {
    component: () => import('./cells/TextCell.vue').then((m) => m.default),
  })

  // 숫자 타입
  registry.register('number', {
    component: () => import('./cells/NumberCell.vue').then((m) => m.default),
  })

  // 날짜 타입
  registry.register('date', {
    component: () => import('./cells/DateCell.vue').then((m) => m.default),
  })

  // 날짜+시간 타입
  registry.register('datetime', {
    component: () => import('./cells/DateTimeCell.vue').then((m) => m.default),
  })

  // Boolean 타입
  registry.register('boolean', {
    component: () => import('./cells/BooleanCell.vue').then((m) => m.default),
  })

  // Badge 타입 (상태 표시)
  registry.register('badge', {
    component: () => import('./cells/BadgeCell.vue').then((m) => m.default),
  })

  // 링크 타입
  registry.register('link', {
    component: () => import('./cells/LinkCell.vue').then((m) => m.default),
  })

  // 이미지 타입
  registry.register('image', {
    component: () => import('./cells/ImageCell.vue').then((m) => m.default),
  })

  // Enum 타입
  registry.register('enum', {
    component: () => import('./cells/EnumCell.vue').then((m) => m.default),
  })
}
