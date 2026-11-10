import { useEffect, useId, useRef, useState } from 'react'
import { Modal } from './Modal'
import { ProductImage, PhotoCredit, productPhoto } from './ProductImage'
import { ActionButton, useActionFeedback } from './ActionButton'
import { CartNumber } from './cart-motion'
import { useDialogMotion } from './dialog-motion'
import { Icon, formatPrice } from './ui'
import type { Product } from './types'
import './product-page.css'

type Props={product:Product;inCart:number;cartFull:boolean;saved:boolean;onFavorite:()=>void;onAdd:(quantity:number)=>boolean;onClose:()=>void;onCart:()=>void}

function ProductPhotoDialog({product,onClose}:{product:Product;onClose:()=>void}) {
  const panel=useRef<HTMLDivElement>(null)
  const [failed,setFailed]=useState(false)
  const {closing,requestClose}=useDialogMotion(panel,false,onClose)
  return <Modal className="product-photo-dialog" surfaceRef={panel} title="تصویر نمونه کالا" onClose={requestClose} closeDisabled={closing}>
    <div className="product-photo-stage"><ProductImage product={product} eager onUnavailable={()=>setFailed(true)}/></div>
    {failed&&<p className="product-photo-caption" role="status">تصویر بارگذاری نشد؛ نمای ساده کالا نمایش داده می‌شود.</p>}
    <p className="product-photo-caption">{product.name}</p><PhotoCredit product={product}/>
  </Modal>
}

