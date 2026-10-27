#!/usr/bin/env node
/**
 * Bancos de teste da 1.0 (SQLite local). Nunca toca o banco da loja: só cria
 * arquivo novo, e recusa se o arquivo já existe.
 *
 *   node scripts/banco-teste.mjs foto
 *     Fotografa o banco semeado na versão atual das migrations em
 *     testes/bancos/v<N>.sqlite.gz. Uma por versão, e nunca muda depois: é o
 *     "dado no formato antigo" em que as migrations seguintes são testadas
 *     (electron/banco/fotos.test.ts). Rodar ao criar cada migration nova.
 *
 *   node scripts/banco-teste.mjs semear <arquivo.sqlite> [AAAA-MM-DD]
 *     Cria um banco semeado (com as patologias) para conferir à mão.
 *
 * Carrega o código do banco pelo Vite, como o build faz (as migrations são
 * arquivos .sql embutidos com `?raw`).
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { createServer } from 'vite'

const RAIZ = path.resolve(import.meta.dirname, '..')
const [comando, alvo, dia] = process.argv.slice(2)

const hojeEmSaoPaulo = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date())

function parar(mensagem) {
  console.error(mensagem)
  process.exit(1)
}

if (comando !== 'foto' && comando !== 'semear') parar('Uso: banco-teste.mjs foto | semear <arquivo.sqlite> [AAAA-MM-DD]')
if (comando === 'semear' && !alvo) parar('Falta o arquivo: banco-teste.mjs semear <arquivo.sqlite>')

const vite = await createServer({
  root: RAIZ, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] },
})
try {
  const { abrirBanco, conferirBanco, versaoDoBanco } = await vite.ssrLoadModule('/electron/banco/banco.ts')
  const { semearBanco } = await vite.ssrLoadModule('/electron/banco/semente.ts')

  const hoje = dia ?? hojeEmSaoPaulo()
  const banco = abrirBanco(':memory:')
  semearBanco(banco, { hoje })
  const problemas = conferirBanco(banco)
  if (problemas.length) parar(`A semente saiu com problema:\n${problemas.join('\n')}`)
  const versao = versaoDoBanco(banco)

  const destino = comando === 'foto'
    ? path.join(RAIZ, 'testes', 'bancos', `v${versao}.sqlite.gz`)
    : path.resolve(alvo)
  if (existsSync(destino)) parar(`${path.relative(RAIZ, destino)} já existe; não sobrescrevo.`)

  // `vacuum into` grava um arquivo só, sem o -wal ao lado.
  const arquivo = comando === 'foto' ? path.join(tmpdir(), `foto-v${versao}-${process.pid}.sqlite`) : destino
  mkdirSync(path.dirname(destino), { recursive: true })
  banco.prepare('vacuum into ?').run(arquivo)
  banco.close()
  if (comando === 'foto') {
    writeFileSync(destino, gzipSync(readFileSync(arquivo), { level: 9 }))
    rmSync(arquivo)
  }
  console.log(`${path.relative(RAIZ, destino)}: versão ${versao}, semente de ${hoje}.`)
} finally {
  await vite.close()
}
