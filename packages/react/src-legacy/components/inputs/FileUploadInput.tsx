/**
 * FileUploadInput - File upload component
 */

import React, { useRef, useCallback } from 'react'
import type { InputComponentProps } from '../../types/component'

export const FileUploadInput: React.FC<InputComponentProps> = ({
  fieldId,
  value,
  onChange,
  disabled = false,
  readonly = false,
  placeholder = 'Choose a file...',
  componentProps = {},
  hasError = false,
  onFocus,
  onBlur,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)

  const { accept, multiple = false, maxSize } = componentProps as {
    accept?: string
    multiple?: boolean
    maxSize?: number
  }

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) {
        onChange(null)
        return
      }

      // Check file size
      if (maxSize) {
        for (const file of Array.from(files)) {
          if (file.size > maxSize) {
            alert(`File ${file.name} exceeds max size of ${maxSize} bytes`)
            return
          }
        }
      }

      if (multiple) {
        onChange(Array.from(files))
      } else {
        onChange(files[0])
      }
    },
    [onChange, multiple, maxSize]
  )

  const handleClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const getFileName = (): string => {
    if (!value) return ''
    if (value instanceof File) return value.name
    if (Array.isArray(value) && value.length > 0) {
      return value.map((f) => f.name).join(', ')
    }
    return ''
  }

  return (
    <div
      className={`input-file ${hasError ? 'input-file--error' : ''} ${disabled ? 'input-file--disabled' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        id={fieldId}
        accept={accept}
        multiple={multiple}
        disabled={disabled || readonly}
        className="input-file__input"
        onChange={handleChange}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      <button
        type="button"
        className="input-file__button"
        onClick={handleClick}
        disabled={disabled || readonly}
      >
        {placeholder}
      </button>
      {value != null && <span className="input-file__name">{getFileName()}</span>}
    </div>
  )
}

export default FileUploadInput
