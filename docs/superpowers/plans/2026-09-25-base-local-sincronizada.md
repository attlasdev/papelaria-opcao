# Base local sincronizada — Plano de implementação

> **Situação: EXECUTADO em 2026-09-25**, todas as 11 tarefas, com as decisões D1–D5
> no padrão proposto. `npm test` (34 testes), `tsc` e build passam; fluxos
> conferidos no navegador. Desvios do texto abaixo: o teste de saldo do estoque lê
> os movimentos na ordem da lista (sem reordenar); as notinhas de cenário têm itens
> fixos; a amostra quita 93% das notinhas vencidas (não 80%); o sino ganhou tipos,
> ícones e "marcar como lidas" (`avisosLidos` na base); `notinha().detalhe` traz só
> o prazo, para caber no selo. As caixas `- [ ]` abaixo não foram marcadas uma a uma.

> **Para quem executa (humano ou agente):** usar superpowers:executing-plans (na
> mesma sessão) ou superpowers:subagent-driven-development (uma tarefa por
> subagente). Os passos usam caixas `- [ ]` para acompanhar.

**Objetivo:** trocar os nove `dados-exemplo.ts` independentes e o estado em
memória por **uma base local única**, gravada no `localStorage`, da qual todas
as telas leem. Uma notinha pendente da Mariana aparece igual no Início, em
Clientes, no detalhe dela, na ficha, na janela de recebimento, no sino, na
busca e no Financeiro.

**Arquitetura:** a base guarda só **fatos** (clientes, produtos, fichas com
itens e pagamentos, movimentos manuais do caixa, movimentos do estoque,
rascunhos de nota). Tudo o que é **consequência** — situação da notinha e do
cliente, total comprado, resumo do dia, entradas do Financeiro, contagens,
notificações, resultados de busca — é calculado na hora por funções puras.
Assim, nada pode divergir: não há segunda cópia para esquecer de atualizar. Uma
semente determinística gera cerca de 90 dias de movimento **relativos à data de
hoje**, então Dia, Semana, Mês e "Vence em N dias" funcionam com datas reais.

**Stack:** React 19 + TypeScript, `useSyncExternalStore` (já usado), `localStorage`
com `try/catch`, Vitest (novo, só `devDependency`, sem módulo nativo) para testar
a camada de dados.

## Restrições globais

- **Não mexe no contrato.** `comum/contrato.ts`, `electron/` e `window.api` ficam
  como estão (regra 7). A base é local ao front; o formato dela vira proposta de
  vocabulário para o primeiro corte do contrato.
- Nomes em português sem acento no código; texto de tela com acento.
- Dinheiro em centavos (inteiro). Datas na base: `YYYY-MM-DD` e horário `HH:MM`.
  Id sempre string.
- CSS por componente, só com tokens de `src/estilos/tokens/`.
- Nenhum dado real de pessoa: nomes e documentos continuam fictícios e mascarados.
- Sem commit durante a execução: o repositório ainda não tem o primeiro commit, e
  o Victor faz o commit. Cada tarefa termina num **ponto de verificação**
  (`npx tsc --noEmit -p tsconfig.json` + `npm test`).
- Ao fim, `Memoria.md` e `AGENTS.md` atualizados (combinado da fase atual).

## Decisões embutidas (confirmar antes de executar)

| # | Decisão | Padrão proposto |
|---|---|---|
| D1 | Pix e cartão no Financeiro | **Aparecem**, uma entrada por pagamento registrado na ficha (venda à vista, entrada ou recebimento de notinha). A pergunta em aberto passa a ser só *de onde* esse registro vem em produção (API da maquininha/banco ou lançamento manual); a tela não conta duas vezes porque existe um único registro por pagamento. |
| D2 | Tamanho e datas da amostra | 24 clientes, 16 produtos, cerca de 400 fichas em 90 dias até hoje. Os números "148 clientes" e "1.420 produtos" somem: as contagens passam a ser reais. |
| D3 | Restaurar dados de exemplo | Clicar no operador (rodapé da barra lateral) abre "Restaurar dados de exemplo", com confirmação. Funciona no Electron e no navegador. |
| D4 | Nova ficha | Abre vazia: sem cliente e sem itens. |
| D5 | Testes | Vitest com `vitest.config.mts` próprio, sem os plugins do Electron. |

## Mapa de arquivos

**Criar** (`src/mock/base/`, a camada de dados local):

| Arquivo | Responsabilidade |
|---|---|
| `tipos.ts` | Tipos da base: `Cliente`, `Produto`, `Ficha`, `ItemVenda`, `Pagamento`, `MovimentoCaixa`, `MovimentoEstoque`, `RascunhoFicha`, `Base`, `VERSAO_BASE` |
| `datas.ts` | `hojeISO`, `agoraHorario`, `somarDias`, `diasEntre`, `noPeriodo`, `periodoAnterior`, `dataPorExtenso` |
| `semente.ts` | `criarSemente(hoje, minutoAtual)`: base coerente e determinística |
| `derivados.ts` | Funções puras de leitura: notinhas, situação do cliente, resumo do cliente, entradas do Financeiro, resumos, busca, notificações |
| `persistencia.ts` | `carregarBase`, `salvarBase`, `apagarBase` sobre `localStorage` |
| `semente.test.ts`, `derivados.test.ts` | Invariantes e regras |

**Reescrever:** `src/mock/estado-demonstracao.ts`, que vira o store sobre a base e
as ações. Teste em `src/mock/estado-demonstracao.test.ts`.

**Adaptar telas:** `inicio`, `criar-ficha` (e blocos), `detalhe-ficha`,
`clientes`, `detalhe-cliente` (e `receber/`), `formulario-cliente`,
`vendas-sem-identificacao`, `financeiro`, `registrar-movimento`, `estoque`,
`movimentacoes-estoque`, `ajustar-estoque`, `registrar-entrada`,
`cadastrar-produto`, `notas-fiscais`, `rascunhos-notas`, `detalhe-fiscal`,
`resultados-busca`, `componentes/layout/tela/Tela.tsx` (sino),
`componentes/layout/barra-lateral/BarraLateral.tsx` (restaurar).

**Esvaziar `dados-exemplo.ts`:** os dados saem. Ficam só as constantes de tela que
não são fatos (`grupos`, `situacaoSaldo`, `categorias`, `unidades`,
`semIdentificacao`, o documento de fornecedor de exemplo). O
`detalhe-cliente/dados-exemplo.ts` é apagado.

---

### Tarefa 1: Vitest, tipos, datas e persistência

**Arquivos:**
- Criar: `vitest.config.mts`, `src/mock/base/tipos.ts`, `src/mock/base/datas.ts`, `src/mock/base/persistencia.ts`, `src/mock/base/datas.test.ts`
- Modificar: `package.json` (script `test`)

**Interfaces produzidas:** todos os tipos abaixo; `hojeISO(): string`,
`agoraHorario(): string`, `minutoDoDia(): number`, `somarDias(iso, n): string`,
`diasEntre(de, ate): number`, `type Periodo = 'dia' | 'semana' | 'mes' | 'ano'`,
`noPeriodo(data, periodo, referencia): boolean`,
`periodoAnterior(periodo, referencia): string`, `dataPorExtenso(iso): string`,
`carregarBase(): Base | null`, `salvarBase(base): void`, `apagarBase(): void`.

- [ ] **Passo 1: instalar o Vitest e criar a config separada**

```bash
npm install -D vitest
```

`vitest.config.mts`:

```ts
import { defineConfig } from 'vitest/config'

// Config própria: a vite.config.mts sobe o Electron, que o teste não precisa.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
```

Em `package.json`, adicionar a `scripts`: `"test": "vitest run"`.

- [ ] **Passo 2: escrever `tipos.ts`**

```ts
/**
 * A base local da demonstração. Guarda só fatos; situação, totais e resumos
 * são calculados em derivados.ts, para nenhuma tela ter uma cópia que envelhece.
 */
export const VERSAO_BASE = 1

export type Meio = 'dinheiro' | 'pix' | 'cartao'
export type FormaVenda = Meio | 'notinha'
export type Grupo = 'papeis' | 'escrita' | 'cadernos' | 'escritorio' | 'artes'

export type Cliente = {
  id: string // CLI-0104
  nome: string
  documento: string // mascarado; "Sem documento" quando não informado
  telefone: string
  email: string
  endereco: string // "Rua, nº - Bairro - Cidade/UF" ou ""
  descricao: string // "Cliente frequente"
  desde: string // YYYY-MM-DD
}

export type Produto = {
  codigo: string // EST-0021
  codigoBarras?: string
  descricao: string
  categoria: string
  grupo: Grupo
  unidade: 'un' | 'pct'
  preco: number
  saldo: number
  minimo: number
}

export type ItemVenda = { codigo: string; descricao: string; quantidade: number; preco: number }

/** Um dinheiro que entrou por causa de uma ficha. */
export type Pagamento = {
  data: string
  horario: string
  meio: Meio
  valor: number
  /** Notinha: parte paga no ato da venda. */
  entrada?: boolean
  /** Rótulo mais preciso do meio, como "Cartão crédito (2x)". */
  rotulo?: string
}

export type Ficha = {
  id: string // '1043'
  clienteId: string | null // null = venda sem identificação
  data: string
  horario: string
  operador: string
  itens: ItemVenda[]
  desconto: number
  total: number // já com desconto
  forma: FormaVenda
  /** À vista: um pagamento na hora. Notinha: entrada e recebimentos, em ordem. */
  pagamentos: Pagamento[]
  vencimento?: string // só notinha
}

/** Lançamento manual do caixa (despesa, retirada, troco, recebimento avulso). */
export type MovimentoCaixa = {
  id: string
  data: string
  horario: string
  descricao: string
  origem: string
  categoria: string
  meio: Meio
  valor: number // negativo = saída
}

export type MovimentoEstoque = {
  id: string
  data: string // ISO com hora, para ordenar
  produto: string
  descricao: string
  tipo: 'Entrada' | 'Ajuste' | 'Venda'
  antes: number
  depois: number
  motivo: string
}

/** Ficha em andamento guardada para retomar depois. */
export type RascunhoFicha = {
  clienteId: string | null
  semIdentificacao: boolean
  itens: { codigo: string; quantidade: number }[]
  desconto: number
  forma: FormaVenda
  recebido: number
  prepararNota: boolean
  vencimento: string
  entrada: number
  meioEntrada: Meio
}

export type Base = {
  versao: number
  criadaEm: string
  operador: string
  clientes: Cliente[]
  produtos: Produto[]
  fichas: Ficha[]
  movimentosCaixa: MovimentoCaixa[]
  movimentosEstoque: MovimentoEstoque[]
  rascunhosNota: string[] // ids de ficha
  rascunhoFicha: RascunhoFicha | null
}
```

- [ ] **Passo 3: escrever o teste de datas (falha, porque `datas.ts` ainda não existe)**

`src/mock/base/datas.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { dataPorExtenso, diasEntre, noPeriodo, periodoAnterior, somarDias } from './datas'

describe('datas', () => {
  it('soma dias atravessando o mês', () => {
    expect(somarDias('2026-09-25', 10)).toBe('2026-10-05')
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('conta dias entre duas datas', () => {
    expect(diasEntre('2026-09-25', '2026-10-25')).toBe(30)
    expect(diasEntre('2026-09-25', '2026-09-20')).toBe(-5)
  })
  it('recorta por período com semana de domingo a sábado', () => {
    // 25/09/2026 é sexta; a semana vai de 20/09 a 26/09
    expect(noPeriodo('2026-09-20', 'semana', '2026-09-25')).toBe(true)
    expect(noPeriodo('2026-09-19', 'semana', '2026-09-25')).toBe(false)
    expect(noPeriodo('2026-09-01', 'mes', '2026-09-25')).toBe(true)
    expect(noPeriodo('2025-09-25', 'ano', '2026-09-25')).toBe(false)
  })
  it('dá a referência do período anterior', () => {
    expect(periodoAnterior('dia', '2026-09-25')).toBe('2026-09-24')
    expect(periodoAnterior('semana', '2026-09-25')).toBe('2026-09-18')
    expect(periodoAnterior('mes', '2026-03-31')).toBe('2026-02-28')
    expect(periodoAnterior('ano', '2026-09-25')).toBe('2025-09-25')
  })
  it('escreve a data por extenso', () => {
    expect(dataPorExtenso('2026-09-25')).toBe('Sexta-feira, 25 de setembro')
  })
})
```

