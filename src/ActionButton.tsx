import {useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode} from 'react'
import {LoadingCar} from './LoadingCar'
import {Icon} from './ui'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean
  done?: boolean
  pendingLabel?: string
  doneLabel?: string
  children: ReactNode
}

export function useActionFeedback() {
  const [done, setDone] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const clear = () => {clearTimeout(timer.current);setDone(false)}
  const complete = () => {
    clearTimeout(timer.current);setDone(true)
    timer.current = setTimeout(() => setDone(false), 1800)
  }
  return {done, clear, complete}
}

export function ActionButton({pending = false, done = false, pendingLabel = 'در حال ثبت…', doneLabel = 'انجام شد', children, className = '', disabled, 'aria-label': label, ...props}: Props) {
  const state = pending ? 'pending' : done ? 'done' : 'idle'
  return <button {...props} className={`action-button ${className}`} disabled={disabled || pending} aria-busy={pending} aria-label={pending ? pendingLabel : done ? doneLabel : label} data-state={state}>
    <span className="action-size" aria-hidden="true"><span>{children}</span><span><span className="action-car-space"/>{pendingLabel}</span><span><Icon name="check" size={19}/>{doneLabel}</span></span>
    <span className="action-layer action-idle" aria-hidden={state !== 'idle'}>{children}</span>
    <span className="action-layer action-pending" aria-hidden={state !== 'pending'}>{pending && <LoadingCar inline label={pendingLabel}/>}</span>
    <span className="action-layer action-done" aria-hidden={state !== 'done'}><Icon name="check" size={19}/><span>{doneLabel}</span></span>
    <span className="action-announcement" aria-live="polite" aria-atomic="true" role={done && !pending ? 'status' : undefined}>{done && !pending ? doneLabel : ''}</span>
  </button>
}

export function CartButton({onAdd, ...props}: Omit<Props, 'onClick'> & {onAdd: () => boolean}) {
  const feedback = useActionFeedback()
  return <ActionButton {...props} done={feedback.done} doneLabel="به سبد اضافه شد" type="button" onClick={() => {feedback.clear();if(onAdd())feedback.complete()}}/>
}
