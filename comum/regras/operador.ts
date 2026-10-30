/**
 * As regras dos operadores (Memoria.md, "Operadores e login", `R-OPERADOR-*`),
 * uma vez só para os dois lados que implementam o contrato: o mock (a base da
 * demonstração) e o SQLite. Funções puras; quem guarda e confere o hash é cada
 * lado.
 */
import { falha, type Assinatura, type Falha } from '../contrato'

export const LIMITE_ERROS = 5
export const ESPERA_MS = 30_000

export const MENSAGENS = {
  pinFormato: 'O PIN tem 4 números.',
  pinErrado: 'PIN não confere.',
  nomeVazio: 'Informe o nome.',
  nomeRepetido: 'Já existe uma pessoa com este nome.',
  semPin: 'Esta pessoa ainda não tem PIN. A administradora precisa definir um.',
  inativo: 'Esta pessoa está desativada.',
  naoEncontrado: 'Pessoa não encontrada.',
  soAdmin: 'Só a administradora pode fazer isto.',
  adminJaExiste: 'A administradora já está cadastrada.',
  adminAtiva: 'A administradora não pode ser desativada.',
  semDona: 'Este gesto precisa também do PIN da administradora.',
  espera: (segundos: number) => `Muitas tentativas erradas. Espere ${segundos} segundos e tente de novo.`,
}

/** O dado chega pela IPC sem garantia de tipo. */
export const textoLimpo = (valor: unknown) => (typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : '')

/** `R-OPERADOR-01`: exatamente 4 números. */
export const pinValido = (pin: unknown): pin is string => typeof pin === 'string' && /^\d{4}$/.test(pin)

export function conferirNome(nome: unknown): Falha | null {
  const limpo = textoLimpo(nome)
  if (!limpo) return falha('validacao', MENSAGENS.nomeVazio)
  if (limpo.length > 60) return falha('validacao', 'Nome longo demais (até 60 letras).')
  return null
}

export const conferirPinNovo = (pin: unknown): Falha | null => (pinValido(pin) ? null : falha('validacao', MENSAGENS.pinFormato))

/**
 * `R-OPERADOR-04`: 5 PINs errados seguidos para a mesma pessoa, 30 s de espera.
 * Fica na memória do processo: fechar o app zera, o que é aceitável (abrir de
 * novo leva mais que 30 s).
 */
export function criarTentativas(agora: () => number = Date.now) {
  const erros = new Map<string, { seguidos: number; ate: number }>()
  return {
    /** Mensagem de espera, se a pessoa ainda estiver bloqueada. */
    bloqueio(id: string): string | null {
      const ate = erros.get(id)?.ate ?? 0
      const falta = ate - agora()
      return falta > 0 ? MENSAGENS.espera(Math.ceil(falta / 1000)) : null
    },
    errou(id: string) {
      const seguidos = (erros.get(id)?.seguidos ?? 0) + 1
      if (seguidos >= LIMITE_ERROS) erros.set(id, { seguidos: 0, ate: agora() + ESPERA_MS })
      else erros.set(id, { seguidos, ate: 0 })
    },
    acertou(id: string) { erros.delete(id) },
  }
}

export type Tentativas = ReturnType<typeof criarTentativas>

/** O que cada lado sabe dizer de uma pessoa para conferir a assinatura. */
export type PessoaParaConferir = { ativo: boolean; admin: boolean; temPin: boolean; confere: (pin: string) => Promise<boolean> | boolean }

/**
 * Confere quem está fazendo (`R-OPERADOR-02`, `03`, `04`, `07`): a pessoa
 * existe, está ativa, tem PIN, não está na espera, e o PIN bate. `soAdmin`
 * para os gestos que só a dona faz.
 */
export async function conferirAssinatura(
  assinatura: Assinatura | undefined,
  buscar: (id: string) => PessoaParaConferir | null,
  tentativas: Tentativas,
  { soAdmin = false } = {},
): Promise<Falha | null> {
  const id = typeof assinatura?.operadorId === 'string' ? assinatura.operadorId : ''
  const pessoa = id ? buscar(id) : null
  if (!pessoa) return falha('nao-encontrado', MENSAGENS.naoEncontrado)
  if (soAdmin && !pessoa.admin) return falha('permissao', MENSAGENS.soAdmin)
  if (!pessoa.ativo) return falha('validacao', MENSAGENS.inativo)
  if (!pessoa.temPin) return falha('validacao', MENSAGENS.semPin)
  const espera = tentativas.bloqueio(id)
  if (espera) return falha('validacao', espera)
  const pin = assinatura?.pin
  if (!pinValido(pin) || !(await pessoa.confere(pin))) {
    tentativas.errou(id)
    return falha('validacao', tentativas.bloqueio(id) ?? MENSAGENS.pinErrado)
  }
  tentativas.acertou(id)
  return null
}

/**
 * Gesto sensível (`R-OPERADOR-06`): quem faz assina, e a dona autoriza com o PIN
 * dela. Se quem faz é a dona, um PIN basta e `autorizadoPor` fica vazio. As
 * falhas da autorização dizem que são da administradora, para a tela não
 * confundir com o PIN de quem faz. `conferir` é a conferência de cada lado.
 */
export async function autorizar<P extends { id: string; admin: boolean }>(
  conferir: (assinatura: Assinatura | null | undefined, opcoes?: { soAdmin?: boolean }) => Promise<P | Falha>,
  quem: Assinatura | null | undefined,
  dona: Assinatura | null | undefined,
): Promise<Falha | { quem: P; autorizadoPor: P | null }> {
  const pessoa = await conferir(quem)
  if ('ok' in pessoa) return pessoa
  if (pessoa.admin) return { quem: pessoa, autorizadoPor: null }
  if (!dona) return falha('validacao', MENSAGENS.semDona)
  const autorizou = await conferir(dona, { soAdmin: true })
  if ('ok' in autorizou) return autorizou.causa === 'permissao' ? autorizou : { ...autorizou, erro: `Administradora: ${autorizou.erro}` }
  return { quem: pessoa, autorizadoPor: autorizou }
}
