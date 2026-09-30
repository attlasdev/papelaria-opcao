import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Botao } from '../../componentes/botao/Botao'
import { ModalMotivo } from '../../componentes/modal/ModalMotivo'
import { CartaoResumo, Painel } from '../../componentes/painel/Painel'
import { Filtros } from '../../componentes/filtros/Filtros'
import { Tabela } from '../../componentes/tabela/Tabela'
import { Paginacao } from '../../componentes/paginacao/Paginacao'
import { useLinhasPorPagina } from '../../componentes/paginacao/useLinhasPorPagina'
import { Etiqueta, SeloCompacto } from '../../componentes/selo/Selo'
import type { NomeIcone } from '../../componentes/icone/Icone'
import { useSemDestino } from '../../componentes/aviso/Aviso'
import { dataCurta, reais, reaisComSinal } from '../../formatar'
import {
  agoraHorario,
  CATEGORIA_ESTORNO,
  dataPorExtenso,
  estornarMovimentoCaixa,
  hojeISO,
  movimentosFinanceiro,
  NOME_MEIO,
  noPeriodo,
  resumoFinanceiro,
  useEstadoDemonstracao,
  type Meio,
  type LinhaFinanceiro,
  type Periodo,
} from '../../mock/estado-demonstracao'
import { rotas } from '../../rotas-caminhos'
import './financeiro.css'
import { useAbrirFicha } from '../detalhe-ficha/AbrirFicha'

type FiltroMeio = 'todos' | Meio

const iconeMeio: Record<Meio, NomeIcone> = { pix: 'pix', cartao: 'cartao', dinheiro: 'dinheiro' }
const nomePeriodo: Record<Periodo, string> = { dia: 'dia', semana: 'semana', mes: 'mês', ano: 'ano' }
// A comparação para no mesmo ponto do período anterior (ver resumoFinanceiro).
const anterior: Record<Periodo, string> = { dia: 'vs ontem, até esta hora', semana: 'vs semana anterior, até hoje', mes: 'vs mês anterior, até hoje', ano: 'vs ano anterior, até hoje' }

