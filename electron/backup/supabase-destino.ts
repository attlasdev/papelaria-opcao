/**
 * O destino das cópias na nuvem: o bucket privado `copias` do Supabase Storage,
 * uma pasta por usuário de login (`<id do usuário>/...`). Credencial: a chave
 * pública e a sessão da loja, nunca a secreta (Memoria.md, `2026-10-05`).
 *
 * As políticas do bucket (supabase/migrations/20261028000001_copias.sql) só
 * deixam a loja ler, criar e sobrescrever a `atual`: apagar, nunca.
 *
 * Recebe o cliente pronto, para servir ao app e ao script de teste.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Destino } from './backup'

export const BUCKET = 'copias'

export function destinoSupabase(cliente: SupabaseClient): Destino {
  let pasta: string | null = null
  const pastaDaLoja = async () => {
    if (pasta) return pasta
    const { data, error } = await cliente.auth.getUser()
    if (error || !data.user) throw error ?? new Error('sem sessão: a loja precisa entrar para o backup subir')
    pasta = data.user.id
    return pasta
  }

  return {
    async enviar(nome, bytes, sobrescrever) {
      const { error } = await cliente.storage.from(BUCKET)
        .upload(`${await pastaDaLoja()}/${nome}`, bytes, { upsert: sobrescrever, contentType: 'application/gzip' })
      if (!error) return 'enviado'
      if (!sobrescrever && /exist|duplicate/i.test(error.message)) return 'ja-existe'
      throw error
    },
    async baixar(nome) {
      const { data, error } = await cliente.storage.from(BUCKET).download(`${await pastaDaLoja()}/${nome}`)
      if (error) throw error
      return new Uint8Array(await data.arrayBuffer())
    },
    async listar(subpasta) {
      const { data, error } = await cliente.storage.from(BUCKET).list(`${await pastaDaLoja()}/${subpasta}`, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
      if (error) throw error
      return data.map((arquivo) => arquivo.name)
    },
  }
}
