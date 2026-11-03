import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import type { Falha, FiltroFinanceiro, LinhaFinanceira, PaginaFinanceiro } from '../../../comum/contrato'
import { hojeEmSaoPaulo } from '../../../comum/regras/entrada'
import { JanelaAssinatura } from '../../componentes/assinatura/JanelaAssinatura'
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
import { api } from '../../dados/api'
import { tituloFalha } from '../../falhas'
import { dataCurta, NOME_MEIO, reais, reaisComSinal } from '../../formatar'
import { useDadosMudaram } from '../../dados/mudancas'
import { dataCalendarioValida, intervaloAtual, intervaloMesPassado, type Periodo } from '../../datas'
import type { Meio } from '../../mock/base/tipos'
import { rotas } from '../../rotas-caminhos'
import './financeiro.css'
import { useAbrirFicha } from '../detalhe-ficha/AbrirFicha'
import { ModalCancelarFichaPorId } from '../detalhe-ficha/ConteudoFicha'
import { ExportarPeriodo } from './ExportarPeriodo'

type AtalhoPeriodo = Periodo | 'mesPassado' | 'personalizado'

const iconeMeio: Record<Meio, NomeIcone> = { pix: 'pix', cartao: 'cartao', dinheiro: 'dinheiro' }
const linhasPorPagina = 15

const mensagem = (r: Falha) => (r.causa === 'validacao' || r.causa === 'permissao' ? r.erro : `${tituloFalha(r.causa)} ${r.erro}`)

/** O horário de São Paulo de um instante, para a coluna "Horário". */
const horario = (instante: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instante))

