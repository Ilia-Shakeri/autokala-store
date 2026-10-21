import { describe,it,expect,vi } from 'vitest'
import { sanitizeCart,loadCart,saveCart,CART_KEY } from '../../src/storage'

describe('cart persistence boundary',()=>{
  it('rejects corrupt entries and merges duplicates without exceeding server limits',()=>{
    expect(sanitizeCart([null,5,{}, {productId:-1,quantity:1},{productId:1,quantity:'2'},{productId:1,quantity:2},{productId:1,quantity:98},{productId:2,quantity:0},{productId:3,quantity:1.5},{productId:2147483648,quantity:1}])).toEqual([{productId:1,quantity:99}])
    expect(sanitizeCart(Array.from({length:80},(_,index)=>({productId:index+1,quantity:1})))).toHaveLength(50)
  })
  it('recovers from broken JSON and non-array storage',()=>{for(const data of ['{','null','{}','4']){localStorage.setItem(CART_KEY,data);expect(loadCart()).toEqual([])}})
  it('round trips valid quantities and sanitizes writes',()=>{saveCart([{productId:2,quantity:3},{productId:2,quantity:1}]);expect(loadCart()).toEqual([{productId:2,quantity:4}])})
  it('keeps the page usable when storage is blocked',()=>{vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('blocked')});vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked')});expect(loadCart()).toEqual([]);expect(()=>saveCart([{productId:1,quantity:1}])).not.toThrow()})
})
