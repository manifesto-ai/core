import { z, type ZodType, type ZodError, type ZodIssue } from 'zod';
import type {
  SemanticPath,
  ValidationResult,
  ValidationIssue,
  ManifestoDomain,
} from '../domain/types.js';
import type { Expression } from '../expression/types.js';

/**
 * Zod 에러를 ValidationResult로 변환
 */
export function zodErrorToValidationResult(
  error: ZodError,
  basePath: SemanticPath
): ValidationResult {
  const issues: ValidationIssue[] = error.issues.map((issue) =>
    zodIssueToValidationIssue(issue, basePath)
  );

  return {
    valid: false,
    issues,
  };
}

/**
 * Zod Issue를 ValidationIssue로 변환
 */
function zodIssueToValidationIssue(
  issue: ZodIssue,
  basePath: SemanticPath
): ValidationIssue {
  const pathSuffix = issue.path.join('.');
  const fullPath = pathSuffix ? `${basePath}.${pathSuffix}` : basePath;

  return {
    code: issue.code,
    message: issue.message,
    path: fullPath,
    severity: 'error',
    suggestedFix: generateSuggestedFix(issue),
  };
}

/**
 * 자동 수정 제안 생성
 */
function generateSuggestedFix(
  issue: ZodIssue
): ValidationIssue['suggestedFix'] | undefined {
  switch (issue.code) {
    case 'invalid_type':
      if (issue.expected === 'string' && issue.received === 'number') {
        return {
          description: 'Convert to string',
          value: ['toString', ['get', '$input']] as Expression,
        };
      }
      if (issue.expected === 'number' && issue.received === 'string') {
        return {
          description: 'Convert to number',
          value: ['toNumber', ['get', '$input']] as Expression,
        };
      }
      break;

    case 'too_small':
      if ('minimum' in issue) {
        return {
          description: `Set to minimum value (${issue.minimum})`,
          value: issue.minimum as number,
        };
      }
      break;

    case 'too_big':
      if ('maximum' in issue) {
        return {
          description: `Set to maximum value (${issue.maximum})`,
          value: issue.maximum as number,
        };
      }
      break;

    case 'invalid_string':
      if (issue.validation === 'email') {
        return {
          description: 'Enter a valid email address',
          value: null,
        };
      }
      break;
  }

  return undefined;
}

/**
 * 값 검증
 */
export function validateValue(
  schema: ZodType,
  value: unknown,
  path: SemanticPath
): ValidationResult {
  const result = schema.safeParse(value);

  if (result.success) {
    return { valid: true, issues: [] };
  }

  return zodErrorToValidationResult(result.error, path);
}

/**
 * 부분 데이터 검증
 */
export function validatePartial<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  data: Partial<z.infer<z.ZodObject<T>>>,
  basePath: SemanticPath
): ValidationResult {
  // Partial 스키마로 변환
  const partialSchema = schema.partial();
  return validateValue(partialSchema, data, basePath);
}

/**
 * 전체 도메인 데이터 검증
 */
export function validateDomainData<TData, TState>(
  domain: ManifestoDomain<TData, TState>,
  data: TData
): ValidationResult {
  const result = domain.dataSchema.safeParse(data);

  if (result.success) {
    return { valid: true, issues: [] };
  }

  return zodErrorToValidationResult(result.error, 'data');
}

/**
 * 필드별 검증 결과 수집
 */
export function validateFields<TData, TState>(
  domain: ManifestoDomain<TData, TState>,
  data: TData
): Record<SemanticPath, ValidationResult> {
  const results: Record<SemanticPath, ValidationResult> = {};

  for (const [path, source] of Object.entries(domain.paths.sources)) {
    const value = getNestedValue(data, path.replace('data.', ''));
    results[path] = validateValue(source.schema, value, path);
  }

  return results;
}

/**
 * 비동기 검증 (API 호출 등)
 */
export async function validateAsync(
  value: unknown,
  path: SemanticPath,
  validator: (value: unknown) => Promise<boolean | string>
): Promise<ValidationResult> {
  try {
    const result = await validator(value);

    if (result === true) {
      return { valid: true, issues: [] };
    }

    return {
      valid: false,
      issues: [
        {
          code: 'ASYNC_VALIDATION_FAILED',
          message: typeof result === 'string' ? result : 'Validation failed',
          path,
          severity: 'error',
        },
      ],
    };
  } catch (e) {
    return {
      valid: false,
      issues: [
        {
          code: 'ASYNC_VALIDATION_ERROR',
          message: e instanceof Error ? e.message : 'Validation error',
          path,
          severity: 'error',
        },
      ],
    };
  }
}

/**
 * 검증 결과 병합
 */
export function mergeValidationResults(
  ...results: ValidationResult[]
): ValidationResult {
  const allIssues: ValidationIssue[] = [];

  for (const result of results) {
    allIssues.push(...result.issues);
  }

  return {
    valid: allIssues.filter((i) => i.severity === 'error').length === 0,
    issues: allIssues,
  };
}

/**
 * 경로별 검증 결과 그룹화
 */
export function groupValidationByPath(
  result: ValidationResult
): Record<SemanticPath, ValidationIssue[]> {
  const grouped: Record<SemanticPath, ValidationIssue[]> = {};

  for (const issue of result.issues) {
    const pathIssues = grouped[issue.path];
    if (!pathIssues) {
      grouped[issue.path] = [];
    }
    grouped[issue.path]!.push(issue);
  }

  return grouped;
}

/**
 * 심각도별 이슈 필터링
 */
export function filterBySeverity(
  result: ValidationResult,
  severity: ValidationIssue['severity']
): ValidationIssue[] {
  return result.issues.filter((i) => i.severity === severity);
}

/**
 * 에러만 추출
 */
export function getErrors(result: ValidationResult): ValidationIssue[] {
  return filterBySeverity(result, 'error');
}

/**
 * 경고만 추출
 */
export function getWarnings(result: ValidationResult): ValidationIssue[] {
  return filterBySeverity(result, 'warning');
}

/**
 * 제안만 추출
 */
export function getSuggestions(result: ValidationResult): ValidationIssue[] {
  return filterBySeverity(result, 'suggestion');
}

/**
 * 중첩된 값 가져오기
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (!path) return obj;

  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
