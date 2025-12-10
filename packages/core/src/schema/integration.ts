import { z, type ZodType, type ZodTypeDef } from 'zod';
import type { SemanticPath, SourceDefinition, SemanticMeta } from '../domain/types.js';

/**
 * Zod 스키마에서 Manifesto SourceDefinition 생성
 */
export function schemaToSource<T>(
  schema: ZodType<T>,
  semantic: SemanticMeta,
  options?: {
    defaultValue?: T;
  }
): SourceDefinition {
  return {
    schema,
    defaultValue: options?.defaultValue,
    semantic: {
      readable: true,
      writable: true,
      ...semantic,
    },
  };
}

/**
 * 공통 스키마 타입들
 */
export const CommonSchemas = {
  /** 이메일 */
  email: () => z.string().email(),

  /** URL */
  url: () => z.string().url(),

  /** 전화번호 (한국) */
  phoneKR: () =>
    z.string().regex(/^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/, 'Invalid Korean phone number'),

  /** 사업자등록번호 */
  businessNumber: () =>
    z.string().regex(/^[0-9]{3}-?[0-9]{2}-?[0-9]{5}$/, 'Invalid business number'),

  /** 양의 정수 */
  positiveInt: () => z.number().int().positive(),

  /** 비음수 정수 */
  nonNegativeInt: () => z.number().int().nonnegative(),

  /** 금액 */
  money: () => z.number().nonnegative(),

  /** 퍼센트 (0-100) */
  percent: () => z.number().min(0).max(100),

  /** 날짜 문자열 (ISO) */
  dateString: () => z.string().datetime(),

  /** ID 문자열 */
  id: () => z.string().min(1),

  /** 선택 옵션 */
  selectOption: <T extends string>(options: readonly T[]) => z.enum(options as [T, ...T[]]),

  /** nullable 래퍼 */
  nullable: <T>(schema: ZodType<T>) => schema.nullable(),

  /** optional 래퍼 */
  optional: <T>(schema: ZodType<T>) => schema.optional(),

  /** 배열 */
  array: <T>(schema: ZodType<T>) => z.array(schema),

  /** 레코드 */
  record: <T>(schema: ZodType<T>) => z.record(schema),
} as const;

/**
 * 스키마 조합 유틸리티
 */
export const SchemaUtils = {
  /**
   * 조건부 필수 스키마 생성
   */
  conditionalRequired<T>(
    schema: ZodType<T>,
    condition: (ctx: unknown) => boolean
  ): ZodType<T | undefined> {
    return schema.optional().superRefine((val, ctx) => {
      // 실제 조건 평가는 런타임에서 수행
      // 여기서는 타입만 정의
    });
  },

  /**
   * 상호 의존 스키마 (둘 중 하나 필수)
   */
  eitherRequired<T, U>(
    schema1: ZodType<T>,
    schema2: ZodType<U>
  ): ZodType<{ field1?: T; field2?: U }> {
    return z
      .object({
        field1: schema1.optional(),
        field2: schema2.optional(),
      })
      .refine((data) => data.field1 !== undefined || data.field2 !== undefined, {
        message: 'At least one field is required',
      });
  },

  /**
   * 범위 스키마 (min/max)
   */
  range(min: number, max: number): ZodType<number> {
    return z.number().min(min).max(max);
  },

  /**
   * 길이 제한 문자열
   */
  stringLength(min: number, max: number): ZodType<string> {
    return z.string().min(min).max(max);
  },

  /**
   * enum 유니온
   */
  enumUnion<T extends string>(...values: T[]): ZodType<T> {
    if (values.length === 0) {
      throw new Error('At least one value is required');
    }
    return z.enum(values as [T, ...T[]]);
  },
};

/**
 * 스키마에서 기본값 추출
 */
export function getSchemaDefault<T>(schema: ZodType<T>): T | undefined {
  try {
    // Zod 스키마에서 기본값 추출 시도
    const def = (schema as ZodType<T, ZodTypeDef>)._def;
    if ('defaultValue' in def) {
      return (def as { defaultValue: () => T }).defaultValue();
    }
  } catch {
    // 기본값 없음
  }
  return undefined;
}

/**
 * 스키마 메타데이터 추출
 */
export function getSchemaMetadata(schema: ZodType): {
  type: string;
  isOptional: boolean;
  isNullable: boolean;
  description?: string;
} {
  const def = schema._def as { typeName?: string; description?: string };

  let isOptional = false;
  let isNullable = false;
  let currentSchema = schema;
  let currentDef = def;

  // 래퍼 스키마 언래핑
  while (true) {
    if (currentDef.typeName === 'ZodOptional') {
      isOptional = true;
      currentSchema = (currentDef as { innerType: ZodType }).innerType;
      currentDef = currentSchema._def as typeof def;
    } else if (currentDef.typeName === 'ZodNullable') {
      isNullable = true;
      currentSchema = (currentDef as { innerType: ZodType }).innerType;
      currentDef = currentSchema._def as typeof def;
    } else {
      break;
    }
  }

  return {
    type: currentDef.typeName ?? 'unknown',
    isOptional,
    isNullable,
    description: currentDef.description,
  };
}

/**
 * Zod 스키마를 JSON Schema로 변환 (간략화)
 */
export function toJsonSchema(schema: ZodType): Record<string, unknown> {
  const meta = getSchemaMetadata(schema);

  const typeMap: Record<string, string> = {
    ZodString: 'string',
    ZodNumber: 'number',
    ZodBoolean: 'boolean',
    ZodArray: 'array',
    ZodObject: 'object',
    ZodNull: 'null',
  };

  const result: Record<string, unknown> = {
    type: typeMap[meta.type] ?? meta.type,
  };

  if (meta.description) {
    result.description = meta.description;
  }

  if (meta.isNullable) {
    result.nullable = true;
  }

  return result;
}
