/**
 * O teste que confere os outros (docs/testes.md). Toda regra numerada do
 * Memoria.md e todo bug de docs/bugs.md tem um teste que cita o número, ou
 * está na tabela de pendentes de docs/testes.md, com o motivo. Regra nova sem
 * teste e sem pendência quebra a suíte: a cobertura não depende de lembrar.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIZ = path.resolve(__dirname, '..')
const ler = (arquivo: string) => readFileSync(path.join(RAIZ, arquivo), 'utf8')

const NUMERO = String.raw`(?:R-[A-Z]+-\d{2}|[AM]\d{1,2}|B-\d{3})`

function todos(texto: string, padrao: RegExp) {
  return new Set([...texto.matchAll(padrao)].map((m) => m[1]))
}

const regras = todos(ler('Memoria.md'), /`(R-[A-Z]+-\d{2})`/g)
const bugs = todos(ler('docs/bugs.md'), /^### ([AM]\d{1,2}|B-\d{3}) ·/gm)
const numerados = new Set([...regras, ...bugs])

const pendentes = todos(ler('docs/testes.md'), new RegExp(String.raw`^\| (${NUMERO}) \|`, 'gm'))

const arquivosDeTeste = ['src', 'electron', 'testes'].flatMap((pasta) =>
  readdirSync(path.join(RAIZ, pasta), { recursive: true, withFileTypes: true })
    .filter((a) => a.isFile() && a.name.endsWith('.test.ts') && a.name !== 'cobertura.test.ts')
    .map((a) => path.relative(RAIZ, path.join(a.parentPath, a.name))))

// Só conta o número citado no nome de um describe/it, entre colchetes.
const citados = new Set(arquivosDeTeste.flatMap((arquivo) =>
  [...ler(arquivo).matchAll(/\b(?:describe|it)\(\s*['"`]([^'"`]*)['"`]/g)]
    .flatMap((m) => [...m[1].matchAll(new RegExp(String.raw`\[(${NUMERO})\]`, 'g'))].map((n) => n[1]))))

const ordenar = (lista: Iterable<string>) => [...lista].sort()

describe('cobertura da suíte', () => {
  it('acha as regras e os bugs numerados', () => {
    expect(regras.size).toBeGreaterThan(50)
    expect(bugs.size).toBeGreaterThan(15)
  })

  it('toda regra e todo bug tem teste ou está nos pendentes', () => {
    expect(ordenar([...numerados].filter((n) => !citados.has(n) && !pendentes.has(n)))).toEqual([])
  })

  it('pendente que já tem teste sai da lista de pendentes', () => {
    expect(ordenar([...pendentes].filter((n) => citados.has(n)))).toEqual([])
  })

  it('teste e pendente só citam números que existem', () => {
    expect(ordenar([...citados, ...pendentes].filter((n) => !numerados.has(n)))).toEqual([])
  })
})
