import type { RefObject } from 'react'
import { useDialogMotion } from './dialog-motion'

export function useCheckoutMotion(surface: RefObject<HTMLDivElement | null>, receipt: boolean, busy: boolean, onClose: () => void) {
  return useDialogMotion(surface, busy, onClose, receipt ? '.checkout-receipt' : undefined)
}
