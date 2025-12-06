/**
 * ImageUploadInput - Image upload component with preview
 */

import React, { useRef, useCallback, useState, useEffect } from 'react'
import type { InputComponentProps } from '../../types/component'

export const ImageUploadInput: React.FC<InputComponentProps> = ({
  fieldId,
  value,
  onChange,
  disabled = false,
  readonly = false,
  placeholder = 'Choose an image...',
  componentProps = {},
  hasError = false,
  onFocus,
  onBlur,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const { accept = 'image/*', maxSize } = componentProps as {
    accept?: string
    maxSize?: number
  }

  // Generate preview
  useEffect(() => {
    if (!value) {
      setPreview(null)
      return
    }

    if (value instanceof File) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(value)
    } else if (typeof value === 'string') {
      // Already a URL
      setPreview(value)
    }
  }, [value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) {
        onChange(null)
        return
      }

      const file = files[0]
      if (!file) {
        onChange(null)
        return
      }

      // Check file size
      if (maxSize && file.size > maxSize) {
        alert(`File exceeds max size of ${maxSize} bytes`)
        return
      }

      onChange(file)
    },
    [onChange, maxSize]
  )

  const handleClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleRemove = useCallback(() => {
    onChange(null)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }, [onChange])

  return (
    <div
      className={`input-image ${hasError ? 'input-image--error' : ''} ${disabled ? 'input-image--disabled' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        id={fieldId}
        accept={accept}
        disabled={disabled || readonly}
        className="input-image__input"
        onChange={handleChange}
        onFocus={onFocus}
        onBlur={onBlur}
      />

      {preview ? (
        <div className="input-image__preview">
          <img src={preview} alt="Preview" className="input-image__img" />
          {!readonly && !disabled && (
            <button
              type="button"
              className="input-image__remove"
              onClick={handleRemove}
              title="Remove"
            >
              ×
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="input-image__button"
          onClick={handleClick}
          disabled={disabled || readonly}
        >
          {placeholder}
        </button>
      )}
    </div>
  )
}

export default ImageUploadInput
