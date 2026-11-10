import { afterEach,expect,it,vi } from 'vitest'
import { act,fireEvent,render,screen } from '@testing-library/react'
import { useState,type ComponentProps } from 'react'
import CartDrawer from '../../src/CartDrawer'
import { formatPrice } from '../../src/ui'
import type { CartItem,Product,Settings } from '../../src/types'

const product:Product={id:1,name:'روغن نمونه',sku:'OIL-TEST',brand:'برند نمونه',price:100000,category:'روغن',label:'',visual:'oil',color:'amber',description:'کالای نمونه برای آزمون سبد',stock:3,vehicles:[]}
const second:Product={...product,id:2,name:'فیلتر نمونه',sku:'FILTER-TEST',visual:'filter',price:50000}
const settings:Settings={storeName:'اتوکالا',shippingFee:85000,freeShippingThreshold:300000,paymentMode:'manual',demo:true}
type Props=ComponentProps<typeof CartDrawer>
const callbacks=()=>({onClose:vi.fn(),onBrowse:vi.fn(),onCheckout:vi.fn(),onRecover:vi.fn(),onInspect:vi.fn()})

function stateful(initial:CartItem[],overrides:Partial<Props>={}){
  const base={open:true,products:[product,second],settings,pendingOrder:false,...callbacks(),...overrides}
  let current=initial
  function Fixture({extra={}}:{extra?:Partial<Props>}){
    const [items,setCart]=useState(initial)
    current=items
    return <CartDrawer {...base} items={items} setCart={setCart} {...extra}/>
  }
  const view=render(<Fixture/>)
  return {...view,current:()=>current,rerender:(extra:Partial<Props>)=>view.rerender(<Fixture extra={extra}/>),callbacks:base}
}

it('caps several plus taps in one render at current stock',()=>{
  const view=stateful([{productId:1,quantity:1}])
  const plus=screen.getByRole('button',{name:`زیاد کردن ${product.name}`}) as HTMLButtonElement
  act(()=>{plus.click();plus.click();plus.click()})
  expect(view.current()).toEqual([{productId:1,quantity:3}])
  expect(plus.disabled).toBe(true)
})

it('removes a single remaining unit and restores its place through undo',()=>{
  const original=[{productId:1,quantity:1},{productId:2,quantity:2}]
  const view=stateful(original)
  fireEvent.click(screen.getByRole('button',{name:`کم کردن ${product.name}`}))
  expect(view.current()).toEqual([{productId:2,quantity:2}])
  const undo=screen.getByRole('button',{name:'بازگرداندن'})
  expect(document.activeElement).toBe(undo)
  fireEvent.click(undo)
  expect(view.current()).toEqual(original)
  expect(document.activeElement).toBe(screen.getByRole('button',{name:product.name,exact:true}))
  expect(screen.getByText(`${product.name} به سبد برگشت.`)).toBeTruthy()
})

it('keeps undo within stock when availability drops after removal',()=>{
  const view=stateful([{productId:1,quantity:3}])
  fireEvent.click(screen.getByRole('button',{name:`حذف ${product.name}`}))
  view.rerender({products:[{...product,stock:1}]})
  fireEvent.click(screen.getByRole('button',{name:'بازگرداندن'}))
  expect(view.current()).toEqual([{productId:1,quantity:1}])
  expect((screen.getByRole('button',{name:`زیاد کردن ${product.name}`}) as HTMLButtonElement).disabled).toBe(true)
})

it.each([{products:[],name:'کالا'},{products:[{...product,stock:0}],name:product.name}])('blocks unavailable checkout while keeping removal usable: $name',({products,name})=>{
  const view=stateful([{productId:1,quantity:1}],{products})
  const checkout=screen.getByRole('button',{name:/تکمیل مشخصات و ثبت سفارش/}) as HTMLButtonElement
  expect(checkout.disabled).toBe(true)
  expect(screen.getByRole('alert').textContent).toContain('کالاهای ناموجود')
  fireEvent.click(screen.getByRole('button',{name:`حذف ${name}`}))
  expect(view.current()).toEqual([])
  expect(screen.getByRole('button',{name:'دیدن کالاهای فروشگاه'})).toBeTruthy()
  expect(screen.queryByRole('button',{name:/تکمیل مشخصات و ثبت سفارش/})).toBeNull()
})

