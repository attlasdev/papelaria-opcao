import { Tela } from '../../componentes/layout/tela/Tela'
import { CaixaAtual } from './CaixaAtual'

/** A rotina da gaveta fica em uma seção própria, independente do Financeiro. */
export function Caixa() {
  return (
    <Tela titulo="Caixa" subtitulo="Abertura, movimentação e fechamento da gaveta">
      <CaixaAtual />
    </Tela>
  )
}
