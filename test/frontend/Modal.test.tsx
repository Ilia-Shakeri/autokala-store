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
it('makes the lower dialog inert and restores its focus after the top one closes',()=>{
  const closeFirst=vi.fn(),closeSecond=vi.fn()
  render(<Modal title="اول" onClose={closeFirst}><button>ادامه</button></Modal>)
  const opener=screen.getByRole('button',{name:'ادامه'});opener.focus()
  const second=render(<Modal title="دوم" onClose={closeSecond}>دوم</Modal>)
  expect(screen.getByRole('dialog',{name:'اول'}).inert).toBe(true)
  fireEvent.keyDown(screen.getAllByRole('button',{name:'بستن'}).at(-1)!,{key:'Escape'})
  expect(closeSecond).toHaveBeenCalledOnce();expect(closeFirst).not.toHaveBeenCalled()
  second.unmount()
  expect(screen.getByRole('dialog',{name:'اول'}).inert).toBe(false)
  expect(document.activeElement).toBe(opener)
})
it('keeps a dialog open when a press starts on its panel and ends on the scrim',()=>{
  const close=vi.fn();render(<Modal title="آزمون" onClose={close}>متن</Modal>)
  const dialog=screen.getByRole('dialog'),backdrop=dialog.parentElement!
  fireEvent.pointerDown(dialog);fireEvent.click(backdrop);expect(close).not.toHaveBeenCalled()
  fireEvent.pointerDown(backdrop);fireEvent.click(backdrop);expect(close).toHaveBeenCalledOnce()
})
it('reclaims body Tab when a pending dialog has no enabled controls',()=>{
  const view=(busy:boolean)=><Modal title="در حال ثبت" onClose={()=>{}} closeDisabled={busy}><fieldset disabled={busy}><input aria-label="نام"/><button>ثبت</button></fieldset></Modal>
  const {rerender}=render(view(false))
  const close=screen.getByRole('button',{name:'بستن'})
  rerender(view(true));close.blur()
  const event=new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true})
  document.body.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  expect(document.activeElement).toBe(screen.getByRole('dialog'))
})
