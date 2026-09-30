import type { ReactNode, TableHTMLAttributes } from 'react'
import './tabela.css'

type Props = TableHTMLAttributes<HTMLTableElement> & {
  /** Largura mínima antes de a tabela rolar na horizontal (janela estreita). */
  larguraMinima?: number
  children: ReactNode
}

/**
 * Tabela padrão. As telas escrevem <thead>/<tbody> normalmente; o visual vem
 * daqui. Destaque de linha: className="linha--atencao" ou "linha--critica".
 * Célula numérica: className="celula--numero" (alinha à direita, algarismos iguais).
 */
export function Tabela({ larguraMinima, className, children, ...resto }: Props) {
  return (
    <div className="tabela-rolagem">
      <table
        className={className ? `tabela ${className}` : 'tabela'}
        style={larguraMinima ? { minWidth: larguraMinima } : undefined}
        {...resto}
      >
        {children}
      </table>
    </div>
  )
}
