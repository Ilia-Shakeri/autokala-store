import { AppError } from './store.mjs'
import { vehicles } from './seed.mjs'

export function digits(value) { return String(value).replace(/[۰-۹]/g, (n) => String(n.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, (n) => String(n.charCodeAt(0) - 1632)) }
export function object(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError(400,'داده درخواست درست نیست.'); return value }
export function text(value, field, min = 1, max = 200) {
  if (typeof value !== 'string') throw new AppError(400,`${field} لازم است.`)
  const result = value.normalize('NFC').trim()
  if (result.length < min || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(result)) throw new AppError(400,`${field} درست نیست.`)
  return result
}
export function integer(value, field, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new AppError(400,`${field} درست نیست.`)
  return value
}
export function email(value) {
  const result = text(value,'ایمیل',5,254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(result)) throw new AppError(400,'ایمیل درست نیست.')
  return result
}
export function password(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128 || !value.trim() || /[\u0000-\u001f\u007f]/u.test(value)) throw new AppError(400,'رمز باید ۱۲ تا ۱۲۸ نویسه باشد.')
  return value
}
export function phone(value) {
  let result = digits(text(value,'شماره همراه',10,30)).replace(/[\s()-]/g,'')
  result = result.replace(/^(?:\+98|0098)/,'0')
  if (!/^09\d{9}$/.test(result)) throw new AppError(400,'شماره همراه ایران درست نیست.')
  return result
}
export function items(value) {
  if (!Array.isArray(value) || !value.length || value.length > 50) throw new AppError(400,'سبد باید ۱ تا ۵۰ کالا داشته باشد.')
  const combined = new Map()
  for (const item of value) {
    object(item)
    const id = integer(item.productId,'شناسه کالا',1,2147483647)
    const quantity = integer(item.quantity,'تعداد',1,99)
    combined.set(id,integer((combined.get(id) || 0) + quantity,'تعداد',1,99))
  }
  return [...combined].sort(([a],[b]) => a-b).map(([productId,quantity]) => ({productId,quantity}))
}
export function customer(value) {
  object(value)
  const postalCode = digits(text(value.postalCode,'کد پستی',10,10))
  if (!/^\d{10}$/.test(postalCode) || /^(\d)\1{9}$/.test(postalCode)) throw new AppError(400,'کد پستی ده رقمی درست نیست.')
  return { name: text(value.name,'نام',2,120), email: email(value.email), phone: phone(value.phone), address: text(value.address,'نشانی',10,1000), postalCode }
}
export const visuals = new Set(['oil','filter','brake','coolant','spark','wiper','spray'])
export function product(value) {
  object(value)
  const visual = text(value.visual,'شکل کالا',1,20)
  if (!visuals.has(visual)) throw new AppError(400,'شکل کالا درست نیست.')
  const color = text(value.color,'رنگ',1,20)
  if (!['amber','cream','red','blue'].includes(color)) throw new AppError(400,'رنگ کالا درست نیست.')
  if (!Array.isArray(value.vehicles) || value.vehicles.length > 50 || value.vehicles.some((name) => !vehicles.some((v) => v.model === name))) throw new AppError(400,'خودروی کالا درست نیست.')
  const price = integer(value.price,'قیمت',1,1000000000)
  const oldPrice = value.oldPrice === undefined || value.oldPrice === null ? null : integer(value.oldPrice,'قیمت قبل',price,1000000000)
  return { name: text(value.name,'نام کالا',3,180), sku: text(value.sku,'کد کالا',2,64), brand: text(value.brand,'برند',2,80), price, oldPrice, category: text(value.category,'دسته',2,80), label: text(value.label ?? '','برچسب',0,40), visual, color, description: text(value.description,'شرح کالا',10,2000), stock: integer(value.stock,'موجودی',0,1000000), vehicles: [...new Set(value.vehicles)] }
}
