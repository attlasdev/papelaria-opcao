import { limpar, type Loja } from '../comum/comprovante'

/**
 * Leitura do `comprovante.json` sem depender do Electron (para poder testar).
 *
 * Fica em `userData`, ao lado do `conexao.json`, e e montado a mao na
 * instalacao. Exemplo com dado inventado: `recursos/comprovante.exemplo.json`.
 *
 *   { "impressora": "POS-80",
 *     "loja": { "nome": "...", "endereco": "...", "telefone": "...", "cnpj": "..." } }
 *
 * `impressora` e o nome da fila no sistema (no Linux, o de `lpstat -p`).
 */
export type ConfigComprovante = { impressora: string; loja: Loja }

/**
 * Nome de fila: so o que o CUPS e o Windows aceitam sem aspas. Vai para argumento
 * de comando, entao nao comeca com "-" (seria lido como opcao).
 */
const NOME_IMPRESSORA = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,126}$/

export function interpretarConfigComprovante(bruto: string): ConfigComprovante | string {
  let dados: { impressora?: unknown; loja?: Record<string, unknown> }
  try {
    dados = JSON.parse(bruto.replace(/^﻿/, '').trim())
  } catch {
    return 'O arquivo de configuração do comprovante não está no formato certo.'
  }
  const impressora = typeof dados?.impressora === 'string' ? dados.impressora.trim() : ''
  if (!NOME_IMPRESSORA.test(impressora)) return 'O nome da impressora no arquivo de configuração não está certo.'

  const campo = (nome: keyof Loja) => (typeof dados.loja?.[nome] === 'string' ? limpar(dados.loja[nome] as string) : '')
  const loja: Loja = { nome: campo('nome'), endereco: campo('endereco'), telefone: campo('telefone'), cnpj: campo('cnpj') }
  const faltando = (Object.keys(loja) as (keyof Loja)[]).filter((k) => !loja[k])
  if (faltando.length) return `Faltam dados da loja no arquivo de configuração: ${faltando.join(', ')}.`
  return { impressora, loja }
}
