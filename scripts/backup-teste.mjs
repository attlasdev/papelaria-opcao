#!/usr/bin/env node
/**
 * Teste de verdade do backup da 1.0 contra um projeto Supabase de TESTE
 * (plano da 1.0, fundação, item 7: "restauração testada").
 *
 * Usa a configuração e a sessão do app nesta máquina (`conexao.json` e
 * `sessao.json` em ~/.config/papelaria-opcao), sem imprimir chave nem token. A
 * sessão é a mesma do app: se o token for renovado, o novo volta para o
 * arquivo e o app continua logado.
 *
 * Conferência do alvo (regra global), em duas partes independentes:
 *   1. o ref do projeto, digitado de propósito em --projeto, tem que bater com a URL;
 *   2. o CONTEÚDO: `select nome from ambiente` no servidor tem que dar 'teste'
 *      (tabela que só existe no projeto de teste).
 *
 * Uso:  node scripts/backup-teste.mjs --projeto=<ref do projeto de teste>
 *
 * Deixa no bucket a `atual` e a diária de hoje: o app não pode apagar (é a
 * regra que o teste confere). Limpar, se quiser, pelo painel.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { createServer } from 'vite'

const RAIZ = path.resolve(import.meta.dirname, '..')
const DADOS = path.join(process.env.XDG_CONFIG_HOME ?? path.join(homedir(), '.config'), 'papelaria-opcao')
const projeto = process.argv.find((a) => a.startsWith('--projeto='))?.slice('--projeto='.length)

function parar(mensagem) {
  console.error(`PAREI: ${mensagem}`)
  process.exit(1)
}
const passo = (texto) => console.log(`· ${texto}`)

if (!projeto) parar('falta --projeto=<ref do projeto de teste>.')
const { url, chave } = JSON.parse(readFileSync(path.join(DADOS, 'conexao.json'), 'utf8').replace(/^﻿/, ''))
const ref = new URL(url).hostname.split('.')[0]
if (ref !== projeto) parar(`o conexao.json aponta para ${ref}, não para ${projeto}.`)

const arquivoSessao = path.join(DADOS, 'sessao.json')
const lerSessao = () => (existsSync(arquivoSessao) ? JSON.parse(readFileSync(arquivoSessao, 'utf8')) : {})
const cliente = createClient(url, chave, {
  auth: {
    persistSession: true, autoRefreshToken: false, detectSessionInUrl: false,
    storage: {
      getItem: (k) => lerSessao()[k] ?? null,
      setItem: (k, v) => writeFileSync(arquivoSessao, JSON.stringify({ ...lerSessao(), [k]: v }), { mode: 0o600 }),
      removeItem: (k) => { const { [k]: _, ...resto } = lerSessao(); writeFileSync(arquivoSessao, JSON.stringify(resto), { mode: 0o600 }) },
    },
  },
})

const { data: ambiente, error: erroAmbiente } = await cliente.from('ambiente').select('nome')
if (erroAmbiente) parar(`não consegui ler o marcador de ambiente (${erroAmbiente.message}). Ele existe neste projeto?`)
if (ambiente?.length !== 1 || ambiente[0].nome !== 'teste') parar(`o marcador de ambiente não diz 'teste' (${JSON.stringify(ambiente)}).`)
const { data: usuario } = await cliente.auth.getUser()
if (!usuario?.user) parar('sem sessão: entre no app (npm run dev) com o usuário de teste antes.')
console.log(`ALVO: projeto ${ref}, marcador ambiente = 'teste'. Escrevendo só no bucket "copias" da pasta do usuário de teste.`)

const vite = await createServer({
  root: RAIZ, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] },
})
const pasta = mkdtempSync(path.join(tmpdir(), 'backup-real-'))
try {
  const { abrirBanco } = await vite.ssrLoadModule('/electron/banco/banco.ts')
  const { migracoes } = await vite.ssrLoadModule('/electron/banco/migracoes.ts')
  const { semearBanco } = await vite.ssrLoadModule('/electron/banco/semente.ts')
  const { fazerCopia, restaurarCopia, NOME_ATUAL } = await vite.ssrLoadModule('/electron/backup/backup.ts')
  const { destinoSupabase, BUCKET } = await vite.ssrLoadModule('/electron/backup/supabase-destino.ts')
  const destino = destinoSupabase(cliente)
  const hoje = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const diaria = `dias/${hoje}.sqlite.gz`
  const raiz = usuario.user.id

  const caminho = path.join(pasta, 'loja.sqlite')
  const banco = abrirBanco(caminho)
  semearBanco(banco, { hoje })
  const contar = (b) => b.prepare('select (select count(*) from ficha) f, (select count(*) from movimento_estoque) m, (select sum(saldo) from produto) s').get()
  const original = contar(banco)

  const primeira = await fazerCopia(banco, { destino, pastaLocal: path.join(pasta, 'copias') })
  passo(`cópia enviada: atual e diária (${primeira.diaria}), ${primeira.bytes} bytes`)
  banco.prepare("update operador set nome = nome || ' (2)' where ativo = 1").run()
  const segunda = await fazerCopia(banco, { destino, pastaLocal: path.join(pasta, 'copias') })
  if (segunda.diaria !== 'ja-existe') parar(`a segunda cópia do dia devia achar a diária existente, deu ${segunda.diaria}.`)
  passo('segunda cópia: atual sobrescrita, diária mantida')
  banco.close()

  const { data: removidos } = await cliente.storage.from(BUCKET).remove([`${raiz}/${diaria}`, `${raiz}/${NOME_ATUAL}`])
  if (removidos?.length) parar(`a loja CONSEGUIU apagar: ${removidos.map((r) => r.name).join(', ')}`)
  if (!(await destino.listar('dias')).includes(`${hoje}.sqlite.gz`)) parar('a diária sumiu depois da tentativa de apagar.')
  passo('apagar foi recusado: a diária continua lá')

  const { error: erroSobrescrever } = await cliente.storage.from(BUCKET).upload(`${raiz}/${diaria}`, new Uint8Array([1, 2, 3]), { upsert: true, contentType: 'application/gzip' })
  if (!erroSobrescrever) parar('a loja CONSEGUIU sobrescrever a diária.')
  passo('sobrescrever a diária foi recusado')

  const { error: erroFora } = await cliente.storage.from(BUCKET).upload(`outra-loja/${NOME_ATUAL}`, new Uint8Array([1]), { contentType: 'application/gzip' })
  if (!erroFora) parar('a loja CONSEGUIU gravar fora da própria pasta.')
  passo('gravar fora da própria pasta foi recusado')

  for (const nome of [NOME_ATUAL, diaria]) {
    const destinoRestauracao = path.join(pasta, `restaurado-${nome.replace(/\W/g, '-')}.sqlite`)
    await restaurarCopia({ destino, nome, caminhoBanco: destinoRestauracao, versaoApp: migracoes.length })
    const restaurado = abrirBanco(destinoRestauracao)
    const contagem = contar(restaurado)
    restaurado.close()
    if (JSON.stringify(contagem) !== JSON.stringify(original)) parar(`a restauração de ${nome} não bate: ${JSON.stringify(contagem)} ≠ ${JSON.stringify(original)}`)
    passo(`restaurada ${nome}: ${contagem.f} fichas, ${contagem.m} movimentos, saldo total ${contagem.s} (igual ao original)`)
  }
  console.log('OK: backup e restauração conferidos no projeto de teste.')
} finally {
  await vite.close()
  rmSync(pasta, { recursive: true, force: true })
}
