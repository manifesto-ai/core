# Contributing to Manifesto

Thank you for your interest in contributing to Manifesto! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Submitting Changes](#submitting-changes)
- [Review Process](#review-process)

---

## Code of Conduct

This project follows a standard code of conduct. Please be respectful and constructive in all interactions.

### Our Standards

- Be respectful and inclusive
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

---

## Getting Started

### Prerequisites

- **Node.js**: >= 20.0.0
- **pnpm**: >= 9.0.0
- **Git**: Latest version recommended

### First-Time Setup

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/manifesto-ai.git
cd manifesto-ai
```

3. Add the upstream remote:

```bash
git remote add upstream https://github.com/anthropics/manifesto-ai.git
```

4. Install dependencies:

```bash
pnpm install
```

5. Build all packages:

```bash
pnpm build
```

6. Run tests to verify setup:

```bash
pnpm test
```

---

## Development Setup

### Install Dependencies

```bash
pnpm install
```

### Build Packages

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @manifesto-ai/schema build
pnpm --filter @manifesto-ai/engine build
pnpm --filter @manifesto-ai/react build
pnpm --filter @manifesto-ai/vue build
```

### Run Tests

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @manifesto-ai/schema test
pnpm --filter @manifesto-ai/engine test
pnpm --filter @manifesto-ai/react test
pnpm --filter @manifesto-ai/vue test

# Run tests in watch mode
pnpm --filter @manifesto-ai/engine test -- --watch
```

### Start Storybook

```bash
# React Storybook
pnpm storybook:react

# Vue Storybook
pnpm storybook:vue

# Both
pnpm storybook:all
```

### Type Checking

```bash
pnpm typecheck
```

### Linting

```bash
pnpm lint
```

### Formatting

```bash
pnpm format
```

---

## Project Structure

```
manifesto-ai/
├── packages/
│   ├── schema/           # Schema types and builder APIs
│   │   ├── src/
│   │   │   ├── types/    # TypeScript interfaces
│   │   │   ├── primitives/ # Builder functions
│   │   │   └── combinators/ # Composition utilities
│   │   └── tests/
│   │
│   ├── engine/           # Core runtime engine
│   │   ├── src/
│   │   │   ├── runtime/  # FormRuntime
│   │   │   ├── evaluator/ # Expression evaluation
│   │   │   ├── tracker/  # Dependency tracking
│   │   │   ├── loader/   # Schema loading
│   │   │   └── adapter/  # Legacy adapters
│   │   └── tests/
│   │
│   ├── react/            # React bindings
│   │   ├── src/
│   │   │   ├── components/ # React components
│   │   │   └── hooks/    # React hooks
│   │   └── tests/
│   │
│   ├── vue/              # Vue bindings
│   │   ├── src/
│   │   │   ├── components/ # Vue components
│   │   │   └── composables/ # Vue composables
│   │   └── tests/
│   │
│   └── example-schemas/  # Example schemas
│
├── apps/
│   ├── storybook-react/  # React component showcase
│   └── storybook-vue/    # Vue component showcase
│
├── docs/                 # Documentation
│
└── tools/                # Build and development tools
```

---

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions/changes

Examples:

```bash
git checkout -b feature/add-color-picker-field
git checkout -b fix/expression-evaluator-null-handling
git checkout -b docs/add-migration-guide
```

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
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

Examples:

```
feat(schema): add colorPicker field type

fix(engine): handle null values in expression evaluation

docs(react): add useFormRuntime hook documentation

refactor(tracker): simplify dependency graph algorithm
```

### Creating a Changeset

For any changes that affect published packages, create a changeset:

```bash
pnpm changeset
```

Follow the prompts to:
1. Select affected packages
2. Choose bump type (patch/minor/major)
3. Write a summary

---

## Coding Standards

### TypeScript

- Use strict mode (enabled in tsconfig)
- Prefer `interface` over `type` for object shapes
- Use explicit return types for public functions
- Document public APIs with JSDoc comments

### Naming Conventions

- **Files**: kebab-case (`expression-evaluator.ts`)
- **Classes**: PascalCase (`ExpressionEvaluator`)
- **Functions/Methods**: camelCase (`evaluateExpression`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_TIMEOUT`)
- **Types/Interfaces**: PascalCase (`FormState`)

### Code Style

- 2 spaces for indentation
- Single quotes for strings
- No semicolons (enforced by Prettier)
- Max line length: 100 characters

### Best Practices

1. **Keep functions small**: Single responsibility
2. **Avoid side effects**: Prefer pure functions
3. **Use immutability**: Don't mutate input arguments
4. **Handle errors**: Use Result types instead of throwing
5. **Write descriptive names**: Self-documenting code

### Example

```typescript
/**
 * Evaluates an expression against the given context.
 *
 * @param expression - The expression to evaluate
 * @param context - The evaluation context
 * @returns Result containing the value or an error
 *
 * @example
 * ```typescript
 * const result = evaluateExpression(
 *   ['>', '$state.age', 18],
 *   { state: { age: 21 } }
 * )
 * // result.value === true
 * ```
 */
export function evaluateExpression(
  expression: Expression,
  context: EvaluationContext
): Result<unknown, EvaluationError> {
  // Implementation
}
```

---

## Testing

### Test Structure

```
packages/
└── engine/
    ├── src/
    │   └── evaluator/
    │       └── evaluator.ts
    └── tests/
        └── evaluator/
            └── evaluator.test.ts
```

### Writing Tests

Use descriptive test names:

```typescript
describe('ExpressionEvaluator', () => {
  describe('comparison operators', () => {
    it('evaluates equality with matching values', () => {
      // Test
    })

    it('handles null values gracefully', () => {
      // Test
    })

    it('returns error for invalid operator', () => {
      // Test
    })
  })
})
```

### Test Categories

1. **Unit Tests**: Test individual functions/classes
2. **Integration Tests**: Test module interactions
3. **Component Tests**: Test React/Vue components

### Running Tests

```bash
# All tests
pnpm test

# With coverage (all packages)
pnpm test:coverage

# With coverage (single package)
pnpm --filter @manifesto-ai/schema test:coverage

# Specific file
pnpm --filter @manifesto-ai/engine test -- evaluator.test.ts

# Watch mode
pnpm --filter @manifesto-ai/engine test -- --watch
```

---

## Documentation

### Where to Document

| Type | Location |
|------|----------|
| API Reference | JSDoc in source code |
| Guides | `/docs/guides/` |
| Architecture | `/docs/architecture.md` |
| Package README | `/packages/*/README.md` |

### JSDoc Guidelines

```typescript
/**
 * Brief description of what this does.
 *
 * Longer description if needed, explaining behavior,
 * edge cases, and important notes.
 *
 * @param name - Description of parameter
 * @returns Description of return value
 * @throws {ErrorType} When this error occurs
 *
 * @example
 * ```typescript
 * // Example usage
 * const result = myFunction('input')
 * ```
 *
 * @see RelatedFunction
 * @since 0.1.0
 */
```

### Documentation Standards

1. Every public API must have JSDoc
2. Include at least one example
3. Document all parameters and return values
4. Explain any non-obvious behavior

---

## Submitting Changes

### Before Submitting

1. Run all checks:

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

2. Create changeset (if needed):

```bash
pnpm changeset
```

3. Update documentation if you changed APIs

### Pull Request Process

1. Push your branch:

```bash
git push origin feature/your-feature
```

2. Create a pull request on GitHub

3. Fill out the PR template:
   - Description of changes
   - Related issues
   - Testing performed
   - Screenshots (if UI changes)

4. Wait for CI to pass

5. Request review from maintainers

### PR Title Format

Follow the same format as commits:

```
feat(schema): add colorPicker field type
fix(engine): handle null values in expression evaluation
docs(react): add useFormRuntime hook documentation
```

---

## Review Process

### What Reviewers Look For

1. **Correctness**: Does the code work as intended?
2. **Tests**: Are there adequate tests?
3. **Documentation**: Is the code documented?
4. **Style**: Does it follow coding standards?
5. **Performance**: Any performance concerns?
6. **Security**: Any security issues?

### Responding to Feedback

- Address all comments
- Explain your reasoning if you disagree
- Mark resolved comments
- Request re-review when ready

### Merge Requirements

- All CI checks passing
- At least one approving review
- All conversations resolved
- Changeset included (if applicable)

---

## Getting Help

### Resources

- [Documentation](./docs/README.md)
- [Architecture Guide](./docs/architecture.md)
- [API Reference](./docs/api-reference/)

### Asking Questions

- Check existing issues first
- Use GitHub Discussions for questions
- Be specific and provide context
- Include relevant code snippets

---

## Recognition

Contributors are recognized in:

- Release notes
- GitHub contributors page
- Special thanks in documentation

Thank you for contributing to Manifesto!

---

[Back to README](./README.md)
