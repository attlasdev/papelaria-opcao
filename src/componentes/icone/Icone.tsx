import type { ReactNode } from 'react'
import { desenhos, type NomeIcone } from './desenhos'
import './icone.css'

type Props = {
  nome: NomeIcone
  /** Lado em px. Padrão 20, o tamanho do menu e dos botões. */
  tamanho?: number
  /** Texto para leitor de tela. Sem ele o ícone é decorativo e fica oculto. */
  rotulo?: string
  className?: string
}

/**
 * Ícone da biblioteca própria (recortado do Icons.pdf do acervo).
 * Herda a cor do texto em volta (currentColor).
 */
export function Icone({ nome, tamanho = 20, rotulo, className }: Props) {
  return (
    <svg
      className={className ? `icone ${className}` : 'icone'}
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="currentColor"
      role={rotulo ? 'img' : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : true}
    >
      {desenhos[nome].map((parte, i) => (
        <path key={i} d={parte.d} fillRule={'parImpar' in parte ? 'evenodd' : undefined} />
      ))}
    </svg>
  )
}

/**
 * Rótulo com ícone solto à esquerda, sem fundo, um tom abaixo do texto.
 * Padrão para títulos de seção e nomes de campo de consulta (cliente, data, documento...).
 */
export function ComIcone({ icone, children }: { icone: NomeIcone; children: ReactNode }) {
  return (
    <span className="com-icone">
      <Icone nome={icone} tamanho={16} />
      {children}
    </span>
  )
}

export type { NomeIcone }
