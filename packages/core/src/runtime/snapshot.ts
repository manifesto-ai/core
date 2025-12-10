import type { SemanticPath, ValidationResult } from '../domain/types.js';

/**
 * DomainSnapshot: 특정 시점의 도메인 상태
 */
export type DomainSnapshot<TData = unknown, TState = unknown> = {
  /** 데이터 값들 */
  data: TData;

  /** 상태 값들 */
  state: TState;

  /** 계산된 값들 */
  derived: Record<SemanticPath, unknown>;

  /** 유효성 검증 결과 */
  validity: Record<SemanticPath, ValidationResult>;

  /** 스냅샷 생성 시간 */
  timestamp: number;

  /** 스냅샷 버전 (변경마다 증가) */
  version: number;
};

/**
 * 빈 스냅샷 생성
 */
export function createSnapshot<TData, TState>(
  initialData: TData,
  initialState: TState
): DomainSnapshot<TData, TState> {
  return {
    data: initialData,
    state: initialState,
    derived: {},
    validity: {},
    timestamp: Date.now(),
    version: 0,
  };
}

/**
 * 스냅샷 복제 (불변성 유지)
 */
export function cloneSnapshot<TData, TState>(
  snapshot: DomainSnapshot<TData, TState>
): DomainSnapshot<TData, TState> {
  return {
    data: deepClone(snapshot.data),
    state: deepClone(snapshot.state),
    derived: { ...snapshot.derived },
    validity: { ...snapshot.validity },
    timestamp: snapshot.timestamp,
    version: snapshot.version,
  };
}

/**
 * 스냅샷에서 경로로 값 조회
 */
export function getValueByPath<TData, TState>(
  snapshot: DomainSnapshot<TData, TState>,
  path: SemanticPath
): unknown {
  if (path.startsWith('data.')) {
    const subPath = path.slice(5);
    return getNestedValue(snapshot.data, subPath);
  }

  if (path.startsWith('state.')) {
    const subPath = path.slice(6);
    return getNestedValue(snapshot.state, subPath);
  }

  if (path.startsWith('derived.')) {
    const subPath = path.slice(8);
    return snapshot.derived[subPath] ?? snapshot.derived[path];
  }

  // derived 경로가 접두사 없이 저장된 경우
  if (path in snapshot.derived) {
    return snapshot.derived[path];
  }

  return undefined;
}

/**
 * 스냅샷에 경로로 값 설정
 */
export function setValueByPath<TData, TState>(
  snapshot: DomainSnapshot<TData, TState>,
  path: SemanticPath,
  value: unknown
): DomainSnapshot<TData, TState> {
  const newSnapshot = cloneSnapshot(snapshot);
  newSnapshot.version++;
  newSnapshot.timestamp = Date.now();

  if (path.startsWith('data.')) {
    const subPath = path.slice(5);
    newSnapshot.data = setNestedValue(newSnapshot.data, subPath, value) as TData;
    return newSnapshot;
  }

  if (path.startsWith('state.')) {
    const subPath = path.slice(6);
    newSnapshot.state = setNestedValue(newSnapshot.state, subPath, value) as TState;
    return newSnapshot;
  }

  if (path.startsWith('derived.')) {
    const subPath = path.slice(8);
    newSnapshot.derived[subPath] = value;
    return newSnapshot;
  }

  // derived 경로로 가정
  newSnapshot.derived[path] = value;
  return newSnapshot;
}

/**
 * 스냅샷 diff 계산
 */
export function diffSnapshots<TData, TState>(
  oldSnapshot: DomainSnapshot<TData, TState>,
  newSnapshot: DomainSnapshot<TData, TState>
): SemanticPath[] {
  const changedPaths: SemanticPath[] = [];

  // data 비교
  const dataChanges = diffObjects(oldSnapshot.data, newSnapshot.data, 'data');
  changedPaths.push(...dataChanges);

  // state 비교
  const stateChanges = diffObjects(oldSnapshot.state, newSnapshot.state, 'state');
  changedPaths.push(...stateChanges);

  // derived 비교
  const allDerivedKeys = new Set([
    ...Object.keys(oldSnapshot.derived),
    ...Object.keys(newSnapshot.derived),
  ]);

  for (const key of allDerivedKeys) {
    if (!deepEqual(oldSnapshot.derived[key], newSnapshot.derived[key])) {
      changedPaths.push(key.startsWith('derived.') ? key : `derived.${key}`);
    }
  }

  return changedPaths;
}

/**
 * 중첩 객체에서 값 가져오기
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (!path) return obj;

  const parts = parsePath(path);
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * 중첩 객체에 값 설정 (불변)
 */
function setNestedValue(obj: unknown, path: string, value: unknown): unknown {
  if (!path) return value;

  const parts = parsePath(path);
  const result = deepClone(obj) as Record<string, unknown>;
  let current = result;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (current[part] === undefined || current[part] === null) {
      current[part] = {};
    } else {
      current[part] = deepClone(current[part]);
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1]!;
  current[lastPart] = value;

  return result;
}

/**
 * 경로 파싱 (점 표기법 및 대괄호 표기법 지원)
 */
function parsePath(path: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inBracket = false;
  let bracketContent = '';

  for (const char of path) {
    if (char === '[' && !inBracket) {
      if (current) {
        parts.push(current);
        current = '';
      }
      inBracket = true;
    } else if (char === ']' && inBracket) {
      // 따옴표 제거
      const cleaned = bracketContent.replace(/^["']|["']$/g, '');
      parts.push(cleaned);
      bracketContent = '';
      inBracket = false;
    } else if (char === '.' && !inBracket) {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else if (inBracket) {
      bracketContent += char;
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

/**
 * 객체 diff
 */
function diffObjects(
  oldObj: unknown,
  newObj: unknown,
  prefix: string
): string[] {
  const changes: string[] = [];

  if (!isObject(oldObj) || !isObject(newObj)) {
    if (!deepEqual(oldObj, newObj)) {
      changes.push(prefix);
    }
    return changes;
  }

  const allKeys = new Set([
    ...Object.keys(oldObj as object),
    ...Object.keys(newObj as object),
  ]);

  for (const key of allKeys) {
    const oldVal = (oldObj as Record<string, unknown>)[key];
    const newVal = (newObj as Record<string, unknown>)[key];
    const path = `${prefix}.${key}`;

    if (!deepEqual(oldVal, newVal)) {
      changes.push(path);

      // 중첩 객체의 경우 재귀적으로 diff
      if (isObject(oldVal) && isObject(newVal)) {
        const nestedChanges = diffObjects(oldVal, newVal, path);
        changes.push(...nestedChanges);
      }
    }
  }

  return changes;
}

/**
 * 객체인지 확인
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 깊은 복제
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepClone) as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = deepClone(value);
  }

  return result as T;
}

/**
 * 깊은 동등성 비교
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (Array.isArray(a) || Array.isArray(b)) return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);

  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (!deepEqual(aObj[key], bObj[key])) return false;
  }

  return true;
}