Rodar `npm test`. Esperado: FALHA ("Failed to resolve import './datas'").

- [ ] **Passo 4: escrever `datas.ts`**

```ts
/** Datas da base: sempre YYYY-MM-DD no fuso local, sem hora. */

function partes(iso: string) {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return { ano, mes, dia }
}

function paraISO(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

function paraData(iso: string) {
  const { ano, mes, dia } = partes(iso)
  return new Date(ano, mes - 1, dia)
}

export function hojeISO() {
  return paraISO(new Date())
}

export function agoraHorario() {
  const agora = new Date()
  return `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`
}

export function minutoDoDia() {
  const agora = new Date()
  return agora.getHours() * 60 + agora.getMinutes()
}

export function somarDias(iso: string, dias: number) {
  const data = paraData(iso)
  data.setDate(data.getDate() + dias)
  return paraISO(data)
}

export function diasEntre(de: string, ate: string) {
  const a = partes(de)
  const b = partes(ate)
  return Math.round((Date.UTC(b.ano, b.mes - 1, b.dia) - Date.UTC(a.ano, a.mes - 1, a.dia)) / 86_400_000)
}

export type Periodo = 'dia' | 'semana' | 'mes' | 'ano'

function inicioDaSemana(iso: string) {
  return somarDias(iso, -paraData(iso).getDay())
}

export function noPeriodo(data: string, periodo: Periodo, referencia: string) {
  if (periodo === 'dia') return data === referencia
  if (periodo === 'mes') return data.slice(0, 7) === referencia.slice(0, 7)
  if (periodo === 'ano') return data.slice(0, 4) === referencia.slice(0, 4)
  const inicio = inicioDaSemana(referencia)
  return data >= inicio && data <= somarDias(inicio, 6)
}

/** Uma data dentro do período imediatamente anterior, para comparar ("vs ontem"). */
export function periodoAnterior(periodo: Periodo, referencia: string) {
  if (periodo === 'dia') return somarDias(referencia, -1)
  if (periodo === 'semana') return somarDias(referencia, -7)
  const { ano, mes, dia } = partes(referencia)
  if (periodo === 'ano') return paraISO(new Date(ano - 1, mes - 1, Math.min(dia, 28)))
  const ultimoDiaAnterior = new Date(ano, mes - 1, 0).getDate()
  return paraISO(new Date(ano, mes - 2, Math.min(dia, ultimoDiaAnterior)))
}

const extenso = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

export function dataPorExtenso(iso: string) {
  const texto = extenso.format(paraData(iso))
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
```

Rodar `npm test`. Esperado: PASSA. Se o `Intl` do Node devolver "sexta-feira, 25
de setembro", o `toUpperCase` da primeira letra já cobre.

- [ ] **Passo 5: escrever `persistencia.ts`**

```ts
import { VERSAO_BASE, type Base } from './tipos'

const CHAVE = 'papelaria-opcao:base'

/**
 * localStorage pode faltar (teste em Node) ou lançar (armazenamento bloqueado).
 * Nesses casos a base vive só na memória da janela, sem quebrar a tela.
 */
export function carregarBase(): Base | null {
  try {
    const texto = globalThis.localStorage?.getItem(CHAVE)
    if (!texto) return null
    const base = JSON.parse(texto) as Base
    return base.versao === VERSAO_BASE ? base : null
  } catch {
    return null
  }
}

export function salvarBase(base: Base) {
  try {
    globalThis.localStorage?.setItem(CHAVE, JSON.stringify(base))
  } catch {
    // Sem espaço ou bloqueado: segue em memória.
  }
}

export function apagarBase() {
  try {
    globalThis.localStorage?.removeItem(CHAVE)
  } catch {
    // idem
  }
}
```

- [ ] **Passo 6: ponto de verificação**

Rodar `npx tsc --noEmit -p tsconfig.json` e `npm test`. Esperado: sem erros.

---

### Tarefa 2: Semente coerente

**Arquivos:**
- Criar: `src/mock/base/semente.ts`, `src/mock/base/semente.test.ts`

**Interfaces:**
- Consome: tipos, `somarDias`, `diasEntre` (Tarefa 1).
- Produz: `criarSemente(hoje: string, minutoAtual?: number): Base`. Os cenários
  fixos que os testes e as telas usam:

| Cliente | Situação garantida |
|---|---|
| CLI-0104 Mariana Costa | notinha a vencer em 12 dias com entrada de R$ 50,00 (Pix) e uma notinha antiga quitada |
| CLI-0105 Colégio Monteiro Lobato | notinha a vencer em 20 dias |
| CLI-0106 Carlos Eduardo Santos | notinha em atraso há 10 dias |
| CLI-0117 Associação Girassol | duas notinhas em atraso |
| CLI-0107 Ana Beatriz Nogueira | só compras à vista (em dia) |

- [ ] **Passo 1: escrever o teste de invariantes (falha, porque `semente.ts` ainda não existe)**

`src/mock/base/semente.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { criarSemente } from './semente'

const HOJE = '2026-09-25'
const base = criarSemente(HOJE, 15 * 60)

describe('semente', () => {
  it('é determinística para a mesma data', () => {
    expect(JSON.stringify(criarSemente(HOJE, 15 * 60))).toBe(JSON.stringify(base))
  })

  it('tem ids únicos de ficha, em ordem de data e horário', () => {
    const ids = base.fichas.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    const ordem = base.fichas.map((f) => `${f.data} ${f.horario}`)
    expect([...ordem].sort()).toEqual(ordem)
  })

  it('não tem nada no futuro', () => {
    for (const f of base.fichas) {
      expect(f.data <= HOJE).toBe(true)
      if (f.data === HOJE) expect(f.horario <= '15:00').toBe(true)
      for (const p of f.pagamentos) expect(p.data <= HOJE).toBe(true)
    }
    for (const m of base.movimentosCaixa) expect(m.data <= HOJE).toBe(true)
  })

  it('fecha a conta de cada ficha', () => {
    for (const f of base.fichas) {
      const soma = f.itens.reduce((t, i) => t + i.preco * i.quantidade, 0)
      expect(f.total).toBe(soma - f.desconto)
      const pago = f.pagamentos.reduce((t, p) => t + p.valor, 0)
      if (f.forma === 'notinha') {
        expect(f.clienteId).not.toBeNull()
        expect(f.vencimento).toBeDefined()
        expect(pago).toBeLessThanOrEqual(f.total)
      } else {
        expect(pago).toBe(f.total)
        expect(f.pagamentos).toHaveLength(1)
        expect(f.pagamentos[0].meio).toBe(f.forma)
      }
    }
  })

  it('só referencia clientes e produtos que existem', () => {
    const clientes = new Set(base.clientes.map((c) => c.id))
    const produtos = new Set(base.produtos.map((p) => p.codigo))
    for (const f of base.fichas) {
      if (f.clienteId) expect(clientes.has(f.clienteId)).toBe(true)
      for (const i of f.itens) expect(produtos.has(i.codigo)).toBe(true)
    }
    for (const id of base.rascunhosNota) expect(base.fichas.some((f) => f.id === id)).toBe(true)
  })

  it('bate o saldo de cada produto com os movimentos do estoque', () => {
    for (const p of base.produtos) {
      const movs = base.movimentosEstoque.filter((m) => m.produto === p.codigo).sort((a, b) => a.data.localeCompare(b.data))
      for (let i = 1; i < movs.length; i++) expect(movs[i].antes).toBe(movs[i - 1].depois)
      if (movs.length) expect(movs[movs.length - 1].depois).toBe(p.saldo)
      for (const m of movs) expect(m.antes).toBeGreaterThanOrEqual(0)
    }
  })

  it('garante os cenários de notinha', () => {
    const aberta = (cliente: string) =>
      base.fichas.filter((f) => f.clienteId === cliente && f.forma === 'notinha'
        && f.pagamentos.reduce((t, p) => t + p.valor, 0) < f.total)
    const mariana = aberta('CLI-0104')
    expect(mariana.some((f) => f.vencimento === '2026-10-07' && f.pagamentos[0]?.entrada && f.pagamentos[0].valor === 5000)).toBe(true)
    expect(aberta('CLI-0106').some((f) => f.vencimento === '2026-09-15')).toBe(true)
    expect(aberta('CLI-0117').filter((f) => (f.vencimento ?? '') < HOJE).length).toBeGreaterThanOrEqual(2)
    expect(base.fichas.some((f) => f.clienteId === 'CLI-0107' && f.forma === 'notinha')).toBe(false)
  })

  it('tem movimento hoje para o Início e o Financeiro', () => {
    expect(base.fichas.filter((f) => f.data === HOJE).length).toBeGreaterThanOrEqual(4)
    expect(base.fichas.some((f) => f.clienteId === null)).toBe(true)
  })
})
```

Rodar `npm test`. Esperado: FALHA ("Failed to resolve import './semente'").

- [ ] **Passo 2: escrever `semente.ts`**

