/**
 * RichEditorInput - Rich text editor component (basic contenteditable)
 */

import React, { useRef, useCallback } from 'react'
import type { InputComponentProps } from '../../types/component'

export const RichEditorInput: React.FC<InputComponentProps> = ({
  fieldId,
  value,
  onChange,
  disabled = false,
  readonly = false,
  placeholder,
  componentProps = {},
  hasError = false,
  onFocus,
  onBlur,
}) => {
  const editorRef = useRef<HTMLDivElement>(null)

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }, [onChange])

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value)
    handleInput()
  }, [handleInput])

  const { toolbar = ['bold', 'italic', 'underline'] } = componentProps as { toolbar?: string[] }

  return (
    <div
      className={`input-rich-editor ${hasError ? 'input-rich-editor--error' : ''} ${disabled ? 'input-rich-editor--disabled' : ''}`}
    >
      {/* Toolbar */}
      {!readonly && (
        <div className="input-rich-editor__toolbar">
          {toolbar.includes('bold') && (
            <button type="button" onClick={() => execCommand('bold')} title="Bold">
              <strong>B</strong>
            </button>
          )}
          {toolbar.includes('italic') && (
            <button type="button" onClick={() => execCommand('italic')} title="Italic">
              <em>I</em>
            </button>
          )}
          {toolbar.includes('underline') && (
            <button type="button" onClick={() => execCommand('underline')} title="Underline">
              <u>U</u>
            </button>
          )}
        </div>
      )}

      {/* Editor */}
      <div
        ref={editorRef}
        id={fieldId}
        className="input-rich-editor__content"
        contentEditable={!disabled && !readonly}
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: (value as string) ?? '' }}
        onInput={handleInput}
        onFocus={onFocus}
        onBlur={onBlur}
        data-placeholder={placeholder}
      />
    </div>
  )
}

export default RichEditorInput
