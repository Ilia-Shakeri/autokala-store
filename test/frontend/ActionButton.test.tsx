import {afterEach, expect, it, vi} from 'vitest'
import {act, fireEvent, render, screen} from '@testing-library/react'
import {ActionButton, CartButton} from '../../src/ActionButton'

afterEach(()=>vi.useRealTimers())
it('locks pending action and never shows success before the caller confirms it',()=>{
  const click=vi.fn()
  const view=render(<ActionButton pending onClick={click}>ذخیره</ActionButton>)
  const button=screen.getByRole('button',{name:'در حال ثبت…'}) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  expect(button.getAttribute('aria-busy')).toBe('true')
  fireEvent.click(button);expect(click).not.toHaveBeenCalled()
  expect(screen.queryByRole('button',{name:'انجام شد'})).toBeNull()
  view.rerender(<ActionButton done onClick={click}>ذخیره</ActionButton>)
  expect(screen.getByRole('button',{name:'انجام شد'}).getAttribute('data-state')).toBe('done')
  expect(screen.getByRole('status').textContent).toBe('انجام شد')
})
it('returns to a retryable normal action on failure without claiming completion',()=>{
  const view=render(<ActionButton pending>ثبت</ActionButton>)
  view.rerender(<ActionButton>ثبت</ActionButton>)
  expect((screen.getByRole('button',{name:'ثبت'}) as HTMLButtonElement).disabled).toBe(false)
  expect(screen.queryByRole('button',{name:'انجام شد'})).toBeNull()
  expect(screen.queryByRole('status')).toBeNull()
})
it('acknowledges only successful local cart changes and allows the next change immediately',()=>{
  vi.useFakeTimers()
  const add=vi.fn().mockReturnValueOnce(false).mockReturnValue(true)
  render(<CartButton onAdd={add}>افزودن</CartButton>)
  fireEvent.click(screen.getByRole('button',{name:'افزودن'}))
  expect(screen.queryByRole('button',{name:'به سبد اضافه شد'})).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'افزودن'}))
  fireEvent.click(screen.getByRole('button',{name:'به سبد اضافه شد'}))
  expect(add).toHaveBeenCalledTimes(3)
  act(()=>vi.advanceTimersByTime(1800))
  expect(screen.getByRole('button',{name:'افزودن'})).toBeTruthy()
})
it('cancels feedback expiry when the button is removed',()=>{
  vi.useFakeTimers()
  const view=render(<CartButton onAdd={()=>true}>افزودن</CartButton>)
  fireEvent.click(screen.getByRole('button',{name:'افزودن'}))
  expect(vi.getTimerCount()).toBe(1)
  view.unmount();expect(vi.getTimerCount()).toBe(0)
})
