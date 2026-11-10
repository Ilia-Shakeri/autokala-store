import { afterEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, act } from '@testing-library/react'
import { useRef } from 'react'
import { useCheckoutMotion } from '../../src/checkout-motion'

const original = Object.getOwnPropertyDescriptor(Element.prototype, 'animate')
afterEach(() => {
  if (original) Object.defineProperty(Element.prototype, 'animate', original)
  else delete (Element.prototype as Partial<Element>).animate
  delete document.documentElement.dataset.input
})
function Surface({busy=false, close}: {busy?:boolean;close:()=>void}) {
  const node=useRef<HTMLDivElement>(null)
  const {closing,requestClose}=useCheckoutMotion(node,false,busy,close)
  return <div ref={node}><button onClick={requestClose}>close</button><span>{closing?'closing':'open'}</span></div>
}
it('keeps the surface mounted until exit completes, cancels entry, and closes once',async()=>{
  const finish: (()=>void)[]=[]
  const cancels: ReturnType<typeof vi.fn>[]=[]
  Object.defineProperty(Element.prototype,'animate',{configurable:true,value:vi.fn(()=>{
    const cancel=vi.fn();cancels.push(cancel)
    return {cancel,finished:new Promise<void>(resolve=>finish.push(resolve))}
  })})
  const close=vi.fn();const view=render(<Surface close={close}/>)
  fireEvent.click(screen.getByText('close'));fireEvent.click(screen.getByText('close'))
  expect(screen.getByText('closing')).toBeTruthy();expect(close).not.toHaveBeenCalled()
  expect(cancels[0]).toHaveBeenCalledOnce()
  await act(async()=>finish[1]())
  expect(close).toHaveBeenCalledOnce()
  view.unmount();expect(cancels[1]).toHaveBeenCalledOnce()
})
it.each(['keyboard','reduced'])('skips movement for %s and blocks close while submitting',mode=>{
  const animate=vi.fn();Object.defineProperty(Element.prototype,'animate',{configurable:true,value:animate})
  if(mode==='keyboard')document.documentElement.dataset.input='keyboard'
  else vi.mocked(window.matchMedia).mockReturnValue({matches:true} as MediaQueryList)
  const close=vi.fn();const view=render(<Surface busy close={close}/>)
  fireEvent.click(screen.getByText('close'));expect(close).not.toHaveBeenCalled()
  view.rerender(<Surface close={close}/>);fireEvent.click(screen.getByText('close'))
  expect(close).toHaveBeenCalledOnce();expect(animate).not.toHaveBeenCalled()
})
