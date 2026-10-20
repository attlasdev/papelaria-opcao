import { useState } from 'react'
import { Link, Outlet, useNavigate, useParams } from 'react-router'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Botao } from '../../componentes/botao/Botao'
import { CartaoResumo, Painel } from '../../componentes/painel/Painel'
import { Filtros } from '../../componentes/filtros/Filtros'
import { Tabela } from '../../componentes/tabela/Tabela'
import { SeloSituacao, type Tom } from '../../componentes/selo/Selo'
import { ComIcone } from '../../componentes/icone/Icone'
import { Paginacao } from '../../componentes/paginacao/Paginacao'
import { useLinhasPorPagina } from '../../componentes/paginacao/useLinhasPorPagina'
import { dataCurta, reais } from '../../formatar'
import {
  contagemItens,
  hojeISO,
  resumoDoCliente,
  resumoItens,
  rotuloForma,
  situacaoDaFicha,
  useEstadoDemonstracao,
  type SituacaoNotinha,
} from '../../mock/estado-demonstracao'
import { rotas } from '../../rotas-caminhos'
import { ReceberNotinhas } from './receber/ReceberNotinhas'
import './detalhe-cliente.css'
import { useAbrirFicha } from '../detalhe-ficha/AbrirFicha'

type Filtro = 'todas' | SituacaoNotinha

const selo: Record<SituacaoNotinha, { tom: Tom; titulo: string }> = {
  pago: { tom: 'ok', titulo: 'Pago' },
  pendente: { tom: 'atencao', titulo: 'Pendente' },
  vencido: { tom: 'critico', titulo: 'Vencido' },
  cancelada: { tom: 'neutro', titulo: 'Cancelada' },
}

