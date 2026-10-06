import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

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
export type Conexao = { url: string; chave: string }

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
  try {
    const dados = JSON.parse(bruto) as Partial<Conexao>
    if (typeof dados.url !== 'string' || typeof dados.chave !== 'string' || !dados.url.startsWith('http')) throw new Error()
    return { url: dados.url, chave: dados.chave }
  } catch {
    throw new ConexaoAusente('A configuração do banco de dados neste computador está incompleta. Chame o suporte.')
  }
}
