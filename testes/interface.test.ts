/**
 * Regras de interface que dá para conferir lendo o código (Memoria.md, "Regras
 * de interface"). As que só a tela mostra estão nos pendentes de docs/testes.md.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIZ = path.resolve(__dirname, '..')

function arquivos(pasta: string, extensoes: string[]): string[] {
  return readdirSync(path.join(RAIZ, pasta), { recursive: true, withFileTypes: true })
    .filter((a) => a.isFile() && extensoes.some((e) => a.name.endsWith(e)))
    .map((a) => path.relative(RAIZ, path.join(a.parentPath, a.name)))
}

/** Arquivos (com a linha) onde o padrão aparece. */
function ondeAparece(lista: string[], padrao: RegExp) {
  return lista.flatMap((arquivo) => readFileSync(path.join(RAIZ, arquivo), 'utf8').split('\n')
    .map((linha, i) => (padrao.test(linha) ? `${arquivo}:${i + 1}` : null))
    .filter((x): x is string => x !== null))
}

const TELA = arquivos('src', ['.tsx', '.ts']).filter((a) => !a.endsWith('.test.ts'))

describe('[R-UI-03] ícones do acervo e nenhum link externo', () => {
  it('nenhum pacote de ícones de fora', () => {
    const pacote = JSON.parse(readFileSync(path.join(RAIZ, 'package.json'), 'utf8'))
    const dependencias = Object.keys({ ...pacote.dependencies, ...pacote.devDependencies })
    expect(dependencias.filter((d) => /lucide|@mui|material|heroicons|fontawesome|react-icons/i.test(d))).toEqual([])
    expect(ondeAparece(TELA, /from ['"](lucide|@mui|react-icons|@heroicons)/)).toEqual([])
  })

  it('nenhum endereço externo no CSS nem na página', () => {
    expect(ondeAparece([...arquivos('src', ['.css']), 'index.html'], /https?:\/\//)).toEqual([])
  })
})

describe('[R-UI-04] calendário do app em toda data', () => {
  it('nenhum campo de data do sistema', () => {
    expect(ondeAparece(TELA, /type=["'{]+date/)).toEqual([])
  })
})

describe('[R-UI-07] rotas em modo hash', () => {
  it('o roteador é o de hash', () => {
    const rotas = readFileSync(path.join(RAIZ, 'src/rotas.tsx'), 'utf8')
    expect(rotas).toMatch(/createHashRouter\(/)
    expect(rotas).not.toMatch(/createBrowserRouter|createMemoryRouter/)
  })
})
