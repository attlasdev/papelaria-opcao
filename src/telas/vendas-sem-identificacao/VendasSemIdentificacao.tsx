import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { SeloCompacto } from '../../componentes/selo/Selo'
import { Tela } from '../../componentes/layout/tela/Tela'
import { CartaoResumo, Painel } from '../../componentes/painel/Painel'
import { Filtros } from '../../componentes/filtros/Filtros'
import { Tabela } from '../../componentes/tabela/Tabela'
import { Etiqueta } from '../../componentes/selo/Selo'
import { SeletorData } from '../../componentes/campo/SeletorData'
import { Paginacao } from '../../componentes/paginacao/Paginacao'
import { useLinhasPorPagina } from '../../componentes/paginacao/useLinhasPorPagina'
import type { NomeIcone } from '../../componentes/icone/Icone'
import type { Falha, PaginaVendasSemIdentificacao, PeriodoVendas, VendaSemIdentificacao } from '../../../comum/contrato'
import { hojeEmSaoPaulo } from '../../../comum/regras/entrada'
import { POR_PAGINA_MAXIMO } from '../../../comum/regras/produto'
import { api } from '../../dados/api'
import { tituloFalha } from '../../falhas'
import { dataCurta, reais } from '../../formatar'
import { NOME_MEIO, useEstadoDemonstracao, type Meio } from '../../mock/estado-demonstracao'
import { rotas } from '../../rotas-caminhos'
import './vendas-sem-identificacao.css'
import { useAbrirFicha } from '../detalhe-ficha/AbrirFicha'
import { Botao } from '../../componentes/botao/Botao'

type Periodo = 'dia' | 'semana' | 'mes' | 'tudo'
type FiltroMeio = 'todos' | Meio

const meios: { valor: Meio; rotulo: string; icone: NomeIcone }[] = [
  { valor: 'dinheiro', rotulo: 'Dinheiro', icone: 'dinheiro' },
  { valor: 'pix', rotulo: 'Pix', icone: 'pix' },
  { valor: 'cartao', rotulo: 'Cartão', icone: 'cartao' },
]

const iconeMeio: Record<VendaSemIdentificacao['forma'], NomeIcone> = { dinheiro: 'dinheiro', pix: 'pix', cartao: 'cartao', misto: 'financeiro' }

const mensagem = (r: Falha) => (r.causa === 'validacao' ? r.erro : `${tituloFalha(r.causa)} ${r.erro}`)

/** "Caderno (2x), Xerox": os itens e os serviços da venda. */
const textoItens = (v: VendaSemIdentificacao) => [...v.itens.map((i) => `${i.descricao} (${i.quantidade}x)`), ...v.servicos].join(', ')
const rotuloDaVenda = (v: VendaSemIdentificacao) => v.rotulo ?? (v.forma === 'misto' ? 'Misto' : NOME_MEIO[v.forma])