```ts
import { diasEntre, somarDias } from './datas'
import { VERSAO_BASE, type Base, type Cliente, type Ficha, type ItemVenda, type Meio, type MovimentoCaixa, type MovimentoEstoque, type Produto } from './tipos'

/**
 * Amostra da demonstração: cerca de 90 dias de balcão terminando em `hoje`.
 * Determinística (sorteio com semente fixa), para testes e capturas se repetirem.
 * Os sorteios não dependem da data, então a mesma história se desloca com o calendário.
 */

const DIAS = 90
const OPERADOR = 'João Silva'

function sorteador(semente: number) {
  let a = semente >>> 0
  const numero = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const inteiro = (min: number, max: number) => min + Math.floor(numero() * (max - min + 1))
  return {
    numero,
    inteiro,
    um: <T,>(lista: readonly T[]) => lista[Math.floor(numero() * lista.length)],
    chance: (p: number) => numero() < p,
  }
}

const horario = (minutos: number) => `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`

// [id, nome, documento, telefone, descricao, desde (dias atrás), compra fiado?]
const CLIENTES: [string, string, string, string, string, number, boolean][] = [
  ['CLI-0104', 'Mariana Costa', 'CPF ***.452.198-**', '(11) 98452-1100', 'Cliente frequente', 1300, true],
  ['CLI-0105', 'Colégio Monteiro Lobato', 'CNPJ 12.345.678/0001-90', '(11) 3214-5500', 'Resp.: Diretoria Adm.', 900, true],
  ['CLI-0106', 'Carlos Eduardo Santos', 'CPF ***.781.902-**', '(11) 97123-4455', 'Atendido no balcão', 400, true],
  ['CLI-0107', 'Ana Beatriz Nogueira', 'CPF ***.312.449-**', '(11) 99876-5432', 'Cliente frequente', 700, false],
  ['CLI-0108', 'Papel e Arte Gráfica ME', 'CNPJ 98.765.432/0001-11', '(11) 4002-8922', 'Compras mensais', 1100, true],
  ['CLI-0109', 'Escola Futuro', 'CNPJ 45.210.987/0001-33', '(11) 3350-1200', 'Compras escolares', 600, true],
  ['CLI-0110', 'Renata Silveira', 'CPF ***.604.215-**', '(11) 98820-3311', 'Cliente de balcão', 200, false],
  ['CLI-0111', 'Mariano Souza Lima', 'CPF ***.991.048-**', '(11) 97771-2040', 'Cliente de balcão', 150, false],
  ['CLI-0112', 'Juliana Almeida', 'CPF ***.281.650-**', '(11) 90000-0112', 'Cliente de balcão', 320, false],
  ['CLI-0113', 'Oficina Criativa', 'CNPJ 31.450.112/0001-08', '(11) 90000-0113', 'Compras para cursos', 800, true],
  ['CLI-0114', 'Patrícia Nascimento', 'CPF ***.472.830-**', '(11) 90000-0114', 'Cliente frequente', 500, false],
  ['CLI-0115', 'Centro Educacional Aurora', 'CNPJ 27.652.340/0001-51', '(11) 90000-0115', 'Compras escolares', 950, true],
  ['CLI-0116', 'Beatriz Oliveira', 'CPF ***.394.720-**', '(11) 90000-0116', 'Cliente frequente', 450, false],
  ['CLI-0117', 'Associação Girassol', 'CNPJ 18.784.220/0001-70', '(11) 90000-0117', 'Compras para eventos', 1000, true],
  ['CLI-0118', 'Fernanda Ribeiro', 'CPF ***.516.940-**', '(11) 90000-0118', 'Cliente de balcão', 90, false],
  ['CLI-0119', 'Gráfica Horizonte', 'CNPJ 40.825.417/0001-02', '(11) 90000-0119', 'Compras mensais', 1200, true],
  ['CLI-0120', 'Rafael Martins', 'CPF ***.638.150-**', '(11) 90000-0120', 'Cliente de balcão', 230, false],
  ['CLI-0121', 'Ateliê das Letras', 'CNPJ 22.946.315/0001-44', '(11) 90000-0121', 'Material para oficinas', 850, true],
  ['CLI-0122', 'Camila Santos', 'CPF ***.750.260-**', '(11) 90000-0122', 'Cliente frequente', 380, false],
  ['CLI-0123', 'Biblioteca do Bairro', 'CNPJ 36.108.426/0001-19', '(11) 90000-0123', 'Compras para acervo', 1050, true],
  ['CLI-0124', 'Lucas Ferreira', 'Sem documento', '(11) 90000-0124', 'Cliente de balcão', 60, false],
  ['CLI-0125', 'Helena Duarte', 'CPF ***.118.304-**', '(11) 90000-0125', 'Cliente de balcão', 40, false],
  ['CLI-0126', 'Instituto Semear', 'CNPJ 50.331.908/0001-27', '(11) 90000-0126', 'Compras mensais', 720, true],
  ['CLI-0127', 'Thiago Moreira', 'CPF ***.905.672-**', '(11) 90000-0127', 'Cliente de balcão', 25, false],
]

const RUAS = ['Rua das Flores', 'Av. Brasil', 'Rua do Comércio', 'Rua Sete de Setembro', 'Rua das Acácias', 'Av. Paulista']
const BAIRROS = ['Centro', 'Jardim Paulista', 'Vila Nova', 'Bela Vista']

/** Saldo atual de cada produto: é o ponto de chegada dos movimentos gerados. */
const PRODUTOS: Produto[] = [
  { codigo: 'EST-0021', codigoBarras: '789102711', descricao: 'Caderno Universitário Tilibra 10 Matérias Capa Dura 200 Fls', categoria: 'Cadernos', grupo: 'cadernos', unidade: 'un', preco: 2490, saldo: 42, minimo: 15 },
  { codigo: 'EST-0022', codigoBarras: '789102722', descricao: 'Caneta Gel Pentel Energel 0.7mm Azul Ponta Agulha', categoria: 'Escrita', grupo: 'escrita', unidade: 'un', preco: 1250, saldo: 6, minimo: 20 },
  { codigo: 'EST-0023', codigoBarras: '789102744', descricao: 'Sulfite A4 Chamex 75g 500fls Pacote Tradicional', categoria: 'Papéis', grupo: 'papeis', unidade: 'pct', preco: 2800, saldo: 85, minimo: 30 },
  { codigo: 'EST-0024', descricao: 'Cartolina Cartão Duplex 250g Cores Sortidas 50x70cm Avulsa', categoria: 'Artes e papéis', grupo: 'artes', unidade: 'un', preco: 350, saldo: 18, minimo: 10 },
  { codigo: 'EST-0025', codigoBarras: '789102789', descricao: 'Bloco Adesivo Post-it Amarelo 76x76mm c/ 4 Blocos 400 Folhas', categoria: 'Escritório', grupo: 'escritorio', unidade: 'pct', preco: 1890, saldo: 3, minimo: 10 },
  { codigo: 'EST-0026', codigoBarras: '789102795', descricao: 'Papel Fotográfico Glossy A4 180g Alta Definição Pacote com 100 Folhas Resistente à Água Premium Micro-poroso Secagem Instantânea', categoria: 'Papéis especiais', grupo: 'papeis', unidade: 'pct', preco: 4500, saldo: 12, minimo: 8 },
  { codigo: 'EST-0027', codigoBarras: '789102733', descricao: 'Borracha Escolar Branca Mercur Record 40 com Capa Protetora', categoria: 'Escolar', grupo: 'artes', unidade: 'un', preco: 250, saldo: 0, minimo: 50 },
  { codigo: 'EST-0028', codigoBarras: '789102806', descricao: 'Lápis Grafite Faber-Castell HB Nº 2 Caixa com 12 Unidades', categoria: 'Escrita', grupo: 'escrita', unidade: 'pct', preco: 1590, saldo: 24, minimo: 10 },
  { codigo: 'EST-0029', codigoBarras: '789102817', descricao: 'Pasta Suspensa Kraft com Haste Plástica', categoria: 'Escritório', grupo: 'escritorio', unidade: 'un', preco: 490, saldo: 36, minimo: 15 },
  { codigo: 'EST-0030', codigoBarras: '789102828', descricao: 'Agenda Permanente Capa Dura 160 Folhas', categoria: 'Agendas', grupo: 'cadernos', unidade: 'un', preco: 3290, saldo: 9, minimo: 12 },
  { codigo: 'EST-0031', descricao: 'Folha de EVA Lisa 40×60cm Azul Avulsa', categoria: 'Artes e papéis', grupo: 'artes', unidade: 'un', preco: 490, saldo: 55, minimo: 20 },
  { codigo: 'EST-0032', codigoBarras: '789102839', descricao: 'Caneta Esferográfica Azul 1.0mm Caixa com 50 Unidades', categoria: 'Escrita', grupo: 'escrita', unidade: 'pct', preco: 3990, saldo: 7, minimo: 8 },
  { codigo: 'EST-0033', codigoBarras: '789102840', descricao: 'Envelope Pardo Ofício 24×34cm Pacote com 100 Unidades', categoria: 'Escritório', grupo: 'escritorio', unidade: 'pct', preco: 2790, saldo: 18, minimo: 10 },
  { codigo: 'EST-0034', codigoBarras: '789102851', descricao: 'Papel Sulfite A3 75g Pacote com 500 Folhas', categoria: 'Papéis', grupo: 'papeis', unidade: 'pct', preco: 6490, saldo: 14, minimo: 6 },
  { codigo: 'EST-0035', codigoBarras: '789102862', descricao: 'Marcador Permanente Preto Ponta Dupla', categoria: 'Escrita', grupo: 'escrita', unidade: 'un', preco: 890, saldo: 31, minimo: 12 },
  { codigo: 'EST-0036', codigoBarras: '789102873', descricao: 'Caderno Brochura Capa Flexível 96 Folhas', categoria: 'Cadernos', grupo: 'cadernos', unidade: 'un', preco: 990, saldo: 22, minimo: 15 },
]

const ROTULOS_CARTAO = ['Cartão débito', 'Cartão crédito (1x)', 'Cartão crédito (2x)']

type FichaSemId = Omit<Ficha, 'id'>

export function criarSemente(hoje: string, minutoAtual = 24 * 60): Base {
  const s = sorteador(1043)

  const clientes: Cliente[] = CLIENTES.map(([id, nome, documento, telefone, descricao, desde], indice) => ({
    id, nome, documento, telefone, descricao,
    email: indice % 3 === 0 ? `${nome.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@email.com` : '',
    endereco: indice % 2 === 0 ? `${RUAS[indice % RUAS.length]}, ${100 + indice * 7} - ${BAIRROS[indice % BAIRROS.length]} - São Paulo/SP` : '',
    desde: somarDias(hoje, -desde),
  }))
  const fiado = new Set(CLIENTES.filter((c) => c[6]).map((c) => c[0]))
  const produtos = PRODUTOS.map((p) => ({ ...p }))

  const itensSorteados = (): ItemVenda[] => {
    const quantos = s.inteiro(1, 4)
    const escolhidos = new Map<string, ItemVenda>()
    for (let i = 0; i < quantos; i++) {
      const p = s.um(produtos)
      const atual = escolhidos.get(p.codigo)
      const quantidade = p.unidade === 'pct' ? s.inteiro(1, 2) : s.inteiro(1, 3)
      escolhidos.set(p.codigo, { codigo: p.codigo, descricao: p.descricao, preco: p.preco, quantidade: (atual?.quantidade ?? 0) + quantidade })
    }
    return [...escolhidos.values()]
  }
  const soma = (itens: ItemVenda[]) => itens.reduce((t, i) => t + i.preco * i.quantidade, 0)

  const fichas: FichaSemId[] = []

  for (let atras = DIAS - 1; atras >= 0; atras--) {
    const data = somarDias(hoje, -atras)
    const quantas = atras === 0 ? 8 : s.inteiro(3, 6)
    const minutos = Array.from({ length: quantas }, () => s.inteiro(8 * 60, 18 * 60)).sort((a, b) => a - b)
    for (const minuto of minutos) {
      // Mesmos sorteios em qualquer dia; só a ficha de hoje depois de "agora" é descartada.
      const identificado = s.chance(0.75)
      const cliente = s.um(clientes)
      const itens = itensSorteados()
      const bruto = soma(itens)
      const desconto = s.chance(0.08) ? Math.round((bruto * 0.05) / 10) * 10 : 0
      const total = bruto - desconto
      const sorteioForma = s.numero()
      const querFiado = s.chance(0.35)
      const sorteioPagamento = [s.numero(), s.numero(), s.numero(), s.inteiro(5, 40)] as const
      if (atras === 0 && minuto > minutoAtual) continue

      const clienteId = identificado ? cliente.id : null
      const ficha: FichaSemId = { clienteId, data, horario: horario(minuto), operador: OPERADOR, itens, desconto, total, forma: 'pix', pagamentos: [] }

      if (clienteId && fiado.has(clienteId) && querFiado) {
        ficha.forma = 'notinha'
        ficha.vencimento = somarDias(data, 30)
        let pago = 0
        if (sorteioPagamento[0] < 0.3) {
          const entrada = Math.round((total * 0.3) / 100) * 100
          ficha.pagamentos.push({ data, horario: ficha.horario, meio: sorteioPagamento[1] < 0.5 ? 'dinheiro' : 'pix', valor: entrada, entrada: true })
          pago = entrada
        }
        const venceu = diasEntre(hoje, ficha.vencimento) < 0
        const quitou = venceu ? sorteioPagamento[2] < 0.8 : sorteioPagamento[2] < 0.25
        if (quitou && pago < total) {
          const dia = somarDias(data, Math.min(sorteioPagamento[3], diasEntre(data, hoje)))
          ficha.pagamentos.push({ data: dia, horario: '10:30', meio: s.um<Meio>(['dinheiro', 'pix', 'cartao']), valor: total - pago })
        }
      } else {
        const meio: Meio = sorteioForma < 0.45 ? 'pix' : sorteioForma < 0.75 ? 'cartao' : 'dinheiro'
        ficha.forma = meio
        ficha.pagamentos.push({ data, horario: ficha.horario, meio, valor: total, rotulo: meio === 'cartao' ? s.um(ROTULOS_CARTAO) : undefined })
      }
      fichas.push(ficha)
    }
  }

  // Cenários garantidos, que as telas e os testes usam como referência.
  const cenario = (clienteId: string, atras: number, vencimento: number, entrada?: number): FichaSemId => {
    const itens = itensSorteados()
    const total = soma(itens)
    const data = somarDias(hoje, -atras)
    return {
      clienteId, data, horario: '11:15', operador: OPERADOR, itens, desconto: 0, total, forma: 'notinha',
      vencimento: somarDias(hoje, vencimento),
      pagamentos: entrada ? [{ data, horario: '11:15', meio: 'pix', valor: entrada, entrada: true }] : [],
    }
  }
  fichas.push(
    cenario('CLI-0104', 18, 12, 5000),
    cenario('CLI-0105', 10, 20),
    cenario('CLI-0106', 40, -10),
    cenario('CLI-0117', 50, -20),
    cenario('CLI-0117', 45, -15),
  )
  // Ana Beatriz é o exemplo de cliente sempre em dia: nenhuma notinha.
  for (const f of fichas) {
    if (f.clienteId === 'CLI-0107' && f.forma === 'notinha') {
      f.forma = 'pix'
      f.vencimento = undefined
      f.pagamentos = [{ data: f.data, horario: f.horario, meio: 'pix', valor: f.total }]
    }
  }

  fichas.sort((a, b) => `${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`))
  const comId: Ficha[] = fichas.map((f, indice) => ({ ...f, id: String(700 + indice).padStart(4, '0') }))

  return {
    versao: VERSAO_BASE,
    criadaEm: hoje,
    operador: OPERADOR,
    clientes,
    produtos,
    fichas: comId,
    movimentosCaixa: caixaManual(hoje, minutoAtual),
    movimentosEstoque: historicoEstoque(produtos, comId, hoje),
    rascunhosNota: comId.filter((f) => f.clienteId).slice(-2).map((f) => f.id).reverse(),
    rascunhoFicha: null,
  }
}

/** Lançamentos manuais recorrentes: fundo de troco, despesas, retiradas e avulsos. */
function caixaManual(hoje: string, minutoAtual: number): MovimentoCaixa[] {
  const lista: MovimentoCaixa[] = []
  for (let atras = DIAS - 1; atras >= 0; atras--) {
    const data = somarDias(hoje, -atras)
    const permitido = (minuto: number) => atras > 0 || minuto <= minutoAtual
    const add = (minuto: number, m: Omit<MovimentoCaixa, 'id' | 'data' | 'horario'>) => {
      if (permitido(minuto)) lista.push({ ...m, id: `${data}-${minuto}-${m.categoria}`, data, horario: horario(minuto) })
    }
    add(8 * 60 + 5, { descricao: 'Reposição do fundo de troco', origem: 'Troco inicial do balcão', categoria: 'Troco', meio: 'dinheiro', valor: -3500 })
    if (atras % 2 === 0) add(12 * 60 + 45, { descricao: 'Serviço de cópias e plastificação', origem: 'Recebimento sem ficha vinculada', categoria: 'Avulso', meio: 'pix', valor: 2600 })
    if (atras % 3 === 0) add(17 * 60 + 30, { descricao: 'Retirada de caixa para o cofre', origem: 'Fechamento de turno', categoria: 'Saída de caixa', meio: 'dinheiro', valor: -30000 })
    if (atras % 7 === 0) add(10 * 60 + 20, { descricao: 'Material de limpeza do balcão', origem: 'Comprovante no caixa físico', categoria: 'Despesa', meio: 'dinheiro', valor: -5000 })
  }
  return lista
}

/**
 * Estoque de trás para frente: parte do saldo atual e desfaz cada venda e cada
 * reposição, para antes/depois sempre encadearem até o saldo de hoje.
 */
function historicoEstoque(produtos: Produto[], fichas: Ficha[], hoje: string): MovimentoEstoque[] {
  type Evento = { quando: string; produto: Produto; tipo: 'Venda' | 'Entrada'; quantidade: number; motivo: string }
  const eventos: Evento[] = []
  for (const f of fichas) {
    for (const i of f.itens) {
      const produto = produtos.find((p) => p.codigo === i.codigo)!
      eventos.push({ quando: `${f.data}T${f.horario}`, produto, tipo: 'Venda', quantidade: i.quantidade, motivo: `Ficha #${f.id}` })
    }
  }
  for (const produto of produtos) {
    for (const atras of [75, 35]) {
      eventos.push({ quando: `${somarDias(hoje, -atras)}T07:50`, produto, tipo: 'Entrada', quantidade: produto.minimo * 3, motivo: 'Reposição de mercadorias' })
    }
  }
  eventos.sort((a, b) => b.quando.localeCompare(a.quando))

  const saldo = new Map(produtos.map((p) => [p.codigo, p.saldo]))
  const movimentos: MovimentoEstoque[] = []
  for (const e of eventos) {
    const depois = saldo.get(e.produto.codigo)!
    const antes = e.tipo === 'Venda' ? depois + e.quantidade : depois - e.quantidade
    if (antes < 0) continue // reposição que deixaria saldo negativo no passado não aconteceu
    saldo.set(e.produto.codigo, antes)
    movimentos.push({ id: `${e.quando}-${e.produto.codigo}-${e.tipo}-${movimentos.length}`, data: `${e.quando}:00`, produto: e.produto.codigo, descricao: e.produto.descricao, tipo: e.tipo, antes, depois, motivo: e.motivo })
  }
  return movimentos.sort((a, b) => b.data.localeCompare(a.data))
}
```

Rodar `npm test`. Esperado: PASSA. Se o teste "bate o saldo" falhar porque
duas vendas do mesmo produto têm o mesmo `data`, a ordenação dos movimentos com
`data` igual precisa desempatar pela ordem de criação: trocar o `sort` final por
um que preserve a ordem de `eventos` (já invertida) e reverter a lista no fim.

- [ ] **Passo 3: ponto de verificação** — `npx tsc --noEmit -p tsconfig.json` e `npm test`.

---

### Tarefa 3: Derivados — notinhas, clientes e fichas

**Arquivos:**
- Criar: `src/mock/base/derivados.ts`, `src/mock/base/derivados.test.ts`

**Interfaces:**
- Consome: tipos, datas, `criarSemente` (nos testes).
- Produz:

```ts
export type SituacaoNotinha = 'pago' | 'pendente' | 'vencido'
export type SituacaoCliente = 'em-dia' | 'pendente' | 'vencido'
export type Notinha = { ficha: Ficha; pago: number; emAberto: number; situacao: SituacaoNotinha; detalhe?: string }
export const ROTULO_SEM_IDENTIFICACAO = 'Não identificado'
export function nomeCliente(base: Base, clienteId: string | null): string
export function resumoItens(ficha: Ficha): string                 // "Caderno … (2x), Caneta … (3x)"
export function contagemItens(ficha: Ficha): string              // "2 tipos de itens · 5 unidades"
export function rotuloForma(ficha: Ficha): string                // "Pix", "Cartão crédito (2x)", "Notinha"
export function notinha(ficha: Ficha, hoje: string): Notinha | null
export function notinhasDoCliente(base: Base, clienteId: string, hoje: string): Notinha[]
export function situacaoDaFicha(ficha: Ficha, hoje: string): { situacao: SituacaoNotinha; detalhe?: string }
export function resumoDoCliente(base: Base, clienteId: string, hoje: string): {
  fichas: Ficha[]; totalComprado: number; ticketMedio: number; abertas: Notinha[]; emAberto: number
  situacao: SituacaoCliente; detalheSituacao?: string
}
export type Abatimento = { id: string; valor: number; quita: boolean }
export function distribuir(notinhas: Notinha[], valor: number): Abatimento[]
```

- [ ] **Passo 1: escrever o teste (falha, porque `derivados.ts` ainda não existe)**

`src/mock/base/derivados.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { criarSemente } from './semente'
import { distribuir, notinha, notinhasDoCliente, resumoDoCliente, resumoItens } from './derivados'
import type { Ficha } from './tipos'

