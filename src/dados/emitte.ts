import type { Produto } from '../mock/base/tipos'
import { gtinValido } from './fiscal'

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
