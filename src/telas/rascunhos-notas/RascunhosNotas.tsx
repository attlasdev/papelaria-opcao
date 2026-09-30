import { Link } from 'react-router'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Painel } from '../../componentes/painel/Painel'
import { Tabela } from '../../componentes/tabela/Tabela'
import { SeloCompacto } from '../../componentes/selo/Selo'
import { dataCurta, reais } from '../../formatar'
import { nomeCliente, useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import { rotas } from '../../rotas-caminhos'
import './rascunhos-notas.css'

export function RascunhosNotas() {
  const base = useEstadoDemonstracao()
  const lista = base.rascunhosNota
    .map((id) => base.fichas.find((item) => item.id === id))
    .filter((item) => item !== undefined)

  return (
    <Tela
      voltar={{ para: rotas.notas, rotulo: 'Voltar para notas fiscais' }}
      trilha={<Link className="rascunhos-notas__link" to={rotas.notas}>Notas fiscais</Link>}
      titulo="Rascunhos de notas"
      subtitulo="Dados de vendas preparados para revisão. Nenhuma nota foi emitida."
    >
      <Painel colado titulo="Rascunhos de saída">
        <Tabela larguraMinima={700}>
          <thead><tr><th>Ficha</th><th>Cliente</th><th>Data</th><th className="celula--numero">Valor</th><th>Situação</th><th className="celula--acoes">Ação</th></tr></thead>
          <tbody>{lista.map((item) => <tr key={item.id}>
            <td className="codigo">#{item.id}</td><td>{nomeCliente(base, item.clienteId)}</td><td>{dataCurta(item.data)}</td><td className="celula--numero">{reais(item.total)}</td>
            <td><SeloCompacto tom="neutro">Rascunho</SeloCompacto></td>
            <td className="celula--acoes"><Link className="botao botao--secundario botao--pequeno" to={rotas.rascunhoNota(item.id)}>Revisar</Link></td>
          </tr>)}
          {lista.length === 0 && <tr><td colSpan={6} className="rascunhos-notas__vazio">Nenhum rascunho em revisão.</td></tr>}</tbody>
        </Tabela>
      </Painel>
    </Tela>
  )
}
