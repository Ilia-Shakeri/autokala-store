import { expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import ProductDetail from '../../src/ProductDetail'
import type { Product } from '../../src/types'

const product:Product={id:1,name:'روغن نمونه',sku:'OIL-BHR-1040-4',brand:'بهران',price:100,oldPrice:125,stock:4,category:'روغن',label:'نمونه',visual:'oil',color:'amber',description:'شرح ساختگی برای بررسی کالا.',vehicles:['پراید','تیبا']}
const props={product,inCart:0,cartFull:false,saved:false,onFavorite:()=>{},onAdd:()=>true,onClose:()=>{},onCart:()=>{}}

it('caps selected quantity at remaining stock and recalculates its total before adding',()=>{
  const add=vi.fn(()=>true)
  const view=render(<ProductDetail {...props} inCart={2} onAdd={add}/>)
  const plus=screen.getByRole('button',{name:'زیاد کردن تعداد'})
  fireEvent.click(plus);fireEvent.click(plus)
  expect((plus as HTMLButtonElement).disabled).toBe(true)
  expect(within(screen.getByRole('group',{name:'تعداد برای افزودن'})).getByText('۲')).toBeTruthy()
  expect(screen.getByText('جمع ۲ عدد')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'افزودن به سبد',exact:true}))
  expect(add).toHaveBeenCalledWith(2)
  view.rerender(<ProductDetail {...props} inCart={3} onAdd={add}/>)
  expect(within(screen.getByRole('group',{name:'تعداد برای افزودن'})).getByText('۱')).toBeTruthy()
})
it.each([
  {changed:{product:{...product,stock:0}},label:'ناموجود'},
  {changed:{inCart:4},label:'سقف تعداد در سبد'},
  {changed:{product:{...product,stock:200},inCart:99},label:'سقف تعداد در سبد'},
  {changed:{cartFull:true},label:'سبد پر است'},
])('blocks buying when $label while keeping product information available',({changed,label})=>{
  const add=vi.fn(()=>true);render(<ProductDetail {...props} {...changed} onAdd={add}/>)
  const button=screen.getByRole('button',{name:label,exact:true}) as HTMLButtonElement
  expect(button.disabled).toBe(true);fireEvent.click(button);expect(add).not.toHaveBeenCalled()
  expect(screen.queryByRole('group',{name:'تعداد برای افزودن'})).toBeNull()
  expect(screen.getByRole('heading',{name:product.name})).toBeTruthy()
})
it('keeps source attribution, shows only valid price reductions, and exposes native vehicle details',()=>{
  const view=render(<ProductDetail {...props}/>)
  expect(screen.getByText('۲۰٪ کاهش نمونه')).toBeTruthy()
  expect(screen.getAllByRole('link').some(link=>link.getAttribute('href')?.includes('commons.wikimedia.org'))).toBe(true)
  const vehicle=screen.getByText('خودروهای نمونه').closest('details')!
  expect(vehicle.open).toBe(false);fireEvent.click(vehicle.querySelector('summary')!);expect(vehicle.open).toBe(true)
  expect(within(vehicle).getByText('پراید')).toBeTruthy()
  view.rerender(<ProductDetail {...props} product={{...product,oldPrice:90}}/>)
  expect(screen.queryByText(/کاهش نمونه/)).toBeNull()
})
it('stacks the large photo above the product and restores its trigger and scroll after Escape',()=>{
  render(<ProductDetail {...props}/>)
  const parent=screen.getByRole('dialog',{name:'جزئیات کالا'}) as HTMLElement
  const region=screen.getByRole('region',{name:'تصویر و مشخصات کالا'})
  region.scrollTop=90
  const trigger=screen.getByRole('button',{name:'نمایش تصویر بزرگ کالا'});trigger.focus();fireEvent.click(trigger)
  expect(parent.inert).toBe(true)
  const photo=screen.getByRole('dialog',{name:'تصویر نمونه کالا'})
  expect(within(photo).getByRole('img').getAttribute('loading')).toBe('eager')
  fireEvent.keyDown(within(photo).getByRole('button',{name:'بستن',exact:true}),{key:'Escape'})
  expect(screen.queryByRole('dialog',{name:'تصویر نمونه کالا'})).toBeNull()
  expect(parent.inert).toBe(false);expect(document.activeElement).toBe(trigger);expect(region.scrollTop).toBe(90)
})
it('falls back on a failed photo and disables the image action without blocking purchase',()=>{
  render(<ProductDetail {...props}/>)
  fireEvent.error(screen.getByRole('img'))
  expect(screen.queryByRole('img')).toBeNull()
  expect((screen.getByRole('button',{name:'نمایش تصویر بزرگ کالا'}) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText('تصویر بارگذاری نشد')).toBeTruthy()
  expect((screen.getByRole('button',{name:'افزودن به سبد',exact:true}) as HTMLButtonElement).disabled).toBe(false)
})
it('has an honest empty-image and unknown-fit state and preserves favorite actions',()=>{
  const favorite=vi.fn()
  const view=render(<ProductDetail {...props} product={{...product,visual:'unknown',sku:'UNKNOWN',vehicles:[]}} onFavorite={favorite}/>)
  expect(screen.queryByRole('button',{name:'نمایش تصویر بزرگ کالا'})).toBeNull()
  expect(screen.getByText('تصویر این کالا در دسترس نیست.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:`نشان کردن ${product.name}`}));expect(favorite).toHaveBeenCalledOnce()
  view.rerender(<ProductDetail {...props} saved/>)
  expect(screen.getByRole('button',{name:`حذف نشان ${product.name}`}).getAttribute('aria-pressed')).toBe('true')
})
it('hands off to the cart only after requesting product close',()=>{
  const calls:string[]=[]
  render(<ProductDetail {...props} inCart={1} onClose={()=>calls.push('close')} onCart={()=>calls.push('cart')}/>)
  fireEvent.click(screen.getByRole('button',{name:'دیدن سبد ۱'}))
  expect(calls).toEqual(['close','cart'])
  expect((screen.getByRole('button',{name:'افزودن به سبد',exact:true}) as HTMLButtonElement).disabled).toBe(true)
})
