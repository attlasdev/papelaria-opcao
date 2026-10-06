import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { interpretarConexao, type Conexao } from './conexao-arquivo'

/**
 * A que banco o app se liga. Fica em `userData/conexao.json`, fora do repositorio
 * e do pacote, e e lido no momento de usar (regra 3 do CLAUDE.md).
 *
 *   { "url": "https://<ref>.supabase.co", "chave": "<chave anon/publishable>" }
 *
 * A chave e a PUBLICA do projeto. Nunca a `service_role`: com ela, quem abrir o
 * computador teria o banco inteiro. Quem protege os dados e o login + RLS.
 *
 * Em desenvolvimento, `PAPELARIA_URL` e `PAPELARIA_CHAVE` no ambiente substituem o
 * arquivo — para apontar para o Supabase local sem tocar no arquivo da maquina.
 */
export type { Conexao } from './conexao-arquivo'

export class ConexaoAusente extends Error {}

export function caminhoConexao(): string {
  return path.join(app.getPath('userData'), 'conexao.json')
}

export function lerConexao(): Conexao {
  const url = process.env.PAPELARIA_URL
  const chave = process.env.PAPELARIA_CHAVE
  if (url && chave) return { url, chave }

  let bruto: string
  try {
    bruto = fs.readFileSync(caminhoConexao(), 'utf8')
  } catch {
    throw new ConexaoAusente('Este computador ainda não foi configurado para o banco de dados. Chame o suporte.')
  }
  const conexao = interpretarConexao(bruto)
  if (typeof conexao === 'string') throw new ConexaoAusente(`${conexao} Chame o suporte.`)
  return conexao
}