export function Financeiro() {
  const abrirFicha = useAbrirFicha()
  const hoje = hojeEmSaoPaulo()
  // Vindo do "aguardando a dona" do Início: os estornos daquele dia.
  const [parametros] = useSearchParams()
  const diaPedido = parametros.get('dia')
  const [periodo, setPeriodo] = useState<AtalhoPeriodo>(diaPedido && diaPedido !== hoje ? 'personalizado' : 'dia')
  const [de, setDe] = useState(diaPedido ?? hoje)
  const [ate, setAte] = useState(diaPedido ?? hoje)
  const [meio, setMeio] = useState<FiltroFinanceiro>(diaPedido ? 'estornos' : 'todos')
  const [pagina, setPagina] = useState(1)
  // O estorno de lançamento: o motivo, depois quem está fazendo (`R-FINANCEIRO-07`).
  const [estornando, setEstornando] = useState<{ linha: LinhaFinanceira; motivo: string | null } | null>(null)
  const [conferindo, setConferindo] = useState<LinhaFinanceira | null>(null)
  const [estornandoVenda, setEstornandoVenda] = useState<{ id: string; numero: string } | null>(null)
  const navegar = useNavigate()
  // Voltar do "Registrar movimento" muda a chave da rota: a lista relê.
  const { key: volta } = useLocation()
  // Gravação que deu certo avisa (`src/dados/mudancas.ts`); a tela relê.
  const versaoDados = useDadosMudaram()
  const [carga, setCarga] = useState<{ dado: PaginaFinanceiro | null; erro: string | null }>({ dado: null, erro: null })
  const [tentativa, setTentativa] = useState(0)
  const recarregar = () => setTentativa((n) => n + 1)
  const periodoValido = dataCalendarioValida(de) && dataCalendarioValida(ate) && de <= ate && ate <= hoje
  useEffect(() => {
    if (!periodoValido) return
    let vivo = true
    void api().consultarFinanceiro({ de, ate }, meio, pagina, linhasPorPagina).then((r) => {
      if (!vivo) return
      setCarga((atual) => (r.ok ? { dado: r.dado, erro: null } : { ...atual, erro: mensagem(r) }))
      if (r.ok && r.dado.pagina !== pagina) setPagina(r.dado.pagina)
    })
    return () => { vivo = false }
  }, [de, ate, meio, pagina, periodoValido, versaoDados, volta, tentativa])

  const dado = periodoValido ? carga.dado : null
  const r = dado?.resumo ?? { entradas: 0, saidas: 0, liquido: 0, quantidadeSaidas: 0, contagem: { todos: 0, dinheiro: 0, pix: 0, cartao: 0, estornos: 0 } }
  const movimentosDaPagina = dado?.linhas ?? []
  const total = dado?.total ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / linhasPorPagina))
  const paginaAtual = dado?.pagina ?? pagina
  const inicioPagina = (paginaAtual - 1) * linhasPorPagina
  const resumoPagina = !periodoValido ? 'Escolha as datas inicial e final'
    : !dado ? ''
    : total === 0 ? 'Nenhuma movimentação no período selecionado'
    : `Mostrando ${inicioPagina + 1}–${inicioPagina + movimentosDaPagina.length} de ${total} ${total === 1 ? 'movimentação' : 'movimentações'}`
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
        <ExportarPeriodo de={de} ate={ate} periodoValido={periodoValido} vazio={r.contagem.todos === 0} />
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
      {carga.erro && periodoValido && (
        <div className="financeiro__falha" role="alert">
          <span>{carga.erro}</span>
          <Botao tamanho="pequeno" onClick={recarregar}>Tentar de novo</Botao>
        </div>
      )}
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
              { valor: 'estornos', rotulo: 'Estornos', contagem: r.contagem.estornos },
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
            {movimentosDaPagina.length === 0 && (
              <tr>
                <td colSpan={7} className="financeiro__movimentos-vazio">
                  {!periodoValido ? 'Escolha as datas inicial e final.' : !dado ? (carga.erro ? 'Não foi possível carregar as movimentações.' : 'Carregando as movimentações…') : 'Nenhuma movimentação no período selecionado.'}
                </td>
              </tr>
            )}
            {movimentosDaPagina.map((mov) => {
              const entrada = mov.valor > 0
              const ficha = mov.ficha
              return (
                <tr key={mov.id}>
                  <td>
                    <span className="celula-principal numero">{horario(mov.registradoEm)}</span>
                    <span className="celula-secundaria numero">{dataCurta(mov.dia)}</span>
                  </td>
                  <td>
                    <span className="celula-principal">{mov.descricao}</span>
                    <span className="celula-secundaria">{mov.origem}{mov.operador && ` · ${mov.operador}`}</span>
                  </td>
                  <td>
                    {ficha ? (
                      <button type="button" className="financeiro__ficha" onClick={() => abrirFicha(ficha.id)}>
                        <Etiqueta icone="recibo">Ficha #{ficha.numero}</Etiqueta>
                      </button>
                    ) : (
                      <Etiqueta>{mov.categoria}</Etiqueta>
                    )}
                  </td>
                  <td>
                    <Etiqueta icone={iconeMeio[mov.meio]}>{mov.rotulo ?? NOME_MEIO[mov.meio]}</Etiqueta>
                  </td>
                  <td>
                    {mov.estornoDe
                      ? <SeloCompacto tom="neutro">Estorno</SeloCompacto>
                      : <SeloCompacto tom={entrada ? 'ok' : 'critico'}>{entrada ? 'Entrada' : 'Saída'}</SeloCompacto>}
                  </td>
                  <td className={`celula--numero financeiro__valor financeiro__valor--${entrada ? 'entrada' : 'saida'}`}>
                    {reaisComSinal(mov.valor)}
                  </td>
                  <td className="celula--acoes">
                    {/* Lançamento manual: estorno de sinal contrário. Venda à vista: cancela a ficha inteira. Notinha se corrige na ficha. */}
                    {mov.estornado && <SeloCompacto tom="neutro">Estornado</SeloCompacto>}
                    {/* O estorno de lançamento de funcionário aguarda o visto da dona (`R-FINANCEIRO-07`). */}
                    {mov.aguardandoDona && <SeloCompacto tom="atencao">A conferir</SeloCompacto>}
                    {mov.aguardandoDona && (
                      <Botao tamanho="pequeno" variante="fantasma" onClick={() => setConferindo(mov)}>
                        Conferir
                      </Botao>
                    )}
                    {mov.lancamentoEstornavel && (
                      <Botao tamanho="pequeno" variante="fantasma" onClick={() => setEstornando({ linha: mov, motivo: null })}>
                        Estornar
                      </Botao>
                    )}
                    {mov.vendaEstornavel && ficha && (
                      <Botao tamanho="pequeno" variante="fantasma" onClick={() => setEstornandoVenda(ficha)}>
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
      {estornandoVenda && (
        <ModalCancelarFichaPorId id={estornandoVenda.id} titulo={`Estornar a venda da ficha #${estornandoVenda.numero}`} textoConfirmar="Estornar venda" aoFechar={() => { setEstornandoVenda(null); recarregar() }} />
      )}
      {estornando && estornando.motivo === null && (
        <ModalMotivo
          titulo="Estornar lançamento"
          subtitulo={`${estornando.linha.descricao} · ${reaisComSinal(estornando.linha.valor)} em ${dataCurta(estornando.linha.dia)}`}
          consequencias={
            <ul>
              <li>Entra hoje um lançamento de <strong>{reaisComSinal(-estornando.linha.valor)}</strong> que anula este.</li>
              <li>O original fica na lista, marcado como estornado.{estornando.linha.dia !== hoje && ` O dia ${dataCurta(estornando.linha.dia)} não muda.`}</li>
              <li>Se quem estorna não é a dona, o estorno fica aguardando o visto dela.</li>
            </ul>
          }
          textoConfirmar="Continuar"
          aoConfirmar={(motivo) => setEstornando({ linha: estornando.linha, motivo })}
          aoFechar={() => setEstornando(null)}
        />
      )}
      {estornando?.motivo && (
        <JanelaAssinatura
          gesto={`Estornar ${estornando.linha.descricao} · ${estornando.motivo}`}
          rotuloConfirmar="Estornar lançamento"
          fazer={(quem) => api().estornarLancamento(estornando.linha.id, estornando.motivo!, quem)}
          aoConcluir={() => { setEstornando(null); recarregar() }}
          aoFechar={() => setEstornando(null)}
        />
      )}
      {conferindo && (
        <JanelaAssinatura
          soDona
          gesto={`Conferir ${conferindo.descricao} · ${reaisComSinal(conferindo.valor)}`}
          rotuloConfirmar="Conferir"
          fazer={(dona) => api().conferirEstornoLancamento(conferindo.id, dona)}
          aoConcluir={() => { setConferindo(null); recarregar() }}
          aoFechar={() => setConferindo(null)}
        />
      )}
      <Outlet />
    </Tela>
  )
}
