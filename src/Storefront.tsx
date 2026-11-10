import { useEffect, useId, useMemo, useRef, useState, type Dispatch, type SetStateAction, type FormEvent } from 'react'
import { api, json, normalize } from './api'
import { Modal } from './Modal'
import { ProductImage, PhotoCredit } from './ProductImage'
import { Select } from './Select'
import { ActionButton, CartButton, useActionFeedback } from './ActionButton'
import { CheckoutDialog, hasPendingOrder } from './CommerceDialogs'
import { Icon, Logo, formatPrice, categoryIcon } from './ui'
import type { CartItem, Catalog, Product, User } from './types'
import { phoneIssue } from './customer-validation'
import CartDrawer from './CartDrawer'
import { CartNumber } from './cart-motion'

type Props = {catalog: Catalog; cart: CartItem[]; setCart: Dispatch<SetStateAction<CartItem[]>>; user: User | null; onAccount:()=>void; onRefresh:()=>void; notify:(message:string)=>void}
const information: Record<string, string[]> = {
  'درباره ما': ['اتوکالا برای انتخاب لوازم مصرفی خودرو طراحی شده است: جست‌وجوی کالا، بررسی مشخصات، ساخت سبد و پیگیری سفارش در یک مسیر.', 'این نسخه، محیط بررسی فروشگاه است. نام و قیمت و موجودی کالاها نمونه‌اند و پیش از فروش عمومی باید توسط فروشنده تأیید شوند.'],
  'تماس با ما': ['شماره تماس، نشانی فروشگاه و ساعت پاسخ‌گویی هنوز توسط مالک تعیین نشده‌اند.', 'اطلاعات تماس پس از تأیید مالک، در تنظیمات فروشگاه ثبت می‌شوند.'],
  'روش‌های پرداخت': ['درگاه پرداخت هنوز انتخاب نشده است. در این نسخه وجهی دریافت نمی‌شود.', 'پس از ثبت، وضعیت سفارش «در انتظار پرداخت» است. تأیید پرداخت فقط پس از بررسی مدیر ثبت می‌شود.'],
  'ارسال سفارش': ['روش حمل، محدوده پوشش و زمان تحویل هنوز تعیین نشده‌اند.', 'هزینه نمایش‌داده‌شده نمونه است. شرایط نهایی ارسال پیش از آغاز فروش عمومی اعلام می‌شوند.'],
  'شرایط بازگشت': ['سیاست نهایی بازگشت کالا هنوز توسط مالک تأیید نشده است.', 'پیش از خرید واقعی، شرایط بازگشت، وضعیت بسته‌بندی و راه ثبت درخواست در همین بخش اعلام می‌شوند.'],
  'فرصت‌های شغلی': ['فعلاً موقعیت شغلی فعالی برای فروشگاه ثبت نشده است.'],
  'مجله خودرو': ['انتخاب قطعه را با مشخصات دفترچه خودرو و کد فنی قطعه تطبیق دهید. نام مدل به‌تنهایی برای تشخیص سازگاری کافی نیست.', 'در صفحه هر کالا، کد محصول، توضیح و فهرست خودروها را ببینید. اطلاعات سازگاری این نسخه نمونه است؛ تأیید نهایی پیش از فروش لازم است.', 'برای سرویس دوره‌ای، تاریخ و کارکرد آخرین سرویس را ثبت کنید و برنامه پیشنهادی سازنده خودرو را دنبال کنید.'],
}
function savedFavorites(): number[] { try {const value=JSON.parse(localStorage.getItem('autokala.favorites.v1')||'[]');return Array.isArray(value)?[...new Set<number>(value.filter((id:unknown):id is number=>Number.isSafeInteger(id)&&Number(id)>0&&Number(id)<=2147483647))]:[]}catch{return []} }

