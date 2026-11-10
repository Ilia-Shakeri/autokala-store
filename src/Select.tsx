import { useId, useRef, useState } from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Icon } from './ui'
import './select.css'

type Option = { value: string; label: string; disabled?: boolean }
type Props = {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: Option[]
  placeholder?: string
  disabled?: boolean
  required?: boolean
  name?: string
  allowClear?: boolean
  clearLabel?: string
}
const clearValue = '__autokala_clear_selection__'

export function Select({ label, value, onValueChange, options, placeholder = 'انتخاب کنید', disabled = false, required = false, name, allowClear = false, clearLabel = 'حذف انتخاب' }: Props) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const [invalid, setInvalid] = useState(false)
  const showInvalid = invalid && !value && !disabled
  return <span className="select-shell" onInvalidCapture={event => {
    event.preventDefault()
    setInvalid(true)
    trigger.current?.focus()
  }}>
    <SelectPrimitive.Root dir="rtl" value={value} disabled={disabled} required={required} name={name} onValueChange={next => {
      setInvalid(false)
      onValueChange(next === clearValue ? '' : next)
    }}>
      <SelectPrimitive.Trigger ref={trigger} id={id} aria-label={label} aria-invalid={showInvalid || undefined} aria-describedby={showInvalid ? `${id}-error` : undefined} className="select-trigger" type="button">
        <span className="select-value"><SelectPrimitive.Value placeholder={placeholder} /></span>
        <SelectPrimitive.Icon className="select-chevron"><Icon name="chevron" size={15} /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="select-content" position="popper" sideOffset={5} collisionPadding={12} onEscapeKeyDown={event => event.stopPropagation()} onKeyDown={event => {
          if (event.key === 'Tab' || event.key === 'Escape') event.stopPropagation()
        }} onClick={event => event.stopPropagation()}>
          <SelectPrimitive.ScrollUpButton className="select-scroll select-scroll-up" aria-label="گزینه‌های بالاتر"><Icon name="chevron" size={15} /></SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="select-viewport">
            {allowClear && value && <SelectPrimitive.Item className="select-option select-clear" value={clearValue}><SelectPrimitive.ItemText>{clearLabel}</SelectPrimitive.ItemText></SelectPrimitive.Item>}
            {options.map(option => <SelectPrimitive.Item className="select-option" value={option.value} key={option.value} disabled={option.disabled} textValue={option.label}>
              <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              <SelectPrimitive.ItemIndicator className="select-check"><Icon name="check" size={15} /></SelectPrimitive.ItemIndicator>
            </SelectPrimitive.Item>)}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="select-scroll select-scroll-down" aria-label="گزینه‌های پایین‌تر"><Icon name="chevron" size={15} /></SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
    {showInvalid && <span id={`${id}-error`} className="select-error" role="alert">یک گزینه انتخاب کنید.</span>}
  </span>
}
