import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Painel } from '../../componentes/painel/Painel'
import { Botao } from '../../componentes/botao/Botao'
import { reais } from '../../formatar'
import { rotas } from '../../rotas-caminhos'
import { ReceberNotinhas } from '../detalhe-cliente/receber/ReceberNotinhas'
import { ComIcone } from '../../componentes/icone/Icone'
import {
  AnotacoesFicha, AvisoOutrasNotinhas, BotaoCancelarFicha, contagemItens, DadosFicha, FaixaCancelada, PagamentosFicha, paginaDoCliente,
  subtituloFicha, TabelaItensFicha, TotaisFicha, useFicha,
} from './ConteudoFicha'
import './detalhe-ficha.css'

export function DetalheFicha() {
  const { id = '' } = useParams()
  const [parametros] = useSearchParams()
  const origem = parametros.get('origem') === 'historico' ? 'historico' : 'inicio'
  const { carga, atualizar, tentarDeNovo } = useFicha(id)
  // 'esta' abre a janela só com esta ficha marcada; 'todas' marca todas as abertas do cliente.
  const [recebendo, setRecebendo] = useState<'esta' | 'todas' | null>(null)
  const ficha = carga.fase === 'pronto' ? carga.ficha : null
  const naoEncontrada = carga.fase === 'erro' && carga.naoEncontrada

  return (
    <Tela
      voltar={{
        para: origem === 'historico' && ficha ? paginaDoCliente(ficha.cliente?.id ?? null) : rotas.inicio,
        rotulo: origem === 'historico' ? 'Voltar para o histórico' : 'Voltar para histórico de fichas',
      }}
      trilha={
        <Link className="detalhe-ficha__link" to={origem === 'historico' ? rotas.clientes : rotas.inicio}>
          {origem === 'historico' ? 'Clientes' : 'Início'}
        </Link>
      }
      titulo={ficha ? `Ficha #${ficha.numero}` : 'Ficha'}
      subtitulo={ficha ? subtituloFicha(ficha) : naoEncontrada ? 'Ficha não encontrada' : ''}
      acoesTitulo={ficha && <BotaoCancelarFicha ficha={ficha} aoMudar={atualizar} />}
      acaoCabecalho={ficha?.forma === 'notinha' && ficha.emAberto > 0 && (
        <Botao variante="primario" icone="dinheiro" onClick={() => setRecebendo('esta')}>
          Receber notinha
        </Botao>
      )}
    >
      {ficha && (
        <>
        <div className="detalhe-ficha__aviso">
          <FaixaCancelada ficha={ficha} aoMudar={atualizar} />
          <AvisoOutrasNotinhas ficha={ficha} aoReceberTodas={() => setRecebendo('todas')} />
        </div>
        <div className="detalhe-ficha">
          <div className="detalhe-ficha__principal">
            <Painel titulo={<ComIcone icone="info">Dados da ficha</ComIcone>}>
              <DadosFicha ficha={ficha} />
            </Painel>
            <Painel colado titulo={<ComIcone icone="pacote">Itens</ComIcone>} acoes={<span className="detalhe-ficha__resumo">{contagemItens(ficha)}</span>}>
              <TabelaItensFicha ficha={ficha} />
            </Painel>
          </div>
          <aside className="detalhe-ficha__lateral">
            <Painel titulo={<ComIcone icone="recibo">Total da ficha</ComIcone>}>
              <strong className="detalhe-ficha__total numero">{reais(ficha.total)}</strong>
              <TotaisFicha ficha={ficha} />
            </Painel>
            <Painel titulo={<ComIcone icone="dinheiro">{ficha.forma === 'notinha' ? 'Pagamentos da notinha' : 'Pagamento'}</ComIcone>}>
              <PagamentosFicha ficha={ficha} />
            </Painel>
            {ficha.forma === 'notinha' && (
              <Painel titulo={<ComIcone icone="editar">Anotações</ComIcone>}>
                <AnotacoesFicha ficha={ficha} aoMudar={atualizar} />
              </Painel>
            )}
          </aside>
        </div>
        </>
      )}
      {carga.fase === 'carregando' && <p className="detalhe-ficha__resumo" role="status">Carregando a ficha…</p>}
      {carga.fase === 'erro' && (naoEncontrada ? (
        <Painel titulo="Ficha não encontrada">
          <p>Não há ficha com esse número. Volte à lista e escolha uma ficha exibida.</p>
          <Link className="detalhe-ficha__link" to={rotas.inicio}>Ver histórico de fichas</Link>
        </Painel>
      ) : (
        <div className="detalhe-ficha__falha" role="alert">
          <span>{carga.mensagem}</span>
          <Botao tamanho="pequeno" onClick={tentarDeNovo}>Tentar de novo</Botao>
        </div>
      ))}
      {recebendo && ficha?.cliente && (
        <ReceberNotinhas clienteId={ficha.cliente.id} marcadas={recebendo === 'esta' ? [ficha.id] : undefined} aoFechar={() => setRecebendo(null)} />
      )}
    </Tela>
  )
}
