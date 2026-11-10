import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Modal } from './Modal'
import { ProductImage } from './ProductImage'
import { Icon, formatPrice } from './ui'
import { CartNumber, cartMotionAllowed, useCartRowsMotion } from './cart-motion'
import type { CartItem, Product, Settings } from './types'
import './cart.css'

type Props={open:boolean;items:CartItem[];products:Product[];settings:Settings;setCart:Dispatch<SetStateAction<CartItem[]>>;pendingOrder:boolean;onClose:()=>void;onBrowse:()=>void;onCheckout:()=>void;onRecover:()=>void;onInspect:(product:Product)=>void}

export default function CartDrawer({open,items,products,settings,setCart,pendingOrder,onClose,onBrowse,onCheckout,onRecover,onInspect}:Props){
  const [present,setPresent]=useState(open)
  const panel=useRef<HTMLDivElement>(null)
  const list=useRef<HTMLDivElement>(null)
  const undoButton=useRef<HTMLButtonElement>(null)
  const restoreFocus=useRef<number|null>(null)
  const [removed,setRemoved]=useState<{item:CartItem;name:string;index:number}|null>(null)
  const [notice,setNotice]=useState('')
  const motion=useRef<Animation[]>([])
  const revision=items.map(item=>`${item.productId}:${item.quantity}`).join('|')
  const captureRows=useCartRowsMotion(list,revision,present)
  useLayoutEffect(()=>{
    if(open&&!present){setPresent(true);return}
    const surface=panel.current
    if(!surface)return
    let cancelled=false
    const backdrop=surface.parentElement!
    const current=getComputedStyle(surface)
    const interrupted=motion.current.some(animation=>animation.playState==='running')
    const from=interrupted?current.transform:open?'translateX(-100%)':'translateX(0)'
    const backdropOpacity=interrupted?getComputedStyle(backdrop).opacity:open?'0':'1'
    for(const animation of motion.current)animation.cancel()
    motion.current=[]
    if(!surface.animate||!cartMotionAllowed()){
      if(!open)setPresent(false)
      return
    }
    const slide=surface.animate([{transform:from},{transform:open?'translateX(0)':'translateX(-100%)'}],{duration:open?280:200,easing:'cubic-bezier(0.32, 0.72, 0, 1)',fill:'both'})
    const shade=backdrop.animate([{opacity:backdropOpacity},{opacity:open?1:0}],{duration:open?220:180,easing:'cubic-bezier(0.23, 1, 0.32, 1)',fill:'both'})
    motion.current=[slide,shade]
    if(!open)void slide.finished.then(()=>{if(!cancelled)setPresent(false)}).catch(()=>{})
    return()=>{cancelled=true}
  },[open,present])
  useEffect(()=>{if(!present){for(const animation of motion.current)animation.cancel();motion.current=[];setRemoved(null);setNotice('')}},[present])
  useEffect(()=>()=>{for(const animation of motion.current)animation.cancel()},[])
  useLayoutEffect(()=>{if(removed)undoButton.current?.focus({preventScroll:true})},[removed])
  useLayoutEffect(()=>{
    if(removed||restoreFocus.current===null)return
    const target=list.current?.querySelector<HTMLButtonElement>(`[data-cart-row="${restoreFocus.current}"] .cart-line-content button`)
    if(target){target.focus({preventScroll:true});restoreFocus.current=null}
  },[revision,removed])
  const count=items.reduce((sum,item)=>sum+item.quantity,0)
  const subtotal=items.reduce((sum,item)=>sum+(products.find(product=>product.id===item.productId)?.price||0)*item.quantity,0)
  const invalid=items.some(item=>{const product=products.find(product=>product.id===item.productId);return !product||item.quantity>product.stock})
  const shipping=subtotal>=settings.freeShippingThreshold?0:settings.shippingFee
  const remaining=Math.max(0,settings.freeShippingThreshold-subtotal)
  const progress=settings.freeShippingThreshold>0?Math.min(1,subtotal/settings.freeShippingThreshold):1
  const remove=(item:CartItem)=>{
    captureRows()
    setRemoved({item:{...item},name:products.find(product=>product.id===item.productId)?.name||'کالای حذف‌شده',index:items.findIndex(entry=>entry.productId===item.productId)})
    setNotice('')
    setCart(current=>current.filter(entry=>entry.productId!==item.productId))
  }
  const change=(item:CartItem,delta:number)=>{
    if(delta<0&&item.quantity===1){remove(item);return}
    captureRows()
    const stock=products.find(product=>product.id===item.productId)?.stock??0
    setCart(current=>current.map(entry=>{
      if(entry.productId!==item.productId)return entry
      const quantity=delta>0?Math.max(entry.quantity,Math.min(99,stock,entry.quantity+1)):Math.max(1,entry.quantity-1)
      return {...entry,quantity}
    }))
  }
  const undo=()=>{
    if(!removed)return
    const product=products.find(product=>product.id===removed.item.productId)
    const existing=items.find(item=>item.productId===removed.item.productId)
    if(!product||!product.stock||(!existing&&items.length>=50)){setNotice('بازگرداندن ممکن نیست؛ موجودی یا ظرفیت سبد تغییر کرده است.');return}
    captureRows()
    restoreFocus.current=product.id
    setCart(current=>{
      const found=current.find(item=>item.productId===product.id)
      const quantity=Math.min(99,product.stock,(found?.quantity||0)+removed.item.quantity)
      if(found)return current.map(item=>item.productId===product.id?{...item,quantity:Math.max(item.quantity,quantity)}:item)
      if(current.length>=50)return current
      const next=[...current];next.splice(Math.min(removed.index,next.length),0,{productId:product.id,quantity});return next
    })
    setNotice(`${removed.name} به سبد برگشت.`);setRemoved(null)
  }
  if(!present)return null
  return <Modal title="سبد خرید" drawer className="cart-sheet" surfaceRef={panel} onClose={onClose}>
    <div className="cart-intro"><span><Icon name="bag" size={17}/>انتخاب‌های شما</span><span className="cart-item-count"><CartNumber value={count}/> کالا</span></div>
    <div className="cart-body" ref={list} role="region" aria-label="کالاهای سبد" tabIndex={0}>
      {!!items.length&&<div className="cart-delivery"><span className="cart-delivery-icon"><Icon name="truck" size={21}/></span><div><strong>{remaining?`${formatPrice(remaining)} تومان تا حذف هزینه ارسال نمونه`:'هزینه ارسال نمونه برای این سبد صفر است'}</strong><p>برآورد بر اساس تنظیمات فعلی؛ مبلغ نهایی در مرحله بعد.</p></div><div className="cart-progress" aria-hidden="true"><span style={{transform:`scaleX(${progress})`}}/></div></div>}
      {items.length?<div className="cart-lines">{items.map(item=>{
        const product=products.find(product=>product.id===item.productId)
        const issue=!product?'این کالا دیگر در کاتالوگ نیست.':item.quantity>product.stock?`موجودی فعلی: ${formatPrice(product.stock)} عدد؛ تعداد را اصلاح کنید.`:''
        return <article className={`cart-line${issue?' cart-line-invalid':''}`} data-cart-row={item.productId} key={item.productId}>
          <button type="button" className="cart-line-image" disabled={!product} onClick={()=>product&&onInspect(product)} aria-label={`مشخصات ${product?.name||'کالای حذف‌شده'}`}><ProductImage product={product||{sku:'',visual:'filter',name:'کالای حذف‌شده'}}/></button>
          <div className="cart-line-content"><span className="cart-line-brand">{product?.brand||'کالا در دسترس نیست'}{product&&<bdi>{product.sku}</bdi>}</span><h3><button type="button" disabled={!product} onClick={()=>product&&onInspect(product)}>{product?.name||'کالای حذف‌شده'}</button></h3><span className="cart-unit-price">هر عدد {formatPrice(product?.price||0)} تومان</span></div>
          <div className="cart-line-controls"><div className="cart-stepper" role="group" aria-label={`تعداد ${product?.name||'کالا'}`}><button type="button" aria-label={`کم کردن ${product?.name||'کالا'}`} onClick={()=>change(item,-1)}><Icon name="minus" size={16}/></button><span aria-live="polite" aria-atomic="true"><CartNumber value={item.quantity}/></span><button type="button" aria-label={`زیاد کردن ${product?.name||'کالا'}`} disabled={!product||item.quantity>=product.stock||item.quantity>=99} onClick={()=>change(item,1)}><Icon name="plus" size={16}/></button></div><button type="button" className="cart-remove" aria-label={`حذف ${product?.name||'کالا'}`} onClick={()=>remove(item)}><Icon name="x" size={14}/>حذف</button><strong className="cart-line-total"><CartNumber value={(product?.price||0)*item.quantity}/><small>تومان</small></strong></div>
          {issue&&<p className="cart-line-error" role="status"><Icon name="box" size={15}/>{issue}</p>}
        </article>
      })}</div>:<div className="cart-empty-state"><span className="cart-empty-mark"><Icon name="bag" size={45}/><i><Icon name="plus" size={16}/></i></span><span className="cart-empty-kicker">جای انتخاب‌های خوب خالی است</span><h3>سبد خریدت منتظرته.</h3><p>قطعه مناسب خودروت را پیدا کن؛<br/>مشخصاتش را ببین و به سبد اضافه کن.</p><button type="button" onClick={onBrowse}>دیدن کالاهای فروشگاه<Icon name="arrow" size={18}/></button><span className="cart-empty-note"><Icon name="shield" size={16}/>قیمت و مشخصات، پیش از ثبت قابل بررسی‌اند.</span></div>}
    </div>
    <div className="cart-bottom">
      {removed&&<div className="cart-undo"><p role="status">کالا از سبد حذف شد.<small>{removed.name}</small></p><button type="button" ref={undoButton} onClick={undo}>بازگرداندن<Icon name="refresh" size={15}/></button></div>}
      {notice&&<p className="cart-feedback" role="status">{notice}</p>}
      {pendingOrder&&<div className="cart-recovery"><p>نتیجه یک درخواست سفارش هنوز روشن نیست.</p><button type="button" onClick={onRecover}>دریافت نتیجه سفارش قبلی<Icon name="orders" size={17}/></button></div>}
      {!!items.length&&!pendingOrder&&<><dl className="cart-estimate"><div><dt>جمع کالاها <small>({formatPrice(count)} عدد)</small></dt><dd><CartNumber value={subtotal}/> <small>تومان</small></dd></div><div><dt>برآورد ارسال نمونه</dt><dd>{shipping?<><CartNumber value={shipping}/> <small>تومان</small></>:<span className="cart-zero-shipping">بدون هزینه نمونه</span>}</dd></div></dl><div className="cart-payable"><span>جمع برآوردی<small>قیمت نهایی از سرور تأیید می‌شود</small></span><strong><CartNumber value={subtotal+shipping}/><small>تومان</small></strong></div>{invalid&&<p className="cart-blocked" role="alert">پیش از ادامه، کالاهای ناموجود یا تعدادشان را اصلاح کنید.</p>}{!pendingOrder&&<button type="button" className="cart-checkout" aria-label="تکمیل مشخصات و ثبت سفارش" disabled={invalid} onClick={onCheckout}><span>تکمیل مشخصات و ثبت سفارش<small>مرحله بعد: اطلاعات گیرنده</small></span><Icon name="arrow" size={21}/></button>}<p className="cart-safe-note"><Icon name="shield" size={14}/>{settings.demo?'نسخه آزمایشی؛ در این مرحله وجهی دریافت نمی‌شود.':'ثبت سفارش، پیش از پرداخت و بررسی نهایی مبلغ.'}</p></>}
    </div>
  </Modal>
}
