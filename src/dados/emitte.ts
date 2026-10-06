import type { Cliente, Produto } from '../mock/base/tipos'
import { separarEndereco } from './endereco'
import { FISCAL_CLIENTE_PADRAO, gtinValido } from './fiscal'
import { lerColuna, preencherPlanilha, type Celula } from './planilha'

/**
 * Arquivo de PRODUTOS para importar na Emitte (Cadastros → Produtos → Importar
 * via XML). É um XML no formato de NF-e, como o `VALIDADO_produtos.xml` que a
 * Emitte aceitou (`docs/materiais-recebidos/emitte/`). Ele só cadastra os
 * produtos: não é nota, não tem valor fiscal.
 *
 * Decisão de `2026-10-06`: os dados fiscais (NCM, tributação, CFOP) a dona
 * preenche na própria Emitte. A tributação e o CFOP a Emitte já pede na tela
 * de importação, para o arquivo inteiro; o NCM vai em branco e é completado lá.
 * Se a Emitte mudar regras fiscais, o app não precisa mudar.
 *
 * Emitente, destinatário, chave e protocolo são os FICTÍCIOS do arquivo
 * validado: a importação só lê os produtos.
 */

const UNIDADE: Record<Produto['unidade'], string> = { un: 'UN', pct: 'PCT', cx: 'CX' }

const escapar = (texto: string) =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const reais = (centavos: number, casas: number) => (centavos / 100).toFixed(casas)

/** Instante no formato da NF-e: `2026-10-06T14:30:00-03:00`, no horário de São Paulo. */
function dataHoraNfe(agora: Date) {
  const partes = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(agora)
  return `${partes.replace(' ', 'T')}-03:00`
}

export type ArquivoProdutos = {
  xml: string
  quantidade: number
  /** Código interno dos produtos cujo código de barras foi como "SEM GTIN". */
  semGtin: string[]
}

export function gerarXmlProdutos(produtos: Produto[], agora = new Date()): ArquivoProdutos {
  const lista = produtos.filter((p) => !p.inativo)
  const semGtin: string[] = []
  const itens = lista.map((p, i) => {
    const codigoBarras = p.codigoBarras?.trim() ?? ''
    const gtin = gtinValido(codigoBarras) ? codigoBarras : 'SEM GTIN'
    if (gtin === 'SEM GTIN') semGtin.push(p.codigo)
    const unidade = UNIDADE[p.unidade] ?? 'UN'
    const preco = reais(p.preco, 10)
    const total = reais(p.preco, 2)
    return `<det nItem="${i + 1}"><prod><cProd>${escapar(p.codigo.slice(0, 60))}</cProd><cEAN>${gtin}</cEAN><xProd>${escapar(p.descricao.slice(0, 120))}</xProd>`
      + `<NCM>${p.fiscal?.ncm ?? ''}</NCM><CFOP>5102</CFOP><uCom>${unidade}</uCom><qCom>1.0000</qCom><vUnCom>${preco}</vUnCom><vProd>${total}</vProd>`
      + `<cEANTrib>${gtin}</cEANTrib><uTrib>${unidade}</uTrib><qTrib>1.0000</qTrib><vUnTrib>${preco}</vUnTrib><indTot>1</indTot></prod>`
      + `<imposto><ICMS><ICMSSN102><orig>${p.fiscal?.origem ?? '0'}</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS>`
      + `<PIS><PISOutr><CST>99</CST><vBC>0.00</vBC><pPIS>0.0000</pPIS><vPIS>0.00</vPIS></PISOutr></PIS>`
      + `<COFINS><COFINSOutr><CST>99</CST><vBC>0.00</vBC><pCOFINS>0.0000</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSOutr></COFINS></imposto></det>`
  })
  const soma = reais(lista.reduce((t, p) => t + p.preco, 0), 2)
  const dh = dataHoraNfe(agora)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe35261011222333000181550010000001231123456783" versao="4.00">`
    + `<ide><cUF>35</cUF><cNF>12345678</cNF><natOp>VENDA</natOp><mod>55</mod><serie>1</serie><nNF>123</nNF><dhEmi>${dh}</dhEmi><tpNF>1</tpNF><idDest>1</idDest><cMunFG>3550308</cMunFG><tpImp>1</tpImp><tpEmis>1</tpEmis><cDV>3</cDV><tpAmb>2</tpAmb><finNFe>1</finNFe><indFinal>1</indFinal><indPres>1</indPres><procEmi>0</procEmi><verProc>TESTE</verProc></ide>`
    + `<emit><CNPJ>11222333000181</CNPJ><xNome>EMPRESA FICTICIA DE TESTE LTDA</xNome><enderEmit><xLgr>RUA TESTE</xLgr><nro>100</nro><xBairro>CENTRO</xBairro><cMun>3550308</cMun><xMun>SAO PAULO</xMun><UF>SP</UF><CEP>01001000</CEP><cPais>1058</cPais><xPais>BRASIL</xPais></enderEmit><IE>111111111111</IE><CRT>1</CRT></emit>`
    + `<dest><CNPJ>44555666000181</CNPJ><xNome>CLIENTE FICTICIO DE TESTE LTDA</xNome><enderDest><xLgr>AVENIDA TESTE</xLgr><nro>200</nro><xBairro>CENTRO</xBairro><cMun>3550308</cMun><xMun>SAO PAULO</xMun><UF>SP</UF><CEP>01002000</CEP><cPais>1058</cPais><xPais>BRASIL</xPais><fone>11999990000</fone></enderDest><indIEDest>9</indIEDest><email>cliente.teste@exemplo.com</email></dest>`
    + itens.join('')
    + `<total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet><vProd>${soma}</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>0.00</vDesc><vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro><vNF>${soma}</vNF></ICMSTot></total>`
    + `<transp><modFrete>9</modFrete></transp><pag><detPag><tPag>01</tPag><vPag>${soma}</vPag></detPag></pag>`
    + `<infAdic><infCpl>ARQUIVO PARA CADASTRO DE PRODUTOS - SEM VALOR FISCAL</infCpl></infAdic></infNFe></NFe>`
    + `<protNFe versao="4.00"><infProt><tpAmb>2</tpAmb><verAplic>TESTE</verAplic><chNFe>35261011222333000181550010000001231123456783</chNFe><dhRecbto>${dh}</dhRecbto><nProt>135260000000001</nProt><digVal>AAAA</digVal><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe></nfeProc>`
  return { xml, quantidade: lista.length, semGtin }
}

