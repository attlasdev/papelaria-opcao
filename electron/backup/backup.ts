/**
 * Backup do banco da loja (Memoria.md, `2026-10-05`; plano da 1.0, fundação,
 * item 7). Perda máxima aceita se o disco morrer: 5 minutos.
 *
 * - **Na nuvem**, pelo `Destino` (o Supabase Storage, em `supabase-destino.ts`):
 *   `atual.sqlite.gz`, sobrescrita a cada cópia, e `dias/AAAA-MM-DD.sqlite.gz`,
 *   a primeira de cada dia, que nunca muda. O app não pode apagar nada lá.
 * - **No computador:** uma cópia por dia em `copias/`, as 30 últimas.
 *
 * Não depende do Electron, para poder testar com um destino falso.
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { backup, DatabaseSync } from 'node:sqlite'
import { gunzipSync, gzipSync } from 'node:zlib'
import { conferirBanco, versaoDoBanco, type Banco } from '../banco/banco'
import { log } from '../log'

/** Onde as cópias ficam fora do computador. Os nomes são relativos à pasta da loja. */
export type Destino = {
  /** `sobrescrever: false` e o arquivo já existe: devolve 'ja-existe' sem mudar nada. */
  enviar(nome: string, bytes: Uint8Array, sobrescrever: boolean): Promise<'enviado' | 'ja-existe'>
  baixar(nome: string): Promise<Uint8Array>
  /** Nomes dentro da pasta (ex.: 'dias'), sem o prefixo. */
  listar(pasta: string): Promise<string[]>
}

export const NOME_ATUAL = 'atual.sqlite.gz'
export const COPIAS_LOCAIS = 30

const diaEmSaoPaulo = (instante: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(instante)

/**
 * Uma cópia: a local do dia (se ainda não houver), a `atual` na nuvem e, se for
 * a primeira do dia, a diária na nuvem. A local vem antes e não depende de
 * rede: sem internet, ela fica e o envio falha (quem chama tenta de novo).
 */
export async function fazerCopia(banco: Banco, opcoes: { destino: Destino; pastaLocal: string; agora?: Date }) {
  const dia = diaEmSaoPaulo(opcoes.agora ?? new Date())
  const temporaria = mkdtempSync(path.join(tmpdir(), 'copia-'))
  try {
    // `backup` copia página a página com o banco aberto e gravando: o arquivo sai consistente.
    const arquivo = path.join(temporaria, 'loja.sqlite')
    await backup(banco, arquivo)

    mkdirSync(opcoes.pastaLocal, { recursive: true })
    const local = path.join(opcoes.pastaLocal, `${dia}.sqlite`)
    if (!existsSync(local)) copyFileSync(arquivo, local)
    podarCopiasLocais(opcoes.pastaLocal)

    const bytes = gzipSync(readFileSync(arquivo), { level: 9 })
    await opcoes.destino.enviar(NOME_ATUAL, bytes, true)
    const diaria = await opcoes.destino.enviar(`dias/${dia}.sqlite.gz`, bytes, false)
    return { dia, bytes: bytes.length, diaria }
  } finally {
    rmSync(temporaria, { recursive: true, force: true })
  }
}

function podarCopiasLocais(pasta: string) {
  const copias = readdirSync(pasta).filter((nome) => /^\d{4}-\d\d-\d\d\.sqlite$/.test(nome)).sort()
  for (const antiga of copias.slice(0, Math.max(0, copias.length - COPIAS_LOCAIS))) rmSync(path.join(pasta, antiga))
}

/**
 * Quem decide quando copiar: a cada `intervaloMs` se algo mudou, e ao fechar.
 * Sem internet, a mudança continua pendente e vai na próxima volta.
 */
export function criarAgendador(fazer: () => Promise<unknown>, intervaloMs = 5 * 60 * 1000) {
  let pendente = false
  let emAndamento: Promise<void> | null = null

  const copiar = () => {
    if (emAndamento) return emAndamento
    pendente = false
    emAndamento = fazer()
      .then(() => { log.info('backup', 'cópia feita') })
      .catch((erro) => {
        pendente = true
        log.aviso('backup', 'cópia não foi; tento de novo na próxima volta:', erro)
      })
      .finally(() => { emAndamento = null })
    return emAndamento
  }

  const relogio = setInterval(() => { if (pendente) void copiar() }, intervaloMs)
  relogio.unref?.()

  return {
    /** Chamada depois de cada gravação no banco. */
    marcarMudanca: () => { pendente = true },
    /** Ao fechar o app: copia se houver mudança, sem esperar mais que `limiteMs`. */
    async aoFechar(limiteMs = 10_000) {
      clearInterval(relogio)
      if (!pendente && !emAndamento) return
      await Promise.race([emAndamento ?? copiar(), new Promise((seguir) => setTimeout(seguir, limiteMs))])
    },
    get pendente() { return pendente },
  }
}

/**
 * Restaura uma cópia da nuvem por cima do banco do computador. Só pelo
 * suporte (decisão de `2026-10-28`), com o banco FECHADO.
 *
 * A cópia é conferida antes de tocar em qualquer coisa: abre, a versão não é
 * mais nova que o app e `conferirBanco` não acha problema. O banco que estava
 * no lugar não é apagado: vai para `<arquivo>.antes-restauracao-<instante>`,
 * junto com o -wal e o -shm, que não podem ficar ao lado do arquivo novo.
 */
export async function restaurarCopia(opcoes: { destino: Destino; nome: string; caminhoBanco: string; versaoApp: number; agora?: Date }) {
  const bytes = gunzipSync(await opcoes.destino.baixar(opcoes.nome))
  const temporario = `${opcoes.caminhoBanco}.restaurando`
  // Abrir a cópia (que vem em modo WAL) cria -wal e -shm ao lado: não podem sobrar.
  const limparTemporario = () => { for (const sufixo of ['', '-wal', '-shm']) rmSync(temporario + sufixo, { force: true }) }
  writeFileSync(temporario, bytes)
  try {
    let conferido: DatabaseSync | null = null
    try {
      conferido = new DatabaseSync(temporario, { readOnly: true })
      const versao = versaoDoBanco(conferido)
      if (versao > opcoes.versaoApp) throw new Error(`a cópia está na versão ${versao}; este app conhece até a ${opcoes.versaoApp}`)
      const problemas = conferirBanco(conferido)
      if (problemas.length) throw new Error(`a cópia tem problema: ${problemas.join('; ')}`)
    } finally {
      conferido?.close()
    }
    for (const sufixo of ['-wal', '-shm']) rmSync(temporario + sufixo, { force: true })

    const marca = (opcoes.agora ?? new Date()).toISOString().replace(/[:.]/g, '-')
    const guardado = `${opcoes.caminhoBanco}.antes-restauracao-${marca}`
    const havia = existsSync(opcoes.caminhoBanco)
    for (const sufixo of ['', '-wal', '-shm']) {
      if (existsSync(opcoes.caminhoBanco + sufixo)) renameSync(opcoes.caminhoBanco + sufixo, guardado + sufixo)
    }
    renameSync(temporario, opcoes.caminhoBanco)
    log.info('backup', `restaurada a cópia ${opcoes.nome}${havia ? `; o banco anterior ficou em ${path.basename(guardado)}` : ''}`)
    return { guardado: havia ? guardado : null }
  } finally {
    limparTemporario()
  }
}
