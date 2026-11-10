import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { cartMotionAllowed } from './cart-motion'

const easing = 'cubic-bezier(0.23, 1, 0.32, 1)'

export function useDialogMotion(surface: RefObject<HTMLDivElement | null>, busy: boolean, onClose: () => void, revealSelector?: string) {
  const [closing, setClosing] = useState(false)
  const animations = useRef<Animation[]>([])
  const close = useRef(onClose)
  close.current = onClose
  useLayoutEffect(() => {
    const node = surface.current
    if (!node) return
    const target = revealSelector ? node.querySelector<HTMLElement>(revealSelector) : node
    if (revealSelector && target) {
      target.scrollTop = 0
      target.querySelector<HTMLElement>('[role=status]')?.focus({preventScroll: true})
    }
    if (target?.animate && cartMotionAllowed()) {
      animations.current.push(target.animate([{opacity: 0, transform: revealSelector ? 'translateY(10px)' : 'translateY(12px) scale(.98)'}, {opacity: 1, transform: 'none'}], {duration: 250, easing}))
    }
  }, [surface, revealSelector])
  useLayoutEffect(() => {
    if (!closing) return
    const node = surface.current
    if (!node?.animate || !cartMotionAllowed()) { close.current(); return }
    const current = getComputedStyle(node)
    const from = {opacity: current.opacity, transform: current.transform}
    for (const animation of animations.current) animation.cancel()
    const exit = node.animate([from, {opacity: 0, transform: 'translateY(12px) scale(.98)'}], {duration: 180, easing, fill: 'forwards'})
    animations.current = [exit]
    let active = true
    void exit.finished.then(() => {if (active) close.current()}).catch(() => {})
    return () => {active = false}
  }, [closing, surface])
  useLayoutEffect(() => () => {for (const animation of animations.current) animation.cancel()}, [])
  return {closing, requestClose: () => {if (!busy) setClosing(true)}}
}