const HOJE = '2026-09-25'
const base = criarSemente(HOJE, 15 * 60)

const fichaNotinha = (total: number, pagos: number[], vencimento: string): Ficha => ({
  id: 'X', clienteId: 'CLI-0104', data: '2026-09-01', horario: '10:00', operador: 'João Silva',
  itens: [{ codigo: 'EST-0021', descricao: 'Caderno', quantidade: 1, preco: total }], desconto: 0, total,
  forma: 'notinha', vencimento, pagamentos: pagos.map((valor) => ({ data: '2026-09-02', horario: '10:00', meio: 'pix' as const, valor })),
})

describe('notinha', () => {
  it('calcula aberto, situação e texto do prazo', () => {
    expect(notinha(fichaNotinha(10000, [3000], '2026-10-07'), HOJE)).toMatchObject({ pago: 3000, emAberto: 7000, situacao: 'pendente', detalhe: 'Vence em 12 dias · R$ 70,00 em aberto' })
    expect(notinha(fichaNotinha(10000, [], '2026-09-15'), HOJE)).toMatchObject({ situacao: 'vencido', detalhe: 'Venceu há 10 dias' })
    expect(notinha(fichaNotinha(10000, [4000, 6000], '2026-09-15'), HOJE)).toMatchObject({ situacao: 'pago', emAberto: 0, detalhe: 'Quitada em 02/09/2026' })
  })
  it('é nula para venda à vista', () => {
    expect(notinha(base.fichas.find((f) => f.forma === 'pix')!, HOJE)).toBeNull()
  })
})

describe('cliente', () => {
  it('Mariana está com notinha a vencer, visível no resumo', () => {
    const r = resumoDoCliente(base, 'CLI-0104', HOJE)
    expect(r.situacao).toBe('pendente')
    expect(r.abertas.some((n) => n.ficha.vencimento === '2026-10-07')).toBe(true)
    expect(r.detalheSituacao).toMatch(/notinha/)
  })
  it('atraso pesa mais que prazo', () => {
    expect(resumoDoCliente(base, 'CLI-0106', HOJE).situacao).toBe('vencido')
  })
  it('Ana Beatriz está em dia e o total bate com as fichas', () => {
    const r = resumoDoCliente(base, 'CLI-0107', HOJE)
    expect(r.situacao).toBe('em-dia')
    expect(r.totalComprado).toBe(r.fichas.reduce((t, f) => t + f.total, 0))
  })
  it('a lista de notinhas do cliente é a mesma que o resumo usa', () => {
    const abertas = notinhasDoCliente(base, 'CLI-0117', HOJE).filter((n) => n.emAberto > 0)
    expect(resumoDoCliente(base, 'CLI-0117', HOJE).abertas.map((n) => n.ficha.id)).toEqual(abertas.map((n) => n.ficha.id))
  })
})

describe('distribuir', () => {
  it('abate da mais antiga para a mais nova', () => {
    const antiga = { ...notinha(fichaNotinha(14500, [], '2026-09-10'), HOJE)!, ficha: { ...fichaNotinha(14500, [], '2026-09-10'), id: 'A', data: '2026-08-01' } }
    const nova = { ...notinha(fichaNotinha(10220, [], '2026-10-20'), HOJE)!, ficha: { ...fichaNotinha(10220, [], '2026-10-20'), id: 'B', data: '2026-09-20' } }
    expect(distribuir([nova, antiga], 20000)).toEqual([
      { id: 'A', valor: 14500, quita: true },
      { id: 'B', valor: 5500, quita: false },
    ])
  })
})

