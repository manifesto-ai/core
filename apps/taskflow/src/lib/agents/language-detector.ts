/**
 * Multi-Language Detection Module
 *
 * 다국어 입력에서 언어를 감지하고 라우팅 전략을 결정합니다.
 *
 * 직접 지원 언어 (ko/en): Pattern Matcher + Intent Compiler 직접 사용
 * 번역 필요 언어 (ja/zh/etc): 영어로 번역 후 처리
 */

// ============================================
// Types
// ============================================

/** 직접 지원하는 언어 */
export type SupportedLanguage = 'ko' | 'en';

/** 감지 가능한 모든 언어 */
export type DetectedLanguage =
  | SupportedLanguage
  | 'ja'      // 일본어
  | 'zh'      // 중국어
  | 'es'      // 스페인어
  | 'fr'      // 프랑스어
  | 'de'      // 독일어
  | 'pt'      // 포르투갈어
  | 'ru'      // 러시아어
  | 'ar'      // 아랍어
  | 'th'      // 태국어
  | 'vi'      // 베트남어
  | 'other';  // 기타 (라틴 문자 기반)

/** 언어 감지 결과 */
export interface LanguageDetectionResult {
  /** 감지된 언어 코드 */
  detected: DetectedLanguage;
  /** 감지 신뢰도 (0-1) */
  confidence: number;
  /** 직접 지원 언어 여부 (ko/en) */
  isDirectSupported: boolean;
  /** 번역이 필요한지 여부 */
  needsTranslation: boolean;
  /** 감지된 문자 체계 */
  script: 'hangul' | 'latin' | 'cjk' | 'cyrillic' | 'arabic' | 'thai' | 'other';
}

// ============================================
// Unicode Patterns for Language Detection
// ============================================

const LANGUAGE_PATTERNS = {
  // 한글 (Hangul)
  korean: /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/,

  // 일본어 (히라가나 + 가타카나)
  japaneseKana: /[\u3040-\u309F\u30A0-\u30FF]/,

  // 중국어/한자 (CJK Unified Ideographs)
  // 주의: 일본어 한자도 포함됨 - 가나와 함께 판단
  cjk: /[\u4E00-\u9FFF\u3400-\u4DBF]/,

  // 키릴 문자 (러시아어 등)
  cyrillic: /[\u0400-\u04FF]/,

  // 아랍 문자
  arabic: /[\u0600-\u06FF\u0750-\u077F]/,

  // 태국어
  thai: /[\u0E00-\u0E7F]/,

  // 베트남어 특수 문자 (라틴 + 성조 기호)
  vietnamese: /[\u00C0-\u00FF\u1EA0-\u1EF9]/,

  // 라틴 문자
  latin: /[a-zA-Z]/,

  // 스페인어/포르투갈어 특수 문자
  spanishPortuguese: /[áéíóúüñãõç]/i,

  // 프랑스어 특수 문자
  french: /[àâäéèêëïîôùûüÿœæç]/i,

  // 독일어 특수 문자
  german: /[äöüßÄÖÜ]/,
};

// ============================================
// Language Detection Logic
// ============================================

/**
 * 텍스트에서 언어를 감지하고 라우팅 전략을 결정
 *
 * @param text - 감지할 텍스트
 * @returns 언어 감지 결과
 */
export function detectLanguageExtended(text: string): LanguageDetectionResult {
  // 빈 문자열 처리
  if (!text || text.trim().length === 0) {
    return createResult('en', 0.5, 'latin');
  }

  const trimmed = text.trim();

  // 각 문자 체계의 비율 계산
  const charCounts = countCharacterTypes(trimmed);
  const totalChars = trimmed.replace(/\s/g, '').length;

  // 1. 한글 감지 (최우선)
  if (charCounts.korean > 0) {
    const ratio = charCounts.korean / totalChars;
    return createResult('ko', Math.min(0.9 + ratio * 0.1, 1), 'hangul');
  }

  // 2. 일본어 감지 (가나 문자 기반)
  if (charCounts.japaneseKana > 0) {
    const ratio = charCounts.japaneseKana / totalChars;
    return createResult('ja', Math.min(0.85 + ratio * 0.15, 1), 'cjk');
  }

  // 3. 중국어 감지 (CJK만 있고 가나가 없는 경우)
  if (charCounts.cjk > 0 && charCounts.japaneseKana === 0) {
    const ratio = charCounts.cjk / totalChars;
    return createResult('zh', Math.min(0.8 + ratio * 0.2, 1), 'cjk');
  }

  // 4. 키릴 문자 (러시아어 등)
  if (charCounts.cyrillic > 0) {
    const ratio = charCounts.cyrillic / totalChars;
    return createResult('ru', Math.min(0.85 + ratio * 0.15, 1), 'cyrillic');
  }

  // 5. 아랍어
  if (charCounts.arabic > 0) {
    const ratio = charCounts.arabic / totalChars;
    return createResult('ar', Math.min(0.85 + ratio * 0.15, 1), 'arabic');
  }

  // 6. 태국어
  if (charCounts.thai > 0) {
    const ratio = charCounts.thai / totalChars;
    return createResult('th', Math.min(0.85 + ratio * 0.15, 1), 'thai');
  }

  // 7. 라틴 문자 기반 언어 판별
  if (charCounts.latin > 0) {
    return detectLatinLanguage(trimmed, charCounts);
  }

  // 기타
  return createResult('other', 0.5, 'other');
}

