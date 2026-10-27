/**
 * O ambiente de teste das migrations (CLAUDE.md, regra 8): toda migration roda
 * antes num banco com dados no formato antigo. As fotos de
 * `testes/bancos/v<N>.sqlite.gz` são a semente (com as patologias) gravada em
 * cada versão; aqui cada uma é migrada até a última e conferida.
 *
 * `testes/bancos/privado/*.sqlite` (fora do git) entra no mesmo teste: é onde
 * fica uma cópia do banco real da loja, quando houver, sem dado pessoal no
 * repositório.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { gunzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBanco, conferirBanco, versaoDoBanco } from './banco'
import { migracoes } from './migracoes'

const PASTA = path.resolve(__dirname, '../../testes/bancos')
const PRIVADO = path.join(PASTA, 'privado')

const fotos = readdirSync(PASTA).filter((nome) => /^v\d+\.sqlite\.gz$/.test(nome))
const privados = existsSync(PRIVADO) ? readdirSync(PRIVADO).filter((nome) => nome.endsWith('.sqlite')) : []

const casos = [
  ...fotos.map((nome) => ({ nome, bytes: () => gunzipSync(readFileSync(path.join(PASTA, nome))) })),
  ...privados.map((nome) => ({ nome: `privado/${nome}`, bytes: () => readFileSync(path.join(PRIVADO, nome)) })),
]

function linhasPorTabela(banco: DatabaseSync) {
  const tabelas = banco.prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'").all() as { name: string }[]
  return Object.fromEntries(tabelas.map(({ name }) => [name, (banco.prepare(`select count(*) n from "${name}"`).get() as { n: number }).n]))
}

let pasta: string
beforeEach(() => { pasta = mkdtempSync(path.join(tmpdir(), 'fotos-')) })
afterEach(() => rmSync(pasta, { recursive: true, force: true }))

describe('fotos do banco por versão', () => {
  it('existe a foto de cada versão das migrations', () => {
    const faltam = migracoes.map((m) => `v${m.versao}.sqlite.gz`).filter((nome) => !fotos.includes(nome))
    expect(faltam, 'rode `npm run banco:foto` depois de criar a migration').toEqual([])
  })

  it.each(casos)('$nome migra até a última versão sem perder nada', ({ bytes }) => {
    const caminho = path.join(pasta, 'loja.sqlite')
    writeFileSync(caminho, bytes())

    const antes = new DatabaseSync(caminho, { readOnly: true })
    const versaoAntes = versaoDoBanco(antes)
    const linhasAntes = linhasPorTabela(antes)
    expect(conferirBanco(antes)).toEqual([])
    antes.close()

    const banco = abrirBanco(caminho)
    expect(versaoDoBanco(banco)).toBe(migracoes.length)
    expect(conferirBanco(banco)).toEqual([])
    // Nenhuma tabela some e nenhuma linha se perde. Migration que apaga de
    // propósito ajusta este teste junto, à vista.
    const linhasDepois = linhasPorTabela(banco)
    for (const [tabela, n] of Object.entries(linhasAntes)) expect(linhasDepois[tabela], tabela).toBeGreaterThanOrEqual(n)
    banco.close()

    expect(existsSync(`${caminho}.v${versaoAntes}`)).toBe(versaoAntes < migracoes.length)
  })
})
