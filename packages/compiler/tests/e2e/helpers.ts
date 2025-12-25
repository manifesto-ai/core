/**
 * E2E Test Helpers
 *
 * Common fixtures, utilities, and mock implementations for E2E tests.
 */

import type { Compiler, CompilerSession } from '../../src/types/compiler.js';
import type { CodeArtifact, TextArtifact, ManifestoArtifact, CompileInput } from '../../src/types/artifact.js';
import type { Fragment } from '../../src/types/fragment.js';
import type { FragmentDraft } from '../../src/types/fragment-draft.js';
import type { LLMAdapter, LLMContext } from '../../src/types/session.js';
import { createCompiler } from '../../src/compiler.js';
import { createCompilerSession } from '../../src/session.js';

// ============================================================================
// Fixtures
// ============================================================================

/**
 * Create a test compiler with default configuration
 */
export function createTestCompiler(config?: Partial<Parameters<typeof createCompiler>[0]>): Compiler {
  return createCompiler({
    coreVersion: '0.3.0',
    ...config,
  });
}

/**
 * Create a test session with default configuration
 */
export function createTestSession(config?: Partial<Parameters<typeof createCompiler>[0]>): CompilerSession {
  const compiler = createTestCompiler(config);
  return createCompilerSession(compiler);
}

/**
 * Create a code artifact for testing
 */
export function createCodeArtifact(
  content: string,
  id = 'test-artifact',
  language: 'ts' | 'js' = 'ts'
): CodeArtifact {
  return {
    id,
    kind: 'code',
    language,
    content,
    metadata: {},
  };
}

/**
 * Create a text artifact for testing
 */
export function createTextArtifact(
  content: string,
  id = 'test-text-artifact'
): TextArtifact {
  return {
    id,
    kind: 'text',
    content,
    metadata: {},
  };
}

/**
 * Create a manifesto artifact for testing
 */
export function createManifestoArtifact(
  fragments: Fragment[],
  id = 'test-manifesto-artifact'
): ManifestoArtifact {
  return {
    id,
    kind: 'manifesto',
    fragments,
    metadata: {},
  };
}

// ============================================================================
// Sample Code Snippets
// ============================================================================

/**
 * Sample TypeScript code with a simple schema
 */
export const SAMPLE_USER_SCHEMA = `
interface User {
  id: string;
  name: string;
  email: string;
  age?: number;
}
`;

/**
 * Sample TypeScript code with derived value
 */
export const SAMPLE_DERIVED_VALUE = `
// Derived: fullName = firstName + " " + lastName
const fullName = firstName + " " + lastName;
`;

/**
 * Sample TypeScript code with an action
 */
export const SAMPLE_ACTION = `
function updateUserEmail(userId: string, newEmail: string) {
  // Effect: API call to update email
  return fetch(\`/api/users/\${userId}/email\`, {
    method: 'PUT',
    body: JSON.stringify({ email: newEmail }),
  });
}
`;

/**
 * Sample TypeScript code with state management
 */
export const SAMPLE_STATE_CODE = `
// State variables
let isLoading: boolean = false;
let errorMessage: string | null = null;
let selectedUserId: string | null = null;

// Derived state
const hasError = errorMessage !== null;
const isUserSelected = selectedUserId !== null;
`;

/**
 * Complex sample with multiple features
 */
export const SAMPLE_COMPLETE_APP = `
// Data schema
interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartItem {
  productId: string;
  quantity: number;
}

// State
let cart: CartItem[] = [];
let isCheckingOut: boolean = false;

// Derived values
const cartTotal = cart.reduce((sum, item) => {
  const product = products.find(p => p.id === item.productId);
  return sum + (product?.price ?? 0) * item.quantity;
}, 0);

const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

// Actions
function addToCart(productId: string, quantity: number) {
  cart = [...cart, { productId, quantity }];
}

function checkout() {
  if (cart.length === 0) return;
  isCheckingOut = true;
  // API call would go here
}
`;

// ============================================================================
// Mock LLM Adapter
// ============================================================================

/**
 * Create a mock LLM adapter that returns predefined drafts
 */
export function createMockLLMAdapter(drafts: FragmentDraft[]): LLMAdapter {
  return {
    modelId: 'mock-model',
    maxConfidence: 0.9,
    async generateDrafts(_input: string, _context: LLMContext): Promise<FragmentDraft[]> {
      return drafts;
    },
  };
}

