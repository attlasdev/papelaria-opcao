import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

/**
 * Preenche um MODELO .xlsx (os da Emitte, em `docs/materiais-recebidos/emitte/`)
 * com linhas de dados, sem tocar no resto: instruções, abas de parâmetros,
 * validações e proteção ficam como vieram.
 *
 * Todo texto vai como texto COMPARTILHADO (`sharedStrings`), nunca "inline": o
 * levantamento da Emitte registrou que um XLSX com "inline strings" travou a
 * importação sem mostrar erro.
 */

export type Celula = string | number | null

const ABA_DADOS = 'xl/worksheets/sheet1.xml'

const escapar = (texto: string) => texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** A, B, …, Z, AA… para o índice 0, 1, … */
function letra(indice: number): string {
  return indice < 26 ? String.fromCharCode(65 + indice) : letra(Math.floor(indice / 26) - 1) + letra(indice % 26)
}

function textosCompartilhados(arquivos: Record<string, Uint8Array>): string[] {
  const xml = strFromU8(arquivos['xl/sharedStrings.xml'])
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join(''))
}

/** Valores de uma coluna de uma aba, da linha `inicio` em diante (só textos). */
export function lerColuna(modelo: Uint8Array, aba: string, coluna: string, inicio: number): string[] {
  const arquivos = unzipSync(modelo)
  const textos = textosCompartilhados(arquivos)
  const xml = strFromU8(arquivos[aba])
  const valores: string[] = []
  for (const m of xml.matchAll(new RegExp(`<c r="${coluna}(\\d+)"([^>]*)>\\s*<v>(\\d+)</v>`, 'g'))) {
    if (Number(m[1]) >= inicio && m[2].includes('t="s"')) valores.push(textos[Number(m[3])])
  }
  return valores
}

export function preencherPlanilha(modelo: Uint8Array, linhas: Celula[][], primeiraLinha = 6): Uint8Array {
  const arquivos = unzipSync(modelo)
  let sst = strFromU8(arquivos['xl/sharedStrings.xml'])
  let aba = strFromU8(arquivos[ABA_DADOS])

  const unicos = Number(/uniqueCount="(\d+)"/.exec(sst)?.[1] ?? 0)
  const usos = Number(/count="(\d+)"/.exec(sst)?.[1] ?? 0)
  const novos: string[] = []
  const indices = new Map<string, number>()
  let celulasTexto = 0
  const indiceDe = (texto: string) => {
    celulasTexto++
    let i = indices.get(texto)
    if (i === undefined) {
      i = unicos + novos.length
      indices.set(texto, i)
      novos.push(texto)
    }
    return i
  }

  // O estilo de cada coluna vem da primeira linha de dados do modelo, se houver
  // (no de clientes ela destrava as células da aba protegida).
  const linhaModelo = new RegExp(`<row r="${primeiraLinha}"[^>]*>([\\s\\S]*?)</row>`).exec(aba)?.[1] ?? ''
  const estilos = new Map([...linhaModelo.matchAll(/<c r="([A-Z]+)\d+" s="(\d+)"/g)].map((m) => [m[1], m[2]]))

  const xmlLinhas = linhas.map((linha, i) => {
    const n = primeiraLinha + i
    const celulas = linha.map((valor, c) => {
      if (valor === null || valor === '') return ''
      const ref = `${letra(c)}${n}`
      const s = estilos.get(letra(c))
      const estilo = s ? ` s="${s}"` : ''
      return typeof valor === 'number'
        ? `<c r="${ref}"${estilo}><v>${valor}</v></c>`
        : `<c r="${ref}"${estilo} t="s"><v>${indiceDe(valor)}</v></c>`
    })
    return `<row r="${n}">${celulas.join('')}</row>`
  })

  // As linhas de dados do modelo (vazias, só com estilo) saem; entram as nossas.
  aba = aba.replace(/<row r="(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g, (linha, n) => (Number(n) >= primeiraLinha ? '' : linha))
  aba = aba.replace('</sheetData>', `${xmlLinhas.join('')}</sheetData>`)
  const ultimaLinha = Math.max(primeiraLinha - 1, primeiraLinha - 1 + linhas.length)
  aba = aba.replace(/<dimension ref="([A-Z]+)1:([A-Z]+)\d+"\/>/, (_m, a, b) => `<dimension ref="${a}1:${b}${ultimaLinha}"/>`)

  if (novos.length || celulasTexto) {
    sst = sst
      .replace(/uniqueCount="\d+"/, `uniqueCount="${unicos + novos.length}"`)
      .replace(/ count="\d+"/, ` count="${usos + celulasTexto}"`)
      .replace('</sst>', `${novos.map((t) => `<si><t xml:space="preserve">${escapar(t)}</t></si>`).join('')}</sst>`)
  }

  // A tabela ligada à aba de dados cobre o cabeçalho e as linhas (no mínimo uma).
  const vinculos = arquivos['xl/worksheets/_rels/sheet1.xml.rels']
  if (vinculos) {
    for (const [, alvo] of strFromU8(vinculos).matchAll(/Target="\.\.\/tables\/([^"]+)"/g)) {
      const caminho = `xl/tables/${alvo}`
      const fim = Math.max(primeiraLinha, ultimaLinha)
      const tabela = strFromU8(arquivos[caminho]).replace(/ref="([A-Z]+)(\d+):([A-Z]+)\d+"/g, (_m, a, i, b) => `ref="${a}${i}:${b}${fim}"`)
      arquivos[caminho] = strToU8(tabela)
    }
  }

  arquivos['xl/sharedStrings.xml'] = strToU8(sst)
  arquivos[ABA_DADOS] = strToU8(aba)
  return zipSync(arquivos, { level: 6 })
}