export function DetalheCliente() {
  const abrirFicha = useAbrirFicha()
  const { id } = useParams()
  const navegar = useNavigate()
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [pagina, setPagina] = useState(1)
  const { referencia: painelCompras, linhasPorPagina } = useLinhasPorPagina()
  /** Notinhas abertas na janela de recebimento; null = fechada. */
  // Janela de recebimento: 'todas' abre com todas marcadas; um id abre só com ela marcada.
  const [receber, setReceber] = useState<'todas' | string | null>(null)
  const base = useEstadoDemonstracao()
  const hoje = hojeISO()
  const cadastro = base.clientes.find((item) => item.id === id)
  const resumo = resumoDoCliente(base, id ?? '', hoje)
  const historico = resumo.fichas.map((ficha) => ({
    id: ficha.id,
    data: dataCurta(ficha.data),
    hora: ficha.horario,
    itens: resumoItens(ficha),
    resumoItens: contagemItens(ficha),
    pagamento: rotuloForma(ficha),
    valor: ficha.total,
    emAberto: resumo.abertas.find((n) => n.ficha.id === ficha.id)?.emAberto,
    ...situacaoDaFicha(ficha, hoje),
  }))
  const abertas = resumo.abertas
  const emAberto = (compraId: string) => abertas.some((item) => item.ficha.id === compraId)
  const desde = cadastro ? new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(new Date(`${cadastro.desde}T12:00:00`)) : ''


  const lista = filtro === 'todas' ? historico : historico.filter((c) => c.situacao === filtro)
  const totalPaginas = Math.max(1, Math.ceil(lista.length / linhasPorPagina))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicioPagina = (paginaAtual - 1) * linhasPorPagina
  const comprasDaPagina = lista.slice(inicioPagina, inicioPagina + linhasPorPagina)
  const resumoPagina = lista.length === 0
    ? 'Nenhuma compra neste filtro'
    : `Mostrando ${inicioPagina + 1}–${inicioPagina + comprasDaPagina.length} de ${lista.length} ${lista.length === 1 ? 'compra' : 'compras'}`
  const contagem = {
    todas: historico.length,
    pagas: historico.filter((c) => c.situacao === 'pago').length,
    pendentes: historico.filter((c) => c.situacao === 'pendente').length,
    vencidas: historico.filter((c) => c.situacao === 'vencido').length,
  }

  return (
    <Tela
      voltar={{ para: rotas.clientes, rotulo: 'Voltar para clientes' }}
      trilha={
        <>
          <Link className="detalhe-cliente__trilha-link" to={rotas.clientes}>
            Clientes
          </Link>{' '}
          / {cadastro?.nome ?? 'Cliente'}
        </>
      }
      titulo={cadastro?.nome ?? 'Cliente não encontrado'}
      subtitulo={cadastro ? `${cadastro.id} · ${cadastro.descricao} · cliente desde ${desde}` : 'Volte à lista de clientes'}
      acaoCabecalho={
        <Botao icone="editar" disabled={!cadastro} onClick={() => id && navegar(rotas.editarCliente(id))}>
          Editar dados
        </Botao>
      }
    >
      {!cadastro && <p className="detalhe-cliente__aviso">Cliente não encontrado nos dados locais.</p>}

      <div className="detalhe-cliente__topo">
        <Painel titulo={<ComIcone icone="pessoa">Cadastro</ComIcone>}>
          <dl className="detalhe-cliente__dados">
            <div>
              <dt><ComIcone icone="documento">Documento</ComIcone></dt>
              <dd className="codigo">{cadastro?.documento ?? '—'}</dd>
            </div>
            <div>
              <dt><ComIcone icone="telefone">Telefone / WhatsApp</ComIcone></dt>
              <dd>{cadastro?.telefone ?? '—'}</dd>
            </div>
            <div>
              <dt><ComIcone icone="endereco">Endereço</ComIcone></dt>
              <dd>{cadastro?.endereco || '—'}</dd>
            </div>
          </dl>
        </Painel>
        <div className="detalhe-cliente__numeros">
          <CartaoResumo
            rotulo="Total comprado"
            icone="carrinho"
            tom="ok"
            valor={resumo.compras ? reais(resumo.totalComprado) : '—'}
            nota={`${resumo.compras} ${resumo.compras === 1 ? 'compra registrada' : 'compras registradas'}`}
          />
          {/* O número que a dona olha quando a cliente pergunta "quanto eu devo?" abre o recebimento. */}
          <button
            type="button"
            className="detalhe-cliente__cartao-acao"
            disabled={abertas.length === 0}
            onClick={() => setReceber('todas')}
            aria-label={abertas.length ? 'Receber notinhas em aberto' : 'Nenhuma notinha em aberto'}
          >
          <CartaoResumo
            rotulo="Notinhas em aberto"
            icone="relogio"
            tom={abertas.some((item) => item.situacao === 'vencido') ? 'critico' : abertas.length ? 'atencao' : 'neutro'}
            valor={abertas.length ? reais(abertas.reduce((soma, item) => soma + item.emAberto, 0)) : '—'}
            nota={abertas.length ? `${abertas.length} ${abertas.length === 1 ? 'notinha' : 'notinhas'} · clique para receber` : 'Nada a receber'}
          />
          </button>
          <CartaoResumo rotulo="Ticket médio" icone="recibo" valor={resumo.compras ? reais(resumo.ticketMedio) : '—'} nota="Por compra" />
        </div>
      </div>

      <div ref={painelCompras}>
      <Painel
        colado
        titulo="Histórico de compras"
        acoes={
          <Filtros
            rotulo="Filtrar compras"
            valor={filtro}
            aoMudar={(proximoFiltro) => { setFiltro(proximoFiltro); setPagina(1) }}
            opcoes={[
              { valor: 'todas', rotulo: 'Todas', contagem: contagem.todas },
              { valor: 'pago', rotulo: 'Pagas', contagem: contagem.pagas },
              { valor: 'pendente', rotulo: 'Notinhas a vencer', contagem: contagem.pendentes },
              { valor: 'vencido', rotulo: 'Notinhas em atraso', contagem: contagem.vencidas },
            ]}
          />
        }
      >
        <Tabela larguraMinima={900}>
          <thead>
            <tr>
              <th>Ficha</th>
              <th>Data</th>
              <th>Itens principais</th>
              <th>Pagamento</th>
              <th className="celula--numero">Valor</th>
              <th>Situação</th>
              <th className="celula--acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {comprasDaPagina.map((compra) => (
              <tr key={compra.id} className={compra.situacao === 'vencido' ? 'linha--critica' : compra.situacao === 'pendente' ? 'linha--atencao' : undefined}>
                <td className="codigo">#{compra.id}</td>
                <td>
                  <span className="celula-principal numero">{compra.data}</span>
                  <span className="celula-secundaria numero">{compra.hora}</span>
                </td>
                <td className="detalhe-cliente__itens">
                  <span className="celula-principal" title={compra.itens}>
                    {compra.itens}
                  </span>
                  <span className="celula-secundaria">{compra.resumoItens}</span>
                </td>
                <td className="detalhe-cliente__pagamento">{compra.pagamento}</td>
                <td className="celula--numero detalhe-cliente__valor">
                  <span className="celula-principal">{reais(compra.valor)}</span>
                  {compra.emAberto !== undefined && compra.emAberto < compra.valor && (
                    <span className="celula-secundaria detalhe-cliente__aberto">{reais(compra.emAberto)} em aberto</span>
                  )}
                </td>
                <td>
                  <SeloSituacao {...selo[compra.situacao]} detalhe={compra.detalhe} />
                </td>
                <td className="celula--acoes">
                  <Botao tamanho="pequeno" onClick={() => abrirFicha(compra.id)}>
                    Ver ficha
                  </Botao>
                  {emAberto(compra.id) && (
                    <Botao tamanho="pequeno" variante="primario" onClick={() => setReceber(compra.id)}>
                      Receber
                    </Botao>
                  )}
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={7} className="detalhe-cliente__vazio">
                  {historico.length ? 'Nenhuma compra nesta situação.' : 'Este cliente ainda não comprou.'}
                </td>
              </tr>
            )}
          </tbody>
        </Tabela>
        <Paginacao
          resumo={resumoPagina}
          pagina={paginaAtual}
          totalPaginas={totalPaginas}
          aoMudar={setPagina}
        />
      </Painel>
      </div>
      {receber && id && (
        <ReceberNotinhas
          clienteId={id}
          marcadas={receber === 'todas' ? undefined : [receber]}
          aoFechar={() => setReceber(null)}
        />
      )}
      <Outlet />
    </Tela>
  )
}
