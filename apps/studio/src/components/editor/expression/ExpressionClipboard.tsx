"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface ExpressionClipboardContextValue {
  /** Copied expression content */
  content: unknown | null;
  /** Whether clipboard has content */
  hasContent: boolean;
  /** Copy expression to clipboard */
  copy: (expr: unknown) => Promise<void>;
  /** Paste from clipboard */
  paste: () => Promise<unknown | null>;
  /** Clear clipboard */
  clear: () => void;
}

const ExpressionClipboardContext = createContext<ExpressionClipboardContextValue | null>(null);

/**
 * ExpressionClipboardProvider - Provides clipboard functionality for expressions
 *
 * Uses both React state and browser Clipboard API for cross-component sharing.
 */
export function ExpressionClipboardProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<unknown | null>(null);

  const copy = useCallback(async (expr: unknown) => {
    setContent(expr);
    // Also copy to system clipboard for cross-tab support
    try {
      await navigator.clipboard.writeText(JSON.stringify(expr, null, 2));
    } catch (err) {
      console.warn("Failed to copy to system clipboard:", err);
    }
  }, []);

  const paste = useCallback(async (): Promise<unknown | null> => {
    // Try to read from system clipboard first
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const parsed = JSON.parse(text);
        return parsed;
      }
    } catch {
      // Fall back to internal state
    }
    return content;
  }, [content]);

  const clear = useCallback(() => {
    setContent(null);
  }, []);

  return (
    <ExpressionClipboardContext.Provider
      value={{
        content,
        hasContent: content !== null,
        copy,
        paste,
        clear,
      }}
    >
      {children}
    </ExpressionClipboardContext.Provider>
  );
}

/**
 * useExpressionClipboard - Hook to access expression clipboard
 */
export function useExpressionClipboard() {
  const context = useContext(ExpressionClipboardContext);
  if (!context) {
    throw new Error(
      "useExpressionClipboard must be used within ExpressionClipboardProvider"
    );
  }
  return context;
}
