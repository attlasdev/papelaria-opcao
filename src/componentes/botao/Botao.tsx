import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icone, type NomeIcone } from '../icone/Icone'
import './botao.css'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** primario: preto, a ação da tela · secundario: contorno · fantasma: só texto. */
  variante?: 'primario' | 'secundario' | 'fantasma'
  tamanho?: 'normal' | 'pequeno'
  icone?: NomeIcone
  children?: ReactNode
}

export function Botao({ variante = 'secundario', tamanho = 'normal', icone, className, children, ...resto }: Props) {
  const classes = ['botao', `botao--${variante}`, tamanho === 'pequeno' && 'botao--pequeno', className]
  return (
    <button type="button" className={classes.filter(Boolean).join(' ')} {...resto}>
      {icone && <Icone nome={icone} tamanho={tamanho === 'pequeno' ? 16 : 18} />}
      {children}
    </button>
  )
}

type PropsIcone = ButtonHTMLAttributes<HTMLButtonElement> & { icone: NomeIcone; rotulo: string }

/** Botão só com ícone. O rótulo vira dica e texto para leitor de tela. */
export function BotaoIcone({ icone, rotulo, className, ...resto }: PropsIcone) {
  return (
    <button type="button" title={rotulo} aria-label={rotulo} className={className ? `botao-icone ${className}` : 'botao-icone'} {...resto}>
      <Icone nome={icone} tamanho={18} />
    </button>
  )
}