it('offers recovery for an empty basket without starting a new order',()=>{
  const view=stateful([],{pendingOrder:true})
  fireEvent.click(screen.getByRole('button',{name:'دریافت نتیجه سفارش قبلی'}))
  expect(view.callbacks.onRecover).toHaveBeenCalledOnce()
  expect(view.callbacks.onCheckout).not.toHaveBeenCalled()
  expect(screen.queryByRole('button',{name:/تکمیل مشخصات و ثبت سفارش/})).toBeNull()
})

it('recalculates the estimate from live delivery settings including a zero threshold',()=>{
  const view=stateful([{productId:1,quantity:2}])
  const total=()=>screen.getByText('جمع برآوردی').parentElement!.textContent
  expect(total()).toContain(formatPrice(285000))
  expect(screen.getByText(`${formatPrice(100000)} تومان تا حذف هزینه ارسال نمونه`)).toBeTruthy()
  view.rerender({settings:{...settings,shippingFee:20000,freeShippingThreshold:400000}})
  expect(total()).toContain(formatPrice(220000))
  expect(screen.getByText(`${formatPrice(200000)} تومان تا حذف هزینه ارسال نمونه`)).toBeTruthy()
  view.rerender({settings:{...settings,freeShippingThreshold:0}})
  expect(total()).toContain(formatPrice(200000))
  expect(screen.getByText('هزینه ارسال نمونه برای این سبد صفر است')).toBeTruthy()
  expect(screen.getByText('بدون هزینه نمونه')).toBeTruthy()
  expect(document.body.textContent).not.toContain('NaN')
})

type RecordedAnimation={node:Element;animation:Animation;finish:()=>void;cancel:ReturnType<typeof vi.fn>}
const originalAnimate=Object.getOwnPropertyDescriptor(Element.prototype,'animate')
afterEach(()=>{
  if(originalAnimate)Object.defineProperty(Element.prototype,'animate',originalAnimate)
  else delete (Element.prototype as Partial<Element>).animate
  delete document.documentElement.dataset.input
})
function controlledAnimations(){
  const records:RecordedAnimation[]=[]
  Object.defineProperty(Element.prototype,'animate',{configurable:true,writable:true,value:vi.fn(function(this:Element){
    let resolve!:()=>void,reject!:(reason:unknown)=>void
    const finished=new Promise<void>((yes,no)=>{resolve=yes;reject=no})
    void finished.catch(()=>{})
    let state:AnimationPlayState='running'
    const cancel=vi.fn(()=>{state='idle';reject(new DOMException('Cancelled','AbortError'))})
    const animation={get playState(){return state},finished,cancel} as unknown as Animation
    records.push({node:this,animation,cancel,finish:()=>{state='finished';resolve()}})
    return animation
  })})
  return records
}

it('keeps one dialog and its focus lock when a closing animation is reopened',async()=>{
  const records=controlledAnimations()
  const root=document.createElement('div');root.id='root';document.body.append(root)
  const opener=document.createElement('button');opener.textContent='باز کردن سبد';document.body.append(opener);opener.focus()
  const props={items:[],products:[product],settings,pendingOrder:false,setCart:()=>{},...callbacks()}
  const view=render(<CartDrawer {...props} open/>,{container:root})
  const dialog=screen.getByRole('dialog',{name:'سبد خرید'})
  const surfaceAnimation=()=>records.filter(record=>record.node===dialog).at(-1)!
  view.rerender(<CartDrawer {...props} open={false}/>)
  const closing=surfaceAnimation()
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  expect(root.inert).toBe(true)
  view.rerender(<CartDrawer {...props} open/>)
  expect(closing.cancel).toHaveBeenCalledOnce()
  await act(async()=>{closing.finish();await Promise.resolve()})
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  expect(document.body.style.overflow).toBe('hidden')
  expect(root.inert).toBe(true)
  view.rerender(<CartDrawer {...props} open={false}/>)
  await act(async()=>{surfaceAnimation().finish();await Promise.resolve()})
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.body.style.overflow).toBe('')
  expect(root.inert).toBe(false)
  expect(document.activeElement).toBe(opener)
  view.unmount();root.remove();opener.remove()
})

it('closes directly without travel when reduced motion is requested',()=>{
  const records=controlledAnimations()
  const media=window.matchMedia('(prefers-reduced-motion: reduce)')
  vi.spyOn(window,'matchMedia').mockImplementation(query=>({...media,media:query,matches:query==='(prefers-reduced-motion: reduce)'}))
  const props={items:[],products:[product],settings,pendingOrder:false,setCart:()=>{},...callbacks()}
  const view=render(<CartDrawer {...props} open/>)
  expect(records).toHaveLength(0)
  view.rerender(<CartDrawer {...props} open={false}/>)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(records).toHaveLength(0)
})
