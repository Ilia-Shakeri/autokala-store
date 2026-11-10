import { it,expect,vi } from 'vitest'
import { render,screen,fireEvent,waitFor } from '@testing-library/react'
import Storefront from '../../src/Storefront'
import { categories,products,vehicles } from '../../server/seed.mjs'
import type { CartItem,Catalog } from '../../src/types'
import * as network from '../../src/api'

const catalog={products:products.map((product:object,index:number)=>({...product,id:index+1})),categories:categories.map((category:{title:string},index:number)=>({...category,id:index+1,count:2})),vehicles,settings:{demo:true,paymentMode:'manual',storeName:'اتوکالا',shippingFee:85000,freeShippingThreshold:2000000}} as Catalog
function show(){render(<Storefront catalog={catalog} cart={[]} setCart={()=>{}} user={null} onAccount={()=>{}} onRefresh={()=>{}} notify={()=>{}}/>)}
it('has no management shortcut on the public store and all catalog products have local photos',()=>{show();expect(screen.queryByRole('button',{name:'پنل مدیریت'})).toBeNull();expect(screen.queryByText('ورود به پنل مدیریت')).toBeNull();const images=screen.getAllByRole('img');expect(images).toHaveLength(12);expect(images.every(image=>image.getAttribute('src')?.startsWith('/products/'))).toBe(true)})
it('searches SKU and brand and keeps category matches exact',()=>{show();const search=screen.getByRole('searchbox',{name:'جست‌وجوی کالا'});fireEvent.change(search,{target:{value:'FLT-SRK'}});expect(screen.getAllByRole('article')).toHaveLength(2);fireEvent.change(search,{target:{value:''}});fireEvent.click(screen.getByRole('button',{name:'لنت و ترمز',exact:true}));expect(screen.getAllByRole('article')).toHaveLength(2)})
it('submits the header search across all products after clearing an old category filter',()=>{
  show();fireEvent.click(screen.getByRole('button',{name:'لنت و ترمز',exact:true}))
  fireEvent.change(screen.getByRole('searchbox',{name:'جست‌وجو در فروشگاه'}),{target:{value:'FLT-SRK'}})
  expect(screen.queryAllByRole('article')).toHaveLength(0)
  fireEvent.submit(screen.getByRole('search',{name:'جست‌وجوی فروشگاه'}))
  expect(screen.getAllByRole('article')).toHaveLength(2)
  expect(screen.getByRole('searchbox',{name:'جست‌وجوی کالا'}).getAttribute('value')).toBe('FLT-SRK')
})
it('reveals source and license while preserving the product detail flow',()=>{show();fireEvent.click(screen.getByRole('button',{name:'مشخصات فیلتر هوای سرکان مناسب پژو ۲۰۶ تیپ ۲',exact:true}));expect(screen.getByRole('dialog')).toBeTruthy();expect(screen.getByText(/عکس نمونه؛ برند و بسته‌بندی/)).toBeTruthy();expect(screen.getAllByRole('link').some(link=>link.getAttribute('href')?.startsWith('https://commons.wikimedia.org/'))).toBe(true)})
it('counts only distinct saved favorites still in the catalog',()=>{
  localStorage.setItem('autokala.favorites.v1',JSON.stringify([1,1,0,-1,999,'2',null]))
  show()
  fireEvent.click(screen.getByRole('button',{name:'نشان‌شده‌ها (۱)'}))
  expect(screen.getAllByRole('article')).toHaveLength(1)
})
it('refreshes an open product detail when catalog stock changes',()=>{
  const props={cart:[],setCart:()=>{},user:null,onAccount:()=>{},onRefresh:()=>{},notify:()=>{}}
  const {rerender}=render(<Storefront {...props} catalog={catalog}/>)
  fireEvent.click(screen.getByRole('button',{name:`مشخصات ${catalog.products[0].name}`,exact:true}))
  rerender(<Storefront {...props} catalog={{...catalog,products:catalog.products.map((p,index)=>index? p:{...p,stock:0})}}/>)
  expect((screen.getByRole('button',{name:'ناموجود',exact:true}) as HTMLButtonElement).disabled).toBe(true)
})
it('closes the phone menu with Escape and outside press and restores its trigger focus',()=>{
  show()
  fireEvent.click(screen.getByRole('button',{name:'باز کردن فهرست'}))
  const close=screen.getByRole('button',{name:'بستن فهرست'})
  expect(close.getAttribute('aria-expanded')).toBe('true')
  fireEvent.keyDown(document,{key:'Escape'})
  expect(screen.getByRole('button',{name:'باز کردن فهرست'})).toBe(document.activeElement)
  fireEvent.click(screen.getByRole('button',{name:'باز کردن فهرست'}))
  fireEvent.pointerDown(document.body)
  expect(screen.getByRole('button',{name:'باز کردن فهرست'}).getAttribute('aria-expanded')).toBe('false')
})
it('blocks a fifty-first distinct product before checkout can reject the basket',()=>{
  const expanded={...catalog,products:Array.from({length:51},(_,index)=>({...catalog.products[0],id:index+1,name:`کالای ${index+1}`}))}
  const setCart=vi.fn(),notify=vi.fn()
  render(<Storefront catalog={expanded} cart={expanded.products.slice(0,50).map(product=>({productId:product.id,quantity:1}))} setCart={setCart} user={null} onAccount={()=>{}} onRefresh={()=>{}} notify={notify}/>)
  fireEvent.click(screen.getByRole('button',{name:'افزودن کالای 51 به سبد'}))
  expect(setCart).not.toHaveBeenCalled()
  expect(notify).toHaveBeenCalledWith('سبد حداکثر ۵۰ کالای متفاوت می‌پذیرد. ابتدا یک کالا را حذف کنید.')
})
it('keeps later cart additions when recovering an earlier order',async()=>{
  const firstProduct=catalog.products[0],secondProduct=catalog.products[1]
  const original=[{productId:firstProduct.id,quantity:1}]
  const quote={subtotal:firstProduct.price,shipping:0,total:firstProduct.price,items:[{productId:firstProduct.id,name:firstProduct.name,price:firstProduct.price,quantity:1,lineTotal:firstProduct.price}]}
  let orderCalls=0
  vi.spyOn(network,'api').mockImplementation(async path=>{
    if(path==='/quote')return quote as never
    if(path==='/orders'){
      if(++orderCalls===1)throw new Error('پاسخ ثبت نرسید')
      return {order:{id:'AK-RECOVERED',status:'pending_payment',createdAt:new Date().toISOString(),...quote},receiptToken:'d'.repeat(43)} as never
    }
    return {} as never
  })
  const setCart=vi.fn(),props={catalog,setCart,user:null,onAccount:()=>{},onRefresh:()=>{},notify:()=>{}}
  const view=render(<Storefront {...props} cart={original}/>)
  fireEvent.click(screen.getByRole('button',{name:'سبد خرید، 1 کالا'}))
  fireEvent.click(screen.getByRole('button',{name:'تکمیل مشخصات و ثبت سفارش'}))
  await screen.findByRole('button',{name:'ثبت سفارش در انتظار پرداخت'})
  await waitFor(()=>expect((screen.getByRole('button',{name:'ثبت سفارش در انتظار پرداخت'}) as HTMLButtonElement).disabled).toBe(false))
  for(const [name,value] of [['نام و نام خانوادگی','کاربر نمونه'],['موبایل گیرنده','09123456789'],['ایمیل رسید','buyer@example.test'],['کد پستی','1234567890'],['نشانی کامل','نشانی ساختگی برای آزمون، پلاک ۱۲']])fireEvent.change(screen.getByLabelText(name,{exact:true}),{target:{value}})
  fireEvent.submit((screen.getByRole('button',{name:'ثبت سفارش در انتظار پرداخت'}) as HTMLButtonElement).form!)
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button',{name:'بازگشت'}))
  const later=[{productId:firstProduct.id,quantity:3},{productId:secondProduct.id,quantity:2}]
  view.rerender(<Storefront {...props} cart={later}/>)
  fireEvent.click(screen.getByRole('button',{name:'سبد خرید، 5 کالا'}))
  fireEvent.click(screen.getByRole('button',{name:'دریافت نتیجه سفارش قبلی'}))
  fireEvent.submit((screen.getByRole('button',{name:'دریافت نتیجه سفارش قبلی'}) as HTMLButtonElement).form!)
  await screen.findByText('سفارش ثبت شد. پرداخت هنوز انجام نشده است.')
  const update=setCart.mock.calls.at(-1)![0]
  expect(update(later)).toEqual([{productId:firstProduct.id,quantity:2},{productId:secondProduct.id,quantity:2}])
})
it.each([{cart:[]},{cart:[{productId:999999,quantity:1}]}] as {cart:CartItem[]}[])('recovers an unresolved order even when the current basket is empty or invalid: $cart',async({cart})=>{
  const product=catalog.products[0]
  const items=[{productId:product.id,quantity:1}]
  const quote={subtotal:product.price,shipping:0,total:product.price,items:[{productId:product.id,name:product.name,price:product.price,quantity:1,lineTotal:product.price}]}
  const body={items,customer:{name:'کاربر نمونه',email:'buyer@example.test',phone:'09123456789',address:'نشانی ساختگی برای آزمون، پلاک ۱۲',postalCode:'1234567890'},note:'',idempotencyKey:'pending-empty-basket-key',expectedTotal:quote.total}
  sessionStorage.setItem('autokala.pending-order.v1',JSON.stringify({body,quote,ownerId:null}))
  const request=vi.spyOn(network,'api').mockResolvedValue({order:{id:'AK-RECOVERED-EMPTY',status:'pending_payment',createdAt:new Date().toISOString(),...quote},receiptToken:'g'.repeat(43)} as never)
  render(<Storefront catalog={catalog} cart={cart} setCart={()=>{}} user={null} onAccount={()=>{}} onRefresh={()=>{}} notify={()=>{}}/>)
  fireEvent.click(screen.getByRole('button',{name:`سبد خرید، ${cart.length} کالا`}))
  expect(screen.getByText('نتیجه یک درخواست سفارش هنوز روشن نیست.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'دریافت نتیجه سفارش قبلی'}))
  fireEvent.submit((screen.getByRole('button',{name:'دریافت نتیجه سفارش قبلی'}) as HTMLButtonElement).form!)
  await screen.findByText('سفارش ثبت شد. پرداخت هنوز انجام نشده است.')
  expect(request).toHaveBeenCalledTimes(1)
  expect(request.mock.calls[0][0]).toBe('/orders')
  expect(JSON.parse(request.mock.calls[0][1]!.body as string)).toEqual(body)
})
