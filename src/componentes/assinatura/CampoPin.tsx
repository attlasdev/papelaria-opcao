import type { ReactNode } from 'react'
import { Campo } from '../campo/Campo'

type Props = {
  rotulo: string
  valor: string
  aoMudar: (pin: string) => void
  ajuda?: ReactNode
  erro?: boolean
  autoFocus?: boolean
  disabled?: boolean
}

/** PIN de 4 números (`R-OPERADOR-01`): só aceita dígitos, escondido como senha. */
export function CampoPin({ rotulo, valor, aoMudar, ...resto }: Props) {
  return (
    <Campo
      {...resto}
      rotulo={rotulo}
      icone="cadeado"
      type="password"
      inputMode="numeric"
      autoComplete="off"
      value={valor}
      onChange={(e) => aoMudar(e.target.value.replace(/\D/g, '').slice(0, 4))}
    />
  )
}

export const pinCompleto = (pin: string) => /^\d{4}$/.test(pin)
