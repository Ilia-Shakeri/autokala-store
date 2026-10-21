import { it,expect } from 'vitest'
import { render,screen,fireEvent } from '@testing-library/react'
import Storefront from '../../src/Storefront'
import { categories,products,vehicles } from '../../server/seed.mjs'
import type { Catalog } from '../../src/types'

const catalog={products:products.map((product:object,index:number)=>({...product,id:index+1})),categories:categories.map((category:{title:string},index:number)=>({...category,id:index+1,count:2})),vehicles,settings:{demo:true,paymentMode:'manual',storeName:'اتوکالا',shippingFee:85000,freeShippingThreshold:2000000}} as Catalog
function show(){render(<Storefront catalog={catalog} cart={[]} setCart={()=>{}} user={null} onAccount={()=>{}} onRefresh={()=>{}} notify={()=>{}}/>)}
it('has no management shortcut on the public store and all catalog products have local photos',()=>{show();expect(screen.queryByRole('button',{name:'پنل مدیریت'})).toBeNull();expect(screen.queryByText('ورود به پنل مدیریت')).toBeNull();const images=screen.getAllByRole('img');expect(images).toHaveLength(12);expect(images.every(image=>image.getAttribute('src')?.startsWith('/products/'))).toBe(true)})
it('searches SKU and brand and keeps category matches exact',()=>{show();const search=screen.getByRole('searchbox',{name:'جست‌وجوی کالا'});fireEvent.change(search,{target:{value:'FLT-SRK'}});expect(screen.getAllByRole('article')).toHaveLength(2);fireEvent.change(search,{target:{value:''}});fireEvent.click(screen.getByRole('button',{name:'لنت و ترمز',exact:true}));expect(screen.getAllByRole('article')).toHaveLength(2)})
it('reveals source and license while preserving the product detail flow',()=>{show();fireEvent.click(screen.getByRole('button',{name:'مشخصات فیلتر هوای سرکان مناسب پژو ۲۰۶ تیپ ۲',exact:true}));expect(screen.getByRole('dialog')).toBeTruthy();expect(screen.getByText(/عکس نمونه؛ برند و بسته‌بندی/)).toBeTruthy();expect(screen.getAllByRole('link').some(link=>link.getAttribute('href')?.startsWith('https://commons.wikimedia.org/'))).toBe(true)})
