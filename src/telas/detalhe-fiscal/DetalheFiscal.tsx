import { Link, useParams } from 'react-router'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Painel } from '../../componentes/painel/Painel'
import { SeloCompacto } from '../../componentes/selo/Selo'
import { dataCurta, reais } from '../../formatar'
import { hojeISO, nomeCliente, resumoItens, useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import { rotas } from '../../rotas-caminhos'
import { documentoFornecedor } from '../notas-fiscais/constantes'
import './detalhe-fiscal.css'

export function DetalheFiscal() {
  const { id } = useParams()
  const base = useEstadoDemonstracao()
  const entrada = !id
  const ficha = id ? base.fichas.find((item) => item.id === id) : undefined
  const rascunhoExiste = id ? base.rascunhosNota.includes(id) : false
  const fornecedor = { ...documentoFornecedor, data: dataCurta(hojeISO()) }

  return (
    <Tela
      voltar={{ para: entrada ? rotas.notas : rotas.rascunhosNotas, rotulo: entrada ? 'Voltar para notas fiscais' : 'Voltar para rascunhos' }}
      trilha={<Link className="detalhe-fiscal__link" to={rotas.notas}>Notas fiscais</Link>}
      titulo={entrada ? 'Documento de fornecedor' : `Rascunho da ficha #${id}`}
      subtitulo={entrada ? 'Exemplo de entrada de mercadorias' : 'Revisão dos dados conhecidos da venda'}
    >
      {entrada ? (
        <Painel titulo="Detalhes disponíveis">
          <dl className="detalhe-fiscal__dados">
            <div><dt>Referência</dt><dd>{fornecedor.referencia}</dd></div>
            <div><dt>Origem</dt><dd>{fornecedor.origem}</dd></div>
            <div><dt>Data</dt><dd>{fornecedor.data}</dd></div>
            <div><dt>Situação</dt><dd><SeloCompacto tom="neutro">Exemplo de entrada</SeloCompacto></dd></div>
          </dl>
          <p className="detalhe-fiscal__nota">O documento fiscal e seus campos ainda não foram integrados. Nenhuma nota foi consultada ou emitida.</p>
        </Painel>
      ) : rascunhoExiste && ficha ? (
        <div className="detalhe-fiscal__grade">
          <Painel titulo="Dados para conferência">
            <dl className="detalhe-fiscal__dados">
              <div><dt>Ficha</dt><dd><Link className="detalhe-fiscal__link" to={rotas.ficha(ficha.id)}>#{ficha.id}</Link></dd></div>
              <div><dt>Cliente</dt><dd>{nomeCliente(base, ficha.clienteId)}</dd></div>
              <div><dt>Data da venda</dt><dd>{dataCurta(ficha.data)}</dd></div>
              <div><dt>Valor conhecido</dt><dd>{reais(ficha.total)}</dd></div>
            </dl>
          </Painel>
          <Painel titulo="Itens da venda">
            <p className="detalhe-fiscal__itens">{resumoItens(ficha)}</p>
          </Painel>
          <Painel titulo="Próxima revisão">
            <p>Conferir tipo de documento, dados fiscais do cliente e dos itens com a contabilidade antes de habilitar a emissão.</p>
            <p className="detalhe-fiscal__nota">Este rascunho não tem número fiscal nem autorização.</p>
          </Painel>
        </div>
      ) : (
        <Painel titulo="Rascunho não encontrado"><p>Escolha um rascunho na lista para revisar os dados disponíveis.</p></Painel>
      )}
    </Tela>
  )
}
