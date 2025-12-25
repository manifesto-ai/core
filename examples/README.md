# Manifesto Examples

This directory contains runnable example projects demonstrating Manifesto concepts.

## Examples Overview

| Example | Description | Concepts |
|---------|-------------|----------|
| [01-counter](./01-counter) | Simple counter | Source paths, Derived paths, useValue, useSetValue |
| [02-todo-list](./02-todo-list) | Todo list with CRUD | Arrays, Actions, State management |
| [03-form-validation](./03-form-validation) | Form with validation | Policies, Field validation, UI state |
| [04-async-data](./04-async-data) | Async data fetching | Async paths, Loading/Error states |
| [05-shopping-cart](./05-shopping-cart) | Shopping cart | Complex derived values, Multiple domains |
| [06-ai-agent](./06-ai-agent) | AI Agent integration | Projection, Agent context, Decision loop |

## Quick Start

Each example is a standalone Vite project. To run an example:

```bash
# From repository root
cd examples/01-counter
pnpm install
pnpm dev
```

Or run all examples at once:

```bash
# From repository root
pnpm install
cd examples/01-counter && pnpm dev
```

## Prerequisites

- Node.js >= 22.0.0
- pnpm >= 9.15.0

## Project Structure

Each example follows this structure:

```
example-name/
├── src/
│   ├── domain.ts        # Manifesto domain definition
│   ├── App.tsx          # React components
│   └── main.tsx         # Entry point with runtime setup
├── index.html           # HTML template
├── package.json         # Dependencies
├── vite.config.ts       # Vite configuration
├── tsconfig.json        # TypeScript configuration
└── README.md            # Example documentation
```

## Learning Path

We recommend following the examples in order:

1. **01-counter**: Start here to learn basic concepts
2. **02-todo-list**: Learn CRUD patterns and actions
3. **03-form-validation**: Understand policies and validation
4. **04-async-data**: Handle async operations
5. **05-shopping-cart**: Build complex derived values
6. **06-ai-agent**: Explore AI integration

## Creating Your Own

Use any example as a template:

```bash
cp -r examples/01-counter my-project
cd my-project
# Edit src/domain.ts to define your domain
pnpm dev
```

## Documentation

- [Getting Started Guide](../docs/getting-started.md)
- [Concepts Overview](../docs/concepts.md)
- [API Reference](../docs/api/)
