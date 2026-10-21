import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from './ui'

export function Modal({ title, onClose, children, drawer = false }: {title: string; onClose: () => void; children: ReactNode; drawer?: boolean}) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const node = panel.current!
    const focusable = () => [...node.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')]
    ;(focusable()[0] || node).focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current() }
      if (event.key === 'Tab') {
        const list = focusable()
        const first = list[0], last = list[list.length - 1]
        if (!first) { event.preventDefault(); node.focus(); return }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  return <div className={drawer ? 'drawer-backdrop' : 'modal-backdrop'} onClick={onClose}>
    <div className={drawer ? 'cart-drawer' : 'product-modal'} ref={panel} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onClick={e => e.stopPropagation()} dir="rtl">
      <div className="drawer-head"><h2>{title}</h2><button type="button" aria-label="بستن" onClick={onClose}><Icon name="x" /></button></div>
      {children}
    </div>
  </div>
}
