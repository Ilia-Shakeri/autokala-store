import { useState } from 'react'
import photos from './product-images.json'
import type { Product } from './types'
import { ProductVisual } from './ui'

type Photo = {src:string;alt:string;width:number;height:number;sourceUrl:string;sourceTitle:string;photographer:string;license:string;licenseUrl:string;illustrative:boolean}
const mapping=photos as Record<string,Photo>
const fallbackSku:Record<string,string>={oil:'OIL-BHR-1040-4',filter:'FLT-SRK-206-A',brake:'BRK-EMC-405-F',coolant:'CLT-CSP-1L',spark:'SPK-STD-405-4',wiper:'WPR-STD-206-2',spray:'CLN-CSP-SHP-500'}
export function productPhoto(product:Pick<Product,'sku'|'visual'>):Photo|undefined{return mapping[product.sku]||mapping[fallbackSku[product.visual]]}
export function ProductImage({product}:{product:Pick<Product,'sku'|'visual'|'name'>}){
  const image=productPhoto(product)
  const [failedSource,setFailedSource]=useState('')
  if(!image||failedSource===image.src)return <ProductVisual type={product.visual}/>
  return <img className="product-photo" src={image.src} alt={image.alt} width={image.width} height={image.height} loading="lazy" decoding="async" onError={()=>setFailedSource(image.src)}/>
}
export function PhotoCredit({product}:{product:Pick<Product,'sku'|'visual'>}){
  const photo=productPhoto(product)
  if(!photo)return null
  return <p className="photo-credit">عکس نمونه؛ برند و بسته‌بندی کالای نهایی ممکن است متفاوت باشد.<br/><a href={photo.sourceUrl} target="_blank" rel="noreferrer noopener">{photo.sourceTitle}</a> · {photo.photographer} · <a href={photo.licenseUrl} target="_blank" rel="noreferrer noopener">{photo.license}</a></p>
}
