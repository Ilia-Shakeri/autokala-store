import { useLayoutEffect, useRef, type RefObject } from 'react'
import { formatPrice } from './ui'

const easeOut = 'cubic-bezier(0.23, 1, 0.32, 1)'
export const cartMotionAllowed = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches && document.documentElement.dataset.input !== 'keyboard'

export function CartNumber({ value, className = '' }: {value:number;className?:string}) {
  const node=useRef<HTMLSpanElement>(null)
  const previous=useRef(value)
  const animation=useRef<Animation|null>(null)
  useLayoutEffect(()=>{
    if(previous.current===value)return
    previous.current=value
    if(!node.current?.animate||!cartMotionAllowed()){animation.current?.cancel();return}
    const current=getComputedStyle(node.current)
    const from=animation.current?.playState==='running'?{opacity:current.opacity,transform:current.transform}:{opacity:.4,transform:'translateY(5px)'}
    animation.current?.cancel()
    animation.current=node.current.animate([from,{opacity:1,transform:'translateY(0)'}],{duration:160,easing:easeOut})
  },[value])
  useLayoutEffect(()=>()=>animation.current?.cancel(),[])
  return <span ref={node} className={`cart-number ${className}`}>{formatPrice(value)}</span>
}

type Row={node:HTMLElement;rect:DOMRect}
export function useCartRowsMotion(root:RefObject<HTMLDivElement|null>,revision:string,present:boolean){
  const previous=useRef(new Map<string,Row>())
  const animations=useRef<Animation[]>([])
  const ghosts=useRef<HTMLElement[]>([])
  const capture=()=>{
    if(!root.current)return
    previous.current=new Map([...root.current.querySelectorAll<HTMLElement>('[data-cart-row]')].map(node=>[node.dataset.cartRow!,{node,rect:node.getBoundingClientRect()}]))
  }
  useLayoutEffect(()=>{
    const list=root.current
    if(!list){previous.current.clear();return}
    const rows=[...list.querySelectorAll<HTMLElement>('[data-cart-row]')]
    const old=previous.current
    for(const animation of animations.current)animation.cancel()
    for(const ghost of ghosts.current)ghost.remove()
    animations.current=[];ghosts.current=[]
    if(cartMotionAllowed()&&typeof list.animate==='function'){
      const bounds=list.getBoundingClientRect()
      const ids=new Set(rows.map(node=>node.dataset.cartRow))
      for(const [id,row] of old){
        if(ids.has(id))continue
        const ghost=row.node.cloneNode(true) as HTMLElement
        ghost.inert=true;ghost.setAttribute('aria-hidden','true');ghost.removeAttribute('data-cart-row')
        Object.assign(ghost.style,{position:'absolute',top:`${row.rect.top-bounds.top+list.scrollTop}px`,left:`${row.rect.left-bounds.left}px`,width:`${row.rect.width}px`,height:`${row.rect.height}px`,pointerEvents:'none',margin:'0',zIndex:'1'})
        list.append(ghost);ghosts.current.push(ghost)
        const animation=ghost.animate([{opacity:.7,transform:'translateX(0) scale(1)'},{opacity:0,transform:'translateX(-20px) scale(.98)'}],{duration:180,easing:easeOut,fill:'forwards'})
        animations.current.push(animation);void animation.finished.then(()=>ghost.remove()).catch(()=>{})
      }
      rows.forEach((node,index)=>{
        const before=old.get(node.dataset.cartRow!)
        const after=node.getBoundingClientRect()
        const delta=before?before.rect.top-after.top:0
        if(!before||Math.abs(delta)>.5){
          animations.current.push(node.animate(before?[{transform:`translateY(${delta}px)`},{transform:'translateY(0)'}]:[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,delay:old.size?0:Math.min(index*35,140),easing:easeOut}))
        }
      })
    }
    capture()
  },[root,revision,present])
  useLayoutEffect(()=>()=>{for(const animation of animations.current)animation.cancel();for(const ghost of ghosts.current)ghost.remove();previous.current.clear()},[])
  return capture
}
