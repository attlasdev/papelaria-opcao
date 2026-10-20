import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Botao } from '../../componentes/botao/Botao'
import { ModalMotivo } from '../../componentes/modal/ModalMotivo'
import { CartaoResumo, Painel } from '../../componentes/painel/Painel'
import { Filtros } from '../../componentes/filtros/Filtros'
import { Tabela } from '../../componentes/tabela/Tabela'
import { Paginacao } from '../../componentes/paginacao/Paginacao'
import { CampoData } from '../../componentes/campo/Campo'
import { Etiqueta, SeloCompacto } from '../../componentes/selo/Selo'
import type { NomeIcone } from '../../componentes/icone/Icone'
import { dataCurta, reais, reaisComSinal } from '../../formatar'
import {
  CATEGORIA_ESTORNO,
  dataCalendarioValida,
  estornarMovimentoCaixa,
  hojeISO,
  intervaloAtual,
  intervaloMesPassado,
  linhasFinanceiroNoIntervalo,
  movimentosFinanceiro,
  movimentosOperacionaisFinanceiro,
  resumoFinanceiroIntervalo,
  useEstadoDemonstracao,
  type Meio,
  type LinhaFinanceiro,
  type Periodo,
} from '../../mock/estado-demonstracao'
import { rotas } from '../../rotas-caminhos'
import './financeiro.css'
import { useAbrirFicha } from '../detalhe-ficha/AbrirFicha'
import { ModalCancelarFicha } from '../detalhe-ficha/ConteudoFicha'
import { ExportarPeriodo } from './ExportarPeriodo'

/** Os meios, mais "Estornos": só as linhas de estorno (`2026-10-19`). */
type FiltroMeio = 'todos' | Meio | 'estornos'
type AtalhoPeriodo = Periodo | 'mesPassado' | 'personalizado'

const iconeMeio: Record<Meio, NomeIcone> = { pix: 'pix', cartao: 'cartao', dinheiro: 'dinheiro' }
const linhasPorPagina = 15

