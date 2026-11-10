import { afterEach, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { CartNumber } from '../../src/cart-motion'
import { formatPrice } from '../../src/ui'

const originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate')
type FakeAnimation = { frames: Keyframe[]; state: AnimationPlayState; cancel: ReturnType<typeof vi.fn> }

afterEach(() => {
  if (originalAnimate) Object.defineProperty(Element.prototype, 'animate', originalAnimate)
  else delete (Element.prototype as Partial<Element>).animate
  delete document.documentElement.dataset.input
})

function animationHarness() {
  const records: FakeAnimation[] = []
  const events: string[] = []
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    value: vi.fn((frames: Keyframe[]) => {
      const index = records.length
      const record: FakeAnimation = { frames, state: 'running', cancel: vi.fn() }
      record.cancel.mockImplementation(() => { events.push(`cancel:${index}`); record.state = 'idle' })
      records.push(record)
      events.push(`animate:${index}`)
      return { get playState() { return record.state }, cancel: record.cancel } as unknown as Animation
    }),
  })
  return { records, events }
}

it('starts a rapid number update from its live presentation before cancelling the previous animation', () => {
  const { records, events } = animationHarness()
  const presentation = { opacity: '0.72', transform: 'matrix(1, 0, 0, 1, 0, 2.4)' }
  vi.spyOn(globalThis, 'getComputedStyle').mockImplementation(() => {
    events.push('read')
    return (records.at(-1)?.state === 'running' ? presentation : { opacity: '1', transform: 'none' }) as CSSStyleDeclaration
  })
  const view = render(<CartNumber value={1} />)
  view.rerender(<CartNumber value={2} />)
  expect(records).toHaveLength(1)
  expect(records[0].cancel).not.toHaveBeenCalled()
  events.length = 0

  view.rerender(<CartNumber value={3} />)

  expect(events).toEqual(['read', 'cancel:0', 'animate:1'])
  expect(records[1].frames[0]).toEqual(presentation)
  expect(view.container.textContent).toBe(formatPrice(3))
  expect(records[1].cancel).not.toHaveBeenCalled()
  view.unmount()
  expect(records[0].cancel).toHaveBeenCalledOnce()
  expect(records[1].cancel).toHaveBeenCalledOnce()
})

it.each(['keyboard', 'reduced motion'])('keeps number feedback still for %s and cancels existing travel when that preference activates', mode => {
  const { records } = animationHarness()
  let reduced = false
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ ...media, media: query, matches: reduced && query === '(prefers-reduced-motion: reduce)' }))
  const preferStill = (enabled: boolean) => {
    if (mode === 'keyboard') document.documentElement.dataset.input = enabled ? 'keyboard' : 'pointer'
    else reduced = enabled
  }
  preferStill(true)
  const view = render(<CartNumber value={1} />)
  view.rerender(<CartNumber value={2} />)
  expect(records).toHaveLength(0)
  expect(view.container.textContent).toBe(formatPrice(2))

  preferStill(false)
  view.rerender(<CartNumber value={3} />)
  expect(records).toHaveLength(1)
  expect(records[0].cancel).not.toHaveBeenCalled()

  preferStill(true)
  view.rerender(<CartNumber value={4} />)
  expect(records).toHaveLength(1)
  expect(records[0].cancel).toHaveBeenCalledOnce()
  expect(view.container.textContent).toBe(formatPrice(4))
  view.unmount()
})