export default function Storefront({catalog,cart,setCart,user,onAccount,onRefresh,notify}:Props) {
  const {products,categories,vehicles,settings}=catalog
  const [category,setCategory]=useState('همه')
  const [query,setQuery]=useState('')
  const [sort,setSort]=useState('default')
  const [special,setSpecial]=useState(false)
  const [favoritesOnly,setFavoritesOnly]=useState(false)
  const [favorites,setFavorites]=useState(()=>savedFavorites().filter(id=>products.some(product=>product.id===id)))
  const [menu,setMenu]=useState(false)
  const menuId=useId()
  const menuButton=useRef<HTMLButtonElement>(null)
  const navigation=useRef<HTMLElement>(null)
  const [cartOpen,setCartOpen]=useState(false)
  const [checkoutItems,setCheckoutItems]=useState<CartItem[] | null>(null)
  const [detail,setDetail]=useState<Product | null>(null)
  const [info,setInfo]=useState('')
  const [brand,setBrand]=useState('')
  const [model,setModel]=useState('')
  const [year,setYear]=useState('')
  const [vehicle,setVehicle]=useState('')
  const [vehicleYear,setVehicleYear]=useState('')
  const [phone,setPhone]=useState('')
  const [consent,setConsent]=useState(false)
  const [subscribing,setSubscribing]=useState(false)
  const [subscriptionError,setSubscriptionError]=useState('')
  const subscription = useActionFeedback()
  useEffect(()=>{setDetail(current=>current?products.find(product=>product.id===current.id)||null:null);setFavorites(current=>current.filter(id=>products.some(product=>product.id===id)))},[products])
  useEffect(()=>{
    if(!menu)return
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setMenu(false);menuButton.current?.focus()}}
    const closeOutside=(event:PointerEvent)=>{if(event.target instanceof Node&&!navigation.current?.contains(event.target)&&!menuButton.current?.contains(event.target))setMenu(false)}
    const desktop=window.matchMedia('(min-width: 761px)')
    const closeDesktop=()=>{if(desktop.matches)setMenu(false)}
    document.addEventListener('keydown',closeOnEscape);document.addEventListener('pointerdown',closeOutside);desktop.addEventListener('change',closeDesktop)
    return()=>{document.removeEventListener('keydown',closeOnEscape);document.removeEventListener('pointerdown',closeOutside);desktop.removeEventListener('change',closeDesktop)}
  },[menu])
  const scrollTo=(id:string)=>document.getElementById(id)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})
  const scrollProducts = () => {setMenu(false);scrollTo('products')}
  const reset = () => {setCategory('همه');setQuery('');setSpecial(false);setFavoritesOnly(false);setVehicle('');scrollProducts()}
  const visible = useMemo(() => {
    const words=normalize(query).split(' ').filter(Boolean)
    const result=products.filter(p=>(category==='همه'||p.category===category)&&(!special||(p.oldPrice||0)>p.price)&&(!favoritesOnly||favorites.includes(p.id))&&(!vehicle||p.vehicles.includes(vehicle))&&words.every(word=>normalize(`${p.name} ${p.brand} ${p.sku} ${p.description}`).includes(word)))
    if(sort==='low')result.sort((a,b)=>a.price-b.price)
    if(sort==='high')result.sort((a,b)=>b.price-a.price)
    if(sort==='stock')result.sort((a,b)=>b.stock-a.stock)
    return result
  },[products,category,special,favoritesOnly,favorites,vehicle,query,sort])
  const toggleFavorite = (id:number) => {const next=favorites.includes(id)?favorites.filter(n=>n!==id):[...favorites,id];setFavorites(next);try{localStorage.setItem('autokala.favorites.v1',JSON.stringify(next))}catch{/* Favorites still work for the current visit. */}}
  const add = (product:Product) => {
    const count=cart.find(item=>item.productId===product.id)?.quantity||0
    if(!count&&cart.length>=50){notify('سبد حداکثر ۵۰ کالای متفاوت می‌پذیرد. ابتدا یک کالا را حذف کنید.');return false}
    if(count>=product.stock||count>=99){notify('بیش از موجودی کالا نمی‌توان به سبد افزود.');return false}
    setCart(current=>{const existing=current.find(item=>item.productId===product.id);if(existing&&(existing.quantity>=product.stock||existing.quantity>=99)||!existing&&current.length>=50)return current;return existing?current.map(item=>item.productId===product.id?{...item,quantity:item.quantity+1}:item):[...current,{productId:product.id,quantity:1}]});notify('کالا به سبد اضافه شد.');return true
  }
  const quantity=cart.reduce((n,item)=>n+item.quantity,0)
  const pendingOrder=hasPendingOrder()
  const subscribe=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(subscribing)return;const issue=phoneIssue(phone);setSubscriptionError(issue);if(issue){event.currentTarget.querySelector<HTMLInputElement>('input')?.focus();return}subscription.clear();setSubscribing(true);try{await api('/subscribe',{method:'POST',body:json({phone,consent})});setPhone('');setConsent(false);subscription.complete();notify('شماره برای خبرهای فروشگاه ثبت شد. ارسال پیامک هنوز فعال نیست.')}catch(e){notify((e as Error).message)}finally{setSubscribing(false)}}
  const contact=info==='تماس با ما' && (settings.contactPhone||settings.contactEmail)
  return <div className="storefront" dir="rtl">
    <a className="skip-link" href="#products">رفتن به کالاها</a>
    <div className="announcement"><span><Icon name="truck" size={17}/>نسخه آزمایشی فروشگاه · ثبت سفارش بدون پرداخت</span><span className="announcement-left">{settings.contactPhone||'اطلاعات تماس در انتظار تأیید فروشگاه'}</span></div>
    <header className="main-header"><div className="nav-shell">
      <Logo/>
      <form className="header-search" role="search" aria-label="جست‌وجوی فروشگاه" onSubmit={event=>{event.preventDefault();setCategory('همه');setSpecial(false);setFavoritesOnly(false);setVehicle('');setVehicleYear('');scrollProducts()}}>
        <Icon name="search" size={20}/><input type="search" aria-label="جست‌وجو در فروشگاه" placeholder="جست‌وجوی نام قطعه، برند یا کد فنی" value={query} onChange={event=>setQuery(event.target.value)}/><button type="submit" aria-label="جست‌وجوی محصولات"><span>جست‌وجو</span><Icon name="arrow" size={17}/></button>
      </form>
      <div className="nav-actions"><button className="icon-btn" onClick={()=>{setMenu(false);onAccount()}} aria-label={user?'حساب و سفارش‌ها':'ورود و پیگیری سفارش'}><Icon name="user"/><span className="account-copy">{user?'حساب کاربری':'ورود | ثبت‌نام'}</span></button><button className="cart-button" onClick={()=>{setMenu(false);setCartOpen(true)}} aria-label={`سبد خرید، ${quantity} کالا`}><Icon name="bag"/><span className="cart-copy">سبد خرید<small>{quantity?`${formatPrice(quantity)} کالا`:'خالی'}</small></span>{quantity>0&&<b><CartNumber value={quantity}/></b>}</button><button ref={menuButton} className="menu-button" onClick={()=>setMenu(!menu)} aria-label={menu?'بستن فهرست':'باز کردن فهرست'} aria-expanded={menu} aria-controls={menuId}><Icon name={menu?'x':'menu'}/></button></div>
      <nav ref={navigation} id={menuId} aria-label="فهرست اصلی" className={menu?'nav-links open':'nav-links'}><button onClick={reset}>فروشگاه</button><button onClick={()=>{setMenu(false);scrollTo('categories')}}>دسته‌بندی‌ها</button><button onClick={()=>{setSpecial(true);setCategory('همه');setFavoritesOnly(false);setQuery('');setVehicle('');scrollProducts()}}>پیشنهاد ویژه</button><button onClick={()=>{setInfo('مجله خودرو');setMenu(false)}}>مجله خودرو</button></nav>
    </div></header>
    <main>
      <section className="hero"><div className="hero-photo" aria-hidden="true"/><div className="hero-overlay"/><div className="hero-content"><div className="eyebrow"><Icon name="spark" size={16}/>قطعه درست، خیال راحت</div><h1>حال خوبِ خودرو<br/><em>از همین‌جا شروع می‌شه.</em></h1><p>لوازم مصرفی خودرو را با نام، برند یا کد قطعه پیدا کن؛ مشخصات را ببین و سفارش را پیگیری کن.</p><div className="vehicle-finder"><div className="finder-title"><span><Icon name="search"/>قطعه مناسب خودروی من</span><small>فیلتر بر اساس مدل؛ سال فقط برای بررسی</small></div><form className="finder-controls" onSubmit={e=>{e.preventDefault();if(!model){notify('ابتدا برند و مدل خودرو را انتخاب کنید.');return}setVehicle(model);setVehicleYear(year);setCategory('همه');setQuery('');setSpecial(false);setFavoritesOnly(false);scrollProducts()}}><Select label="برند خودرو" value={brand} placeholder="برند خودرو" required allowClear clearLabel="انتخاب دوباره برند" onValueChange={value=>{setBrand(value);setModel('');setYear('')}} options={[...new Set(vehicles.map(v=>v.brand))].map(value=>({value,label:value}))}/><Select label="مدل خودرو" value={model} disabled={!brand} placeholder={brand?'مدل خودرو':'اول برند خودرو'} required allowClear clearLabel="انتخاب دوباره مدل" onValueChange={value=>{setModel(value);setYear('')}} options={vehicles.filter(v=>v.brand===brand).map(v=>({value:v.model,label:v.model}))}/><Select label="سال ساخت" value={year} disabled={!model} placeholder="سال ساخت، فقط راهنما" allowClear clearLabel="بدون سال ساخت" onValueChange={setYear} options={(vehicles.find(v=>v.model===model)?.years||[]).map(y=>({value:String(y),label:formatPrice(y).replace(/٬/g,'')}))}/><button className="finder-submit">نمایش قطعات<Icon name="arrow" size={18}/></button></form></div></div><div className="hero-stat"><strong>{formatPrice(products.length)} کالا</strong><span>کاتالوگ نمونه برای بررسی فروشگاه</span><small>قیمت و سازگاری پیش از فروش تأیید شوند</small></div><div className="scroll-hint"><span/>بیشتر ببینید</div></section>
      <section className="trust-strip"><div><span><Icon name="shield"/></span><p><strong>مشخصات روشن</strong><small>برند، کد و توضیح هر کالا</small></p></div><div><span><Icon name="truck"/></span><p><strong>ارسال سفارش</strong><small>روش ارسال در انتظار تنظیم</small></p></div><div><span><Icon name="orders"/></span><p><strong>پیگیری خرید</strong><small>رسید با کلید اختصاصی</small></p></div><div><span><Icon name="car"/></span><p><strong>انتخاب دقیق</strong><small>بررسی مشخصات و سازگاری</small></p></div></section>
      <section className="section categories-section" id="categories"><div className="section-heading"><div><span>دسته‌بندی محصولات</span><h2>هر چیزی که خودرو نیاز داره</h2></div><button className="text-link" onClick={reset}>مشاهده همه<Icon name="arrow" size={18}/></button></div><div className="category-grid">{categories.map((item,index)=><button className="category-card reveal" style={{animationDelay:`${index*50}ms`}} key={item.id} onClick={()=>{setCategory(item.title);setSpecial(false);setFavoritesOnly(false);setQuery('');setVehicle('');scrollProducts()}}><span className={`category-symbol symbol-${item.icon}`}><Icon name={categoryIcon(item.icon)} size={32}/></span><span><strong>{item.title}</strong><small>{formatPrice(item.count)} کالا</small></span><Icon name="arrow" size={18}/></button>)}</div></section>
      <section className="products-section" id="products"><div className="section products-inner"><div className="section-heading"><div><span>انتخاب با مشخصات کامل</span><h2>{favoritesOnly?'کالاهای نشان‌شده':special?'پیشنهادهای فروشگاه':'کالاهای فروشگاه'}</h2></div><div className="product-tools"><label className="search-field"><Icon name="search" size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} aria-label="جست‌وجوی کالا" placeholder="نام قطعه، برند یا کد کالا" type="search"/></label><button className="text-link" onClick={reset}>همه محصولات<Icon name="arrow" size={18}/></button></div></div><div className="filter-pills catalog-filters">{['همه',...categories.map(c=>c.title)].map(name=><button aria-pressed={category===name} className={category===name?'active':''} onClick={()=>setCategory(name)} key={name}>{name}</button>)}<button aria-pressed={favoritesOnly} className={favoritesOnly?'active':''} onClick={()=>setFavoritesOnly(!favoritesOnly)}>نشان‌شده‌ها ({formatPrice(favorites.length)})</button></div><div className="catalog-toolbar"><span>{formatPrice(visible.length)} کالا{vehicle&&<> · {vehicle}{vehicleYear&&`، سال ${vehicleYear}`}<button onClick={()=>setVehicle('')} aria-label="حذف فیلتر خودرو">×</button></>}</span><label>چیدمان <Select label="چیدمان کالاها" value={sort} onValueChange={setSort} options={[{value:'default',label:'پیشنهاد فروشگاه'},{value:'low',label:'ارزان‌تر'},{value:'high',label:'گران‌تر'},{value:'stock',label:'موجودی بیشتر'}]}/></label></div><p className="catalog-demo">کاتالوگ نمونه · قیمت، موجودی و سازگاری برای بررسی مسیر خرید است.</p><div className="product-grid">{visible.map(product=><article className="product-card" key={product.id}><div className={`product-image bg-${product.color}`}><small className="product-image-note">عکس نمونه</small><span className="product-label">{product.stock?product.label||'مشخصات کالا':'ناموجود'}</span><button className={favorites.includes(product.id)?'heart active':'heart'} onClick={()=>toggleFavorite(product.id)} aria-label={`${favorites.includes(product.id)?'حذف نشان':'نشان کردن'} ${product.name}`} aria-pressed={favorites.includes(product.id)}><Icon name="heart" size={19}/></button><button className="product-visual-button" onClick={()=>setDetail(product)} aria-label={`مشخصات ${product.name}`}><ProductImage product={product}/></button></div><div className="product-info"><small>{product.brand} · {product.sku}</small><h3><button className="product-title" onClick={()=>setDetail(product)}>{product.name}</button></h3><div className="price-row"><p>{!!product.oldPrice&&product.oldPrice>product.price&&<del>{formatPrice(product.oldPrice)}</del>}<strong>{formatPrice(product.price)} <small>تومان</small></strong></p><CartButton disabled={!product.stock} onAdd={()=>add(product)} aria-label={`افزودن ${product.name} به سبد`}><Icon name="cart" size={18}/><span>افزودن به سبد</span></CartButton></div></div></article>)}{!visible.length&&<div className="empty-products"><p>کالایی با این انتخاب پیدا نشد. نام کوتاه‌تر یا دسته دیگری را امتحان کنید.</p><button onClick={reset}>نمایش همه کالاها</button></div>}</div></div></section>
      <section className="section promo"><div><span>پیش از سفر، یک بررسی کوتاه</span><h2>سرویس بعدی رو<br/>به‌موقع انجام بده.</h2><p>روغن، فیلتر و قطعات مصرفی را با مشخصات خودرو مقایسه کن.</p><button onClick={()=>{setCategory('روغن و سیالات');setSpecial(false);setFavoritesOnly(false);setQuery('');setVehicle('');scrollProducts()}}>دیدن لوازم سرویس<Icon name="arrow" size={18}/></button></div><div className="promo-rings" aria-hidden="true"><i/><i/><span><Icon name="spark" size={52}/></span></div></section>
    </main>
    <footer><div className="footer-main section"><div className="footer-brand"><Logo light/><p>انتخاب لوازم مصرفی خودرو؛<br/>از مشخصات کالا تا پیگیری سفارش.</p></div><div><strong>اتوکالا</strong>{['درباره ما','تماس با ما','فرصت‌های شغلی'].map(title=><button key={title} onClick={()=>setInfo(title)}>{title}</button>)}</div><div><strong>راهنمای خرید</strong>{['روش‌های پرداخت','ارسال سفارش','شرایط بازگشت'].map(title=><button key={title} onClick={()=>setInfo(title)}>{title}</button>)}</div><div className="newsletter"><strong>خبرهای فروشگاه</strong><p>شماره برای اطلاع‌رسانی آینده ثبت می‌شود؛ پیامک فعلاً فعال نیست.</p><form onSubmit={subscribe}><label className="newsletter-phone"><input value={phone} disabled={subscribing} required onChange={e=>{subscription.clear();setPhone(e.target.value);if(subscriptionError)setSubscriptionError(phoneIssue(e.target.value))}} onBlur={()=>{if(phone)setSubscriptionError(phoneIssue(phone))}} aria-invalid={Boolean(subscriptionError)||undefined} aria-describedby={subscriptionError?'newsletter-error':undefined} placeholder="شماره موبایل با ۰۹" inputMode="tel" autoComplete="tel" aria-label="موبایل خبرنامه" maxLength={30}/><ActionButton pending={subscribing} done={subscription.done} doneLabel="ثبت شد" pendingLabel="ثبت…" disabled={!consent} aria-label="ثبت شماره خبرنامه"><Icon name="arrow"/></ActionButton></label><label className="consent"><input type="checkbox" disabled={subscribing} checked={consent} onChange={e=>setConsent(e.target.checked)} required/>با ثبت شماره برای خبرهای فروشگاه موافقم.</label>{subscriptionError&&<p className="form-error" id="newsletter-error" role="alert">{subscriptionError}</p>}</form></div></div><div className="footer-bottom section"><span>© {new Date().toLocaleDateString('fa-IR',{year:'numeric'})} اتوکالا · نسخه آزمایشی</span><span>قطعه درست، انتخاب روشن</span></div></footer>
    <CartDrawer open={cartOpen} items={cart} products={products} settings={settings} setCart={setCart} pendingOrder={pendingOrder} onClose={()=>setCartOpen(false)} onBrowse={()=>{setCartOpen(false);scrollProducts()}} onCheckout={()=>{setCheckoutItems(cart.map(item=>({...item})));setCartOpen(false)}} onRecover={()=>{setCheckoutItems(cart.map(item=>({...item})));setCartOpen(false)}} onInspect={setDetail}/>
    {checkoutItems&&<CheckoutDialog items={checkoutItems} user={user} onClose={()=>setCheckoutItems(null)} onComplete={submitted=>{setCart(current=>current.map(item=>({...item,quantity:item.quantity-(submitted.find(ordered=>ordered.productId===item.productId)?.quantity||0)})).filter(item=>item.quantity>0));onRefresh()}}/>}
    {detail&&<Modal className="product-detail-dialog" title={detail.name} onClose={()=>setDetail(null)} footer={<div className="detail-purchase"><div className="detail-price"><span>قیمت کالا</span><strong>{formatPrice(detail.price)} <small>تومان</small></strong></div><CartButton key={detail.id} disabled={!detail.stock} onAdd={()=>add(detail)}><Icon name="cart" size={19}/>{detail.stock?'افزودن به سبد':'ناموجود'}</CartButton></div>}>
      <div className="product-detail-layout" tabIndex={0} role="region" aria-label="تصویر و مشخصات کالا">
        <div className="product-detail-media"><div className={`detail-visual bg-${detail.color}`}><ProductImage product={detail}/></div><PhotoCredit product={detail}/></div>
        <div className="product-details">
          <p className="detail-description">{detail.description}</p>
          <dl><dt>برند و کد</dt><dd>{detail.brand}<br/><bdi dir="ltr">{detail.sku}</bdi></dd><dt>دسته</dt><dd>{detail.category}</dd><dt>موجودی نمونه</dt><dd>{formatPrice(detail.stock)} عدد</dd><dt>خودروهای نمونه</dt><dd>{detail.vehicles.join('، ')||'نیازمند بررسی کد فنی'}</dd></dl>
          <p className="muted-note">سازگاری با کد فنی و دفترچه خودرو تأیید شود.</p>
        </div>
      </div>
    </Modal>}
    {info&&<Modal title={info} onClose={()=>setInfo('')}><div className="info-copy">{contact?<><p>شماره تماس: <b dir="ltr">{settings.contactPhone||'هنوز ثبت نشده'}</b></p><p>ایمیل: <b dir="ltr">{settings.contactEmail||'هنوز ثبت نشده'}</b></p></>:information[info]?.map(text=><p key={text}>{text}</p>)}</div></Modal>}
  </div>
}
