import type {
  ManifestoDomain,
  SemanticPath,
  ValidationResult,
  ValidationIssue,
} from './types.js';

/**
 * 도메인 유효성 검증 옵션
 */
export type ValidateDomainOptions = {
  /** 순환 의존성 검사 여부 */
  checkCycles?: boolean;
  /** 미사용 경로 검사 여부 */
  checkUnused?: boolean;
  /** 누락된 의존성 검사 여부 */
  checkMissingDeps?: boolean;
};

const DEFAULT_OPTIONS: ValidateDomainOptions = {
  checkCycles: true,
  checkUnused: true,
  checkMissingDeps: true,
};

/**
 * 도메인 정의 유효성 검증
 */
export function validateDomain<TData, TState>(
  domain: ManifestoDomain<TData, TState>,
  options: ValidateDomainOptions = DEFAULT_OPTIONS
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // 1. 기본 필드 검증
  if (!domain.id || domain.id.trim() === '') {
    issues.push({
      code: 'DOMAIN_ID_REQUIRED',
      message: 'Domain id is required',
      path: 'id',
      severity: 'error',
    });
  }

  if (!domain.name || domain.name.trim() === '') {
    issues.push({
      code: 'DOMAIN_NAME_REQUIRED',
      message: 'Domain name is required',
      path: 'name',
      severity: 'error',
    });
  }

  // 2. 모든 정의된 경로 수집
  const allPaths = collectAllPaths(domain);

  // 3. 누락된 의존성 검사
  if (options.checkMissingDeps) {
    const missingDeps = findMissingDependencies(domain, allPaths);
    issues.push(...missingDeps);
  }

  // 4. 순환 의존성 검사
  if (options.checkCycles) {
    const cycles = findCyclicDependencies(domain);
    issues.push(...cycles);
  }

  // 5. 액션 preconditions 검사
  const actionIssues = validateActions(domain, allPaths);
  issues.push(...actionIssues);

  return {
    valid: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
  };
}

/**
 * 도메인에 정의된 모든 경로 수집
 */
function collectAllPaths<TData, TState>(
  domain: ManifestoDomain<TData, TState>
): Set<SemanticPath> {
  const paths = new Set<SemanticPath>();

  // Sources
  for (const path of Object.keys(domain.paths.sources)) {
    paths.add(path);
  }

  // Derived
  for (const path of Object.keys(domain.paths.derived)) {
    paths.add(path);
  }

  // Async
  for (const path of Object.keys(domain.paths.async)) {
    paths.add(path);
    const asyncDef = domain.paths.async[path];
    if (asyncDef) {
      paths.add(asyncDef.resultPath);
      paths.add(asyncDef.loadingPath);
      paths.add(asyncDef.errorPath);
    }
  }

  // State paths from stateSchema (state.xxx paths are valid dependencies)
  if (domain.stateSchema && typeof domain.stateSchema === 'object') {
    // Handle Zod schema or plain object
    const shape = (domain.stateSchema as any).shape || (domain.stateSchema as any);
    if (shape && typeof shape === 'object') {
      for (const key of Object.keys(shape)) {
        paths.add(`state.${key}` as SemanticPath);
      }
    }
  }

  // Data paths from dataSchema (data.xxx paths are valid dependencies)
  if (domain.dataSchema && typeof domain.dataSchema === 'object') {
    const shape = (domain.dataSchema as any).shape || (domain.dataSchema as any);
    if (shape && typeof shape === 'object') {
      for (const key of Object.keys(shape)) {
        paths.add(`data.${key}` as SemanticPath);
      }
    }
  }

  return paths;
}

/**
 * 누락된 의존성 찾기
 */
function findMissingDependencies<TData, TState>(
  domain: ManifestoDomain<TData, TState>,
  allPaths: Set<SemanticPath>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Derived deps 검사
  for (const [path, def] of Object.entries(domain.paths.derived)) {
    for (const dep of def.deps) {
      if (!allPaths.has(dep) && !isBuiltInPath(dep)) {
        issues.push({
          code: 'MISSING_DEPENDENCY',
          message: `Derived path "${path}" depends on undefined path "${dep}"`,
          path,
          severity: 'error',
        });
      }
    }
  }

  // Async deps 검사
  for (const [path, def] of Object.entries(domain.paths.async)) {
    for (const dep of def.deps) {
      if (!allPaths.has(dep) && !isBuiltInPath(dep)) {
        issues.push({
          code: 'MISSING_DEPENDENCY',
          message: `Async path "${path}" depends on undefined path "${dep}"`,
          path,
          severity: 'error',
        });
      }
    }
  }

  // Action deps 검사
  for (const [actionId, def] of Object.entries(domain.actions)) {
    for (const dep of def.deps) {
      if (!allPaths.has(dep) && !isBuiltInPath(dep)) {
        issues.push({
          code: 'MISSING_DEPENDENCY',
          message: `Action "${actionId}" depends on undefined path "${dep}"`,
          path: `actions.${actionId}`,
          severity: 'error',
        });
      }
    }
  }

  return issues;
}

/**
 * 순환 의존성 찾기 (DFS)
 */
function findCyclicDependencies<TData, TState>(
  domain: ManifestoDomain<TData, TState>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 의존성 그래프 구축
  const graph = new Map<SemanticPath, SemanticPath[]>();

  for (const [path, def] of Object.entries(domain.paths.derived)) {
    graph.set(path, def.deps);
  }

  for (const [path, def] of Object.entries(domain.paths.async)) {
    graph.set(path, def.deps);
  }

  // DFS로 순환 탐지
  const visited = new Set<SemanticPath>();
  const recursionStack = new Set<SemanticPath>();

  function dfs(node: SemanticPath, pathStack: SemanticPath[]): boolean {
    visited.add(node);
    recursionStack.add(node);

    const deps = graph.get(node) ?? [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        if (dfs(dep, [...pathStack, dep])) {
          return true;
        }
      } else if (recursionStack.has(dep)) {
        const cycleStart = pathStack.indexOf(dep);
        const cycle = pathStack.slice(cycleStart).concat(dep);
        issues.push({
          code: 'CYCLIC_DEPENDENCY',
          message: `Cyclic dependency detected: ${cycle.join(' -> ')}`,
          path: node,
          severity: 'error',
        });
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node, [node]);
    }
  }

  return issues;
}

/**
 * 액션 유효성 검사
 */
function validateActions<TData, TState>(
  domain: ManifestoDomain<TData, TState>,
  allPaths: Set<SemanticPath>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [actionId, def] of Object.entries(domain.actions)) {
    // Preconditions 경로 검사
    if (def.preconditions) {
      for (const cond of def.preconditions) {
        if (!allPaths.has(cond.path) && !isBuiltInPath(cond.path)) {
          issues.push({
            code: 'INVALID_PRECONDITION_PATH',
            message: `Action "${actionId}" has precondition referencing undefined path "${cond.path}"`,
            path: `actions.${actionId}`,
            severity: 'error',
          });
        }
      }
    }

    // Semantic verb 필수
    if (!def.semantic.verb || def.semantic.verb.trim() === '') {
      issues.push({
        code: 'ACTION_VERB_REQUIRED',
        message: `Action "${actionId}" requires a verb in semantic metadata`,
        path: `actions.${actionId}`,
        severity: 'warning',
      });
    }
  }

  return issues;
}

/**
 * 빌트인 경로 여부 확인 ($ 등)
 */
function isBuiltInPath(path: SemanticPath): boolean {
  return path.startsWith('$');
}
