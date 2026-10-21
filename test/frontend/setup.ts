import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

class ResizeObserverStub { observe(){} unobserve(){} disconnect(){} }
globalThis.ResizeObserver=ResizeObserverStub
if(!window.PointerEvent)Object.defineProperty(window,'PointerEvent',{value:MouseEvent,configurable:true})
Element.prototype.scrollIntoView=()=>{}
Element.prototype.hasPointerCapture=()=>false
Element.prototype.setPointerCapture=()=>{}
Element.prototype.releasePointerCapture=()=>{}
window.matchMedia=vi.fn().mockImplementation(query=>({matches:false,media:query,onchange:null,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return false}}))
afterEach(()=>{cleanup();localStorage.clear();document.body.style.overflow='';vi.unstubAllGlobals()})