export function Financeiro() {
  const abrirFicha = useAbrirFicha()
  const [periodo, setPeriodo] = useState<Periodo>('dia')
  const [meio, setMeio] = useState<FiltroMeio>('todos')
  const [pagina, setPagina] = useState(1)
  const [estornando, setEstornando] = useState<LinhaFinanceiro | null>(null)
  const { referencia: painelMovimentos, linhasPorPagina } = useLinhasPorPagina()
  const semDestino = useSemDestino()
  const navegar = useNavigate()
  const base = useEstadoDemonstracao()
  const hoje = hojeISO()
  const linhas = movimentosFinanceiro(base)
  const r = resumoFinanceiro(linhas, periodo, hoje, agoraHorario())
  const doPeriodo = linhas.filter((l) => noPeriodo(l.data, periodo, hoje))
  const lista = meio === 'todos' ? doPeriodo : doPeriodo.filter((m) => m.meio === meio)
  const totalPaginas = Math.max(1, Math.ceil(lista.length / linhasPorPagina))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicioPagina = (paginaAtual - 1) * linhasPorPagina
  const movimentosDaPagina = lista.slice(inicioPagina, inicioPagina + linhasPorPagina)
  const resumoPagina = lista.length === 0
    ? `Nenhuma movimentação neste ${nomePeriodo[periodo]}`
    : `Mostrando ${inicioPagina + 1}–${inicioPagina + movimentosDaPagina.length} de ${lista.length} ${lista.length === 1 ? 'movimentação' : 'movimentações'}`
  const maiorValor = Math.max(r.entradas, r.saidas, 1)
  const largura = (centavos: number) => `${(centavos / maiorValor) * 100}%`

  return (
    <Tela
      titulo="Financeiro"
      subtitulo={`Data base: ${dataPorExtenso(hoje)}`}
      acaoCabecalho={
        <Botao variante="primario" icone="mais" onClick={() => navegar(rotas.registrarMovimento)}>
          Registrar movimento
        </Botao>
      }
      acoesTitulo={
        <>
          <Filtros
            rotulo="Período"
            valor={periodo}
            aoMudar={(proximoPeriodo) => { setPeriodo(proximoPeriodo); setPagina(1) }}
            opcoes={[
              { valor: 'dia', rotulo: 'Dia' },
              { valor: 'semana', rotulo: 'Semana' },
              { valor: 'mes', rotulo: 'Mês' },
              { valor: 'ano', rotulo: 'Ano' },
            ]}
          />
          <Botao icone="baixar" onClick={semDestino('exportar período')}>
            Exportar período
          </Botao>
        </>
      }
    >
      <div className="grade-resumo">
        <CartaoResumo
          rotulo="Entradas"
          icone="baixar"
          tom="ok"
          valor={reais(r.entradas)}
          sinal="entrada"
          variacao={r.variacao}
          nota={r.variacao ? anterior[periodo] : 'Sem período anterior para comparar'}
        />
        <CartaoResumo
          rotulo="Saídas"
          icone="enviar"
          tom="critico"
          valor={reais(r.saidas)}
          sinal="saida"
          nota={`${r.quantidadeSaidas} ${r.quantidadeSaidas === 1 ? 'saída' : 'saídas'} no ${nomePeriodo[periodo]}`}
        />
        <CartaoResumo rotulo="Entradas menos saídas" icone="financeiro" valor={reais(r.liquido)} nota={`Líquido do ${nomePeriodo[periodo]}`} />
        <CartaoResumo
          rotulo="Meio mais usado"
          icone={r.meioMaisUsado ? iconeMeio[r.meioMaisUsado.meio] : 'pix'}
          valor={r.meioMaisUsado ? NOME_MEIO[r.meioMaisUsado.meio] : '—'}
          nota={r.meioMaisUsado ? `${r.meioMaisUsado.participacao}% do volume · ${reais(r.meioMaisUsado.valor)}` : 'Sem entradas no período'}
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
            <span>Saídas</span>
            <div className="financeiro__comparacao-trilho" aria-hidden="true">
              <span className="financeiro__comparacao-barra financeiro__comparacao-barra--saida" style={{ width: largura(r.saidas) }} />
            </div>
            <strong className="numero">{reais(r.saidas)}</strong>
          </div>
          <div className="financeiro__comparacao-liquido">
            <span>Líquido do {nomePeriodo[periodo]}</span>
            <strong className="numero">{reais(r.liquido)}</strong>
          </div>
        </div>
      </Painel>

      <div ref={painelMovimentos}>
      <Painel
        colado
        titulo="Movimentações do caixa"
        acoes={
          <Filtros
            rotulo="Filtrar por meio de pagamento"
            valor={meio}
            aoMudar={(proximoMeio) => { setMeio(proximoMeio); setPagina(1) }}
            opcoes={[
              { valor: 'todos', rotulo: 'Todos', contagem: r.contagem.todos },
              { valor: 'pix', rotulo: 'Pix', contagem: r.contagem.pix },
              { valor: 'cartao', rotulo: 'Cartão', contagem: r.contagem.cartao },
              { valor: 'dinheiro', rotulo: 'Dinheiro', contagem: r.contagem.dinheiro },
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
                  Nenhuma movimentação neste {nomePeriodo[periodo]}.
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
                    <span className="celula-secundaria">{mov.origem}</span>
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
                    {/* Venda e recebimento se corrigem na ficha; aqui só o lançamento manual. */}
                    {mov.estornado && <SeloCompacto tom="neutro">Estornado</SeloCompacto>}
                    {mov.estornavel && (
                      <Botao tamanho="pequeno" variante="fantasma" onClick={() => setEstornando(mov)}>
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
      </div>

      <p className="financeiro__nota">
        Relatório do balcão. Não substitui a contabilidade.
      </p>
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