export default function ProductDetail({product,inCart,cartFull,saved,onFavorite,onAdd,onClose,onCart}:Props) {
  const panel=useRef<HTMLDivElement>(null)
  const openCartAfter=useRef(false)
  const {closing,requestClose}=useDialogMotion(panel,false,()=>{onClose();if(openCartAfter.current)onCart()})
  const [photoOpen,setPhotoOpen]=useState(false)
  const [failedPhoto,setFailedPhoto]=useState(false)
  const [quantity,setQuantity]=useState(1)
  const feedback=useActionFeedback()
  const id=useId()
  const maximum=Math.max(0,Math.min(product.stock,99)-inCart)
  const selected=Math.min(quantity,Math.max(1,maximum))
  const unavailable=product.stock<=0
  const blocked=unavailable||maximum===0||cartFull
  const oldPrice=product.oldPrice&&product.oldPrice>product.price?product.oldPrice:null
  const reduction=oldPrice?Math.round((1-product.price/oldPrice)*100):0
  const photo=productPhoto(product)
  useEffect(()=>{setFailedPhoto(false)},[photo?.src])
  useEffect(()=>{setQuantity(current=>Math.max(1,Math.min(current,maximum)))},[maximum])
  const viewCart=()=>{if(closing)return;openCartAfter.current=true;requestClose()}
  const add=()=>{if(closing||blocked)return;feedback.clear();if(onAdd(selected))feedback.complete()}
  const buttonLabel=unavailable?'ناموجود':cartFull?'سبد پر است':maximum===0?'سقف تعداد در سبد':'افزودن به سبد'
  return <>
    <Modal className="product-detail-dialog product-page" surfaceRef={panel} title="جزئیات کالا" onClose={requestClose} closeDisabled={closing} footer={<div className="product-buybar">
      <div className="product-buy-total"><span>{selected===1?'قیمت کالا':`جمع ${formatPrice(selected)} عدد`}<small>تومان</small></span><strong><CartNumber value={product.price*selected}/></strong></div>
      <div className="product-buy-actions">
        {(inCart>0||cartFull)&&<button type="button" className="product-view-cart" disabled={closing} onClick={viewCart}><Icon name="bag" size={18}/>دیدن سبد {inCart>0&&<span>{formatPrice(inCart)}</span>}</button>}
        <ActionButton type="button" disabled={blocked||closing} done={feedback.done} doneLabel="به سبد اضافه شد" onClick={add}><Icon name="cart" size={19}/>{buttonLabel}</ActionButton>
      </div>
      <p className="product-buy-note"><Icon name="shield" size={13}/>قیمت و موجودی نمونه‌اند؛ مبلغ نهایی هنگام ثبت بررسی می‌شود.</p>
    </div>}>
      <div className="product-page-body" tabIndex={0} role="region" aria-label="تصویر و مشخصات کالا">
        <div className="product-page-grid">
          <div className="product-page-heading">
            <div className="product-page-meta"><span>{product.category}</span><button type="button" disabled={closing} className={saved?'product-save is-saved':'product-save'} aria-pressed={saved} aria-label={`${saved?'حذف نشان':'نشان کردن'} ${product.name}`} onClick={onFavorite}><Icon name="heart" size={19}/>{saved?'نشان‌شده':'نشان کن'}</button></div>
            <span className="product-brand">{product.brand}</span><h3 className="product-page-title">{product.name}</h3>
            <p className="product-code">کد کالا <bdi dir="ltr">{product.sku}</bdi></p>
          </div>
          <div className="product-page-media">
            <div className="product-page-image"><span className="product-photo-tag">عکس نمونه</span>{reduction>0&&<span className="product-reduction">{formatPrice(reduction)}٪ کاهش نمونه</span>}
              {photo?<button type="button" disabled={closing||failedPhoto} onClick={()=>setPhotoOpen(true)} aria-label="نمایش تصویر بزرگ کالا"><ProductImage product={product} eager onUnavailable={()=>setFailedPhoto(true)}/><span className="product-image-expand"><Icon name={failedPhoto?'box':'search'} size={16}/>{failedPhoto?'تصویر بارگذاری نشد':'تصویر بزرگ‌تر'}</span></button>:<div className="product-no-photo"><ProductImage product={product}/><span>تصویر این کالا در دسترس نیست.</span></div>}
            </div>
            <PhotoCredit product={product}/>
          </div>
          <div className="product-page-info">
            <div className="product-price-card"><div><span>قیمت هر عدد · نمونه</span>{oldPrice&&<del>{formatPrice(oldPrice)} تومان</del>}<strong><CartNumber value={product.price}/><small>تومان</small></strong></div><span className={unavailable?'product-availability is-unavailable':'product-availability'}><Icon name={unavailable?'x':'check'} size={15}/>{unavailable?'ناموجود':`${formatPrice(product.stock)} عدد موجودی نمونه`}</span></div>
            <p className="product-page-description">{product.description}</p>
            {!blocked&&<div className="product-quantity-row"><div><label id={`${id}-quantity`}>تعداد برای افزودن</label><small>{inCart>0?`${formatPrice(inCart)} عدد از این کالا در سبد است.`:'تعداد دلخواه را انتخاب کن.'}</small></div><div className="product-quantity" role="group" aria-labelledby={`${id}-quantity`}>
              <button type="button" disabled={closing||selected<=1} aria-label="کم کردن تعداد" onClick={()=>{feedback.clear();setQuantity(value=>Math.max(1,value-1))}}><Icon name="minus" size={17}/></button><span aria-live="polite" aria-atomic="true"><CartNumber value={selected}/></span><button type="button" disabled={closing||selected>=maximum} aria-label="زیاد کردن تعداد" onClick={()=>{feedback.clear();setQuantity(value=>Math.min(maximum,value+1))}}><Icon name="plus" size={17}/></button>
            </div></div>}
            {blocked&&<p className="product-blocked" role="status">{unavailable?'این کالا فعلاً موجود نیست؛ می‌توانی برای بعد نشانش کنی.':cartFull?'سبد به سقف ۵۰ کالای متفاوت رسیده است. ابتدا یک کالا را از سبد حذف کن.':'تعداد این کالا در سبد به سقف موجودی یا ۹۹ عدد رسیده است.'}</p>}
            <section className="product-fit-note"><Icon name="car" size={21}/><div><h4>قطعه درست را با کد فنی پیدا کن.</h4><p>مدل خودرو به‌تنهایی کافی نیست؛ کد قطعه و دفترچه خودرو را تطبیق بده. سازگاری‌های این نسخه نمونه‌اند.</p></div></section>
            <div className="product-spec-sections">
              <details open><summary>مشخصات کالا<Icon name="chevron" size={17}/></summary><dl><div><dt>برند</dt><dd>{product.brand}</dd></div><div><dt>کد کالا</dt><dd><bdi dir="ltr">{product.sku}</bdi></dd></div><div><dt>دسته</dt><dd>{product.category}</dd></div><div><dt>موجودی نمونه</dt><dd>{formatPrice(product.stock)} عدد</dd></div></dl></details>
              <details><summary>خودروهای نمونه<small>{formatPrice(product.vehicles.length)} مدل</small><Icon name="chevron" size={17}/></summary><div className="product-vehicles">{product.vehicles.length?<ul>{product.vehicles.map((vehicle,index)=><li key={`${vehicle}-${index}`}><Icon name="car" size={15}/>{vehicle}</li>)}</ul>:<p>برای این کالا خودرویی ثبت نشده است.</p>}<p>تأیید نهایی با مشخصات سازنده و کد فنی لازم است.</p></div></details>
              <details><summary>درباره ارسال و پرداخت<Icon name="chevron" size={17}/></summary><p className="product-service-note">روش حمل، زمان تحویل و درگاه پرداخت هنوز تنظیم نشده‌اند. این نسخه برای بررسی فروشگاه است؛ وجهی دریافت نمی‌شود.</p></details>
            </div>
          </div>
        </div>
      </div>
    </Modal>
    {photoOpen&&<ProductPhotoDialog product={product} onClose={()=>setPhotoOpen(false)}/>}
  </>
}
