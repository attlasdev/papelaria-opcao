import type { ReactNode } from 'react'
import { Icone, type NomeIcone } from '../icone/Icone'
import './selo.css'

export type Tom = 'ok' | 'atencao' | 'critico' | 'neutro'

type PropsSituacao = {
  tom: Tom
  titulo: string
  /** Segunda linha, menor. Sem ela o selo tem uma linha, centrada, da mesma altura. */
  detalhe?: string
}

/**
 * Situação de algo (compra, estoque): fundo pastel chapado, largura única,
 * texto centrado. O padrão validado na tela Clientes.
 */
export function SeloSituacao({ tom, titulo, detalhe }: PropsSituacao) {
  return (
    <span className={`selo-situacao selo--${tom}`} title={detalhe ? `${titulo} · ${detalhe}` : undefined}>
      <strong>{titulo}</strong>
      {detalhe && <small>{detalhe}</small>}
    </span>
  )
}

/** Versão de uma linha, para caber ao lado de um número (saldo do estoque). */
export function SeloCompacto({ tom, children }: { tom: Tom; children: ReactNode }) {
  return <span className={`selo-compacto selo--${tom}`} title={typeof children === 'string' ? children : undefined}>{children}</span>
}

/** Rótulo neutro com borda: categoria, forma de pagamento, referência. */
export function Etiqueta({ icone, children }: { icone?: NomeIcone; children: ReactNode }) {
  return (
    <span className="etiqueta">
      {icone && <Icone nome={icone} tamanho={14} />}
      {children}
    </span>
  )
}
