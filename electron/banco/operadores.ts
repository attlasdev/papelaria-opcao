/**
 * As operações dos operadores no banco da 1.0 (tela 1; `R-OPERADOR-*`). As
 * regras estão em `comum/regras/operador.ts`, as mesmas do mock; aqui fica o
 * que é do banco: o hash do PIN e as restrições que o schema garante.
 *
 * Recebe o banco por função: no app ele só abre na primeira chamada.
 */
import { falha, ok, type Contrato, type Operador, type Resultado } from '../../comum/contrato'
import { conferirAssinatura, conferirNome, conferirPinNovo, criarTentativas, MENSAGENS, textoLimpo, type Tentativas } from '../../comum/regras/operador'
import { transacao, type Banco } from './banco'
import { hashDoPin, pinConfere } from './pin'

type OperacoesOperador = Pick<Contrato, 'listarOperadores' | 'cadastrarAdministradora' | 'cadastrarOperador' | 'renomearOperador' | 'ativarOperador' | 'redefinirPin'>

type Linha = { id: string; nome: string; ativo: number; admin: number; pin_hash: string | null }

const paraOperador = (l: Linha): Operador => ({ id: l.id, nome: l.nome, ativo: l.ativo === 1, admin: l.admin === 1, temPin: l.pin_hash !== null })

/** Restrição do banco virada em mensagem para a tela; o resto segue como exceção. */
function traduzir<T>(fazer: () => Resultado<T>): Resultado<T> {
  try {
    return fazer()
  } catch (erro) {
    const texto = String(erro)
    if (/UNIQUE constraint failed: operador\.nome/.test(texto)) return falha('validacao', MENSAGENS.nomeRepetido)
    if (/administradora nao pode ser desativada/.test(texto)) return falha('validacao', MENSAGENS.adminAtiva)
    throw erro
  }
}

export function operadoresSqlite(banco: () => Banco, tentativas: Tentativas = criarTentativas()): OperacoesOperador {
  const buscar = (id: string) =>
    (banco().prepare('select id, nome, ativo, admin, pin_hash from operador where id = ?').get(id) as Linha | undefined) ?? null

  const assinadoPelaDona = (dona: Parameters<OperacoesOperador['cadastrarOperador']>[2]) =>
    conferirAssinatura(dona, (id) => {
      const l = buscar(id)
      return l && { ativo: l.ativo === 1, admin: l.admin === 1, temPin: l.pin_hash !== null, confere: (pin: string) => pinConfere(pin, l.pin_hash) }
    }, tentativas, { soAdmin: true })

  /** Depois da assinatura: a pessoa alvo existe, e a mudança volta como ela ficou. */
  const mudar = (id: unknown, sql: string, ...valores: (string | number)[]): Resultado<Operador> => traduzir(() => {
    const alvo = typeof id === 'string' ? buscar(id) : null
    if (!alvo) return falha('nao-encontrado', MENSAGENS.naoEncontrado)
    banco().prepare(sql).run(...valores, alvo.id)
    return ok(paraOperador(buscar(alvo.id)!))
  })

  return {
    async listarOperadores() {
      const pessoas = (banco().prepare('select id, nome, ativo, admin, pin_hash from operador order by admin desc, nome').all() as Linha[]).map(paraOperador)
      const preferencia = banco().prepare("select valor from preferencia where chave = 'operador_atual'").get() as { valor: string } | undefined
      const ultimo = preferencia ? JSON.parse(preferencia.valor) : null
      const ultimoId = pessoas.some((p) => p.id === ultimo && p.ativo && p.temPin) ? ultimo as string : null
      return ok({ pessoas, ultimoId })
    },

    async cadastrarAdministradora(nome, pin) {
      const problema = conferirNome(nome) ?? conferirPinNovo(pin)
      if (problema) return problema
      return traduzir(() => transacao(banco(), () => {
        if (banco().prepare('select 1 from operador where admin = 1').get()) return falha('conflito', MENSAGENS.adminJaExiste)
        const id = crypto.randomUUID()
        banco().prepare('insert into operador (id, nome, admin, pin_hash, criado_em) values (?, ?, 1, ?, ?)')
          .run(id, textoLimpo(nome), hashDoPin(pin), new Date().toISOString())
        return ok(paraOperador(buscar(id)!))
      }))
    },

    async cadastrarOperador(nome, pin, dona) {
      const problema = conferirNome(nome) ?? conferirPinNovo(pin) ?? await assinadoPelaDona(dona)
      if (problema) return problema
      return traduzir(() => {
        const id = crypto.randomUUID()
        banco().prepare('insert into operador (id, nome, pin_hash, criado_em) values (?, ?, ?, ?)')
          .run(id, textoLimpo(nome), hashDoPin(pin), new Date().toISOString())
        return ok(paraOperador(buscar(id)!))
      })
    },

    async renomearOperador(id, nome, dona) {
      const problema = conferirNome(nome) ?? await assinadoPelaDona(dona)
      if (problema) return problema
      return mudar(id, 'update operador set nome = ? where id = ?', textoLimpo(nome))
    },

    async ativarOperador(id, ativo, dona) {
      if (typeof ativo !== 'boolean') return falha('validacao', 'Pedido inválido.')
      const problema = await assinadoPelaDona(dona)
      if (problema) return problema
      return mudar(id, 'update operador set ativo = ? where id = ?', ativo ? 1 : 0)
    },

    async redefinirPin(id, pin, dona) {
      const problema = conferirPinNovo(pin) ?? await assinadoPelaDona(dona)
      if (problema) return problema
      const resultado = mudar(id, 'update operador set pin_hash = ? where id = ?', hashDoPin(pin))
      if (resultado.ok) tentativas.acertou(resultado.dado.id)
      return resultado
    },
  }
}
