/**
 * Pass Base - Pass 인터페이스 정의
 *
 * Pass는 Artifact를 분석하여 Finding을 추출하고,
 * Finding을 Fragment로 변환하는 컴파일러의 핵심 단위입니다.
 *
 * PASS_OWNERSHIP.md 문서를 참고하여 각 Pass의 책임을 확인하세요.
 */

import type { Artifact, SelectionSpan } from '../types/artifact.js';
import type { Fragment } from '../types/fragment.js';
import type { FragmentDraft } from '../types/fragment-draft.js';
import type { Provenance } from '../types/provenance.js';

// ============================================================================
// Finding Types
// ============================================================================

/**
 * Finding 종류
 */
export type FindingKind =
  | 'variable_declaration' // 변수 선언
  | 'function_declaration' // 함수 선언
  | 'function_call' // 함수 호출
  | 'assignment' // 할당문
  | 'if_statement' // 조건문
  | 'binary_expression' // 이항 표현식
  | 'member_expression' // 멤버 접근
  | 'return_statement' // 반환문
  | 'block_statement' // 블록문
  | 'type_annotation' // 타입 어노테이션
  | 'nl_entity' // 자연어 엔티티
  | 'nl_action' // 자연어 액션
  | 'nl_condition' // 자연어 조건
  | 'unknown'; // 알 수 없는 종류

/**
 * Finding - Pass가 Artifact에서 추출한 정보
 *
 * AST 노드, 자연어 문장 등에서 추출한 중간 정보로,
 * 이후 Fragment로 변환됩니다.
 */
export interface Finding {
  /** Finding 고유 ID */
  id: string;
  /** Finding 종류 */
  kind: FindingKind;
  /** 추출한 Pass 이름 */
  passName: string;
  /** 원본 Artifact ID */
  artifactId: string;

  /**
   * AST 노드 참조 (Code Pass용)
   * SWC AST 노드의 type과 span 정보
   */
  astNode?: {
    type: string;
    span: {
      start: number;
      end: number;
      ctxt?: number;
    };
  };

  /**
   * 추출한 데이터
   * Pass마다 다른 구조를 가짐
   */
  data: FindingData;

  /** Provenance */
  provenance: Provenance;

  /** 연관된 다른 Finding ID */
  relatedFindings?: string[];
}

/**
 * Finding 데이터 (Pass별로 다름)
 */
export type FindingData =
  | VariableDeclarationData
  | FunctionDeclarationData
  | FunctionCallData
  | AssignmentData
  | IfStatementData
  | BinaryExpressionData
  | TypeAnnotationData
  | NLEntityData
  | NLActionData
  | NLConditionData
  | UnknownData;

/**
 * 변수 선언 데이터
 */
export interface VariableDeclarationData {
  kind: 'variable_declaration';
  name: string;
  varKind: 'const' | 'let' | 'var';
  typeAnnotation?: string;
  initialValue?: unknown;
  sourceCode: string;
}

/**
 * 함수 선언 데이터
 */
export interface FunctionDeclarationData {
  kind: 'function_declaration';
  name: string;
  params: Array<{ name: string; type?: string }>;
  returnType?: string;
  isAsync: boolean;
  sourceCode: string;
}

/**
 * 함수 호출 데이터
 */
export interface FunctionCallData {
  kind: 'function_call';
  callee: string;
  arguments: unknown[];
  sourceCode: string;
}

/**
 * 할당문 데이터
 */
export interface AssignmentData {
  kind: 'assignment';
  target: string;
  operator: '=' | '+=' | '-=' | '*=' | '/=';
  value: unknown;
  sourceCode: string;
}

/**
 * 조건문 데이터
 */
export interface IfStatementData {
  kind: 'if_statement';
  condition: unknown;
  consequentFindings: string[];
  alternateFindings?: string[];
  sourceCode: string;
}

/**
 * 이항 표현식 데이터
 */
export interface BinaryExpressionData {
  kind: 'binary_expression';
  operator: string;
  left: unknown;
  right: unknown;
  sourceCode: string;
}

/**
 * 타입 어노테이션 데이터
 */
export interface TypeAnnotationData {
  kind: 'type_annotation';
  typeName: string;
  isOptional: boolean;
  isArray: boolean;
  sourceCode: string;
}

/**
 * 자연어 엔티티 데이터
 */
export interface NLEntityData {
  kind: 'nl_entity';
  name: string;
  description: string;
  inferredType?: string;
  confidence: number;
}

/**
 * 자연어 액션 데이터
 */
export interface NLActionData {
  kind: 'nl_action';
  verb: string;
  target?: string;
  description: string;
  confidence: number;
}

/**
 * 자연어 조건 데이터
 */
export interface NLConditionData {
  kind: 'nl_condition';
  subject: string;
  predicate: string;
  description: string;
  confidence: number;
}

/**
 * 알 수 없는 데이터
 */
export interface UnknownData {
  kind: 'unknown';
  raw: unknown;
}

// ============================================================================
// Pass Context
// ============================================================================

/**
 * Pass 실행 컨텍스트
 *
 * Pass 실행에 필요한 공유 정보를 제공합니다.
 */