/**
 * Create a mock LLM adapter that fails
 */
export function createFailingLLMAdapter(error: Error): LLMAdapter {
  return {
    modelId: 'failing-model',
    maxConfidence: 0.9,
    async generateDrafts(): Promise<FragmentDraft[]> {
      throw error;
    },
  };
}

/**
 * Create sample fragment drafts for testing NL pipeline
 */
export function createSampleDrafts(): FragmentDraft[] {
  return [
    {
      kind: 'SchemaFragment',
      namespace: 'data',
      fields: [
        { path: 'user.name', type: 'string' },
        { path: 'user.email', type: 'string' },
      ],
      provisionalRequires: [],
      provisionalProvides: ['data.user.name', 'data.user.email'],
      status: 'raw',
      origin: {
        artifactId: 'nl-input',
        location: { kind: 'llm', model: 'mock-model', promptHash: 'test123' },
      },
      confidence: 0.85,
      reasoning: 'User schema with name and email fields',
    } as FragmentDraft,
    {
      kind: 'SourceFragment',
      path: 'data.user.name',
      semantic: {
        type: 'string',
        description: 'User display name',
      },
      provisionalRequires: [],
      provisionalProvides: ['data.user.name'],
      status: 'raw',
      origin: {
        artifactId: 'nl-input',
        location: { kind: 'llm', model: 'mock-model', promptHash: 'test123' },
      },
      confidence: 0.8,
      reasoning: 'Source for user name',
    } as FragmentDraft,
  ];
}

// ============================================================================
// Assertions
// ============================================================================

/**
 * Assert that compilation succeeded
 */
export function assertCompileSuccess(result: Awaited<ReturnType<Compiler['compile']>>): void {
  if (result.issues.some((i) => i.severity === 'error')) {
    const errors = result.issues.filter((i) => i.severity === 'error');
    throw new Error(`Compilation failed with errors: ${JSON.stringify(errors, null, 2)}`);
  }
}

/**
 * Assert that fragments contain expected paths
 */
export function assertFragmentsPaths(
  fragments: Fragment[],
  expectedPaths: string[]
): void {
  const allPaths = new Set(fragments.flatMap((f) => f.provides));

  for (const path of expectedPaths) {
    if (!allPaths.has(path)) {
      throw new Error(`Expected path "${path}" not found in fragments. Found: ${[...allPaths].join(', ')}`);
    }
  }
}

/**
 * Assert no blocking issues
 */
export function assertNoBlockingIssues(result: Awaited<ReturnType<Compiler['compile']>>): void {
  const blockingIssues = result.issues.filter((i) => i.severity === 'error');
  if (blockingIssues.length > 0) {
    throw new Error(`Found ${blockingIssues.length} blocking issues: ${JSON.stringify(blockingIssues, null, 2)}`);
  }
}

/**
 * Assert no conflicts
 */
export function assertNoConflicts(result: Awaited<ReturnType<Compiler['compile']>>): void {
  if (result.conflicts.length > 0) {
    throw new Error(`Found ${result.conflicts.length} conflicts: ${JSON.stringify(result.conflicts, null, 2)}`);
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Count fragments by kind
 */
export function countFragmentsByKind(fragments: Fragment[]): Record<string, number> {
  return fragments.reduce(
    (acc, f) => {
      acc[f.kind] = (acc[f.kind] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
}

/**
 * Get all paths provided by fragments
 */
export function getAllPaths(fragments: Fragment[]): string[] {
  return [...new Set(fragments.flatMap((f) => f.provides))];
}

/**
 * Find fragment by path
 */
export function findFragmentByPath(fragments: Fragment[], path: string): Fragment | undefined {
  return fragments.find((f) => f.provides.includes(path));
}

/**
 * Wait for session to reach a specific phase
 */
export async function waitForPhase(
  session: CompilerSession,
  targetPhase: string,
  timeoutMs = 5000
): Promise<void> {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const unsubscribe = session.onPhaseChange((phase) => {
      if (phase === targetPhase) {
        unsubscribe();
        resolve();
      }
    });

    // Timeout check
    const checkTimeout = setInterval(() => {
      if (Date.now() - start > timeoutMs) {
        unsubscribe();
        clearInterval(checkTimeout);
        reject(new Error(`Timeout waiting for phase "${targetPhase}"`));
      }
    }, 100);
  });
}
