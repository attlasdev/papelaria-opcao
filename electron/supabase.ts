import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { createClient, type SupportedStorage, type SupabaseClient } from '@supabase/supabase-js'
import type { CausaFalha } from '../comum/contrato'
import { lerConexao } from './conexao'

/**
 * A sessao do login fica num arquivo em `userData`, para a loja nao precisar
 * entrar todo dia. Sao tokens da sessao, nunca a senha.
 */
function armazenamentoSessao(): SupportedStorage {
  const arquivo = path.join(app.getPath('userData'), 'sessao.json')
  const ler = (): Record<string, string> => {
    try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')) as Record<string, string> }
    catch { return {} }
  }
  const gravar = (dados: Record<string, string>) => fs.writeFileSync(arquivo, JSON.stringify(dados), { mode: 0o600 })
  return {
    getItem: (chave) => ler()[chave] ?? null,
    setItem: (chave, valor) => gravar({ ...ler(), [chave]: valor }),
    removeItem: (chave) => {
      const { [chave]: _removida, ...resto } = ler()
      gravar(resto)
    },
  }
}

let cliente: SupabaseClient | null = null

/** Um cliente so por execucao. Lança `ConexaoAusente` se o app nao foi configurado. */
export function supabase(): SupabaseClient {
  if (cliente) return cliente
  const { url, chave } = lerConexao()
  cliente = createClient(url, chave, {
    auth: { storage: armazenamentoSessao(), persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  })
  return cliente
}

/**
 * Traduz o erro cru para uma causa e uma mensagem que a loja entende. O texto cru
 * fica so no log do processo principal (regra 5).
 *
 * Funcao pura de proposito: da para testar sem nenhum banco de pe.
 */
export function interpretar(erro: unknown, status?: number): { causa: CausaFalha; mensagem: string } {
  const codigo = campo(erro, 'code')
  const m = (erro instanceof Error ? erro.message : campo(erro, 'message') ?? String(erro)).toLowerCase()

  if (m.includes('fetch failed') || m.includes('enotfound') || m.includes('econnrefused') || m.includes('etimedout') || m.includes('network')) {
    return { causa: 'rede', mensagem: 'Sem conexão com o banco de dados. Confira a internet; o app tenta de novo sozinho.' }
  }
  if (codigo === 'P0409') {
    return { causa: 'conflito', mensagem: 'Os dados foram alterados em outro lugar. Feche e abra o app para ver a versão mais nova.' }
  }
  if (codigo === 'invalid_credentials' || m.includes('invalid login credentials')) {
    return { causa: 'validacao', mensagem: 'E-mail ou senha não conferem.' }
  }
  if (status === 401 || codigo === '42501' || codigo === 'PGRST301' || codigo === 'PGRST303' || m.includes('jwt') || m.includes('session')) {
    return { causa: 'sessao', mensagem: 'A sessão terminou. Entre de novo.' }
  }
  if (codigo === '42P01' || codigo === '42883' || codigo === 'PGRST202' || codigo === 'PGRST205') {
    return { causa: 'banco', mensagem: 'O banco de dados não está preparado para este app. Chame o suporte.' }
  }
  return { causa: 'desconhecida', mensagem: 'Algo falhou ao falar com o banco de dados. Chame o suporte se continuar.' }
}

function campo(erro: unknown, nome: string): string | undefined {
  if (erro && typeof erro === 'object' && nome in erro) {
    const valor = (erro as Record<string, unknown>)[nome]
    return typeof valor === 'string' ? valor : undefined
  }
  return undefined
}