describe('itens', () => {
  it('resume os itens com quantidade', () => {
    expect(resumoItens(fichaNotinha(2490, [], HOJE))).toBe('Caderno (1x)')
  })
})
```

Rodar `npm test`. Esperado: FALHA ("Failed to resolve import './derivados'").

- [ ] **Passo 2: escrever a primeira metade de `derivados.ts`**

```ts
import { reais } from '../../formatar'
import { dataCurta } from '../../formatar'
import { diasEntre } from './datas'
import type { Base, Ficha } from './tipos'

/**
 * Tudo o que se calcula a partir da base. Funções puras: recebem a base e a
 * data de hoje e devolvem o que a tela mostra. Nenhuma guarda cópia.
 */

export type SituacaoNotinha = 'pago' | 'pendente' | 'vencido'
export type SituacaoCliente = 'em-dia' | 'pendente' | 'vencido'
export type Notinha = { ficha: Ficha; pago: number; emAberto: number; situacao: SituacaoNotinha; detalhe?: string }

export const ROTULO_SEM_IDENTIFICACAO = 'Não identificado'

export function nomeCliente(base: Base, clienteId: string | null) {
  if (!clienteId) return ROTULO_SEM_IDENTIFICACAO
  return base.clientes.find((c) => c.id === clienteId)?.nome ?? 'Cliente removido'
}

export function resumoItens(ficha: Ficha) {
  return ficha.itens.map((i) => `${i.descricao} (${i.quantidade}x)`).join(', ')
}

export function contagemItens(ficha: Ficha) {
  const unidades = ficha.itens.reduce((t, i) => t + i.quantidade, 0)
  return `${ficha.itens.length} ${ficha.itens.length === 1 ? 'tipo de item' : 'tipos de itens'} · ${unidades} ${unidades === 1 ? 'unidade' : 'unidades'}`
}

const NOME_MEIO = { dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Cartão' } as const

export function rotuloForma(ficha: Ficha) {
  if (ficha.forma === 'notinha') return 'Notinha'
  return ficha.pagamentos[0]?.rotulo ?? NOME_MEIO[ficha.forma]
}

function textoPrazo(vencimento: string, hoje: string) {
  const dias = diasEntre(hoje, vencimento)
  if (dias === 0) return 'Vence hoje'
  if (dias > 0) return `Vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`
  return `Venceu há ${-dias} ${dias === -1 ? 'dia' : 'dias'}`
}

export function notinha(ficha: Ficha, hoje: string): Notinha | null {
  if (ficha.forma !== 'notinha') return null
  const pago = ficha.pagamentos.reduce((t, p) => t + p.valor, 0)
  const emAberto = Math.max(0, ficha.total - pago)
  if (emAberto === 0) {
    const ultimo = ficha.pagamentos[ficha.pagamentos.length - 1]
    return { ficha, pago, emAberto, situacao: 'pago', detalhe: ultimo ? `Quitada em ${dataCurta(ultimo.data)}` : undefined }
  }
  const vencimento = ficha.vencimento ?? hoje
  const situacao: SituacaoNotinha = diasEntre(hoje, vencimento) < 0 ? 'vencido' : 'pendente'
  const partes = [textoPrazo(vencimento, hoje), pago > 0 ? `${reais(emAberto)} em aberto` : undefined]
  return { ficha, pago, emAberto, situacao, detalhe: partes.filter(Boolean).join(' · ') }
}

/** Situação de qualquer ficha: à vista é sempre paga. */
export function situacaoDaFicha(ficha: Ficha, hoje: string) {
  const n = notinha(ficha, hoje)
  return n ? { situacao: n.situacao, detalhe: n.detalhe } : { situacao: 'pago' as const, detalhe: undefined }
}

export function notinhasDoCliente(base: Base, clienteId: string, hoje: string) {
  return base.fichas
    .filter((f) => f.clienteId === clienteId)
    .map((f) => notinha(f, hoje))
    .filter((n): n is Notinha => n !== null)
}

export function resumoDoCliente(base: Base, clienteId: string, hoje: string) {
  const fichas = base.fichas.filter((f) => f.clienteId === clienteId).sort((a, b) => `${b.data} ${b.horario}`.localeCompare(`${a.data} ${a.horario}`))
  const totalComprado = fichas.reduce((t, f) => t + f.total, 0)
  const abertas = notinhasDoCliente(base, clienteId, hoje).filter((n) => n.emAberto > 0)
  const emAberto = abertas.reduce((t, n) => t + n.emAberto, 0)
  const situacao: SituacaoCliente = abertas.some((n) => n.situacao === 'vencido') ? 'vencido' : abertas.length ? 'pendente' : 'em-dia'
  return {
    fichas,
    totalComprado,
    ticketMedio: fichas.length ? Math.round(totalComprado / fichas.length) : 0,
    abertas,
    emAberto,
    situacao,
    detalheSituacao: abertas.length ? `${abertas.length} ${abertas.length === 1 ? 'notinha' : 'notinhas'} · ${reais(emAberto)}` : undefined,
  }
}

export type Abatimento = { id: string; valor: number; quita: boolean }

/** Divide um valor entre notinhas, da mais antiga para a mais nova. */
export function distribuir(notinhas: Notinha[], valor: number): Abatimento[] {
  let resto = valor
  return [...notinhas]
    .sort((a, b) => `${a.ficha.data} ${a.ficha.horario}`.localeCompare(`${b.ficha.data} ${b.ficha.horario}`) || a.ficha.id.localeCompare(b.ficha.id))
    .map((n) => {
      const abatido = Math.min(resto, n.emAberto)
      resto -= abatido
      return { id: n.ficha.id, valor: abatido, quita: abatido === n.emAberto }
    })
    .filter((a) => a.valor > 0)
}
```

Juntar os dois imports de `formatar` num só ao salvar.

Rodar `npm test`. Esperado: PASSA.

- [ ] **Passo 3: ponto de verificação** — `npx tsc --noEmit -p tsconfig.json` e `npm test`.

---

### Tarefa 4: Derivados — Financeiro, resumos, estoque, busca e sino

**Arquivos:**
- Modificar: `src/mock/base/derivados.ts` (acrescentar ao fim), `src/mock/base/derivados.test.ts` (acrescentar)

**Interfaces produzidas:**

```ts
export type LinhaFinanceiro = {
  id: string; data: string; horario: string; descricao: string; origem: string
  ficha?: string; categoria: string; meio: Meio; meioRotulo: string; valor: number
}
export function movimentosFinanceiro(base: Base): LinhaFinanceiro[]   // mais recente primeiro
export function resumoFinanceiro(linhas: LinhaFinanceiro[], periodo: Periodo, referencia: string): {
  entradas: number; saidas: number; quantidadeSaidas: number; liquido: number
  variacao?: { texto: string; direcao: 'alta' | 'baixa' }
  meioMaisUsado?: { meio: Meio; valor: number; participacao: number }
  contagem: Record<'todos' | Meio, number>
}
export function resumoDoDia(base: Base, dia: string): {
  recebimentos: number; variacao?: { texto: string; direcao: 'alta' | 'baixa' }
  vendas: number; ticketMedio: number; saidas: number; quantidadeSaidas: number
}
export function resumoEstoque(base: Base): { produtos: number; categorias: number; baixo: number; semCodigo: number }
export function buscar(base: Base, termo: string): { clientes: Cliente[]; fichas: Ficha[]; produtos: Produto[] }
export type Notificacao = { id: string; texto: string; destino: string }
export function notificacoes(base: Base, hoje: string): Notificacao[]
export function situacaoSaldo(produto: Produto): 'normal' | 'baixo' | 'zerado'
```

`notificacoes` devolve **rotas** como texto: passar as funções de `rotas-caminhos.ts`
importando-as em `derivados.ts` (o arquivo não tem React, então isso não cria
dependência de tela).

- [ ] **Passo 1: acrescentar os testes (falham, porque as funções ainda não existem)**

```ts
import { buscar, movimentosFinanceiro, notificacoes, resumoDoDia, resumoEstoque, resumoFinanceiro } from './derivados'

describe('financeiro', () => {
  const linhas = movimentosFinanceiro(base)
  it('tem uma entrada por pagamento, nenhuma a mais', () => {
    const pagamentos = base.fichas.flatMap((f) => f.pagamentos)
    expect(linhas.filter((l) => l.ficha).length).toBe(pagamentos.length)
    expect(linhas.filter((l) => l.ficha).reduce((t, l) => t + l.valor, 0)).toBe(pagamentos.reduce((t, p) => t + p.valor, 0))
  })
  it('notinha sem pagamento não entra no caixa', () => {
    const semPagamento = base.fichas.find((f) => f.forma === 'notinha' && f.pagamentos.length === 0)!
    expect(linhas.some((l) => l.ficha === semPagamento.id)).toBe(false)
  })
  it('resume o dia com entradas, saídas e contagem por meio', () => {
    const r = resumoFinanceiro(linhas, 'dia', HOJE)
    const doDia = linhas.filter((l) => l.data === HOJE)
    expect(r.entradas).toBe(doDia.filter((l) => l.valor > 0).reduce((t, l) => t + l.valor, 0))
    expect(r.contagem.todos).toBe(doDia.length)
    expect(r.liquido).toBe(r.entradas - r.saidas)
  })
})

describe('início', () => {
  it('conta as vendas e os recebimentos de hoje', () => {
    const r = resumoDoDia(base, HOJE)
    expect(r.vendas).toBe(base.fichas.filter((f) => f.data === HOJE).length)
    expect(r.recebimentos).toBe(base.fichas.flatMap((f) => f.pagamentos).filter((p) => p.data === HOJE).reduce((t, p) => t + p.valor, 0)
      + base.movimentosCaixa.filter((m) => m.data === HOJE && m.valor > 0).reduce((t, m) => t + m.valor, 0))
  })
})

describe('estoque, busca e sino', () => {
  it('conta o estoque pela lista real', () => {
    expect(resumoEstoque(base)).toMatchObject({ produtos: 16, baixo: 5, semCodigo: 2 })
  })
  it('acha cliente, ficha e produto', () => {
    const r = buscar(base, 'mariana')
    expect(r.clientes.map((c) => c.id)).toContain('CLI-0104')
    expect(r.fichas.every((f) => f.clienteId === 'CLI-0104' || f.clienteId === 'CLI-0111')).toBe(true)
    expect(buscar(base, '789102711').produtos[0].codigo).toBe('EST-0021')
  })
  it('avisa notinhas em atraso e estoque baixo', () => {
    const avisos = notificacoes(base, HOJE).map((n) => n.texto).join(' | ')
    expect(avisos).toMatch(/Associação Girassol/)
    expect(avisos).toMatch(/Carlos Eduardo Santos/)
    expect(avisos).toMatch(/estoque/i)
  })
})
```

"Mariana" também casa com "Mariano Souza Lima", daí o segundo id aceito na
busca. Os produtos com saldo baixo ou zerado na lista são EST-0022, EST-0025,
EST-0027, EST-0030 e EST-0032 (5). Os sem código são EST-0024 e EST-0031 (2).

- [ ] **Passo 2: acrescentar as funções a `derivados.ts`**

```ts
import { noPeriodo, periodoAnterior, type Periodo } from './datas'
import { rotas } from '../../rotas-caminhos'
import type { Cliente, Meio, Produto } from './tipos'

export type LinhaFinanceiro = {
  id: string; data: string; horario: string; descricao: string; origem: string
  ficha?: string; categoria: string; meio: Meio; meioRotulo: string; valor: number
}

/**
 * O Financeiro lê os pagamentos das fichas (um registro por dinheiro recebido)
 * e os lançamentos manuais. Notinha só aparece quando alguém paga.
 */
export function movimentosFinanceiro(base: Base): LinhaFinanceiro[] {
  const daVenda = base.fichas.flatMap((f) => f.pagamentos.map((p, indice) => {
    const descricao = f.forma !== 'notinha' ? `Venda da ficha #${f.id}` : p.entrada ? `Entrada da notinha #${f.id}` : `Recebimento da notinha #${f.id}`
    return {
      id: `${f.id}-${indice}`,
      data: p.data,
      horario: p.horario,
      descricao,
      origem: `Balcão · ${nomeCliente(base, f.clienteId)}`,
      ficha: f.id,
      categoria: f.forma === 'notinha' ? 'Recebimento de notinha' : 'Venda',
      meio: p.meio,
      meioRotulo: p.rotulo ?? NOME_MEIO[p.meio],
      valor: p.valor,
    }
  }))
  const manuais = base.movimentosCaixa.map((m) => ({ ...m, meioRotulo: NOME_MEIO[m.meio] }))
  return [...daVenda, ...manuais].sort((a, b) => `${b.data} ${b.horario}`.localeCompare(`${a.data} ${a.horario}`))
}

function variacaoPercentual(atual: number, anterior: number) {
  if (anterior === 0) return undefined
  const pct = ((atual - anterior) / anterior) * 100
  return { texto: `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%`, direcao: pct >= 0 ? 'alta' as const : 'baixa' as const }
}

export function resumoFinanceiro(linhas: LinhaFinanceiro[], periodo: Periodo, referencia: string) {
  const doPeriodo = linhas.filter((l) => noPeriodo(l.data, periodo, referencia))
  const anterior = periodoAnterior(periodo, referencia)
  const entradasDe = (ls: LinhaFinanceiro[]) => ls.filter((l) => l.valor > 0).reduce((t, l) => t + l.valor, 0)
  const entradas = entradasDe(doPeriodo)
  const saidasLista = doPeriodo.filter((l) => l.valor < 0)
  const saidas = saidasLista.reduce((t, l) => t - l.valor, 0)
  const porMeio = (['pix', 'cartao', 'dinheiro'] as const).map((meio) => ({ meio, valor: doPeriodo.filter((l) => l.valor > 0 && l.meio === meio).reduce((t, l) => t + l.valor, 0) }))
  const maior = [...porMeio].sort((a, b) => b.valor - a.valor)[0]
  return {
    entradas,
    saidas,
    quantidadeSaidas: saidasLista.length,
    liquido: entradas - saidas,
    variacao: variacaoPercentual(entradas, entradasDe(linhas.filter((l) => noPeriodo(l.data, periodo, anterior)))),
    meioMaisUsado: maior && maior.valor > 0 ? { ...maior, participacao: Math.round((maior.valor / entradas) * 100) } : undefined,
    contagem: {
      todos: doPeriodo.length,
      pix: doPeriodo.filter((l) => l.meio === 'pix').length,
      cartao: doPeriodo.filter((l) => l.meio === 'cartao').length,
      dinheiro: doPeriodo.filter((l) => l.meio === 'dinheiro').length,
    },
  }
}

export function resumoDoDia(base: Base, dia: string) {
  const linhas = movimentosFinanceiro(base)
  const r = resumoFinanceiro(linhas, 'dia', dia)
  const vendas = base.fichas.filter((f) => f.data === dia)
  const totalVendido = vendas.reduce((t, f) => t + f.total, 0)
  return {
    recebimentos: r.entradas,
    variacao: r.variacao,
    vendas: vendas.length,
    ticketMedio: vendas.length ? Math.round(totalVendido / vendas.length) : 0,
    saidas: r.saidas,
    quantidadeSaidas: r.quantidadeSaidas,
  }
}

export function situacaoSaldo(produto: Produto) {
  if (produto.saldo === 0) return 'zerado' as const
  return produto.saldo < produto.minimo ? 'baixo' as const : 'normal' as const
}

export function resumoEstoque(base: Base) {
  return {
    produtos: base.produtos.length,
    categorias: new Set(base.produtos.map((p) => p.categoria)).size,
    baixo: base.produtos.filter((p) => situacaoSaldo(p) !== 'normal').length,
    semCodigo: base.produtos.filter((p) => !p.codigoBarras).length,
  }
}

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR')
}