// ---------------------------------------------------------------------------
// Planilha nova, sem modelo (ex.: o período do Financeiro para o contador).
// ---------------------------------------------------------------------------

/** Cores em hexadecimal sem `#` (RRGGBB). */
export type Estilo = {
  negrito?: boolean
  italico?: boolean
  tamanho?: number
  cor?: string
  fundo?: string
  /** `grade`: as quatro bordas finas; `baixo`: só a de baixo; `cima`: linha de total. */
  borda?: 'grade' | 'baixo' | 'cima'
  alinhar?: 'esquerda' | 'centro' | 'direita'
  quebrar?: boolean
  formato?: 'moeda' | 'data'
}

/**
 * Célula com estilo. Dinheiro vai em `centavos` e sai como número em reais, com
 * formato de moeda: o contador soma. `formula` (em inglês, `SUM(B2:B5)`) leva
 * junto o valor já calculado em `centavos`/`numero`, para quem abrir sem recalcular.
 * Sem valor nenhum, a célula existe só pelo estilo (fundo de cartão, borda).
 */
export type CelulaRica = { texto?: string; numero?: number; centavos?: number; data?: string; formula?: string; estilo?: Estilo }
export type CelulaNova = Celula | CelulaRica

export type Aba = {
  nome: string
  linhas: CelulaNova[][]
  /** Largura de cada coluna, em caracteres. */
  larguras?: number[]
  /** Altura de linhas específicas (índice da linha → pontos). */
  alturas?: Record<number, number>
  /** Intervalos mesclados, como `A1:D1`. */
  mesclar?: string[]
  /** Quantas linhas do topo ficam paradas ao rolar. */
  congelar?: number
  /** Intervalo com filtro automático, como `A4:L80`. */
  filtro?: string
  /** Barras dentro das células, proporcionais ao valor (a partir de zero). */
  barras?: { intervalo: string; cor: string }[]
  /** Linha (índice) repetida no topo de cada página impressa. */
  repetirNaImpressao?: number
  /** Sem as linhas de grade da planilha: o Resumo fica com cara de painel. */
  semGrade?: boolean
}

/** Dias desde 30/12/1899, como o Excel conta datas. */
function serialData(iso: string) {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return Date.UTC(ano, mes - 1, dia) / 86_400_000 + 25_569
}

const COR_BORDA = 'D5D5D5'
const COR_BORDA_TOTAL = '4B4B4B'
const FORMATOS = { moeda: 164, data: 165 } as const

