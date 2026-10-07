import { dataCurta, dataHora } from '../formatar'
import {
  CATEGORIA_ESTORNO,
  NOME_MEIO,
  ladoFinanceiro,
  linhasFinanceiroNoIntervalo,
  movimentosOperacionaisFinanceiro,
  resumoFinanceiroIntervalo,
  type LinhaFinanceiro,
} from '../mock/base/derivados'
import { diasEntre, somarDias } from '../mock/base/datas'
import type { Meio } from '../mock/base/tipos'
import { criarPlanilha, type Aba, type CelulaNova, type CelulaRica, type Estilo } from './planilha'

/**
 * O período do Financeiro em planilha, para consulta e para o contador
 * (Memoria.md, "Financeiro"). Sai das MESMAS funções da tela: o total do
 * arquivo é o total dos cartões, estornos inclusive.
 *
 * Vai o período inteiro, em todos os meios (o filtro de meio da tabela não
 * vale aqui: arquivo parcial na contabilidade é armadilha). Adição e retirada
 * de dinheiro da gaveta não vão: não são receita nem despesa, são do Caixa.
 *
 * Abas: Resumo (cartões e totais por meio e categoria), Por dia (ou Por mês,
 * em período longo) com barras, e Movimentos (uma linha por registro).
 */

// Cores dos tokens do app (src/estilos/tokens/cores.css): a planilha parece o Financeiro da tela.
const COR = {
  tinta: '000000',
  textoSuave: '4B4B4B',
  apagado: '8A8A8A',
  zebra: 'F9F9F9',
  cinza: 'F3F3F3',
  entrada: '176B4D',
  saida: 'C8090F',
  barraEntrada: '1F8F5F',
  okFundo: 'DCEFE4',
  okTexto: '145C3F',
  criticoFundo: 'F9D9D9',
  criticoTexto: '9E1116',
  neutroFundo: 'EFEFEF',
  neutroTexto: '303030',
  marca: 'FEF003',
  branco: 'FFFFFF',
}

/** Até este tamanho o período vai dia a dia; acima, mês a mês (um ano em dias seria 365 barras). */
const MAXIMO_DIAS_POR_DIA = 92

const DIA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

const vazio = (estilo: Estilo): CelulaRica => ({ estilo })
const cabecalho: Estilo = { negrito: true, cor: COR.branco, fundo: COR.tinta, alinhar: 'centro', borda: 'grade' }
const zebra = (i: number): Estilo => ({ borda: 'baixo', ...(i % 2 ? { fundo: COR.zebra } : {}) })
const corDoValor = (centavos: number) => (centavos > 0 ? COR.entrada : centavos < 0 ? COR.saida : COR.apagado)

type Totais = { entradas: number; despesas: number }

/** Título, subtítulo e a faixa amarela da marca: as três primeiras linhas de cada aba. */
function topo(titulo: string, subtitulo: string, colunas: number) {
  const ultima = String.fromCharCode(64 + colunas)
  const faixa = Array.from({ length: colunas }, () => vazio({ fundo: COR.marca }))
  return {
    linhas: [
      [{ texto: titulo, estilo: { negrito: true, tamanho: 16 } }],
      [{ texto: subtitulo, estilo: { cor: COR.textoSuave, tamanho: 10 } }],
      faixa,
    ] as CelulaNova[][],
    mesclar: [`A1:${ultima}1`, `A2:${ultima}2`],
    alturas: { 0: 28, 1: 18, 2: 4 } as Record<number, number>,
  }
}

