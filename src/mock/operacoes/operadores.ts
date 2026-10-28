/**
 * As operações dos operadores sobre a base da demonstração (1.0, tela 1;
 * `R-OPERADOR-*`). É o lado "mock" dos testes de contrato e, até a Fase 3, o
 * que responde no app (`src/dados/api.ts`): a base da demonstração é a fonte
 * da verdade enquanto as outras telas não migram.
 *
 * As regras são as de `comum/regras/operador.ts`, as mesmas do SQLite.
 */
import { falha, ok, type Contrato, type Operador, type Resultado } from '../../../comum/contrato'
import { conferirAssinatura, conferirNome, conferirPinNovo, criarTentativas, MENSAGENS, textoLimpo } from '../../../comum/regras/operador'
import type { OperadorBase } from '../base/tipos'
import { gravarOperadores, obterBase } from '../estado-demonstracao'

export type OperacoesOperador = Pick<Contrato, 'listarOperadores' | 'cadastrarAdministradora' | 'cadastrarOperador' | 'renomearOperador' | 'ativarOperador' | 'redefinirPin'>

async function sha256(texto: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function hashDoPin(pin: string) {
  const sal = crypto.randomUUID()
  return `sha256$${sal}$${await sha256(`${sal}:${pin}`)}`
}

async function pinConfere(pin: string, hash: string | null) {
  const [tipo, sal, guardado] = hash?.split('$') ?? []
  return tipo === 'sha256' && Boolean(sal) && (await sha256(`${sal}:${pin}`)) === guardado
}

const paraOperador = ({ id, nome, ativo, admin, pinHash }: OperadorBase): Operador => ({ id, nome, ativo, admin, temPin: pinHash !== null })

/** Como o `collate nocase` do SQLite: só as letras sem acento ignoram a caixa. */
const chaveDoNome = (nome: string) => nome.replace(/[A-Z]/g, (letra) => letra.toLowerCase())
const nomeEmUso = (nome: string, menos?: string) =>
  obterBase().operadores.some((o) => o.id !== menos && chaveDoNome(o.nome) === chaveDoNome(nome))

const ordem = (a: OperadorBase, b: OperadorBase) => {
  const [x, y] = [chaveDoNome(a.nome), chaveDoNome(b.nome)]
  return Number(b.admin) - Number(a.admin) || (x < y ? -1 : x > y ? 1 : 0)
}

export function criarOperadoresDaBase(tentativas = criarTentativas()): OperacoesOperador {
  const buscar = (id: string) => obterBase().operadores.find((o) => o.id === id) ?? null

  const assinadoPelaDona = (dona: Parameters<OperacoesOperador['cadastrarOperador']>[2]) =>
    conferirAssinatura(dona, (id) => {
      const o = buscar(id)
      return o && { ativo: o.ativo, admin: o.admin, temPin: o.pinHash !== null, confere: (pin: string) => pinConfere(pin, o.pinHash) }
    }, tentativas, { soAdmin: true })

  function mudar(id: unknown, mudanca: Partial<OperadorBase>): Resultado<Operador> {
    const alvo = typeof id === 'string' ? buscar(id) : null
    if (!alvo) return falha('nao-encontrado', MENSAGENS.naoEncontrado)
    if (mudanca.nome !== undefined && nomeEmUso(mudanca.nome, alvo.id)) return falha('validacao', MENSAGENS.nomeRepetido)
    if (mudanca.ativo === false && alvo.admin) return falha('validacao', MENSAGENS.adminAtiva)
    const novo = { ...alvo, ...mudanca }
    gravarOperadores(obterBase().operadores.map((o) => (o.id === alvo.id ? novo : o)))
    return ok(paraOperador(novo))
  }

  async function incluir(nome: string, pin: string, admin: boolean): Promise<Resultado<Operador>> {
    const limpo = textoLimpo(nome)
    if (nomeEmUso(limpo)) return falha('validacao', MENSAGENS.nomeRepetido)
    const novo: OperadorBase = { id: crypto.randomUUID(), nome: limpo, ativo: true, admin, pinHash: await hashDoPin(pin) }
    gravarOperadores([...obterBase().operadores, novo])
    return ok(paraOperador(novo))
  }

  return {
    async listarOperadores() {
      const pessoas = [...obterBase().operadores].sort(ordem).map(paraOperador)
      const ultimo = obterBase().ultimoOperadorId
      return ok({ pessoas, ultimoId: pessoas.some((p) => p.id === ultimo && p.ativo && p.temPin) ? ultimo : null })
    },

    async cadastrarAdministradora(nome, pin) {
      const problema = conferirNome(nome) ?? conferirPinNovo(pin)
      if (problema) return problema
      if (obterBase().operadores.some((o) => o.admin)) return falha('conflito', MENSAGENS.adminJaExiste)
      return incluir(nome, pin, true)
    },

    async cadastrarOperador(nome, pin, dona) {
      const problema = conferirNome(nome) ?? conferirPinNovo(pin) ?? await assinadoPelaDona(dona)
      return problema ?? incluir(nome, pin, false)
    },

    async renomearOperador(id, nome, dona) {
      const problema = conferirNome(nome) ?? await assinadoPelaDona(dona)
      return problema ?? mudar(id, { nome: textoLimpo(nome) })
    },

    async ativarOperador(id, ativo, dona) {
      if (typeof ativo !== 'boolean') return falha('validacao', 'Pedido inválido.')
      const problema = await assinadoPelaDona(dona)
      return problema ?? mudar(id, { ativo })
    },

    async redefinirPin(id, pin, dona) {
      const problema = conferirPinNovo(pin) ?? await assinadoPelaDona(dona)
      if (problema) return problema
      const resultado = mudar(id, { pinHash: await hashDoPin(pin) })
      if (resultado.ok) tentativas.acertou(resultado.dado.id)
      return resultado
    },
  }
}

/** A instância do app: uma só, para a espera depois de 5 erros valer entre as janelas. */
export const operadoresDaBase = criarOperadoresDaBase()