/** Estilos usados na planilha, cada combinação uma vez, no formato de `styles.xml`. */
function tabelaDeEstilos() {
  const fontes = ['<font><sz val="11"/><name val="Calibri"/></font>']
  const fundos = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>']
  const bordas = ['<border><left/><right/><top/><bottom/><diagonal/></border>']
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>']
  const indice = (lista: string[], xml: string) => {
    const i = lista.indexOf(xml)
    return i >= 0 ? i : lista.push(xml) - 1
  }
  const linha = (cor: string, estilo = 'thin') => `style="${estilo}"><color rgb="FF${cor}"/>`
  const porChave = new Map<string, number>()

  function de(estilo?: Estilo): number {
    if (!estilo) return 0
    const chave = JSON.stringify(estilo)
    const pronto = porChave.get(chave)
    if (pronto !== undefined) return pronto
    const fonte = indice(fontes, `<font>${estilo.negrito ? '<b/>' : ''}${estilo.italico ? '<i/>' : ''}<sz val="${estilo.tamanho ?? 11}"/>${estilo.cor ? `<color rgb="FF${estilo.cor}"/>` : ''}<name val="Calibri"/></font>`)
    const fundo = estilo.fundo ? indice(fundos, `<fill><patternFill patternType="solid"><fgColor rgb="FF${estilo.fundo}"/><bgColor indexed="64"/></patternFill></fill>`) : 0
    const borda = estilo.borda === 'grade'
      ? indice(bordas, `<border><left ${linha(COR_BORDA)}</left><right ${linha(COR_BORDA)}</right><top ${linha(COR_BORDA)}</top><bottom ${linha(COR_BORDA)}</bottom><diagonal/></border>`)
      : estilo.borda === 'baixo'
        ? indice(bordas, `<border><left/><right/><top/><bottom ${linha(COR_BORDA)}</bottom><diagonal/></border>`)
        : estilo.borda === 'cima'
          ? indice(bordas, `<border><left/><right/><top ${linha(COR_BORDA_TOTAL, 'medium')}</top><bottom/><diagonal/></border>`)
          : 0
    const formato = estilo.formato ? FORMATOS[estilo.formato] : 0
    const horizontal = estilo.alinhar === 'centro' ? 'center' : estilo.alinhar === 'direita' ? 'right' : estilo.alinhar === 'esquerda' ? 'left' : ''
    const alinhamento = `<alignment vertical="center"${horizontal ? ` horizontal="${horizontal}"` : ''}${estilo.quebrar ? ' wrapText="1"' : ''}/>`
    const i = xfs.push(`<xf numFmtId="${formato}" fontId="${fonte}" fillId="${fundo}" borderId="${borda}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"${formato ? ' applyNumberFormat="1"' : ''}>${alinhamento}</xf>`) - 1
    porChave.set(chave, i)
    return i
  }

  const xml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="${FORMATOS.moeda}" formatCode="&quot;R$&quot;\\ #,##0.00;\\-&quot;R$&quot;\\ #,##0.00"/><numFmt numFmtId="${FORMATOS.data}" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="${fontes.length}">${fontes.join('')}</fonts>
<fills count="${fundos.length}">${fundos.join('')}</fills>
<borders count="${bordas.length}">${bordas.join('')}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`
  return { de, xml }
}

/**
 * Monta um .xlsx do zero, com uma ou mais abas. Como no preenchimento dos
 * modelos, todo texto vai COMPARTILHADO (`sharedStrings`), nunca "inline".
 */
export function criarPlanilha(abas: Aba[]): Uint8Array {
  const textos: string[] = []
  const indices = new Map<string, number>()
  let usos = 0
  const indiceDe = (texto: string) => {
    usos++
    let i = indices.get(texto)
    if (i === undefined) {
      i = textos.length
      indices.set(texto, i)
      textos.push(texto)
    }
    return i
  }
  const estilos = tabelaDeEstilos()

  function celula(ref: string, valor: CelulaNova): string {
    if (valor === null || valor === '') return ''
    if (typeof valor === 'number') return `<c r="${ref}"><v>${valor}</v></c>`
    if (typeof valor === 'string') return `<c r="${ref}" t="s"><v>${indiceDe(valor)}</v></c>`
    const s = estilos.de(valor.centavos !== undefined ? { formato: 'moeda', ...valor.estilo } : valor.data !== undefined ? { formato: 'data', ...valor.estilo } : valor.estilo)
    const estilo = s ? ` s="${s}"` : ''
    const numero = valor.centavos !== undefined ? valor.centavos / 100 : valor.data !== undefined ? serialData(valor.data) : valor.numero
    if (valor.formula) return `<c r="${ref}"${estilo}><f>${escapar(valor.formula)}</f><v>${numero ?? 0}</v></c>`
    if (numero !== undefined) return `<c r="${ref}"${estilo}><v>${numero}</v></c>`
    if (valor.texto !== undefined && valor.texto !== '') return `<c r="${ref}"${estilo} t="s"><v>${indiceDe(valor.texto)}</v></c>`
    return estilo ? `<c r="${ref}"${estilo}/>` : ''
  }

  const folhas = abas.map((aba, numero) => {
    const linhas = aba.linhas.map((linha, i) => {
      const altura = aba.alturas?.[i]
      return `<row r="${i + 1}"${altura ? ` ht="${altura}" customHeight="1"` : ''}>${linha.map((valor, c) => celula(`${letra(c)}${i + 1}`, valor)).join('')}</row>`
    })
    const congelar = aba.congelar
      ? `<pane ySplit="${aba.congelar}" topLeftCell="A${aba.congelar + 1}" activePane="bottomLeft" state="frozen"/>`
      : ''
    const visao = `<sheetViews><sheetView${aba.semGrade ? ' showGridLines="0"' : ''}${numero === 0 ? ' tabSelected="1"' : ''} workbookViewId="0">${congelar}</sheetView></sheetViews>`
    const colunas = aba.larguras?.length
      ? `<cols>${aba.larguras.map((l, i) => `<col min="${i + 1}" max="${i + 1}" width="${l}" customWidth="1"/>`).join('')}</cols>`
      : ''
    const filtro = aba.filtro ? `<autoFilter ref="${aba.filtro}"/>` : ''
    const mescla = aba.mesclar?.length ? `<mergeCells count="${aba.mesclar.length}">${aba.mesclar.map((ref) => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>` : ''
    const barras = (aba.barras ?? []).map((b, i) =>
      `<conditionalFormatting sqref="${b.intervalo}"><cfRule type="dataBar" priority="${i + 1}"><dataBar><cfvo type="num" val="0"/><cfvo type="max"/><color rgb="FF${b.cor}"/></dataBar></cfRule></conditionalFormatting>`).join('')
    // Impressão: deitada, ajustada à largura da folha.
    const impressao = '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>'
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>${visao}${colunas}<sheetData>${linhas.join('')}</sheetData>${filtro}${mescla}${barras}${impressao}</worksheet>`
  })

  const nomeAba = (nome: string) => escapar(nome.slice(0, 31)).replace(/"/g, '&quot;')
  // Nomes definidos: linha repetida na impressão e a área do filtro (o Excel cria esta ao abrir; já vai pronta).
  const definidos = abas.flatMap((aba, i) => {
    const ref = `'${nomeAba(aba.nome).replace(/'/g, "''")}'`
    return [
      ...(aba.repetirNaImpressao !== undefined ? [`<definedName name="_xlnm.Print_Titles" localSheetId="${i}">${ref}!$${aba.repetirNaImpressao + 1}:$${aba.repetirNaImpressao + 1}</definedName>`] : []),
      ...(aba.filtro ? [`<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${ref}!${aba.filtro.replace(/([A-Z]+)(\d+)/g, '$$$1$$$2')}</definedName>`] : []),
    ]
  })

  const n = abas.length
  const arquivos: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${abas.map((aba, i) => `<sheet name="${nomeAba(aba.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${definidos.length ? `<definedNames>${definidos.join('')}</definedNames>` : ''}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${n + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`),
  }
  folhas.forEach((folha, i) => { arquivos[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(folha) })
  // Estilos e textos por último: só ficam completos depois de montar as abas.
  arquivos['xl/styles.xml'] = strToU8(estilos.xml())
  arquivos['xl/sharedStrings.xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${usos}" uniqueCount="${textos.length}">${textos.map((t) => `<si><t xml:space="preserve">${escapar(t)}</t></si>`).join('')}</sst>`)
  return zipSync(arquivos, { level: 6 })
}
