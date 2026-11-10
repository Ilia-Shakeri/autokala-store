import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './ui'

let activeModals = 0
let originalInert = false
let originalOverflow = ''
const modalStack: HTMLElement[] = []

export function Modal({ title, onClose, children, drawer = false, className = '', footer, closeDisabled = false, surfaceRef }: {title: string; onClose: () => void; children: ReactNode; drawer?: boolean; className?: string; footer?: ReactNode; closeDisabled?: boolean; surfaceRef?: RefObject<HTMLDivElement|null>}) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  const backdropPress = useRef(false)
  close.current = () => {if (!closeDisabled) onClose()}
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const root = document.getElementById('root')
    if (activeModals++ === 0) {originalInert = root?.inert || false;originalOverflow=document.body.style.overflow}
    document.body.style.overflow = 'hidden'
    if(root)root.inert=true
    const node = panel.current!
    const parent = modalStack.at(-1)
    if (parent) parent.inert = true
    modalStack.push(node)
    const focusable = () => [...node.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter(element=>element.tabIndex>=0 && !element.closest('[hidden],[inert]') && getComputedStyle(element).display!=='none' && getComputedStyle(element).visibility!=='hidden')
    ;(focusable()[0] || node).focus()
    const key = (event: KeyboardEvent) => {
      if (modalStack.at(-1) !== node) return
      if(event.defaultPrevented || (event.target instanceof Node && !node.contains(event.target) && event.target !== document.body && event.target !== document.documentElement))return
      if (event.key === 'Escape') { event.preventDefault(); close.current() }
      if (event.key === 'Tab') {
        const list = focusable()
        const first = list[0], last = list[list.length - 1]
        if (!first) { event.preventDefault(); node.focus(); return }
        if (!node.contains(document.activeElement)) {event.preventDefault();(event.shiftKey ? last : first)?.focus();return}
        if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('keydown', key)
      const wasTop = modalStack.at(-1) === node
      modalStack.splice(modalStack.indexOf(node), 1)
      const top = modalStack.at(-1)
      if (top) top.inert = false
      if (--activeModals === 0) {document.body.style.overflow=originalOverflow;if(root)root.inert=originalInert}
      if (wasTop) {
        if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({preventScroll:true})
        else top?.focus()
      }
    }
  }, [])
  return createPortal(<div className={drawer ? 'drawer-backdrop' : 'modal-backdrop'} onPointerDown={event => {backdropPress.current = event.target === event.currentTarget}} onClick={event => {if(event.target === event.currentTarget && backdropPress.current) close.current();backdropPress.current=false}}>
    <div className={`${drawer ? 'cart-drawer' : 'product-modal'} ${className}`} ref={node=>{panel.current=node;if(surfaceRef)surfaceRef.current=node}} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onClick={e => e.stopPropagation()} dir="rtl">
      <div className="drawer-head"><h2>{title}</h2><button type="button" aria-label="بستن" disabled={closeDisabled} onClick={onClose}><Icon name="x" /></button></div>
      {children}
      {footer && <div className="modal-footer">{footer}</div>}
    </div>
  </div>, document.body)
}
