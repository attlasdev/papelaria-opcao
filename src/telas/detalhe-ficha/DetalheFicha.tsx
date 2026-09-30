import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Painel } from '../../componentes/painel/Painel'
import { Botao } from '../../componentes/botao/Botao'
import { dataCurta, reais } from '../../formatar'
import { contagemItens, hojeISO, nomeCliente, notinha as notinhaDa, useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import { rotas } from '../../rotas-caminhos'
import { ReceberNotinhas } from '../detalhe-cliente/receber/ReceberNotinhas'
import { ComIcone } from '../../componentes/icone/Icone'
import { AvisoOutrasNotinhas, DadosFicha, PagamentosFicha, paginaDoCliente, TabelaItensFicha, TotaisFicha } from './ConteudoFicha'
import './detalhe-ficha.css'

export function DetalheFicha() {
  const { id = '' } = useParams()
  const [parametros] = useSearchParams()
  const origem = parametros.get('origem') === 'historico' ? 'historico' : 'inicio'
  const base = useEstadoDemonstracao()
  const hoje = hojeISO()
  // 'esta' abre a janela só com esta ficha marcada; 'todas' marca todas as abertas do cliente.
  const [recebendo, setRecebendo] = useState<'esta' | 'todas' | null>(null)
  const ficha = base.fichas.find((item) => item.id === id)
  const notinha = ficha ? notinhaDa(ficha, hoje) : null

  return (
    <Tela
      voltar={{
        para: origem === 'historico' && ficha ? paginaDoCliente(ficha.clienteId) : rotas.inicio,
        rotulo: origem === 'historico' ? 'Voltar para o histórico' : 'Voltar para histórico de fichas',
      }}
      trilha={
        <Link className="detalhe-ficha__link" to={origem === 'historico' ? rotas.clientes : rotas.inicio}>
          {origem === 'historico' ? 'Clientes' : 'Início'}
        </Link>
      }
      titulo={`Ficha #${id}`}
      subtitulo={ficha ? `${nomeCliente(base, ficha.clienteId)} · ${dataCurta(ficha.data)} · ${ficha.horario} · operador ${ficha.operador}` : 'Ficha não encontrada'}
      acaoCabecalho={notinha && notinha.emAberto > 0 && (
        <Botao variante="primario" icone="dinheiro" onClick={() => setRecebendo('esta')}>
          Receber notinha
        </Botao>
      )}
    >
      {ficha ? (
        <>
        <div className="detalhe-ficha__aviso">
          <AvisoOutrasNotinhas base={base} ficha={ficha} hoje={hoje} aoReceberTodas={() => setRecebendo('todas')} />
        </div>
        <div className="detalhe-ficha">
          <div className="detalhe-ficha__principal">
            <Painel titulo={<ComIcone icone="info">Dados da ficha</ComIcone>}>
              <DadosFicha base={base} ficha={ficha} hoje={hoje} />
            </Painel>
            <Painel colado titulo={<ComIcone icone="pacote">Itens</ComIcone>} acoes={<span className="detalhe-ficha__resumo">{contagemItens(ficha)}</span>}>
              <TabelaItensFicha ficha={ficha} />
            </Painel>
          </div>
          <aside className="detalhe-ficha__lateral">
            <Painel titulo={<ComIcone icone="recibo">Total da ficha</ComIcone>}>
              <strong className="detalhe-ficha__total numero">{reais(ficha.total)}</strong>
              <TotaisFicha ficha={ficha} hoje={hoje} />
            </Painel>
            <Painel titulo={<ComIcone icone="dinheiro">{notinha ? 'Pagamentos da notinha' : 'Pagamento'}</ComIcone>}>
              <PagamentosFicha ficha={ficha} />
            </Painel>
          </aside>
        </div>
        </>
      ) : (
        <Painel titulo="Ficha não encontrada">
          <p>Não há ficha #{id} nos dados locais. Volte à lista e escolha uma ficha exibida.</p>
          <Link className="detalhe-ficha__link" to={rotas.inicio}>Ver histórico de fichas</Link>
        </Painel>
      )}
      {recebendo && notinha && ficha?.clienteId && (
        <ReceberNotinhas clienteId={ficha.clienteId} marcadas={recebendo === 'esta' ? [ficha.id] : undefined} aoFechar={() => setRecebendo(null)} />
      )}
    </Tela>
  )
}
