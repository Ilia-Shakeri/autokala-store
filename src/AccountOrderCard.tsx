import { forwardRef } from 'react'
import type { Order } from './types'
import { statusLabels } from './types'
import { formatPrice, Icon } from './ui'

const date = (value: string) => new Date(value).toLocaleString('fa-IR', {timeZone:'Asia/Tehran',dateStyle:'medium',timeStyle:'short'})

export const AccountOrderCard = forwardRef<HTMLElement, {order:Order; expanded?:boolean}>(function AccountOrderCard({order,expanded=false}, ref) {
  return <article className="account-order" ref={ref} tabIndex={-1} aria-label={`سفارش ${order.id}`}>
    <header><span className="account-order-icon"><Icon name="box"/></span><div><span className="account-eyebrow">شماره سفارش</span><h4><bdi>{order.id}</bdi></h4></div><span className={`account-order-status status-${order.status}`}>{statusLabels[order.status] || order.status}</span></header>
    <p className="account-order-date">ثبت در <time dateTime={order.createdAt}>{date(order.createdAt)}</time></p>
    <details open={expanded}><summary><span>جزئیات کالاها <small>({order.items.reduce((sum,item)=>sum+item.quantity,0).toLocaleString('fa-IR')} عدد)</small></span><Icon name="chevron" size={16}/></summary>
      <ul className="account-order-lines">{order.items.map(item=><li key={item.productId}><div><h5>{item.name}</h5><span>{item.quantity.toLocaleString('fa-IR')} عدد · هر عدد {formatPrice(item.price)} تومان</span></div><strong>{formatPrice(item.lineTotal)} <small>تومان</small></strong></li>)}</ul>
    </details>
    <dl><div><dt>ارسال</dt><dd>{formatPrice(order.shipping)} تومان</dd></div><div><dt>جمع سفارش</dt><dd><strong>{formatPrice(order.total)}</strong> تومان</dd></div></dl>
    {order.status==='pending_payment'&&<p className="account-order-note"><Icon name="orders" size={15}/><span>پرداخت هنوز انجام نشده است.{order.expiresAt&&<> پایان مهلت رزرو: <time dateTime={order.expiresAt}>{date(order.expiresAt)}</time></>}</span></p>}
  </article>
})
