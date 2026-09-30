import { Link, useSearchParams } from 'react-router'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Painel } from '../../componentes/painel/Painel'
import { dataCurta, reais } from '../../formatar'
import { buscar, nomeCliente, resumoItens, rotuloForma, useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import { rotas } from '../../rotas-caminhos'
import './resultados-busca.css'
import { useAbrirFicha } from '../detalhe-ficha/AbrirFicha'

export function ResultadosBusca() {
  const abrirFicha = useAbrirFicha()
  const [parametros] = useSearchParams()
  const termo = (parametros.get('q') ?? '').trim()
  const base = useEstadoDemonstracao()
  const { clientes: clientesEncontrados, fichas: fichasEncontradas, produtos: produtosEncontrados } = buscar(base, termo)
  const total = clientesEncontrados.length + fichasEncontradas.length + produtosEncontrados.length

  return (
    <Tela
      voltar={{ para: rotas.inicio, rotulo: 'Voltar para início' }}
      titulo="Resultados da busca"
      subtitulo={termo ? `${total} resultado${total === 1 ? '' : 's'} para “${termo}”` : 'Digite um termo na busca do cabeçalho.'}
    >
      {total === 0 && <Painel titulo="Nenhum resultado"><p>Tente o nome, código ou outro termo dos dados disponíveis.</p></Painel>}
      {clientesEncontrados.length > 0 && <Painel titulo="Clientes"><ul className="resultados-busca__lista">{clientesEncontrados.map((item) => <li key={item.id}><Link to={rotas.cliente(item.id)}><strong>{item.nome}</strong><span>{item.id} · {item.documento}</span></Link></li>)}</ul></Painel>}
      {fichasEncontradas.length > 0 && <Painel titulo="Fichas de venda"><ul className="resultados-busca__lista">{fichasEncontradas.map((item) => <li key={item.id}><button type="button" onClick={() => abrirFicha(item.id)}><strong>Ficha #{item.id} · {nomeCliente(base, item.clienteId)}</strong><span>{dataCurta(item.data)} · {reais(item.total)} · {rotuloForma(item)} · {resumoItens(item)}</span></button></li>)}</ul></Painel>}
      {produtosEncontrados.length > 0 && <Painel titulo="Produtos"><ul className="resultados-busca__lista">{produtosEncontrados.map((item) => <li key={item.codigo}><Link to={rotas.movimentacoesEstoque(item.codigo)}><strong>{item.descricao}</strong><span>{item.codigo} · saldo {item.saldo} {item.unidade}</span></Link></li>)}</ul></Painel>}
    </Tela>
  )
}
