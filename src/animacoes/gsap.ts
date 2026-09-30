import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

export { gsap, useGSAP }

export function movimentoReduzido() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
