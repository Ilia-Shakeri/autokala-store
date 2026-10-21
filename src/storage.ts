import type { CartItem } from './types'

export const CART_KEY = 'autokala.cart.v1'
export function sanitizeCart(value: unknown): CartItem[] {
  if(!Array.isArray(value))return []
  const combined=new Map<number,number>()
  for(const item of value)if(item && typeof item==='object' && Number.isSafeInteger(item.productId) && item.productId>0 && item.productId<=2147483647 && Number.isSafeInteger(item.quantity) && item.quantity>0 && item.quantity<=99)combined.set(item.productId,Math.min(99,(combined.get(item.productId)||0)+item.quantity))
  return [...combined].slice(0,50).map(([productId,quantity])=>({productId,quantity}))
}
export function loadCart(): CartItem[] {try{return sanitizeCart(JSON.parse(localStorage.getItem(CART_KEY)||'[]'))}catch{return []}}
export function saveCart(cart:CartItem[]): void {try{localStorage.setItem(CART_KEY,JSON.stringify(sanitizeCart(cart)))}catch{/* Private browsing can disable persistent storage. */}}
