import { it,expect,vi } from 'vitest'
import { render,screen,fireEvent } from '@testing-library/react'
import { Modal } from '../../src/Modal'

it('isolates the background and restores focus, scroll and inert state on close',()=>{
  const root=document.createElement('div');root.id='root';document.body.append(root)
  const opener=document.createElement('button');opener.textContent='باز کن';document.body.append(opener);opener.focus()
  const close=vi.fn()
  const {unmount}=render(<Modal title="آزمون" onClose={close}><button>آخر</button></Modal>,{container:root})
  expect(root.inert).toBe(true);expect(document.body.style.overflow).toBe('hidden');expect(document.activeElement).toBe(screen.getByRole('button',{name:'بستن'}))
  const last=screen.getByRole('button',{name:'آخر'});last.focus();fireEvent.keyDown(last,{key:'Tab'});expect(document.activeElement).toBe(screen.getByRole('button',{name:'بستن'}))
  fireEvent.keyDown(document.activeElement!,{key:'Escape'});expect(close).toHaveBeenCalledOnce()
  unmount();expect(root.inert).toBe(false);expect(document.body.style.overflow).toBe('');expect(document.activeElement).toBe(opener);root.remove();opener.remove()
})
it('keeps scroll locked when stacked dialogs close in either order',()=>{
  const first=render(<Modal title="اول" onClose={()=>{}}>اول</Modal>)
  const second=render(<Modal title="دوم" onClose={()=>{}}>دوم</Modal>)
  first.unmount();expect(document.body.style.overflow).toBe('hidden')
  second.unmount();expect(document.body.style.overflow).toBe('')
})
it('does not let a prevented menu Escape close its parent modal',()=>{
  const close=vi.fn();render(<Modal title="آزمون" onClose={close}><button onKeyDown={event=>event.preventDefault()}>فهرست</button></Modal>)
  fireEvent.keyDown(screen.getByRole('button',{name:'فهرست'}),{key:'Escape'});expect(close).not.toHaveBeenCalled()
})
it('keeps footer purchase actions inside the focus cycle',()=>{
  render(<Modal title="کالا" onClose={()=>{}} footer={<button>افزودن به سبد</button>}><p>شرح کالا</p></Modal>)
  const purchase=screen.getByRole('button',{name:'افزودن به سبد'});purchase.focus()
  fireEvent.keyDown(purchase,{key:'Tab'})
  expect(document.activeElement).toBe(screen.getByRole('button',{name:'بستن'}))
})
