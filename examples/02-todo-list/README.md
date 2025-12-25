# Todo List Example

A classic todo list demonstrating CRUD operations with Manifesto.

## Features

This example showcases:

- **Array Data Management**: Managing a list of todos
- **Derived Values**: Computing counts (total, active, completed)
- **Filtering**: Active, completed, or all todos
- **CRUD Operations**: Add, toggle, delete, clear completed

## Quick Start

```bash
cd examples/02-todo-list
pnpm install
pnpm dev
```

Open http://localhost:5173 in your browser.

## Key Concepts

### Array Management

```typescript
// Store todos as an array
'data.todos': {
  schema: z.array(todoSchema),
  semantic: { type: 'collection', description: 'List of todo items' },
}
```

### Derived Counts

```typescript
// Compute active count using Expression DSL
'derived.activeCount': {
  deps: ['data.todos'],
  expr: [
    'length',
    ['filter', ['get', 'data.todos'], ['fn', 'todo', ['not', ['get-prop', 'todo', 'completed']]]],
  ],
}
```

### CRUD Actions

```typescript
// Toggle a todo's completion status
toggleTodo: {
  deps: ['data.todos'],
  semantic: { verb: 'toggle', object: 'todo completion' },
  effect: ['setValue', 'data.todos', [
    'map',
    ['get', 'data.todos'],
    ['fn', 'todo', [
      'if',
      ['==', ['get-prop', 'todo', 'id'], ['get', '$payload']],
      ['merge', 'todo', { completed: ['not', ['get-prop', 'todo', 'completed']] }],
      'todo',
    ]],
  ]],
}
```

### React Implementation

For simplicity, this example uses direct `setValue` calls in components:

```tsx
function TodoItem({ todo }) {
  const { value: todos } = useValue<Todo[]>('data.todos');
  const { setValue } = useSetValue();

  const handleToggle = () => {
    const updated = todos.map((t) =>
      t.id === todo.id ? { ...t, completed: !t.completed } : t
    );
    setValue('data.todos', updated);
  };

  return (
    <input
      type="checkbox"
      checked={todo.completed}
      onChange={handleToggle}
    />
  );
}
```

## Project Structure

```
02-todo-list/
├── src/
│   ├── domain.ts    # Todo domain with CRUD actions
│   ├── App.tsx      # Todo components
│   └── main.tsx     # Entry point
└── ...
```

## Learn More

- [01-counter](../01-counter) - Start with basics
- [03-form-validation](../03-form-validation) - Add validation
