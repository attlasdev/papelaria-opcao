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