export function Financeiro() {
  const abrirFicha = useAbrirFicha()
  const [periodo, setPeriodo] = useState<AtalhoPeriodo>('dia')
  const [de, setDe] = useState(hojeISO())
  const [ate, setAte] = useState(hojeISO())
  const [meio, setMeio] = useState<FiltroMeio>('todos')
  const [pagina, setPagina] = useState(1)
  const [estornando, setEstornando] = useState<LinhaFinanceiro | null>(null)
  const [estornandoVenda, setEstornandoVenda] = useState<string | null>(null)
  const navegar = useNavigate()
  const base = useEstadoDemonstracao()
  const hoje = hojeISO()
  const linhas = movimentosOperacionaisFinanceiro(movimentosFinanceiro(base))
  const r = resumoFinanceiroIntervalo(linhas, de, ate)
  const doPeriodo = linhasFinanceiroNoIntervalo(linhas, de, ate)
  const estornos = doPeriodo.filter((m) => m.categoria === CATEGORIA_ESTORNO)
  const lista = meio === 'todos' ? doPeriodo : meio === 'estornos' ? estornos : doPeriodo.filter((m) => m.meio === meio)
  const fichaEstornando = estornandoVenda ? base.fichas.find((f) => f.id === estornandoVenda) : undefined
  const periodoValido = dataCalendarioValida(de) && dataCalendarioValida(ate) && de <= ate && ate <= hoje
  const totalPaginas = Math.max(1, Math.ceil(lista.length / linhasPorPagina))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicioPagina = (paginaAtual - 1) * linhasPorPagina
  const movimentosDaPagina = lista.slice(inicioPagina, inicioPagina + linhasPorPagina)
  const resumoPagina = lista.length === 0
    ? periodoValido ? 'Nenhuma movimentação no período selecionado' : 'Escolha as datas inicial e final'
    : `Mostrando ${inicioPagina + 1}–${inicioPagina + movimentosDaPagina.length} de ${lista.length} ${lista.length === 1 ? 'movimentação' : 'movimentações'}`
  const maiorValor = Math.max(r.entradas, r.saidas, 1)
  const largura = (centavos: number) => `${(centavos / maiorValor) * 100}%`

  return (
    <Tela
      titulo="Financeiro"
      subtitulo={periodoValido ? `Consulta de ${dataCurta(de)} a ${dataCurta(ate)}` : 'Escolha as datas para consultar'}
      acaoCabecalho={
        <Botao variante="primario" icone="mais" onClick={() => navegar(rotas.registrarMovimento)}>
          Registrar movimento
        </Botao>
      }
      acoesTitulo={
        <ExportarPeriodo linhas={linhas} de={de} ate={ate} periodoValido={periodoValido} vazio={r.contagem.todos === 0} />
      }
    >
      <Painel titulo="Consultar período" className="financeiro__periodo">
        <div className="financeiro__periodo-controles">
          <Filtros
            rotulo="Atalhos de período financeiro"
            valor={periodo}
            aoMudar={(atalho) => {
              setPeriodo(atalho)
              if (atalho !== 'personalizado') {
                const intervalo = atalho === 'mesPassado' ? intervaloMesPassado(hoje) : intervaloAtual(atalho, hoje)
                setDe(intervalo.de)
                setAte(intervalo.ate)
              }
              setPagina(1)
            }}
            opcoes={[
              { valor: 'dia', rotulo: 'Hoje' },
              { valor: 'semana', rotulo: 'Esta semana' },
              { valor: 'mes', rotulo: 'Este mês' },
              { valor: 'mesPassado', rotulo: 'Mês passado' },
              { valor: 'ano', rotulo: 'Este ano' },
              { valor: 'personalizado', rotulo: 'Outro período' },
            ]}
          />
          <div className="financeiro__periodo-datas">
            <CampoData rotulo="De" valor={de} min="1900-01-01" max={ate || hoje} aoMudar={(valor) => { setDe(valor); setPeriodo('personalizado'); setPagina(1) }} />
            <CampoData rotulo="Até" valor={ate} min={de || '1900-01-01'} max={hoje} aoMudar={(valor) => { setAte(valor); setPeriodo('personalizado'); setPagina(1) }} />
          </div>
        </div>
        {!periodoValido && <p className="financeiro__periodo-ajuda" role="status">Preencha um intervalo válido para consultar.</p>}
      </Painel>
      <div className="grade-resumo">
        <CartaoResumo
          rotulo="Entradas"
          icone="baixar"
          tom="ok"
          valor={reais(r.entradas)}
          sinal="entrada"
        />
        <CartaoResumo
          rotulo="Despesas e outras saídas"
          icone="enviar"
          tom="critico"
          valor={reais(r.saidas)}
          sinal="saida"
          nota={`${r.quantidadeSaidas} ${r.quantidadeSaidas === 1 ? 'saída' : 'saídas'} no período`}
        />
        <CartaoResumo
          rotulo="Entradas menos despesas"
          icone="financeiro"
          valor={reais(r.liquido)}
        />
      </div>

      <Painel titulo="Entradas e saídas do período" className="financeiro__comparacao">
        <div className="financeiro__comparacao-conteudo">
          <div className="financeiro__comparacao-linha">
            <span>Entradas</span>
            <div className="financeiro__comparacao-trilho" aria-hidden="true">
              <span className="financeiro__comparacao-barra financeiro__comparacao-barra--entrada" style={{ width: largura(r.entradas) }} />
            </div>
            <strong className="numero">{reais(r.entradas)}</strong>
          </div>
          <div className="financeiro__comparacao-linha">
            <span>Despesas</span>
            <div className="financeiro__comparacao-trilho" aria-hidden="true">
              <span className="financeiro__comparacao-barra financeiro__comparacao-barra--saida" style={{ width: largura(r.saidas) }} />
            </div>
            <strong className="numero">{reais(r.saidas)}</strong>
          </div>
          <div className="financeiro__comparacao-liquido">
            <span>Entradas menos despesas do período</span>
            <strong className="numero">{reais(r.liquido)}</strong>
          </div>
        </div>
      </Painel>

      <Painel
        colado
        titulo="Movimentações financeiras"
        acoes={
          <Filtros
            rotulo="Filtrar por meio de pagamento"
            valor={meio}
            aoMudar={(proximoMeio) => { setMeio(proximoMeio); setPagina(1) }}
            opcoes={[
              { valor: 'todos', rotulo: 'Todos os meios', contagem: r.contagem.todos },
              { valor: 'pix', rotulo: 'Pix', contagem: r.contagem.pix },
              { valor: 'cartao', rotulo: 'Cartão', contagem: r.contagem.cartao },
              { valor: 'dinheiro', rotulo: 'Dinheiro', contagem: r.contagem.dinheiro },
              { valor: 'estornos', rotulo: 'Estornos', contagem: estornos.length },
            ]}
          />
        }
      >
        <Tabela larguraMinima={900}>
          <thead>
            <tr>
              <th>Horário</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Meio</th>
              <th>Fluxo</th>
              <th className="celula--numero">Valor</th>
              <th className="celula--acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && (
              <tr>
                <td colSpan={7} className="financeiro__movimentos-vazio">
                  {periodoValido ? 'Nenhuma movimentação no período selecionado.' : 'Escolha as datas inicial e final.'}
                </td>
              </tr>
            )}
            {movimentosDaPagina.map((mov) => {
              const entrada = mov.valor > 0
              return (
                <tr key={mov.id}>
                  <td>
                    <span className="celula-principal numero">{mov.horario}</span>
                    <span className="celula-secundaria numero">{dataCurta(mov.data)}</span>
                  </td>
                  <td>
                    <span className="celula-principal">{mov.descricao}</span>
                    <span className="celula-secundaria">{mov.origem}{mov.operador && ` · ${mov.operador}`}</span>
                  </td>
                  <td>
                    {mov.ficha ? (
                      <button type="button" className="financeiro__ficha" onClick={() => abrirFicha(mov.ficha!)}>
                        <Etiqueta icone="recibo">Ficha #{mov.ficha}</Etiqueta>
                      </button>
                    ) : (
                      <Etiqueta>{mov.categoria}</Etiqueta>
                    )}
                  </td>
                  <td>
                    <Etiqueta icone={iconeMeio[mov.meio]}>{mov.meioRotulo}</Etiqueta>
                  </td>
                  <td>
                    {mov.categoria === CATEGORIA_ESTORNO
                      ? <SeloCompacto tom="neutro">Estorno</SeloCompacto>
                      : <SeloCompacto tom={entrada ? 'ok' : 'critico'}>{entrada ? 'Entrada' : 'Saída'}</SeloCompacto>}
                  </td>
                  <td className={`celula--numero financeiro__valor financeiro__valor--${entrada ? 'entrada' : 'saida'}`}>
                    {reaisComSinal(mov.valor)}
                  </td>
                  <td className="celula--acoes">
                    {/* Lançamento manual: estorno de sinal contrário. Venda à vista: cancela a ficha inteira. Notinha se corrige na ficha. */}
                    {mov.estornado && <SeloCompacto tom="neutro">Estornado</SeloCompacto>}
                    {mov.estornavel && (
                      <Botao tamanho="pequeno" variante="fantasma" onClick={() => setEstornando(mov)}>
                        Estornar
                      </Botao>
                    )}
                    {mov.vendaEstornavel && mov.ficha && (
                      <Botao tamanho="pequeno" variante="fantasma" onClick={() => setEstornandoVenda(mov.ficha!)}>
                        Estornar
                      </Botao>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Tabela>
        <Paginacao resumo={resumoPagina} pagina={paginaAtual} totalPaginas={totalPaginas} aoMudar={setPagina} />
      </Painel>

      <p className="financeiro__nota">
        Entradas incluem vendas, notinhas recebidas e lançamentos avulsos em dinheiro, Pix e cartão. O resultado não representa lucro nem saldo bancário.
      </p>
      {fichaEstornando && (
        <ModalCancelarFicha ficha={fichaEstornando} titulo={`Estornar a venda da ficha #${fichaEstornando.id}`} textoConfirmar="Estornar venda" aoFechar={() => setEstornandoVenda(null)} />
      )}
      {estornando && (
        <ModalMotivo
          titulo="Estornar lançamento"
          subtitulo={`${estornando.descricao} · ${reaisComSinal(estornando.valor)} em ${dataCurta(estornando.data)}`}
          consequencias={
            <ul>
              <li>Entra hoje um lançamento de <strong>{reaisComSinal(-estornando.valor)}</strong> que anula este.</li>
              <li>O original fica na lista, marcado como estornado.{estornando.data !== hoje && ` O dia ${dataCurta(estornando.data)} não muda.`}</li>
            </ul>
          }
          textoConfirmar="Estornar lançamento"
          aoConfirmar={(motivo) => { estornarMovimentoCaixa(estornando.id, motivo); setEstornando(null) }}
          aoFechar={() => setEstornando(null)}
        />
      )}
      <Outlet />
    </Tela>
  )
}