// ---------------------------------------------------------------------------
// Planilhas (modelos v2 da Emitte: Cadastros → Importar via XLS)
// ---------------------------------------------------------------------------

/** Cidade como a Emitte lista: maiúsculas, sem acento, espaços simples. */
export function cidadeEmitte(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
}

const TIPOS_LOGRADOURO = ['Avenida', 'Rua', 'Rodovia', 'Ruela', 'Rio', 'Sítio', 'Sup Quadra', 'Travessa', 'Vale', 'Via', 'Viaduto', 'Viela', 'Vila', 'Vargem']
const ABREVIACOES: Record<string, string> = { AV: 'Avenida', R: 'Rua', ROD: 'Rodovia', TV: 'Travessa', TRAV: 'Travessa' }

/** "Av. Paulista" → { tipo: 'Avenida', logradouro: 'Paulista' }. Sem tipo reconhecido, a rua vai inteira. */
export function separarLogradouro(rua: string) {
  const [primeira = '', ...resto] = rua.trim().split(/\s+/)
  const chave = cidadeEmitte(primeira.replace(/\.$/, ''))
  const tipo = TIPOS_LOGRADOURO.find((t) => cidadeEmitte(t) === chave) ?? ABREVIACOES[chave]
  return tipo && resto.length ? { tipo, logradouro: resto.join(' ') } : { tipo: '', logradouro: rua.trim() }
}

/** "São Paulo/SP" ou "São Paulo - SP" → { cidade, uf }. */
export function separarCidade(texto: string) {
  const m = /^(.*?)[\s/,-]+([A-Za-z]{2})\s*$/.exec(texto.trim())
  return m ? { cidade: m[1].trim(), uf: m[2].toUpperCase() } : { cidade: texto.trim(), uf: '' }
}

const digitos = (texto: string) => texto.replace(/\D/g, '')

const CONTRIBUINTE = { 'nao-contribuinte': 'N', contribuinte: 'C', isento: 'I' } as const
const TIPO_CLIENTE = { consumidor: 'C', revenda: 'R' } as const

export type ClienteDeFora = { nome: string; falta: string[] }

export type PlanilhaClientes = { bytes: Uint8Array; incluidos: number; ids: string[]; deFora: ClienteDeFora[] }

/**
 * Quem ainda não foi para a Emitte. A importação da Emitte só CRIA: reenviar
 * duplica (testado em 2026-10-06 — o mesmo código de barras e o mesmo código
 * na nota viraram um segundo produto, com outro ID). Por isso cada um vai uma vez.
 */
export function pendentesEmitte<T extends { emitteEnviadoEm?: string; inativo?: true }>(lista: T[]) {
  return lista.filter((item) => !item.emitteEnviadoEm && !item.inativo)
}

