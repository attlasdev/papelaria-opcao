import { app } from 'electron'
import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { falha, ok, type Resultado } from '../comum/contrato'
import { interpretarConfigComprovante, type ConfigComprovante } from './comprovante-arquivo'
import { log } from './log'

/**
 * Envio CRU para a impressora termica: os bytes ESC/POS ja prontos vao sem
 * driver no meio (Memoria.md, `2026-10-07`).
 *
 * Linux: fila CUPS "raw" e `lp -o raw`. Comando sempre por `execFile`/`spawn`
 * com lista de argumentos, nunca por shell: o nome da impressora vem de arquivo.
 * Windows: ainda nao (alvo da 1.0, a provar numa maquina Windows antes da tela).
 */

export function caminhoConfigComprovante(): string {
  return path.join(app.getPath('userData'), 'comprovante.json')
}

/** Lida no momento de usar: trocar o arquivo nao pede reiniciar o app. */
export function lerConfigComprovante(): Resultado<ConfigComprovante> {
  let bruto: string
  try {
    bruto = fs.readFileSync(caminhoConfigComprovante(), 'utf8')
  } catch {
    return falha('configuracao', 'Este computador ainda não foi configurado para imprimir comprovantes. Chame o suporte.')
  }
  const config = interpretarConfigComprovante(bruto)
  return typeof config === 'string' ? falha('configuracao', `${config} Chame o suporte.`) : ok(config)
}

/** Saida em ingles (`LC_ALL=C`): a conferencia le o texto do `lpstat`. */
const AMBIENTE = { ...process.env, LC_ALL: 'C', LANG: 'C' }
const LIMITE_MS = 10_000

function lpstat(impressora: string): Promise<{ codigo: number; saida: string }> {
  return new Promise((resolver) => {
    execFile('lpstat', ['-p', impressora], { env: AMBIENTE, timeout: LIMITE_MS }, (erro, saida, saidaErro) => {
      const codigo = erro ? (typeof erro.code === 'number' ? erro.code : 1) : 0
      resolver({ codigo, saida: `${saida}${saidaErro}` })
    })
  })
}

function lp(impressora: string, titulo: string, bytes: Uint8Array): Promise<{ codigo: number; saida: string }> {
  return new Promise((resolver) => {
    const processo = spawn('lp', ['-d', impressora, '-o', 'raw', '-t', titulo], { env: AMBIENTE, timeout: LIMITE_MS })
    let saida = ''
    processo.stdout.on('data', (parte) => { saida += parte })
    processo.stderr.on('data', (parte) => { saida += parte })
    processo.on('error', (erro) => resolver({ codigo: -1, saida: String(erro) }))
    processo.on('close', (codigo) => resolver({ codigo: codigo ?? -1, saida }))
    processo.stdin.end(Buffer.from(bytes))
  })
}

export async function enviarCru(impressora: string, titulo: string, bytes: Uint8Array): Promise<Resultado<null>> {
  if (process.platform === 'win32') return falha('impressora', 'A impressão do comprovante ainda não funciona no Windows.')

  const estado = await lpstat(impressora)
  if (estado.codigo !== 0) {
    log.erro('impressora', 'lpstat:', estado.saida)
    return falha('impressora', `A impressora "${impressora}" não está instalada neste computador. Chame o suporte.`)
  }
  if (/\bdisabled\b/.test(estado.saida)) {
    return falha('impressora', 'A impressora está parada. Confira se está ligada, com papel e com o cabo conectado, e tente de novo.')
  }

  const envio = await lp(impressora, titulo, bytes)
  if (envio.codigo !== 0) {
    log.erro('impressora', 'lp:', envio.saida)
    return falha('impressora', 'A impressora não aceitou o comprovante. Confira se está ligada e tente de novo.')
  }
  return ok(null)
}