export function buscar(base: Base, termo: string): { clientes: Cliente[]; fichas: Ficha[]; produtos: Produto[] } {
  const t = normalizar(termo.trim())
  if (!t) return { clientes: [], fichas: [], produtos: [] }
  const casa = (texto: string) => normalizar(texto).includes(t)
  return {
    clientes: base.clientes.filter((c) => casa(`${c.id} ${c.nome} ${c.documento} ${c.telefone}`)),
    fichas: base.fichas
      .filter((f) => casa(`${f.id} ${nomeCliente(base, f.clienteId)} ${resumoItens(f)}`))
      .sort((a, b) => `${b.data} ${b.horario}`.localeCompare(`${a.data} ${a.horario}`))
      .slice(0, 30),
    produtos: base.produtos.filter((p) => casa(`${p.codigo} ${p.codigoBarras ?? ''} ${p.descricao} ${p.categoria}`)),
  }
}

export type Notificacao = { id: string; texto: string; destino: string }

export function notificacoes(base: Base, hoje: string): Notificacao[] {
  const avisos: Notificacao[] = base.clientes
    .map((c) => ({ c, r: resumoDoCliente(base, c.id, hoje) }))
    .filter(({ r }) => r.situacao === 'vencido')
    .map(({ c, r }) => ({
      id: `atraso-${c.id}`,
      texto: `${c.nome}: ${r.abertas.filter((n) => n.situacao === 'vencido').length} notinha(s) em atraso · ${reais(r.emAberto)}`,
      destino: rotas.cliente(c.id),
    }))
  const baixos = base.produtos.filter((p) => situacaoSaldo(p) !== 'normal').length
  if (baixos) avisos.push({ id: 'estoque', texto: `${baixos} produtos com estoque baixo ou zerado`, destino: rotas.estoque })
  return avisos
}
```

Reorganizar os imports no topo do arquivo, um por módulo.

Rodar `npm test`. Esperado: PASSA.

- [ ] **Passo 3: ponto de verificação** — `npx tsc --noEmit -p tsconfig.json` e `npm test`.

---

### Tarefa 5: Store e ações sobre a base

**Arquivos:**
- Reescrever: `src/mock/estado-demonstracao.ts`
- Criar: `src/mock/estado-demonstracao.test.ts`

**Interfaces:**
- Consome: tudo das Tarefas 1 a 4.
- Produz (as telas usam só isto):

```ts
export function useEstadoDemonstracao(): Base
export function cadastrarCliente(dados: { nome: string; documento: string; telefone: string; email: string; endereco: string }): string
export function editarCliente(id: string, dados: { nome: string; documento: string; telefone: string; email: string; endereco: string }): void
export function cadastrarProduto(dados: Omit<Produto, 'codigo'>): string
export function alterarSaldo(codigo: string, depois: number, motivo: string, tipo: 'Entrada' | 'Ajuste'): boolean
export function registrarMovimentoCaixa(dados: Omit<MovimentoCaixa, 'id'>): void
export function concluirFicha(dados: Omit<Ficha, 'id' | 'operador'>): string
export function receberNotinhas(ids: string[], pagamento: { data: string; horario: string; meio: Meio; valor: number }): Abatimento[]
export function salvarRascunhoFicha(rascunho: RascunhoFicha | null): void
export function prepararRascunho(id: string): void
export function restaurarDemonstracao(hoje?: string, minutoAtual?: number): void
export function proximoNumeroFicha(base: Base): string
export * from './base/derivados'
export * from './base/datas'
export type * from './base/tipos'
```

- [ ] **Passo 1: escrever o teste (falha, porque as novas assinaturas ainda não existem)**

`src/mock/estado-demonstracao.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import {
  concluirFicha, movimentosFinanceiro, notinhasDoCliente, proximoNumeroFicha, receberNotinhas,
  resumoDoCliente, restaurarDemonstracao, useEstadoDemonstracao,
} from './estado-demonstracao'
import { obterBase } from './estado-demonstracao'

const HOJE = '2026-09-25'
beforeEach(() => restaurarDemonstracao(HOJE, 15 * 60))

describe('concluirFicha', () => {
  it('guarda a ficha, dá baixa no estoque e numera em sequência', () => {
    const antes = obterBase()
    const numero = proximoNumeroFicha(antes)
    const caderno = antes.produtos.find((p) => p.codigo === 'EST-0021')!
    const id = concluirFicha({
      clienteId: 'CLI-0107', data: HOJE, horario: '15:00', desconto: 0, total: 4980, forma: 'pix',
      itens: [{ codigo: 'EST-0021', descricao: caderno.descricao, quantidade: 2, preco: 2490 }],
      pagamentos: [{ data: HOJE, horario: '15:00', meio: 'pix', valor: 4980 }],
    })
    const depois = obterBase()
    expect(id).toBe(numero)
    expect(depois.produtos.find((p) => p.codigo === 'EST-0021')!.saldo).toBe(caderno.saldo - 2)
    expect(depois.movimentosEstoque[0]).toMatchObject({ tipo: 'Venda', produto: 'EST-0021', antes: caderno.saldo, depois: caderno.saldo - 2 })
    expect(movimentosFinanceiro(depois).some((l) => l.ficha === id && l.valor === 4980)).toBe(true)
  })
})

describe('receberNotinhas', () => {
  it('quita a mais antiga, abate da seguinte e muda a situação do cliente', () => {
    const base = obterBase()
    const abertas = notinhasDoCliente(base, 'CLI-0117', HOJE).filter((n) => n.emAberto > 0)
    const total = abertas.reduce((t, n) => t + n.emAberto, 0)
    receberNotinhas(abertas.map((n) => n.ficha.id), { data: HOJE, horario: '15:00', meio: 'dinheiro', valor: total })
    expect(resumoDoCliente(obterBase(), 'CLI-0117', HOJE).situacao).toBe('em-dia')
    const recebidos = movimentosFinanceiro(obterBase()).filter((l) => l.data === HOJE && l.categoria === 'Recebimento de notinha' && abertas.some((n) => n.ficha.id === l.ficha))
    expect(recebidos.reduce((t, l) => t + l.valor, 0)).toBe(total)
  })
})

it('useEstadoDemonstracao é exportado', () => {
  expect(typeof useEstadoDemonstracao).toBe('function')
})
```

`obterBase()` é exportado só para teste e para ações fora do React (um getter do
módulo).

Rodar `npm test`. Esperado: FALHA (exports inexistentes).

- [ ] **Passo 2: reescrever `estado-demonstracao.ts`**

```ts
import { useSyncExternalStore } from 'react'
import { distribuir, notinha, type Abatimento } from './base/derivados'
import { hojeISO, minutoDoDia } from './base/datas'
import { apagarBase, carregarBase, salvarBase } from './base/persistencia'
import { criarSemente } from './base/semente'
import type { Base, Ficha, Meio, MovimentoCaixa, MovimentoEstoque, Produto, RascunhoFicha } from './base/tipos'

export * from './base/derivados'
export * from './base/datas'
export type * from './base/tipos'

/**
 * A base local da demonstração: uma só, gravada no localStorage, lida por todas
 * as telas. Some quando o banco de verdade entrar (via window.api e contrato).
 */
let base: Base = carregarBase() ?? criarSemente(hojeISO(), minutoDoDia())
salvarBase(base)

const ouvintes = new Set<() => void>()
const inscrever = (ouvinte: () => void) => {
  ouvintes.add(ouvinte)
  return () => ouvintes.delete(ouvinte)
}

export const obterBase = () => base

function mudar(proxima: Base) {
  base = proxima
  salvarBase(base)
  ouvintes.forEach((o) => o())
}

export function useEstadoDemonstracao() {
  return useSyncExternalStore(inscrever, obterBase)
}

export function restaurarDemonstracao(hoje = hojeISO(), minutoAtual = minutoDoDia()) {
  apagarBase()
  mudar(criarSemente(hoje, minutoAtual))
}

