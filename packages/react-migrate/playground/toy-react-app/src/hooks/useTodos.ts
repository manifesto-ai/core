import { useReducer, useCallback } from 'react';
import { Todo, TodoPriority, TodoFilter } from '../types';
import { todoReducer, TodoAction } from '../reducers/todoReducer';

interface UseTodosResult {
  todos: Todo[];
  filter: TodoFilter;
  addTodo: (title: string, priority: TodoPriority) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  setFilter: (filter: TodoFilter) => void;
}

const initialState = {
  todos: [] as Todo[],
  filter: 'all' as TodoFilter,
};

export function useTodos(): UseTodosResult {
  const [state, dispatch] = useReducer(todoReducer, initialState);

  const addTodo = useCallback((title: string, priority: TodoPriority) => {
    dispatch({
      type: 'ADD_TODO',
      payload: {
        id: Date.now().toString(),
        title,
        priority,
        completed: false,
        createdAt: new Date(),
      },
    });
  }, []);

  const toggleTodo = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_TODO', payload: { id } });
  }, []);

  const deleteTodo = useCallback((id: string) => {
    dispatch({ type: 'DELETE_TODO', payload: { id } });
  }, []);

  const setFilter = useCallback((filter: TodoFilter) => {
    dispatch({ type: 'SET_FILTER', payload: { filter } });
  }, []);

  return {
    todos: state.todos,
    filter: state.filter,
    addTodo,
    toggleTodo,
    deleteTodo,
    setFilter,
  };
}
