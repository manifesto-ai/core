/**
 * AutocompleteInput - Autocomplete/search input component
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import type { InputComponentProps } from '../../types/component'

export const AutocompleteInput: React.FC<InputComponentProps> = ({
  fieldId,
  value,
  onChange,
  disabled = false,
  readonly = false,
  placeholder,
  componentProps = {},
  hasError = false,
  options = [],
  onFocus,
  onBlur,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const { minChars = 1 } = componentProps as { minChars?: number }

  // Sync input value with actual value
  useEffect(() => {
    const selectedOption = options.find((o) => o.value === value)
    setInputValue(selectedOption?.label ?? (value as string) ?? '')
  }, [value, options])

  // Filter options based on input
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(inputValue.toLowerCase())
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)
    if (val.length >= minChars) {
      setIsOpen(true)
    } else {
      setIsOpen(false)
    }
  }

  const handleSelect = useCallback(
    (optionValue: string | number) => {
      onChange(optionValue)
      setIsOpen(false)
      const selectedOption = options.find((o) => o.value === optionValue)
      setInputValue(selectedOption?.label ?? '')
    },
    [onChange, options]
  )

  const handleFocus = useCallback(() => {
    if (inputValue.length >= minChars) {
      setIsOpen(true)
    }
    onFocus?.()
  }, [inputValue, minChars, onFocus])

  const handleBlur = useCallback(() => {
    // Delay to allow click on option
    setTimeout(() => {
      setIsOpen(false)
      onBlur?.()
    }, 150)
  }, [onBlur])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div
      ref={containerRef}
      className={`input-autocomplete ${hasError ? 'input-autocomplete--error' : ''} ${disabled ? 'input-autocomplete--disabled' : ''}`}
    >
      <input
        type="text"
        id={fieldId}
        value={inputValue}
        disabled={disabled}
        readOnly={readonly}
        placeholder={placeholder}
        className="input-autocomplete__input"
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoComplete="off"
      />
      {isOpen && filteredOptions.length > 0 && (
        <ul className="input-autocomplete__dropdown">
          {filteredOptions.map((option) => (
            <li
              key={option.value}
              className={`input-autocomplete__option ${option.value === value ? 'input-autocomplete__option--selected' : ''}`}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default AutocompleteInput