const proximoId = (ids: string[], prefixo: string) =>
  `${prefixo}${String(Math.max(0, ...ids.map((id) => Number(id.slice(prefixo.length)) || 0)) + 1).padStart(4, '0')}`

export function proximoNumeroFicha(atual: Base) {
  return String(Math.max(0, ...atual.fichas.map((f) => Number(f.id))) + 1).padStart(4, '0')
}

export function cadastrarCliente(dados: { nome: string; documento: string; telefone: string; email: string; endereco: string }) {
  const id = proximoId(base.clientes.map((c) => c.id), 'CLI-')
  mudar({ ...base, clientes: [...base.clientes, { ...dados, id, descricao: 'Cadastro novo', desde: hojeISO() }] })
  return id
}

export function editarCliente(id: string, dados: { nome: string; documento: string; telefone: string; email: string; endereco: string }) {
  mudar({ ...base, clientes: base.clientes.map((c) => (c.id === id ? { ...c, ...dados } : c)) })
}

export function cadastrarProduto(dados: Omit<Produto, 'codigo'>) {
  const codigo = proximoId(base.produtos.map((p) => p.codigo), 'EST-')
  mudar({ ...base, produtos: [...base.produtos, { ...dados, codigo }] })
  return codigo
}

function movimentoEstoque(produto: Produto, depois: number, tipo: MovimentoEstoque['tipo'], motivo: string): MovimentoEstoque {
  const data = new Date().toISOString()
  return { id: `${data}-${produto.codigo}-${tipo}`, data, produto: produto.codigo, descricao: produto.descricao, tipo, antes: produto.saldo, depois, motivo }
}

export function alterarSaldo(codigo: string, depois: number, motivo: string, tipo: 'Entrada' | 'Ajuste') {
  const produto = base.produtos.find((p) => p.codigo === codigo)
  if (!produto || !Number.isInteger(depois) || depois < 0) return false
  mudar({
    ...base,
    produtos: base.produtos.map((p) => (p.codigo === codigo ? { ...p, saldo: depois } : p)),
    movimentosEstoque: [movimentoEstoque(produto, depois, tipo, motivo), ...base.movimentosEstoque],
  })
  return true
}

export function registrarMovimentoCaixa(dados: Omit<MovimentoCaixa, 'id'>) {
  mudar({ ...base, movimentosCaixa: [{ ...dados, id: `${dados.data}-${dados.horario}-${base.movimentosCaixa.length}` }, ...base.movimentosCaixa] })
}

/** Venda concluída: guarda a ficha e dá baixa no estoque; o saldo para em zero. */
export function concluirFicha(dados: Omit<Ficha, 'id' | 'operador'>) {
  const id = proximoNumeroFicha(base)
  const movimentos: MovimentoEstoque[] = []
  const produtos = base.produtos.map((p) => {
    const vendido = dados.itens.find((i) => i.codigo === p.codigo)
    if (!vendido) return p
    const depois = Math.max(0, p.saldo - vendido.quantidade)
    movimentos.push(movimentoEstoque(p, depois, 'Venda', `Ficha #${id}${p.saldo < vendido.quantidade ? ' · saldo do sistema menor que o vendido' : ''}`))
    return { ...p, saldo: depois }
  })
  mudar({
    ...base,
    fichas: [...base.fichas, { ...dados, id, operador: base.operador }],
    produtos,
    movimentosEstoque: [...movimentos, ...base.movimentosEstoque],
    rascunhoFicha: null,
  })
  return id
}

/** Recebe uma ou várias notinhas; cada uma ganha o pagamento que lhe coube. */
export function receberNotinhas(ids: string[], pagamento: { data: string; horario: string; meio: Meio; valor: number }): Abatimento[] {
  const abertas = base.fichas
    .filter((f) => ids.includes(f.id))
    .map((f) => notinha(f, pagamento.data))
    .filter((n) => n !== null && n.emAberto > 0) as NonNullable<ReturnType<typeof notinha>>[]
  const abatimentos = distribuir(abertas, pagamento.valor)
  if (!abatimentos.length) return []
  mudar({
    ...base,
    fichas: base.fichas.map((f) => {
      const a = abatimentos.find((item) => item.id === f.id)
      return a ? { ...f, pagamentos: [...f.pagamentos, { data: pagamento.data, horario: pagamento.horario, meio: pagamento.meio, valor: a.valor }] } : f
    }),
  })
  return abatimentos
}

export function salvarRascunhoFicha(rascunho: RascunhoFicha | null) {
  mudar({ ...base, rascunhoFicha: rascunho })
}

export function prepararRascunho(id: string) {
  if (!base.rascunhosNota.includes(id)) mudar({ ...base, rascunhosNota: [id, ...base.rascunhosNota] })
}
```

Rodar `npm test`. Esperado: PASSA. `npx tsc` vai acusar erros **nas telas**: é
esperado, e as Tarefas 6 a 10 resolvem.

- [ ] **Passo 3: ponto de verificação** — `npm test` passa. A lista de erros do
  `tsc` passa a ser o roteiro das próximas tarefas.

---

### Tarefa 6: Venda — Início, Nova ficha e Detalhe da ficha

**Arquivos:**
- Modificar: `src/telas/inicio/Inicio.tsx`, `src/telas/inicio/dados-exemplo.ts` (fica só `MeioPagamento`, ou é apagado)
- Modificar: `src/telas/criar-ficha/CriarFicha.tsx`, `cliente/ClienteFicha.tsx`, `cliente/ModalNovoCliente.tsx`, `itens/ItensFicha.tsx`, `pagamento/PagamentoFicha.tsx`, `criar-ficha/dados-exemplo.ts`
- Modificar: `src/telas/detalhe-ficha/DetalheFicha.tsx`; apagar os dados de `detalhe-ficha/dados-exemplo.ts`

**Interfaces:** consome `useEstadoDemonstracao`, `resumoDoDia`, `nomeCliente`,
`resumoItens`, `contagemItens`, `rotuloForma`, `situacaoDaFicha`, `notinha`,
`concluirFicha`, `proximoNumeroFicha`, `hojeISO`, `agoraHorario`, `dataPorExtenso`.

- [ ] **Passo 1: Início lê a base**
  - Subtítulo: `${dataPorExtenso(hojeISO())} · movimentação de vendas`.
  - Cartões: `const dia = resumoDoDia(base, hojeISO())`, com Recebimentos =
    `dia.recebimentos` (variação "vs ontem" = `dia.variacao`, escondida quando
    `undefined`), Vendas concluídas = `${dia.vendas} fichas` e média
    `dia.ticketMedio`, Saídas = `dia.saidas` com `${dia.quantidadeSaidas} saídas registradas`.
  - Histórico: `base.fichas` em ordem decrescente de `data` e `horario`. Colunas:
    cliente = `nomeCliente(base, f.clienteId)` (link para o cliente ou para vendas
    sem identificação), itens = `resumoItens(f)`, pagamento =
    `rotuloForma(f)` com o ícone de `f.forma` (`notinha` → `calendario`).
  - Filtro de pagamento compara com `f.forma` (`'notinha'` no lugar de `'futuro'`).
  - O `SeletorData` usa `dataInicial={hojeISO()}`.
- [ ] **Passo 2: Nova ficha**
  - Cabeçalho: `Ficha #${proximoNumeroFicha(base)} · aberta hoje, ${agoraHorario()} · operador ${base.operador}`
    (horário fixado num `useState` na abertura).
  - Itens começam vazios (D4). `ItensFicha` monta o item a partir de `base.produtos`
    (sai o `catalogo`). O item guarda `codigo` para a baixa de estoque.
  - `ClienteFicha` busca em `base.clientes` (sai `clientesCadastrados`).
    `ModalNovoCliente` chama `cadastrarCliente({ nome, documento, telefone, email: '', endereco })`.
  - Ao concluir:

```ts
const data = hojeISO()
const horario = agoraHorario()
const pagamentos: Pagamento[] = notinhaEscolhida
  ? entradaNaNotinha > 0 ? [{ data, horario, meio: meioEntrada, valor: entradaNaNotinha, entrada: true }] : []
  : [{ data, horario, meio: forma as Meio, valor: total }]
const id = concluirFicha({
  clienteId: cliente && cliente !== semIdentificacao ? cliente.id : null,
  data, horario, desconto, total, forma: notinhaEscolhida ? 'notinha' : forma as Meio,
  itens: itens.map((i) => ({ codigo: i.codigo, descricao: i.descricao, quantidade: i.quantidade, preco: i.preco })),
  pagamentos, vencimento: notinhaEscolhida ? vencimento : undefined,
})
```

  - Somem as chamadas manuais a `registrarMovimentoCaixa`: o Financeiro deriva a
    entrada do pagamento (D1).
  - `FormaPagamento` passa a usar `'notinha'` em vez de `'futuro'` (renomear em
    `criar-ficha/dados-exemplo.ts`, `PagamentoFicha.tsx` e `CriarFicha.tsx`).
  - Rascunho: `salvarRascunhoFicha` com o formato `RascunhoFicha` da base (ids e
    quantidades). Ao retomar, os itens são remontados por `codigo` a partir de
    `base.produtos`.
- [ ] **Passo 3: Detalhe da ficha**
  - `const ficha = base.fichas.find((f) => f.id === id)`. Somem `buscarFichaExemplo`
    e a divergência por `origem`; `origem` só decide o botão Voltar.
  - "Itens principais" vira uma tabela curta (produto, quantidade, preço, total)
    montada de `ficha.itens`, com desconto e total no rodapé.
  - Pagamento = `rotuloForma(ficha)`, situação = `situacaoDaFicha(ficha, hojeISO())`,
    e o bloco da notinha usa `notinha(ficha, hojeISO())`.
- [ ] **Passo 4: verificar no navegador** (`preview_start` em `http://localhost:5173`):
  - o Início mostra as vendas de hoje, e os cartões batem com a soma da tabela
    filtrada por hoje;
  - concluir uma venda Pix de 2 cadernos faz a ficha aparecer no topo do
    Início, o saldo do caderno cair 2 no Estoque e a entrada aparecer no Financeiro;
  - recarregar a página mantém a venda (localStorage).
- [ ] **Passo 5: ponto de verificação** — `npx tsc` sem erros nestes arquivos e `npm test`.

---

### Tarefa 7: Clientes, detalhe, formulário, vendas sem identificação e janela de recebimento

**Arquivos:**
- Modificar: `src/telas/clientes/Clientes.tsx`, `clientes/dados-exemplo.ts` (fica só `SituacaoCompras`, que vira `SituacaoCliente` da base)
- Modificar: `src/telas/detalhe-cliente/DetalheCliente.tsx`, `receber/ReceberNotinhas.tsx`; apagar `detalhe-cliente/dados-exemplo.ts`
- Modificar: `src/telas/formulario-cliente/FormularioCliente.tsx`, `src/telas/vendas-sem-identificacao/VendasSemIdentificacao.tsx`

**Interfaces:** consome `resumoDoCliente`, `notinhasDoCliente`, `receberNotinhas`,
`distribuir`, `nomeCliente`, `resumoItens`, `contagemItens`, `rotuloForma`,
`situacaoDaFicha`, `cadastrarCliente`, `editarCliente`.

- [ ] **Passo 1: lista de Clientes**
  - Linha: `const r = resumoDoCliente(base, c.id, hoje)`. Compras = `r.fichas.length`,
    situação = `r.situacao`, detalhe = `r.detalheSituacao`, descrição = `c.descricao`.
  - Cartões e filtros contam clientes com `r.situacao === 'pendente'` e `'vencido'`;
    "Clientes cadastrados" = `base.clientes.length`. Somem `totais` e `contagemClientesExemplo`.
  - Expansão "compras recentes": `r.fichas.slice(0, 3)` com selo pela
    `situacaoDaFicha` (hoje o selo é sempre "Pago"). "Total acumulado" = `r.totalComprado`.
  - Calcular `resumoDoCliente` uma vez por cliente num `useMemo([base])`, para
    busca e filtro não recalcularem tudo a cada tecla.
