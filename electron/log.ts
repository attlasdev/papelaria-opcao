/**
 * O log do aplicativo, em arquivo (auditoria de 21/10, A6): no Windows
 * instalado o `console` não vai para lugar nenhum, e o suporte precisa saber o
 * que aconteceu na máquina da loja.
 *
 * Fica em `userData/logs/app.log` (na loja, `%APPDATA%\papelaria-opcao\logs`),
 * com rotação: passou de 1 MB, vira `app.1.log` e assim até `app.3.log`.
 *
 * Duas garantias:
 *   1. **Nenhuma credencial no log** (CLAUDE.md, regra 3): toda linha passa por
 *      `limparSegredos` antes de ir para o disco ou para o console.
 *   2. **O log nunca derruba o app:** disco cheio ou pasta sem permissão fazem
 *      a linha ir só para o console, e só.
 *
 * Não depende do Electron, para poder testar: `main.ts` diz a pasta.
 */
import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'

const LIMITE_BYTES = 1024 * 1024
const ARQUIVOS_ANTIGOS = 3

const SEGREDOS: [RegExp, string][] = [
  [/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[jwt]'],
  [/sb_(publishable|secret)_[\w-]+/g, 'sb_$1_[chave]'],
  [/(bearer\s+)[\w.~+/-]+=*/gi, '$1[token]'],
  [/((?:api[-_]?key|apikey|access_token|refresh_token|password|senha|chave|token)["']?\s*[:=]\s*["']?)[^\s"'&,}]+/gi, '$1[oculto]'],
  [/(\/\/[^/\s:@]+:)[^@\s/]+@/g, '$1[oculto]@'],
]

/** Tira chave, token e senha do texto: o que sobra pode ir para o log. */
export function limparSegredos(texto: string): string {
  return SEGREDOS.reduce((atual, [padrao, troca]) => atual.replace(padrao, troca), texto)
}

function descrever(parte: unknown): string {
  if (parte instanceof Error) return parte.stack ?? `${parte.name}: ${parte.message}`
  if (typeof parte === 'string') return parte
  try {
    return JSON.stringify(parte)
  } catch {
    return String(parte)
  }
}

export type Nivel = 'info' | 'aviso' | 'erro'

export function formatarLinha(nivel: Nivel, origem: string, partes: unknown[], agora = new Date()) {
  return limparSegredos(`${agora.toISOString()} ${nivel.toUpperCase()} [${origem}] ${partes.map(descrever).join(' ')}`)
}

let pasta: string | null = null

/** Chamada uma vez pelo `main.ts`, com a pasta de dados do app. Antes disso, só console. */
export function configurarLog(destino: string | null) {
  pasta = destino
}

function rotacionar(arquivo: string) {
  if (!existsSync(arquivo) || statSync(arquivo).size < LIMITE_BYTES) return
  const antigo = (n: number) => path.join(path.dirname(arquivo), `app.${n}.log`)
  rmSync(antigo(ARQUIVOS_ANTIGOS), { force: true })
  for (let n = ARQUIVOS_ANTIGOS - 1; n >= 1; n--) if (existsSync(antigo(n))) renameSync(antigo(n), antigo(n + 1))
  renameSync(arquivo, antigo(1))
}

function escrever(nivel: Nivel, origem: string, partes: unknown[]) {
  const linha = formatarLinha(nivel, origem, partes)
  if (nivel === 'erro') console.error(linha)
  else console.log(linha)
  if (!pasta) return
  try {
    mkdirSync(pasta, { recursive: true })
    const arquivo = path.join(pasta, 'app.log')
    rotacionar(arquivo)
    appendFileSync(arquivo, `${linha}\n`)
  } catch (erro) {
    console.error(`[log] não consegui gravar em ${pasta}:`, (erro as Error).message)
  }
}

export const log = {
  info: (origem: string, ...partes: unknown[]) => escrever('info', origem, partes),
  aviso: (origem: string, ...partes: unknown[]) => escrever('aviso', origem, partes),
  erro: (origem: string, ...partes: unknown[]) => escrever('erro', origem, partes),
}