/**
 * Só vão os clientes com tudo o que a Emitte exige; os outros voltam com o que
 * falta, para a dona completar no app. A "Observação" fica vazia porque a
 * Emitte a imprime na nota.
 *
 * `cidades`: as da aba de parâmetros do próprio modelo ("SAO PAULO|SP").
 */
export function gerarPlanilhaClientes(clientes: Cliente[], modelo: Uint8Array, cidades: Set<string>): PlanilhaClientes {
  const linhas: Celula[][] = []
  const ids: string[] = []
  const deFora: ClienteDeFora[] = []
  for (const c of clientes) {
    const fiscal = c.fiscal ?? FISCAL_CLIENTE_PADRAO
    const documento = digitos(c.documento)
    const endereco = separarEndereco(c.endereco)
    const { tipo, logradouro } = separarLogradouro(endereco.rua)
    const { cidade, uf } = separarCidade(endereco.cidade)
    const cep = digitos(fiscal.cep ?? '')
    const falta: string[] = []
    if (documento.length !== 11 && documento.length !== 14) falta.push('CPF ou CNPJ')
    if (cep.length !== 8) falta.push('CEP')
    if (!logradouro) falta.push('rua')
    // A Emitte recusa a linha sem tipo de logradouro (testado: "Praça Central").
    else if (!tipo) falta.push(`tipo de logradouro "${endereco.rua.trim().split(/\s+/)[0]}" não existe na Emitte; cadastre este cliente direto lá`)
    if (!endereco.bairro.trim()) falta.push('bairro')
    if (!cidade || !uf) falta.push('cidade/UF')
    else if (!cidades.has(`${cidadeEmitte(cidade)}|${uf}`)) falta.push(`cidade "${cidade}/${uf}" não está na lista da Emitte`)
    if (falta.length) {
      deFora.push({ nome: c.nome, falta })
      continue
    }
    const telefone = digitos(c.telefone).slice(0, 14)
    linhas.push([
      CONTRIBUINTE[fiscal.tipoContribuinte], TIPO_CLIENTE[fiscal.tipoCliente], documento,
      digitos(fiscal.inscricaoEstadual ?? '') || null, null,
      c.nome.trim().slice(0, 60), null, telefone || null, null, null,
      cep, tipo || null, logradouro.slice(0, 60), endereco.numero.slice(0, 60) || null,
      (fiscal.complemento ?? '').slice(0, 60) || null, endereco.bairro.trim().slice(0, 60),
      cidadeEmitte(cidade), uf, null,
    ])
    ids.push(c.id)
  }
  return { bytes: preencherPlanilha(modelo, linhas), incluidos: linhas.length, ids, deFora }
}

/** As cidades aceitas, lidas da aba de parâmetros do modelo de clientes. */
export function cidadesDoModelo(modelo: Uint8Array) {
  const nomes = lerColuna(modelo, 'xl/worksheets/sheet2.xml', 'C', 3)
  const ufs = lerColuna(modelo, 'xl/worksheets/sheet2.xml', 'D', 3)
  return new Set(nomes.map((nome, i) => `${nome}|${ufs[i]}`))
}

export type PlanilhaProdutos = { bytes: Uint8Array; quantidade: number; codigos: string[]; semGtin: string[] }

/**
 * Na planilha, NCM e CFOP vão por produto (no XML o CFOP vinha da tela de
 * importação). CFOP de revenda: 5102 dentro do estado, 6102 fora. NCM vai em
 * branco: a dona completa na Emitte (decisão de 2026-10-06) — a testar se a
 * planilha aceita assim.
 */
export function gerarPlanilhaProdutos(produtos: Produto[], modelo: Uint8Array): PlanilhaProdutos {
  const lista = produtos.filter((p) => !p.inativo)
  const semGtin: string[] = []
  const linhas: Celula[][] = lista.map((p) => {
    const codigoBarras = p.codigoBarras?.trim() ?? ''
    const gtin = gtinValido(codigoBarras) ? codigoBarras : 'SEM GTIN'
    if (gtin === 'SEM GTIN') semGtin.push(p.codigo)
    return [
      gtin, p.codigo.slice(0, 10), p.descricao.slice(0, 120), UNIDADE[p.unidade] ?? 'UN',
      Number((p.preco / 100).toFixed(2)), Number(p.fiscal?.origem ?? 0), p.fiscal?.ncm ?? null, null,
      p.fiscal?.cest ?? null, null, null, p.fiscal?.cfopEstadual ?? '5102', p.fiscal?.cfopInterestadual ?? '6102', null,
    ]
  })
  return { bytes: preencherPlanilha(modelo, linhas), quantidade: lista.length, codigos: lista.map((p) => p.codigo), semGtin }
}