- [ ] **Passo 2: detalhe do cliente**
  - Cadastro: documento, telefone, e-mail e endereço vêm de `Cliente`. O subtítulo
    fica `${c.id} · ${c.descricao} · cliente desde ${mês/ano de c.desde}`.
  - Cartões: Total comprado = `r.totalComprado` (nota `${r.fichas.length} compras`),
    Notinhas em aberto = `r.emAberto`, Ticket médio = `r.ticketMedio`.
  - Histórico = `r.fichas` → `{ id, data: dataCurta(f.data), hora: f.horario, itens: resumoItens(f), resumoItens: contagemItens(f), pagamento: rotuloForma(f), valor: f.total, ...situacaoDaFicha(f, hoje) }`.
    Somem `compras`, `historicoDisponivel`, `vendasDaSessao`, `fichasDaAmostra` e o aviso
    "histórico detalhado ainda não foi incluído".
  - Seleção e "Receber" continuam iguais, com ids de `r.abertas`.
- [ ] **Passo 3: janela Receber notinha**
  - Troca `notinhasDoCliente(estado, clienteId)` antigo pelo novo
    (`notinhasDoCliente(base, clienteId, hoje)`), `n.id` → `n.ficha.id`,
    `n.data` → `dataCurta(n.ficha.data)`, `n.valor` → `n.ficha.total`, `n.ordem` → `n.ficha.data`.
  - Confirmar chama `receberNotinhas(ids, { data, horario, meio, valor })`.
  - A nota da forma de pagamento passa a valer para todos os meios:
    "Entram R$ X no Financeiro em DD/MM/AAAA como recebimento de notinha." (D1).
- [ ] **Passo 4: formulário e vendas sem identificação**
  - `FormularioCliente` lê e grava `Cliente` (e-mail e endereço sempre presentes;
    nada de `dadosClientes`).
  - `VendasSemIdentificacao` usa `base.fichas.filter((f) => f.clienteId === null)`;
    o meio vem de `f.forma` (nunca `notinha`).
- [ ] **Passo 5: verificar no navegador**
  - Mariana: lista mostra "Notinhas a vencer · 1 notinha · R$ …"; o detalhe mostra a
    mesma notinha, com vencimento em 12 dias e entrada de R$ 50,00; a janela de
    recebimento abre com o mesmo valor em aberto.
  - Receber tudo da Associação Girassol muda o selo para "Em dia" na lista, tira o
    aviso do sino e acrescenta as entradas no Financeiro de hoje.
- [ ] **Passo 6: ponto de verificação.**

---

### Tarefa 8: Financeiro e registro de movimento

**Arquivos:**
- Modificar: `src/telas/financeiro/Financeiro.tsx`, `financeiro/dados-exemplo.ts` (fica só `Meio`, reexportado da base), `src/telas/registrar-movimento/RegistrarMovimento.tsx`

- [ ] **Passo 1: períodos reais**
  - `const linhas = movimentosFinanceiro(base)`, `const r = resumoFinanceiro(linhas, periodo, hojeISO())`.
  - Lista = `linhas.filter((l) => noPeriodo(l.data, periodo, hojeISO()))` e depois o filtro de meio.
  - Cartões: Entradas, Saídas (`${r.quantidadeSaidas} saídas no período`), Entradas
    menos saídas (variação vs período anterior), Meio mais usado
    (`${r.meioMaisUsado.participacao}% do volume · ${reais(valor)}`).
  - Somem `periodo !== 'dia'` e os avisos "Ainda não há dados de exemplo para…".
  - Subtítulo: `Data base: ${dataPorExtenso(hojeISO())}`. Rótulo "Líquido do dia"
    → "Líquido do período".
  - Etiqueta da ficha continua; linhas com `ficha` ganham link para `rotas.ficha(id)`.
- [ ] **Passo 2: registrar movimento**
  - `registrarMovimentoCaixa({ data: hojeISO(), horario: agoraHorario(), descricao, origem, categoria, meio, valor })`, sem `meioRotulo`.
- [ ] **Passo 3: verificar no navegador** — Dia, Semana, Mês e Ano mostram números
  diferentes e coerentes (Semana ≥ Dia, Mês ≥ Semana no mesmo mês); o total de
  Entradas do Dia bate com o cartão "Recebimentos do dia" do Início.
- [ ] **Passo 4: ponto de verificação.**

---

### Tarefa 9: Estoque

**Arquivos:**
- Modificar: `src/telas/estoque/Estoque.tsx`, `estoque/dados-exemplo.ts` (ficam `grupos` e o reexport de `situacaoSaldo`/`Produto`/`Grupo` da base)
- Modificar: `src/telas/movimentacoes-estoque/MovimentacoesEstoque.tsx`, `ajustar-estoque/AjustarEstoque.tsx`, `registrar-entrada/RegistrarEntrada.tsx`, `registrar-entrada/dados-exemplo.ts`, `cadastrar-produto/CadastrarProduto.tsx`, `cadastrar-produto/dados-exemplo.ts`

- [ ] **Passo 1:** cartões e contagens do Estoque vêm de `resumoEstoque(base)`; somem
  `totais`, `novosProdutos` e as somas de compensação.
- [ ] **Passo 2:** Movimentações já lê `base.movimentosEstoque`, com o filtro "Vendas".
  O motivo `Ficha #1043` vira link para a ficha.
- [ ] **Passo 3:** Registrar entrada abre com os produtos em estoque baixo ou zerado
  (`base.produtos.filter((p) => situacaoSaldo(p) !== 'normal')`), com `saldoAtual`
  vindo da base. O custo sugerido sai do protótipo (`itensIniciais`) quando
  existir para o código; senão fica vazio. A data padrão é `hojeISO()`.
- [ ] **Passo 4:** Cadastrar produto sugere o próximo código a partir da base
  (sai `proximoCodigo = 'EST-0028'`, que colide com um produto existente).
- [ ] **Passo 5: verificar no navegador** — o cartão "Estoque baixo" é igual ao
  número de linhas no filtro "Estoque baixo"; uma entrada de 10 canetas tira a
  caneta desse filtro e aparece em Movimentações.
- [ ] **Passo 6: ponto de verificação.**

---

### Tarefa 10: Notas fiscais, busca e sino

**Arquivos:**
- Modificar: `src/telas/notas-fiscais/NotasFiscais.tsx`, `notas-fiscais/dados-exemplo.ts` (fica só o documento de fornecedor), `rascunhos-notas/RascunhosNotas.tsx`, `detalhe-fiscal/DetalheFiscal.tsx`
- Modificar: `src/telas/resultados-busca/ResultadosBusca.tsx`, `src/componentes/layout/tela/Tela.tsx`

- [ ] **Passo 1: notas**
  - Rascunhos = `base.rascunhosNota` mapeados para as fichas (cliente por
    `nomeCliente`, data por `dataCurta`, valor por `f.total`).
  - Destaque = o rascunho mais recente; se não houver nenhum, o painel diz "Nenhum
    rascunho em revisão" e aponta para a nova ficha.
  - Documentos: saídas = rascunhos; entrada = o documento de fornecedor de exemplo.
  - `DetalheFiscal` monta o rascunho a partir da ficha da base, com a tabela de itens.
- [ ] **Passo 2: busca** — `buscar(base, termo)`, com três grupos (Clientes, Fichas,
  Produtos). A seção "Compras do histórico" some (era duplicata). A ficha mostra
  `dataCurta(f.data) · reais(f.total) · rotuloForma(f) · resumoItens(f)`.
- [ ] **Passo 3: sino** — `notificacoes(base, hojeISO())`, uma linha por aviso,
  cada uma com link para `destino`. Sem avisos: "Nenhuma pendência". Um número no
  ícone do sino quando houver avisos (`tela__notificacoes-contagem`, CSS com tokens).
- [ ] **Passo 4: verificar no navegador** — buscar "mariana" traz a cliente e as
  fichas dela; o sino lista Associação Girassol e Carlos Eduardo; receber as
  notinhas do Carlos tira a linha dele do sino.
- [ ] **Passo 5: ponto de verificação.**

---

### Tarefa 11: Restaurar dados, limpeza e documentação

**Arquivos:**
- Modificar: `src/componentes/layout/barra-lateral/BarraLateral.tsx` (+ `.css`)
- Modificar: `Memoria.md`, `AGENTS.md`

- [ ] **Passo 1: restaurar (D3)** — o operador no rodapé da barra lateral vira um
  botão que abre um `Modal estreito` "Restaurar dados de exemplo": "Apaga as vendas,
  clientes e ajustes feitos nesta máquina e volta à amostra de 90 dias até hoje."
  Botões Cancelar e "Restaurar" (primário). Confirmar chama `restaurarDemonstracao()`
  e navega para `rotas.inicio`. Na barra recolhida, o ícone do operador faz o mesmo.
- [ ] **Passo 2: limpeza** — `rg "dados-exemplo" src` só pode achar constantes de tela
  (grupos, categorias, unidades, semIdentificacao, documento de fornecedor).
  `rg "Stitch|protótipo" src` não pode achar comentário que ainda diga que os dados
  "podem divergir entre telas". Apagar arquivos que ficaram vazios.
- [ ] **Passo 3: documentação**
  - `Memoria.md`: a decisão (base única em `src/mock/base/`, fatos contra
    derivados, localStorage, semente relativa a hoje, D1 a D5) e a atualização do
    "Estado atual". Tirar de "Como retomar" a frase "Divergência de dados de exemplo
    entre telas NÃO é para corrigir agora".
  - `AGENTS.md`: na árvore de `src/`, acrescentar `mock/base/` e a regra "tela não
    guarda dado próprio; lê `useEstadoDemonstracao()` e os derivados; fato novo vai
    em `tipos.ts` e na semente".
  - Memória do projeto (auto-memória): atualizar `fase-visual-sem-dados`, que deixou
    de valer.
- [ ] **Passo 4: verificação final**
  - `npm test` e `npm run build` passam.
  - No navegador, percorrer as telas: Início → nova ficha (notinha com entrada
    para a Mariana) → detalhe da Mariana (a notinha nova e a de cenário aparecem)
    → receber as duas → Financeiro (as entradas de hoje) → Estoque (saldo e
    movimentos) → sino → busca → Restaurar (volta ao estado inicial) → recarregar
    (continua).
  - Console sem erros; sem rolagem na coluna direita da ficha em 1920×1030.
  - `npm run dev` e abrir o Electron: os dados aparecem iguais e persistem ao
    fechar e reabrir a janela.

---

## Autorrevisão

- **Cobertura do pedido:** notinha pendente coerente entre as telas (Tarefas 3, 5 e 7),
  busca (4 e 10), filtros (6 a 9), pendências e sino (4 e 10), Financeiro (4 e 8),
  registro local persistente (1 e 5), novos dados de exemplo (2).
- **Nomes conferidos entre tarefas:** `notinha()`, `notinhasDoCliente(base, id, hoje)`,
  `resumoDoCliente`, `distribuir`, `movimentosFinanceiro`, `resumoFinanceiro`,
  `resumoDoDia`, `resumoEstoque`, `buscar`, `notificacoes`, `concluirFicha(dados)`,
  `receberNotinhas(ids, pagamento)`, `restaurarDemonstracao(hoje?, minuto?)`,
  `proximoNumeroFicha(base)`, `obterBase()`.
- **Risco conhecido:** `derivados.ts` importa `rotas-caminhos.ts` só por causa do sino.
  Se isso incomodar a fronteira mock/tela, `notificacoes` pode devolver
  `{ tipo, clienteId }`, e o `Tela.tsx` monta a rota.
