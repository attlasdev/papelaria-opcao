import { useState, type ReactNode } from 'react'
import { centavosDigitados, moedaDigitada } from '../../formatar'
import { Campo } from './Campo'

type Props = {
  rotulo: string
  name?: string
  valorCentavos?: number | null
  valorInicialCentavos?: number | null
  aoMudar?: (centavos: number | null) => void
  opcional?: boolean
  required?: boolean
  readOnly?: boolean
  erro?: boolean
  ajuda?: ReactNode
  autoFocus?: boolean
  placeholder?: string
  className?: string
}

/** Campo de dinheiro: ao digitar 2333, mostra R$ 23,33. */
export function CampoMoeda({ valorCentavos, valorInicialCentavos = null, aoMudar, placeholder = 'R$ 0,00', ...props }: Props) {
  const [interno, setInterno] = useState<number | null>(valorInicialCentavos)
  const valor = valorCentavos === undefined ? interno : valorCentavos

  function mudar(texto: string) {
    const proximo = centavosDigitados(texto)
    if (valorCentavos === undefined) setInterno(proximo)
    aoMudar?.(proximo)
  }

  return (
    <Campo
      {...props}
      type="text"
      inputMode="numeric"
      value={moedaDigitada(valor)}
      placeholder={placeholder}
      onFocus={(evento) => evento.target.select()}
      onChange={(evento) => mudar(evento.target.value)}
      onKeyDown={(evento) => {
        if (evento.key === 'Backspace' && valor === 0) {
          evento.preventDefault()
          mudar('')
        }
      }}
    />
  )
}
