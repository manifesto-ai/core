# Contributing to Manifesto AI

Thank you for your interest in contributing to Manifesto AI! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Coding Standards](#coding-standards)

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributors of all backgrounds and experience levels.

## Getting Started

### Prerequisites

- Node.js 22 or later
- pnpm 9.15 or later

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/manifesto-ai.git
cd manifesto-ai
```

3. Add the upstream repository:

```bash
git remote add upstream https://github.com/manifesto-ai/manifesto-ai.git
```

## Development Setup

### Install Dependencies

```bash
pnpm install
```

### Build All Packages

```bash
pnpm build
```

### Run Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests for a specific package
pnpm --filter @manifesto-ai/core test
```

### Type Checking

```bash
pnpm typecheck
```

## Project Structure

```
manifesto-ai/
├── packages/
│   ├── core/                    # Core runtime, domain, expressions, effects
│   ├── bridge/                  # Framework-agnostic bridge interfaces
│   ├── bridge-zustand/          # Zustand integration
│   ├── bridge-react-hook-form/  # React Hook Form integration
│   ├── projection-ui/           # UI state projection
│   ├── projection-agent/        # AI agent context projection
│   └── projection-graphql/      # GraphQL schema projection
├── docs/                        # Documentation
├── package.json                 # Root package.json
├── pnpm-workspace.yaml          # Workspace configuration
└── turbo.json                   # Turborepo configuration
```

### Package Structure

Each package follows this structure:

```
packages/{package-name}/
├── src/
│   ├── index.ts        # Main exports
│   └── ...             # Source files
├── tests/              # Test files
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## Making Changes

### Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-fix-name
```

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or fixes

### Development Workflow

1. Make your changes
2. Add or update tests
3. Ensure all tests pass: `pnpm test`
4. Ensure type checking passes: `pnpm typecheck`
5. Update documentation if needed

### Package-Specific Development

```bash
# Work on a specific package
cd packages/core

# Run tests in watch mode
pnpm test:watch

# Build the package
pnpm build

# Check types
pnpm typecheck
```

## Testing

### Test Requirements

- All new features must include tests
- Bug fixes should include regression tests
- Aim for >85% code coverage

### Running Tests

```bash
# All tests
pnpm test

# With coverage
pnpm test:coverage

# Specific package
pnpm --filter @manifesto-ai/core test

# Watch mode
pnpm --filter @manifesto-ai/core test:watch
```

### Writing Tests

Tests use [Vitest](https://vitest.dev/). Example:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createRuntime, defineDomain, z } from '../src/index.js';

describe('Runtime', () => {
  let runtime;

  beforeEach(() => {
    const domain = defineDomain('test', {
      dataSchema: z.object({ count: z.number() })
    });
    runtime = createRuntime(domain);
  });

  it('should get and set values', () => {
    runtime.set('data.count', 5);
    expect(runtime.get('data.count')).toBe(5);
  });

  it('should notify subscribers on change', () => {
    const callback = vi.fn();
    runtime.subscribe('data.count', callback);

    runtime.set('data.count', 10);

    expect(callback).toHaveBeenCalledWith(10);
  });
});
```

### Test File Location

- Place tests in `tests/` directory
- Mirror source structure: `src/domain/index.ts` → `tests/domain/index.test.ts`
- Use `.test.ts` extension

## Submitting Changes

### Commit Messages

Follow conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting, no code change
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

Examples:
```
feat(core): add support for async derived values
fix(bridge): resolve memory leak in subscription cleanup
docs(readme): update installation instructions
```

### Pull Request Process

1. Ensure your branch is up to date:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. Push your branch:
   ```bash
   git push origin feature/your-feature-name
   ```

3. Create a Pull Request on GitHub

4. Fill out the PR template with:
   - Description of changes
   - Related issue (if any)
   - Testing performed
   - Screenshots (if UI changes)

### PR Requirements

- [ ] Tests pass
- [ ] Type checking passes
- [ ] Documentation updated (if needed)
- [ ] Changelog entry added (for significant changes)
- [ ] PR description is complete

## Coding Standards

### TypeScript

- Use strict mode
- Prefer explicit types over inference for public APIs
- Use `unknown` over `any` when possible
- Export types separately from implementations

```typescript
// Good
export type { MyType } from './types.js';
export { myFunction } from './implementation.js';

// Avoid
export { MyType, myFunction } from './index.js';
```

### Code Style

- Use ESLint and Prettier configurations
- 2-space indentation
- Single quotes for strings
- Trailing commas in multi-line
- No semicolons (enforced by config)

### Documentation

- Add JSDoc comments for public APIs
- Include `@example` for complex functions
- Update README when adding features

```typescript
/**
 * Creates a runtime instance for the given domain.
 *
 * @param domain - The domain definition
 * @param options - Optional configuration
 * @returns A new runtime instance
 *
 * @example
 * ```typescript
 * const runtime = createRuntime(myDomain, {
 *   initialData: { count: 0 }
 * });
 * ```
 */
export function createRuntime<TData, TState>(
  domain: ManifestoDomain<TData, TState>,
  options?: CreateRuntimeOptions<TData, TState>
): DomainRuntime<TData, TState> {
  // ...
}
```

### Package Dependencies

- Core package should have minimal dependencies (only `zod`)
- Use peer dependencies for framework integrations
- Avoid circular dependencies between packages

### File Organization

- One concept per file
- Group related exports in barrel files (`index.ts`)
- Keep files under 500 lines when possible

## Questions?

If you have questions, please:

1. Check existing issues and discussions
2. Open a new issue with the `question` label
3. Join our community discussions

Thank you for contributing to Manifesto AI!
