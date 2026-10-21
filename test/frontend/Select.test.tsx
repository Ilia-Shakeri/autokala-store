// @vitest-environment jsdom
import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Select } from '../../src/Select'
const options = [
  {value: 'oil', label: 'روغن موتور'},
  {value: 'brake', label: 'لنت ناموجود', disabled: true},
  {value: 'filter', label: 'فیلتر هوا'},
]
function Fixture({disabled = false, onChange = (_value: string) => {}}: {disabled?: boolean; onChange?: (value: string) => void}) {
  const [value, setValue] = useState('')
  return <form aria-label="خرید"><Select label="نوع قطعه" name="part" placeholder="قطعه را برگزینید" required disabled={disabled} allowClear clearLabel="حذف انتخاب" value={value} options={options} onValueChange={next => {setValue(next);onChange(next)}} /><button type="submit">ثبت</button></form>
}
describe('فهرست قطعه', () => {
  it('keeps required form validation and focuses the visible control', () => {
    render(<Fixture />)
    const form = screen.getByRole('form', {name: 'خرید'}) as HTMLFormElement
    const trigger = screen.getByRole('combobox', {name: 'نوع قطعه'})
    let valid = true
    act(() => {valid = form.checkValidity()})
    expect(valid).toBe(false)
    expect(document.activeElement).toBe(trigger)
    expect(trigger.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('alert').textContent).toBe('یک گزینه انتخاب کنید.')
    expect(new FormData(form).get('part')).toBe('')
  })

  it('selects by keyboard, skips disabled choices, and preserves submitted values', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Fixture onChange={onChange} />)
    const trigger = screen.getByRole('combobox', {name: 'نوع قطعه'})
    trigger.focus()
    await user.keyboard('{ArrowDown}')
    await screen.findByRole('listbox')
    await user.keyboard('{Home}{ArrowDown}{Enter}')
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    expect(trigger.textContent).toContain('فیلتر هوا')
    expect(onChange).toHaveBeenCalledWith('filter')
    expect(document.activeElement).toBe(trigger)
    const form = screen.getByRole('form', {name: 'خرید'}) as HTMLFormElement
    expect(form.checkValidity()).toBe(true)
    expect(new FormData(form).get('part')).toBe('filter')
  })

  it('can clear an optional selection without submitting the clear option as a value', async () => {
    const user = userEvent.setup()
    render(<Fixture />)
    const trigger = screen.getByRole('combobox', {name: 'نوع قطعه'})
    trigger.focus()
    await user.keyboard('{ArrowDown}')
    await screen.findByRole('listbox')
    await user.keyboard('{End}{Enter}')
    await waitFor(() => expect(trigger.textContent).toContain('فیلتر هوا'))
    await user.keyboard('{ArrowDown}')
    await screen.findByRole('listbox')
    await user.keyboard('{Home}{Enter}')
    await waitFor(() => expect(trigger.textContent).toContain('قطعه را برگزینید'))
    expect(new FormData(screen.getByRole('form') as HTMLFormElement).get('part')).toBe('')
  })

  it('closes only the list on Escape and keeps the previous selection', async () => {
    const user = userEvent.setup()
    const outerEscape = vi.fn()
    render(<div onKeyDown={event => {if (event.key === 'Escape') outerEscape()}}><Fixture /></div>)
    const trigger = screen.getByRole('combobox', {name: 'نوع قطعه'})
    trigger.focus()
    await user.keyboard('{ArrowDown}')
    await screen.findByRole('listbox')
    await user.keyboard('{End}{Escape}')
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    expect(outerEscape).not.toHaveBeenCalled()
    expect(trigger.textContent).toContain('قطعه را برگزینید')
    expect(document.activeElement).toBe(trigger)
  })

  it('matches Persian text with the keyboard while closed', async () => {
    const user = userEvent.setup()
    render(<Fixture />)
    const trigger = screen.getByRole('combobox', {name: 'نوع قطعه'})
    trigger.focus()
    await user.keyboard('ف')
    await waitFor(() => expect(trigger.textContent).toContain('فیلتر هوا'))
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('omits disabled controls from submission and validation', async () => {
    const user = userEvent.setup()
    render(<Fixture disabled />)
    const trigger = screen.getByRole('combobox', {name: 'نوع قطعه'}) as HTMLButtonElement
    expect(trigger.disabled).toBe(true)
    await user.click(trigger)
    expect(screen.queryByRole('listbox')).toBeNull()
    const form = screen.getByRole('form') as HTMLFormElement
    expect(form.checkValidity()).toBe(true)
    expect(new FormData(form).has('part')).toBe(false)
  })

  it('keeps an open list click from reaching a dialog backdrop', async () => {
    const user = userEvent.setup()
    const backdropClick = vi.fn()
    render(<div onClick={backdropClick}><Fixture /></div>)
    const trigger = screen.getByRole('combobox', {name: 'نوع قطعه'})
    trigger.focus()
    await user.keyboard('{ArrowDown}')
    await screen.findByRole('listbox')
    fireEvent.click(screen.getByRole('option', {name: 'روغن موتور'}))
    expect(backdropClick).not.toHaveBeenCalled()
  })
})
