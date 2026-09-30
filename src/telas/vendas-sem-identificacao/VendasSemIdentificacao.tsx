import { useState } from 'react'
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
import { dataCurta, reais } from '../../formatar'
import { porDataDecrescente, resumoItens, rotuloForma, useEstadoDemonstracao, type Ficha, type Meio } from '../../mock/estado-demonstracao'
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

const iconeMeio = Object.fromEntries(meios.map((m) => [m.valor, m.icone])) as Record<Meio, NomeIcone>

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

function noPeriodo(data: string, referencia: string, periodo: Periodo) {
  if (periodo === 'tudo') return true
  if (periodo === 'dia') return data === referencia
  if (periodo === 'mes') return data.slice(0, 7) === referencia.slice(0, 7)
  const { inicio, fim } = semanaDe(referencia)
  return data >= inicio && data <= fim
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
  const { fichas } = useEstadoDemonstracao()

  // Sem cliente não existe notinha: só as três formas à vista.
  const todas = fichas
    .filter((ficha): ficha is Ficha & { forma: Meio } => ficha.clienteId === null && ficha.forma !== 'notinha')
    .sort(porDataDecrescente)
  // Sem data escolhida, o período parte de hoje, o mesmo número do card em Clientes.
  const referencia = dataEscolhida || isoLocal(new Date())
  const doPeriodo = todas.filter((ficha) => noPeriodo(ficha.data, referencia, periodo))
  const lista = doPeriodo.filter((ficha) => filtroMeio === 'todos' || ficha.forma === filtroMeio)

  // Cancelada continua na lista, mas não soma.
  const vendidas = doPeriodo.filter((ficha) => !ficha.cancelamento)
  const totalPeriodo = vendidas.reduce((soma, ficha) => soma + ficha.total, 0)
  const porMeio = (meio: Meio) => vendidas.filter((ficha) => ficha.forma === meio)

  const totalPaginas = Math.max(1, Math.ceil(lista.length / linhasPorPagina))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicioPagina = (paginaAtual - 1) * linhasPorPagina
  const vendasDaPagina = lista.slice(inicioPagina, inicioPagina + linhasPorPagina)
  const resumoPagina = lista.length === 0
    ? 'Nenhuma venda neste filtro'
    : `Mostrando ${inicioPagina + 1}–${inicioPagina + vendasDaPagina.length} de ${quantidade(lista.length)}`

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
      subtitulo="Vendas de balcão sem cliente cadastrado."
    >
      <div className="grade-resumo">
        <CartaoResumo
          rotulo="Total vendido"
          icone="carrinho"
          tom="ok"
          valor={reais(totalPeriodo)}
          nota={`${quantidade(vendidas.length)}${vendidas.length ? ` · média ${reais(Math.round(totalPeriodo / vendidas.length))}` : ''}`}
        />
        {meios.map((meio) => {
          const vendas = porMeio(meio.valor)
          return (
            <CartaoResumo
              key={meio.valor}
              rotulo={meio.rotulo}
              icone={meio.icone}
              valor={reais(vendas.reduce((soma, ficha) => soma + ficha.total, 0))}
              nota={quantidade(vendas.length)}
            />
          )
        })}
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
                  aoMudar={(data) => { setDataEscolhida(data); setPagina(1) }}
                />
              )}
              <Filtros
                rotulo="Filtrar por pagamento"
                valor={filtroMeio}
                aoMudar={(proximo) => { setFiltroMeio(proximo); setPagina(1) }}
                opcoes={[
                  { valor: 'todos', rotulo: 'Todos', contagem: doPeriodo.length },
                  ...meios.map((meio) => ({ valor: meio.valor, rotulo: meio.rotulo, contagem: porMeio(meio.valor).length })),
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
              {vendasDaPagina.map((venda) => (
                <tr key={venda.id}>
                  <td className="codigo">#{venda.id}</td>
                  <td>
                    <span className="celula-principal numero">{dataCurta(venda.data)}</span>
                    <span className="celula-secundaria numero">{venda.horario}</span>
                  </td>
                  <td className="vendas-sem-identificacao__itens" title={resumoItens(venda)}>{resumoItens(venda)}</td>
                  <td>
                    <Etiqueta icone={iconeMeio[venda.forma]}>{rotuloForma(venda)}</Etiqueta>
                  </td>
                  <td className="celula--numero vendas-sem-identificacao__valor">{venda.cancelamento ? <SeloCompacto tom="neutro">Cancelada</SeloCompacto> : reais(venda.total)}</td>
                  <td className="celula--acoes">
                    <Botao tamanho="pequeno" onClick={() => abrirFicha(venda.id)}>
                      Ver ficha
                    </Botao>
                  </td>
                </tr>
              ))}
              {lista.length === 0 && (
                <tr>
                  <td colSpan={6} className="vendas-sem-identificacao__vazio">
                    Nenhuma venda sem identificação neste período.
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