function isoLocal(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

/** Semana de domingo a sábado que contém a data de referência. */
function semanaDe(referencia: string) {
  const [ano, mes, dia] = referencia.split('-').map(Number)
  const inicio = new Date(ano, mes - 1, dia)
  inicio.setDate(inicio.getDate() - inicio.getDay())
  const fim = new Date(inicio)
  fim.setDate(fim.getDate() + 6)
  return { inicio: isoLocal(inicio), fim: isoLocal(fim) }
}

/** O período pedido ao back: o dia, a semana (domingo a sábado) ou o mês da referência; `null` é tudo. */
function periodoDe(referencia: string, periodo: Periodo, hoje: string): PeriodoVendas {
  if (periodo === 'tudo') return null
  if (periodo === 'dia') return { de: referencia, ate: referencia }
  if (periodo === 'semana') {
    const { inicio, fim } = semanaDe(referencia)
    return { de: inicio, ate: fim < hoje ? fim : hoje }
  }
  const [ano, mes] = referencia.split('-').map(Number)
  const fim = isoLocal(new Date(ano, mes, 0))
  return { de: `${referencia.slice(0, 7)}-01`, ate: fim < hoje ? fim : hoje }
}

function quantidade(total: number) {
  return `${total} ${total === 1 ? 'venda' : 'vendas'}`
}

/**
 * Histórico das vendas feitas sem identificação. Não é um cliente: é o filtro
 * das fichas sem cliente, para achar o que saiu e como foi pago no período.
 */
export function VendasSemIdentificacao() {
  const abrirFicha = useAbrirFicha()
  const [periodo, setPeriodo] = useState<Periodo>('dia')
  const [filtroMeio, setFiltroMeio] = useState<FiltroMeio>('todos')
  const [dataEscolhida, setDataEscolhida] = useState('')
  const [pagina, setPagina] = useState(1)
  const { referencia: painelVendas, linhasPorPagina } = useLinhasPorPagina()
  const porPagina = Math.min(linhasPorPagina, POR_PAGINA_MAXIMO)
  const hoje = hojeEmSaoPaulo()
  // Sem data escolhida, o período parte de hoje, o mesmo número do card em Clientes.
  const referencia = dataEscolhida || hoje
  const [carga, setCarga] = useState<{ dado: PaginaVendasSemIdentificacao | null; erro: string | null }>({ dado: null, erro: null })
  const [tentativa, setTentativa] = useState(0)
  // Fase 2: a venda e o cancelamento gravam na base da demonstração; a lista relê quando ela muda.
  const base = useEstadoDemonstracao()
  const pedido = JSON.stringify(periodoDe(referencia, periodo, hoje))
  useEffect(() => {
    let vivo = true
    void api().listarVendasSemIdentificacao(JSON.parse(pedido) as PeriodoVendas, filtroMeio, pagina, porPagina).then((r) => {
      if (!vivo) return
      if (!r.ok) return setCarga((atual) => ({ ...atual, erro: mensagem(r) }))
      setCarga({ dado: r.dado, erro: null })
      if (r.dado.pagina !== pagina) setPagina(r.dado.pagina)
    })
    return () => { vivo = false }
  }, [pedido, filtroMeio, pagina, porPagina, base, tentativa])

  const dado = carga.dado
  const resumo = dado?.resumo
  const vendasDaPagina = dado?.vendas ?? []
  const total = dado?.total ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))
  const paginaAtual = dado?.pagina ?? pagina
  const inicioPagina = (paginaAtual - 1) * porPagina
  const resumoPagina = !dado
    ? ''
    : total === 0
      ? 'Nenhuma venda neste filtro'
      : `Mostrando ${inicioPagina + 1}–${inicioPagina + vendasDaPagina.length} de ${quantidade(total)}`

  const descricaoPeriodo = periodo === 'tudo'
    ? 'Todo o histórico'
    : periodo === 'dia'
      ? `Dia ${dataCurta(referencia)}`
      : periodo === 'semana'
        ? `Semana de ${dataCurta(semanaDe(referencia).inicio)} a ${dataCurta(semanaDe(referencia).fim)}`
        : `Mês ${referencia.slice(5, 7)}/${referencia.slice(0, 4)}`

  function mudarPeriodo(proximo: Periodo) {
    setPeriodo(proximo)
    setPagina(1)
  }

  return (
    <Tela
      voltar={{ para: rotas.clientes, rotulo: 'Voltar para clientes' }}
      trilha={
        <>
          <Link className="vendas-sem-identificacao__trilha-link" to={rotas.clientes}>
            Clientes
          </Link>{' '}
          / Vendas sem identificação
        </>
      }
      titulo="Vendas sem identificação"
      subtitulo="Vendas realizadas sem identificar o cliente."
    >
      {carga.erro && (
        <div className="vendas-sem-identificacao__falha" role="alert">
          <span>{carga.erro}</span>
          <Botao tamanho="pequeno" onClick={() => setTentativa((n) => n + 1)}>Tentar de novo</Botao>
        </div>
      )}
      <div className="grade-resumo">
        <CartaoResumo
          rotulo="Total vendido"
          icone="carrinho"
          tom="ok"
          valor={resumo ? reais(resumo.totalVendido) : '—'}
          nota={resumo ? `${quantidade(resumo.vendas)}${resumo.vendas ? ` · média ${reais(Math.round(resumo.totalVendido / resumo.vendas))}` : ''}` : undefined}
        />
        {meios.map((meio) => (
          <CartaoResumo
            key={meio.valor}
            rotulo={meio.rotulo}
            icone={meio.icone}
            valor={resumo ? reais(resumo.porMeio[meio.valor].valor) : '—'}
            nota={resumo ? quantidade(resumo.porMeio[meio.valor].vendas) : undefined}
          />
        ))}
      </div>

      <div ref={painelVendas}>
        <Painel
          colado
          titulo={descricaoPeriodo}
          acoes={
            <div className="vendas-sem-identificacao__filtros">
              <Filtros
                rotulo="Período"
                valor={periodo}
                aoMudar={mudarPeriodo}
                opcoes={[
                  { valor: 'dia', rotulo: 'Dia' },
                  { valor: 'semana', rotulo: 'Semana' },
                  { valor: 'mes', rotulo: 'Mês' },
                  { valor: 'tudo', rotulo: 'Tudo' },
                ]}
              />
              {periodo !== 'tudo' && (
                <SeletorData
                  valor={dataEscolhida}
                  dataInicial={referencia}
                  max={hoje}
                  aoMudar={(data) => { setDataEscolhida(data); setPagina(1) }}
                />
              )}
              <Filtros
                rotulo="Filtrar por pagamento"
                valor={filtroMeio}
                aoMudar={(proximo) => { setFiltroMeio(proximo); setPagina(1) }}
                opcoes={[
                  { valor: 'todos', rotulo: 'Todos', contagem: dado?.contagem.todos },
                  ...meios.map((meio) => ({ valor: meio.valor, rotulo: meio.rotulo, contagem: dado?.contagem[meio.valor] })),
                ]}
              />
            </div>
          }
        >
          <Tabela larguraMinima={820}>
            <thead>
              <tr>
                <th>Ficha</th>
                <th>Data</th>
                <th>Itens</th>
                <th>Pagamento</th>
                <th className="celula--numero">Valor</th>
                <th className="celula--acoes">Ações</th>
              </tr>
            </thead>
            <tbody>
              {vendasDaPagina.map((venda) => {
                const [dia, hora] = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(venda.registradoEm)).split(', ')
                return (
                <tr key={venda.id}>
                  <td className="codigo">#{venda.numero}</td>
                  <td>
                    <span className="celula-principal numero">{dia}</span>
                    <span className="celula-secundaria numero">{hora}</span>
                  </td>
                  <td className="vendas-sem-identificacao__itens" title={textoItens(venda)}>{textoItens(venda)}</td>
                  <td>
                    <Etiqueta icone={iconeMeio[venda.forma]}>{rotuloDaVenda(venda)}</Etiqueta>
                  </td>
                  <td className="celula--numero vendas-sem-identificacao__valor">{venda.cancelada ? <SeloCompacto tom="neutro">Cancelada</SeloCompacto> : reais(venda.total)}</td>
                  <td className="celula--acoes">
                    <Botao tamanho="pequeno" onClick={() => abrirFicha(venda.id)}>
                      Ver ficha
                    </Botao>
                  </td>
                </tr>
                )
              })}
              {dado && total === 0 && (
                <tr>
                  <td colSpan={6} className="vendas-sem-identificacao__vazio">
                    Nenhuma venda sem identificação neste período.
                  </td>
                </tr>
              )}
              {!dado && (
                <tr>
                  <td colSpan={6} className="vendas-sem-identificacao__vazio">
                    {carga.erro ? 'Não foi possível carregar as vendas.' : 'Carregando as vendas…'}
                  </td>
                </tr>
              )}
            </tbody>
          </Tabela>
          <Paginacao resumo={resumoPagina} pagina={paginaAtual} totalPaginas={totalPaginas} aoMudar={setPagina} />
        </Painel>
      </div>
    </Tela>
  )
}