export function planilhaFinanceiro(todas: LinhaFinanceiro[], de: string, ate: string, geradoEm = new Date().toISOString()) {
  const linhas = movimentosOperacionaisFinanceiro(todas)
  const resumo = resumoFinanceiroIntervalo(linhas, de, ate)
  const doPeriodo = [...linhasFinanceiroNoIntervalo(linhas, de, ate)]
    .sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario))

  // Pagamento de ficha desfeito ganha a linha `<id>-estorno`; lançamento manual, `estornoDe`.
  const desfeitos = new Set(linhas.flatMap((l) => (l.estornoDe ? [l.estornoDe] : l.id.endsWith('-estorno') ? [l.id.slice(0, -'-estorno'.length)] : [])))

  // Cada coluna (entradas, despesas) soma com sinal: o estorno aparece negativo
  // no lado que ele abate, e a soma da coluna bate com o total do período.
  const somar = (chave: (l: LinhaFinanceiro) => string) => {
    const grupos = new Map<string, Totais>()
    for (const l of doPeriodo) {
      const g = grupos.get(chave(l)) ?? { entradas: 0, despesas: 0 }
      if (ladoFinanceiro(l) === 'entrada') g.entradas += l.valor
      else g.despesas -= l.valor
      grupos.set(chave(l), g)
    }
    return grupos
  }

  const periodo = `${dataCurta(de)} a ${dataCurta(ate)}`
  const subtitulo = `Período de ${periodo} · gerado em ${dataHora(geradoEm)}`

  // --- Resumo ----------------------------------------------------------------
  const r = topo('Financeiro — Papelaria Opção', subtitulo, 4)
  const resumoLinhas = r.linhas
  resumoLinhas.push([])
  const cartao = (rotulo: string, valor: CelulaRica, fundo: string, cor: string): [CelulaRica, CelulaRica] => [
    { texto: rotulo, estilo: { fundo, cor, tamanho: 10, negrito: true } },
    { ...valor, estilo: { fundo, cor, tamanho: 16, negrito: true, alinhar: 'esquerda' } },
  ]
  const cartoes = [
    cartao('Entradas', { centavos: resumo.entradas }, COR.okFundo, COR.okTexto),
    cartao('Despesas', { centavos: resumo.saidas }, COR.criticoFundo, COR.criticoTexto),
    cartao('Entradas menos despesas', { centavos: resumo.liquido }, COR.neutroFundo, COR.neutroTexto),
    cartao('Movimentações', { numero: resumo.contagem.todos }, COR.neutroFundo, COR.neutroTexto),
  ]
  r.alturas[resumoLinhas.length] = 20
  resumoLinhas.push(cartoes.map(([rotulo]) => rotulo))
  r.alturas[resumoLinhas.length] = 30
  resumoLinhas.push(cartoes.map(([, valor]) => valor))

  /** Tabela de totais com uma linha de total em SOMA (o contador pode mexer e ela recalcula). */
  const tabela = (titulo: string, grupos: [string, Totais][]) => {
    resumoLinhas.push([])
    resumoLinhas.push([{ texto: titulo, estilo: { negrito: true, tamanho: 12 } }])
    r.alturas[resumoLinhas.length] = 20
    resumoLinhas.push([titulo === 'Por meio' ? 'Meio' : 'Categoria', 'Entradas', 'Despesas', 'Resultado'].map((texto, i) => ({ texto, estilo: { ...cabecalho, alinhar: i === 0 ? 'esquerda' : 'centro' } })))
    const primeira = resumoLinhas.length + 1
    grupos.forEach(([rotulo, g], i) => {
      const n = resumoLinhas.length + 1
      const base = zebra(i)
      resumoLinhas.push([
        { texto: rotulo, estilo: base },
        { centavos: g.entradas, estilo: { ...base, cor: COR.entrada } },
        { centavos: g.despesas, estilo: { ...base, cor: COR.saida } },
        { centavos: g.entradas - g.despesas, formula: `B${n}-C${n}`, estilo: { ...base, negrito: true } },
      ])
    })
    const ultima = resumoLinhas.length
    const total = grupos.reduce((t, [, g]) => ({ entradas: t.entradas + g.entradas, despesas: t.despesas + g.despesas }), { entradas: 0, despesas: 0 })
    const estiloTotal: Estilo = { negrito: true, borda: 'cima', fundo: COR.cinza }
    const soma = (coluna: string) => (ultima >= primeira ? `SUM(${coluna}${primeira}:${coluna}${ultima})` : '0')
    resumoLinhas.push([
      { texto: 'Total', estilo: estiloTotal },
      { centavos: total.entradas, formula: soma('B'), estilo: { ...estiloTotal, cor: COR.entrada } },
      { centavos: total.despesas, formula: soma('C'), estilo: { ...estiloTotal, cor: COR.saida } },
      { centavos: total.entradas - total.despesas, formula: soma('D'), estilo: estiloTotal },
    ])
  }
  const porMeio = somar((l) => l.meio)
  tabela('Por meio', (['dinheiro', 'pix', 'cartao'] as Meio[]).map((meio) => [NOME_MEIO[meio], porMeio.get(meio) ?? { entradas: 0, despesas: 0 }]))
  tabela('Por categoria', [...somar((l) => l.categoria)].sort(([a], [b]) => a.localeCompare(b, 'pt-BR')))

  resumoLinhas.push([])
  for (const nota of [
    'Entradas menos despesas não é lucro nem saldo bancário.',
    'Estorno abate do próprio lado: desfazer uma venda reduz as entradas; desfazer uma despesa reduz as despesas.',
    'Adições e retiradas de dinheiro da gaveta não entram: estão no Caixa.',
  ]) {
    r.mesclar.push(`A${resumoLinhas.length + 1}:D${resumoLinhas.length + 1}`)
    resumoLinhas.push([{ texto: nota, estilo: { italico: true, cor: COR.apagado, tamanho: 9 } }])
  }

  // --- Por dia (ou por mês) -----------------------------------------------------
  const porMes = diasEntre(de, ate) + 1 > MAXIMO_DIAS_POR_DIA
  const chaves: string[] = []
  if (porMes) {
    for (let mes = de.slice(0, 7); mes <= ate.slice(0, 7); mes = somarDias(`${mes}-28`, 4).slice(0, 7)) chaves.push(mes)
  } else {
    for (let dia = de; dia <= ate; dia = somarDias(dia, 1)) chaves.push(dia)
  }
  const porTempo = somar((l) => (porMes ? l.data.slice(0, 7) : l.data))
  const t = topo(porMes ? 'Por mês' : 'Por dia', `${porMes ? 'Cada mês' : 'Cada dia'} do período de ${periodo}, inclusive os sem movimento.`, 4)
  const tempoLinhas = t.linhas
  tempoLinhas.push([])
  const cabecalhoTempo = tempoLinhas.length
  t.alturas[cabecalhoTempo] = 20
  tempoLinhas.push([porMes ? 'Mês' : 'Dia', 'Entradas', 'Despesas', 'Resultado'].map((texto) => ({ texto, estilo: cabecalho })))
  const primeiraTempo = tempoLinhas.length + 1
  chaves.forEach((chave, i) => {
    const g = porTempo.get(chave) ?? { entradas: 0, despesas: 0 }
    const parado = g.entradas === 0 && g.despesas === 0
    const base: Estilo = { ...zebra(i), ...(parado ? { cor: COR.apagado } : {}) }
    const [ano, mes, dia] = chave.split('-')
    const rotulo = porMes ? `${mes}/${ano}` : `${dia}/${mes} · ${DIA_SEMANA[new Date(Date.UTC(+ano, +mes - 1, +dia)).getUTCDay()]}`
    tempoLinhas.push([
      { texto: rotulo, estilo: { ...base, alinhar: 'centro' } },
      { centavos: g.entradas, estilo: parado ? base : { ...base, cor: COR.entrada } },
      { centavos: g.despesas, estilo: parado ? base : { ...base, cor: COR.saida } },
      { centavos: g.entradas - g.despesas, estilo: parado ? base : { ...base, negrito: true, cor: corDoValor(g.entradas - g.despesas) } },
    ])
  })
  const ultimaTempo = tempoLinhas.length
  const estiloTotal: Estilo = { negrito: true, borda: 'cima', fundo: COR.cinza }
  tempoLinhas.push([
    { texto: 'Total', estilo: { ...estiloTotal, alinhar: 'centro' } },
    { centavos: resumo.entradas, formula: `SUM(B${primeiraTempo}:B${ultimaTempo})`, estilo: { ...estiloTotal, cor: COR.entrada } },
    { centavos: resumo.saidas, formula: `SUM(C${primeiraTempo}:C${ultimaTempo})`, estilo: { ...estiloTotal, cor: COR.saida } },
    { centavos: resumo.liquido, formula: `SUM(D${primeiraTempo}:D${ultimaTempo})`, estilo: estiloTotal },
  ])

  // --- Movimentos ----------------------------------------------------------------
  const m = topo('Movimentos', `Uma linha por registro, em todos os meios · ${periodo}`, 12)
  const movimentos = m.linhas
  movimentos.push([])
  const cabecalhoMov = movimentos.length
  m.alturas[cabecalhoMov] = 20
  movimentos.push(['Data', 'Horário', 'Descrição', 'Categoria', 'Tipo', 'Meio', 'Ficha', 'Cliente', 'Origem', 'Valor', 'Operador', 'Situação']
    .map((texto) => ({ texto, estilo: cabecalho })))
  const selo = (texto: string, fundo: string, cor: string, base: Estilo): CelulaRica => ({ texto, estilo: { ...base, fundo, cor, negrito: true, alinhar: 'centro' } })
  doPeriodo.forEach((l, i) => {
    const estornado = desfeitos.has(l.id)
    const base: Estilo = { ...zebra(i), ...(estornado ? { italico: true, cor: COR.apagado } : {}) }
    const tipo = l.categoria === CATEGORIA_ESTORNO
      ? selo('Estorno', COR.neutroFundo, COR.neutroTexto, base)
      : l.valor > 0 ? selo('Entrada', COR.okFundo, COR.okTexto, base) : selo('Saída', COR.criticoFundo, COR.criticoTexto, base)
    const texto = (valor: string | undefined, alinhar?: Estilo['alinhar']): CelulaRica => ({ texto: valor ?? '', estilo: alinhar ? { ...base, alinhar } : base })
    movimentos.push([
      { data: l.data, estilo: { ...base, alinhar: 'centro' } },
      texto(l.horario, 'centro'),
      texto(l.descricao),
      texto(l.categoria),
      tipo,
      texto(l.meioRotulo),
      texto(l.ficha ? `#${l.ficha}` : undefined, 'centro'),
      texto(l.cliente),
      texto(l.origem),
      { centavos: l.valor, estilo: { ...base, negrito: !estornado, ...(estornado ? {} : { cor: corDoValor(l.valor) }) } },
      texto(l.operador),
      estornado ? selo('Estornado', COR.neutroFundo, COR.neutroTexto, base) : texto(undefined),
    ])
  })
  const ultimaMov = movimentos.length
  // SUBTOTAL respeita o filtro: filtrando só Pix, o total mostra só o Pix.
  movimentos.push([
    { texto: 'Entradas menos despesas (respeita o filtro)', estilo: estiloTotal },
    ...Array.from({ length: 8 }, () => vazio(estiloTotal)),
    // Sem movimento, nada a somar (o intervalo cairia na própria linha do total).
    { centavos: resumo.liquido, ...(ultimaMov > cabecalhoMov + 1 ? { formula: `SUBTOTAL(9,J${cabecalhoMov + 2}:J${ultimaMov})` } : {}), estilo: estiloTotal },
    vazio(estiloTotal),
    vazio(estiloTotal),
  ])
  m.mesclar.push(`A${ultimaMov + 1}:I${ultimaMov + 1}`)

  const abas: Aba[] = [
    { nome: 'Resumo', linhas: resumoLinhas, mesclar: r.mesclar, alturas: r.alturas, larguras: [30, 22, 26, 20], semGrade: true },
    {
      nome: porMes ? 'Por mês' : 'Por dia', linhas: tempoLinhas, mesclar: t.mesclar, alturas: t.alturas, larguras: [16, 22, 22, 22],
      congelar: cabecalhoTempo + 1, repetirNaImpressao: cabecalhoTempo, semGrade: true,
      barras: [
        { intervalo: `B${primeiraTempo}:B${ultimaTempo}`, cor: COR.barraEntrada },
        { intervalo: `C${primeiraTempo}:C${ultimaTempo}`, cor: COR.saida },
      ],
    },
    {
      nome: 'Movimentos', linhas: movimentos, mesclar: m.mesclar, alturas: m.alturas,
      larguras: [12, 9, 34, 22, 11, 30, 9, 24, 32, 15, 14, 12],
      congelar: cabecalhoMov + 1, repetirNaImpressao: cabecalhoMov, filtro: `A${cabecalhoMov + 1}:L${Math.max(ultimaMov, cabecalhoMov + 1)}`,
    },
  ]
  return { bytes: criarPlanilha(abas), quantidade: doPeriodo.length, nome: `financeiro-${de}-a-${ate}.xlsx` }
}
