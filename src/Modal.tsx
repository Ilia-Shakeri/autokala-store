import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './ui'

let activeModals = 0
let originalInert = false
let originalOverflow = ''

export function Modal({ title, onClose, children, drawer = false, className = '' }: {title: string; onClose: () => void; children: ReactNode; drawer?: boolean; className?: string}) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const root = document.getElementById('root')
    if (activeModals++ === 0) {originalInert = root?.inert || false;originalOverflow=document.body.style.overflow}
    document.body.style.overflow = 'hidden'
    if(root)root.inert=true
    const node = panel.current!
    const focusable = () => [...node.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter(element=>element.tabIndex>=0 && !element.closest('[hidden],[inert]') && getComputedStyle(element).display!=='none' && getComputedStyle(element).visibility!=='hidden')
    ;(focusable()[0] || node).focus()
    const key = (event: KeyboardEvent) => {
      if(event.defaultPrevented || (event.target instanceof Node && !node.contains(event.target)))return
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
    return () => { document.removeEventListener('keydown', key); if(--activeModals===0){document.body.style.overflow=originalOverflow;if(root)root.inert=originalInert} previous?.focus() }
  }, [])
  return createPortal(<div className={drawer ? 'drawer-backdrop' : 'modal-backdrop'} onClick={onClose}>
    <div className={`${drawer ? 'cart-drawer' : 'product-modal'} ${className}`} ref={panel} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onClick={e => e.stopPropagation()} dir="rtl">
      <div className="drawer-head"><h2>{title}</h2><button type="button" aria-label="بستن" onClick={onClose}><Icon name="x" /></button></div>
      {children}
    </div>
  </div>, document.body)
}