export interface PassContext {
  /** 현재 처리 중인 Artifact */
  artifact: Artifact;

  /** 선택 영역 (부분 컴파일 시) */
  selection?: SelectionSpan;

  /** 이전 Pass에서 추출한 Finding */
  previousFindings: Finding[];

  /** 다른 Pass에서 생성한 Fragment */
  existingFragments: Fragment[];

  /** 기존 Semantic Path 목록 */
  existingPaths: string[];

  /**
   * Finding 생성 헬퍼
   */
  createFinding(
    kind: FindingKind,
    data: FindingData,
    provenance: Provenance,
    astNode?: Finding['astNode']
  ): Finding;

  /**
   * 로깅
   */
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown): void;
}

// ============================================================================
// Pass Interface
// ============================================================================

/**
 * Pass 인터페이스
 *
 * 각 Pass는 이 인터페이스를 구현합니다.
 *
 * 주요 메서드:
 * - supports(): 이 Artifact를 처리할 수 있는지 확인
 * - analyze(): Artifact에서 Finding 추출
 * - compile(): Finding을 Fragment로 변환
 */
export interface Pass {
  /** Pass 이름 (고유) */
  readonly name: string;

  /**
   * Pass 우선순위 (낮을수록 먼저 실행)
   *
   * 일반적인 우선순위:
   * - 0-99: AST 추출 Pass
   * - 100-199: Schema Pass
   * - 200-299: Expression Pass
   * - 300-399: Effect Pass
   * - 400-499: Policy Pass
   * - 500-599: Action Pass
   * - 900-999: NL Pass (병렬 실행 가능)
   */
  readonly priority: number;

  /**
   * 의존하는 Pass 이름 목록
   *
   * 이 Pass는 나열된 Pass가 완료된 후에 실행됩니다.
   */
  readonly dependsOn?: string[];

  /**
   * Pass 카테고리
   */
  readonly category: 'extractor' | 'lowering' | 'nl';

  /**
   * 이 Artifact를 처리할 수 있는지 확인
   */
  supports(artifact: Artifact): boolean;

  /**
   * Artifact에서 Finding 추출
   *
   * @param ctx Pass 컨텍스트
   * @returns 추출된 Finding 배열
   */
  analyze(ctx: PassContext): Finding[];

  /**
   * Finding을 Fragment로 변환
   *
   * @param findings 이 Pass가 추출한 Finding
   * @param ctx Pass 컨텍스트
   * @returns 생성된 Fragment 배열
   */
  compile(findings: Finding[], ctx: PassContext): Fragment[];
}

/**
 * NL Pass 인터페이스 (LLM 사용)
 *
 * 일반 Pass와 달리 비동기로 동작하며,
 * Fragment 대신 FragmentDraft를 생성합니다.
 */
export interface NLPass extends Omit<Pass, 'compile'> {
  readonly category: 'nl';

  /**
   * Finding을 FragmentDraft로 변환 (비동기)
   *
   * AGENT_README Invariant #2: LLM은 비신뢰 제안자
   * - FragmentDraft만 생성 (Fragment 아님)
   * - Deterministic Lowering으로 검증 후 Fragment 변환
   */
  compile(findings: Finding[], ctx: PassContext): Promise<FragmentDraft[]>;
}

/**
 * Pass가 NLPass인지 확인
 */
export function isNLPass(pass: Pass | NLPass): pass is NLPass {
  return pass.category === 'nl';
}

// ============================================================================
// Pass Result
// ============================================================================

/**
 * Pass 실행 결과
 */
export interface PassResult {
  /** Pass 이름 */
  passName: string;
  /** 추출된 Finding */
  findings: Finding[];
  /** 생성된 Fragment */
  fragments: Fragment[];
  /** NL Pass인 경우 생성된 Draft */
  drafts?: FragmentDraft[];
  /** 실행 시간 (ms) */
  duration: number;
  /** 오류 (있는 경우) */
  error?: Error;
}

// ============================================================================
// Helper Functions
// ============================================================================

let findingCounter = 0;

/**
 * Finding ID 생성
 */
export function createFindingId(passName: string): string {
  findingCounter++;
  return `finding_${passName}_${findingCounter}_${Date.now().toString(36)}`;
}

/**
 * PassContext 생성 헬퍼
 */
export function createPassContext(
  artifact: Artifact,
  options: {
    selection?: SelectionSpan;
    previousFindings?: Finding[];
    existingFragments?: Fragment[];
    existingPaths?: string[];
    logger?: (level: string, message: string, data?: unknown) => void;
  } = {}
): PassContext {
  return {
    artifact,
    selection: options.selection,
    previousFindings: options.previousFindings ?? [],
    existingFragments: options.existingFragments ?? [],
    existingPaths: options.existingPaths ?? [],
    createFinding(kind, data, provenance, astNode) {
      return {
        id: createFindingId('ctx'),
        kind,
        passName: 'context',
        artifactId: artifact.id,
        data,
        provenance,
        astNode,
      };
    },
    log(level, message, data) {
      if (options.logger) {
        options.logger(level, message, data);
      } else {
        // eslint-disable-next-line no-console
        console.log(`[${level}] ${message}`, data ?? '');
      }
    },
  };
}