// Common words for Latin language detection (when no special characters)
const GERMAN_KEYWORDS = /\b(ich|du|er|sie|es|wir|ihr|was|wie|wann|wo|warum|ist|sind|haben|sein|heute|morgen|soll|muss|kann|bitte|danke|guten|tag|auf|und|oder|nicht|ein|eine|der|die|das)\b/i;
const FRENCH_KEYWORDS = /\b(je|tu|il|elle|nous|vous|ils|elles|est|sont|avoir|être|quoi|comment|quand|où|pourquoi|aujourd'hui|demain|dois|peux|s'il|merci|bonjour|le|la|les|un|une|et|ou|ne|pas)\b/i;
const SPANISH_KEYWORDS = /\b(yo|tú|él|ella|nosotros|qué|cómo|cuándo|dónde|por qué|es|son|tener|ser|hoy|mañana|debo|puedo|por favor|gracias|hola|el|la|los|las|un|una|y|o|no)\b/i;

/**
 * 라틴 문자 기반 언어 판별 (영어, 스페인어, 프랑스어, 독일어, 포르투갈어, 베트남어)
 */
function detectLatinLanguage(
  text: string,
  charCounts: ReturnType<typeof countCharacterTypes>
): LanguageDetectionResult {
  // 베트남어 특수 문자가 많으면 베트남어
  if (charCounts.vietnamese > 2) {
    return createResult('vi', 0.8, 'latin');
  }

  // 독일어 특수 문자
  if (charCounts.german > 0) {
    return createResult('de', 0.75, 'latin');
  }

  // 프랑스어 특수 문자
  if (charCounts.french > 0) {
    return createResult('fr', 0.7, 'latin');
  }

  // 스페인어/포르투갈어 특수 문자
  if (charCounts.spanishPortuguese > 0) {
    // ñ는 스페인어에만 있음
    if (text.includes('ñ') || text.includes('Ñ')) {
      return createResult('es', 0.75, 'latin');
    }
    // ã, õ는 포르투갈어
    if (/[ãõÃÕ]/.test(text)) {
      return createResult('pt', 0.75, 'latin');
    }
    // 그 외는 스페인어로 추정
    return createResult('es', 0.65, 'latin');
  }

  // Keyword-based detection for languages without special characters
  if (GERMAN_KEYWORDS.test(text)) {
    return createResult('de', 0.7, 'latin');
  }

  if (FRENCH_KEYWORDS.test(text)) {
    return createResult('fr', 0.65, 'latin');
  }

  if (SPANISH_KEYWORDS.test(text)) {
    return createResult('es', 0.65, 'latin');
  }

  // 특수 문자 없는 라틴 문자 = 영어로 기본 처리
  return createResult('en', 0.85, 'latin');
}

/**
 * 문자 유형별 개수 계산
 */
function countCharacterTypes(text: string): Record<string, number> {
  const counts: Record<string, number> = {
    korean: 0,
    japaneseKana: 0,
    cjk: 0,
    cyrillic: 0,
    arabic: 0,
    thai: 0,
    vietnamese: 0,
    french: 0,
    german: 0,
    spanishPortuguese: 0,
    latin: 0,
  };

  for (const char of text) {
    if (LANGUAGE_PATTERNS.korean.test(char)) counts.korean++;
    else if (LANGUAGE_PATTERNS.japaneseKana.test(char)) counts.japaneseKana++;
    else if (LANGUAGE_PATTERNS.cjk.test(char)) counts.cjk++;
    else if (LANGUAGE_PATTERNS.cyrillic.test(char)) counts.cyrillic++;
    else if (LANGUAGE_PATTERNS.arabic.test(char)) counts.arabic++;
    else if (LANGUAGE_PATTERNS.thai.test(char)) counts.thai++;
    else if (LANGUAGE_PATTERNS.vietnamese.test(char)) counts.vietnamese++;
    else if (LANGUAGE_PATTERNS.german.test(char)) counts.german++;
    else if (LANGUAGE_PATTERNS.french.test(char)) counts.french++;
    else if (LANGUAGE_PATTERNS.spanishPortuguese.test(char)) counts.spanishPortuguese++;
    else if (LANGUAGE_PATTERNS.latin.test(char)) counts.latin++;
  }

  return counts;
}

/**
 * 결과 객체 생성 헬퍼
 */
function createResult(
  detected: DetectedLanguage,
  confidence: number,
  script: LanguageDetectionResult['script']
): LanguageDetectionResult {
  const isDirectSupported = detected === 'ko' || detected === 'en';

  return {
    detected,
    confidence,
    isDirectSupported,
    needsTranslation: !isDirectSupported,
    script,
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * 언어 코드를 사람이 읽을 수 있는 이름으로 변환
 */
export function getLanguageName(code: DetectedLanguage): string {
  const names: Record<DetectedLanguage, string> = {
    ko: 'Korean',
    en: 'English',
    ja: 'Japanese',
    zh: 'Chinese',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    pt: 'Portuguese',
    ru: 'Russian',
    ar: 'Arabic',
    th: 'Thai',
    vi: 'Vietnamese',
    other: 'Unknown',
  };
  return names[code] || 'Unknown';
}

/**
 * 기존 detectLanguage 호환 함수 (ko/en만 반환)
 * pattern-matcher.ts와의 하위 호환성 유지
 */
export function detectLanguage(text: string): 'ko' | 'en' {
  const result = detectLanguageExtended(text);
  return result.detected === 'ko' ? 'ko' : 'en';
}
