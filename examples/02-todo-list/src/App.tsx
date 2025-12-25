/**
 * Todo List App
 *
 * Demonstrates CRUD operations with Manifesto.
 */

import { useValue, useSetValue, useDerived } from '@manifesto-ai/bridge-react';
import type { SemanticPath } from '@manifesto-ai/core';
import type { Todo, FilterType } from './domain';
import { generateId } from './domain';

// ============================================================================
// Todo Input
// ============================================================================

function TodoInput() {
  const { value: text } = useValue<string>('state.newTodoText' as SemanticPath);
  const { value: todos } = useValue<Todo[]>('data.todos' as SemanticPath);
  const { setValue } = useSetValue();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const newTodo: Todo = {
      id: generateId(),
      text: text.trim(),
      completed: false,
      createdAt: Date.now(),
    };

    setValue('data.todos' as SemanticPath, [...todos, newTodo]);
    setValue('state.newTodoText' as SemanticPath, '');
  };

  return (
    <form onSubmit={handleSubmit} style={styles.inputForm}>
      <input
        type="text"
        value={text}
        onChange={(e) => setValue('state.newTodoText' as SemanticPath, e.target.value)}
        placeholder="What needs to be done?"
        style={styles.input}
        autoFocus
      />
      <button type="submit" style={styles.addButton} disabled={!text.trim()}>
        Add
      </button>
    </form>
  );
}

// ============================================================================
// Todo Item
// ============================================================================

function TodoItem({ todo }: { todo: Todo }) {
  const { value: todos } = useValue<Todo[]>('data.todos' as SemanticPath);
  const { setValue } = useSetValue();

  const handleToggle = () => {
    const updated = todos.map((t) =>
      t.id === todo.id ? { ...t, completed: !t.completed } : t
    );
    setValue('data.todos' as SemanticPath, updated);
  };

  const handleDelete = () => {
    const filtered = todos.filter((t) => t.id !== todo.id);
    setValue('data.todos' as SemanticPath, filtered);
  };

  return (
    <div style={styles.todoItem}>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={handleToggle}
        style={styles.checkbox}
      />
      <span
        style={{
          ...styles.todoText,
          textDecoration: todo.completed ? 'line-through' : 'none',
          color: todo.completed ? '#9ca3af' : '#1f2937',
        }}
      >
        {todo.text}
      </span>
      <button onClick={handleDelete} style={styles.deleteButton}>
        Delete
      </button>
    </div>
  );
}

// ============================================================================
// Todo List
// ============================================================================

function TodoList() {
  const { value: todos } = useValue<Todo[]>('data.todos' as SemanticPath);
  const { value: filter } = useValue<FilterType>('state.filter' as SemanticPath);

  const filteredTodos = todos.filter((todo) => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  if (filteredTodos.length === 0) {
    return (
      <div style={styles.emptyState}>
        {filter === 'all' ? 'No todos yet. Add one above!' : `No ${filter} todos.`}
      </div>
    );
  }

  return (
    <div style={styles.todoList}>
      {filteredTodos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </div>
  );
}

// ============================================================================
// Filter Bar
// ============================================================================

function FilterBar() {
  const { value: filter } = useValue<FilterType>('state.filter' as SemanticPath);
  const { setValue } = useSetValue();
  const { value: activeCount } = useDerived<number>('derived.activeCount' as SemanticPath);
  const { value: completedCount } = useDerived<number>('derived.completedCount' as SemanticPath);
  const { value: todos } = useValue<Todo[]>('data.todos' as SemanticPath);

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
  ];

  const handleClearCompleted = () => {
    setValue(
      'data.todos' as SemanticPath,
      todos.filter((t) => !t.completed)
    );
  };

  return (
    <div style={styles.filterBar}>
      <span style={styles.itemCount}>
        {activeCount} item{activeCount !== 1 ? 's' : ''} left
      </span>
      <div style={styles.filters}>
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setValue('state.filter' as SemanticPath, key)}
            style={{
              ...styles.filterButton,
              ...(filter === key ? styles.filterButtonActive : {}),
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {completedCount > 0 && (
        <button onClick={handleClearCompleted} style={styles.clearButton}>
          Clear completed
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Stats Panel
// ============================================================================

function StatsPanel() {
  const { value: totalCount } = useDerived<number>('derived.totalCount' as SemanticPath);
  const { value: activeCount } = useDerived<number>('derived.activeCount' as SemanticPath);
  const { value: completedCount } = useDerived<number>('derived.completedCount' as SemanticPath);

  return (
    <div style={styles.statsPanel}>
      <div style={styles.stat}>
        <span style={styles.statValue}>{totalCount}</span>
        <span style={styles.statLabel}>Total</span>
      </div>
      <div style={styles.stat}>
        <span style={styles.statValue}>{activeCount}</span>
        <span style={styles.statLabel}>Active</span>
      </div>
      <div style={styles.stat}>
        <span style={styles.statValue}>{completedCount}</span>
        <span style={styles.statLabel}>Done</span>
      </div>
    </div>
  );
}

// ============================================================================
// Main App
// ============================================================================

export default function App() {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Manifesto Todos</h1>
      <p style={styles.subtitle}>CRUD patterns with @manifesto-ai/core</p>
      <StatsPanel />
      <TodoInput />
      <TodoList />
      <FilterBar />
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    overflow: 'hidden',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    padding: '24px 24px 4px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
    textAlign: 'center',
    paddingBottom: '16px',
  },
  statsPanel: {
    display: 'flex',
    justifyContent: 'center',
    gap: '32px',
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#6366f1',
  },
  statLabel: {
    fontSize: '12px',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  inputForm: {
    display: 'flex',
    padding: '16px',
    gap: '8px',
    borderBottom: '1px solid #e5e7eb',
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    fontSize: '16px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  addButton: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    color: 'white',
    backgroundColor: '#6366f1',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  todoList: {
    maxHeight: '300px',
    overflowY: 'auto',
  },
  todoItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px',
    gap: '12px',
    borderBottom: '1px solid #f3f4f6',
    transition: 'background-color 0.2s',
  },
  checkbox: {
    width: '20px',
    height: '20px',
    cursor: 'pointer',
  },
  todoText: {
    flex: 1,
    fontSize: '16px',
    transition: 'color 0.2s',
  },
  deleteButton: {
    padding: '6px 12px',
    fontSize: '12px',
    color: '#ef4444',
    backgroundColor: 'transparent',
    border: '1px solid #ef4444',
    borderRadius: '4px',
    cursor: 'pointer',
    opacity: 0.6,
    transition: 'opacity 0.2s',
  },
  emptyState: {
    padding: '48px 24px',
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: '16px',
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: '#f9fafb',
    fontSize: '14px',
  },
  itemCount: {
    color: '#6b7280',
  },
  filters: {
    display: 'flex',
    gap: '4px',
  },
  filterButton: {
    padding: '6px 12px',
    fontSize: '14px',
    color: '#6b7280',
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  filterButtonActive: {
    borderColor: '#d1d5db',
    color: '#1f2937',
  },
  clearButton: {
    padding: '6px 12px',
    fontSize: '14px',
    color: '#6b7280',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },
};
