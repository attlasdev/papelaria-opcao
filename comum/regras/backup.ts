/**
 * O login da loja e o estado do backup (`R-LOGIN-01`; plano da 1.0, Fase 3.5),
 * uma vez só para o mock e o Electron. Funções puras: cada lado diz o que sabe
 * (o registro desta máquina e se há sessão agora) e a resposta sai daqui.
 */
import { ok, type Aviso, type Contrato, type EstadoBackup } from '../contrato'

/** O que esta máquina guarda sobre o backup. Instantes em ISO 8601, UTC. */
export type RegistroBackup = {
  /** O primeiro login que deu certo nesta máquina; `null`: nunca entrou. */
  entrouEm: string | null
  /** A última cópia que subiu para a nuvem. */
  ultimaCopiaEm: string | null
  /** A primeira mudança no banco que ainda não subiu; `null`: nada esperando. */
  pendenteDesde: string | null
}

export const REGISTRO_VAZIO: RegistroBackup = { entrouEm: null, ultimaCopiaEm: null, pendenteDesde: null }

/** O normal é subir a cada 5 minutos; mudança esperando há mais que isto é cópia parada. */
export const LIMITE_COPIA_PARADA_MS = 60 * 60 * 1000

const instante = (valor: unknown) => (typeof valor === 'string' && !Number.isNaN(Date.parse(valor)) ? valor : null)

/** O registro lido do disco; o que não for instante vira `null` (arquivo velho ou mexido). */
export function registroDe(bruto: unknown): RegistroBackup {
  const r = bruto && typeof bruto === 'object' ? (bruto as Record<string, unknown>) : {}
  return { entrouEm: instante(r.entrouEm), ultimaCopiaEm: instante(r.ultimaCopiaEm), pendenteDesde: instante(r.pendenteDesde) }
}

/**
 * - **Pede o login** só se esta máquina nunca entrou e não há sessão: depois
 *   do primeiro login, perder a sessão não para a loja.
 * - **Cópia parada:** sem sessão (nada sobe), ou com mudança esperando há mais
 *   de 1 hora. Conta da mudança, não da última cópia: depois de horas sem
 *   mexer, a primeira gravação não é atraso.
 */
export function estadoDoBackup(registro: RegistroBackup, sessao: boolean, agora: Date): EstadoBackup {
  const esperando = registro.pendenteDesde ? agora.getTime() - Date.parse(registro.pendenteDesde) : 0
  return {
    sessao,
    precisaEntrar: !sessao && !registro.entrouEm,
    ultimaCopiaEm: registro.ultimaCopiaEm,
    pendenteDesde: registro.pendenteDesde,
    parada: !sessao || esperando > LIMITE_COPIA_PARADA_MS,
  }
}

export const ID_AVISO_BACKUP = 'copia-parada'

/**
 * O aviso do sino quando a cópia está parada. Nunca conta como lido: só some
 * quando a cópia volta a subir.
 */
export function avisoDoBackup(estado: EstadoBackup): Aviso | null {
  if (!estado.parada) return null
  return {
    id: ID_AVISO_BACKUP, tipo: 'copia-parada', tom: 'critico', titulo: 'Cópia na nuvem parada',
    detalhe: estado.sessao
      ? 'As mudanças não sobem há mais de 1 hora. Confira a internet; se continuar, entre de novo.'
      : 'O login da loja saiu. Entre de novo para a cópia voltar a subir.',
    destino: { tela: 'entrar' },
    lido: false,
  }
}

/** O sino com o aviso do backup na frente (é o mais grave: sem cópia, perder o disco perde a loja). */
export function comAvisoDoBackup(avisos: Aviso[], estado: EstadoBackup): Aviso[] {
  const aviso = avisoDoBackup(estado)
  const outros = avisos.filter((a) => a.id !== ID_AVISO_BACKUP)
  return aviso ? [aviso, ...outros] : outros
}

/** O que cada lado (mock, Electron) sabe; o resto sai daqui. */
export type FonteDoBackup = {
  registro: () => RegistroBackup
  /** Sem como saber (app sem configuração, erro ao ler a sessão): sem sessão. */
  temSessao: () => Promise<boolean>
}

type OperacoesDoBackup = Pick<Contrato, 'obterEstadoBackup' | 'listarAvisos' | 'marcarAvisosLidos'>

/** `obterEstadoBackup` e o sino com o aviso do backup por cima dos avisos da loja. */
export function operacoesDoBackup(fonte: FonteDoBackup, avisos: Pick<Contrato, 'listarAvisos' | 'marcarAvisosLidos'>): OperacoesDoBackup {
  const estado = async () => estadoDoBackup(fonte.registro(), await fonte.temSessao().catch(() => false), new Date())
  return {
    obterEstadoBackup: async () => ok(await estado()),
    async listarAvisos() {
      const r = await avisos.listarAvisos()
      return r.ok ? ok(comAvisoDoBackup(r.dado, await estado())) : r
    },
    // O id da cópia parada não existe nos avisos da loja: marcar ignora, e ele volta não lido.
    async marcarAvisosLidos(ids) {
      const r = await avisos.marcarAvisosLidos(ids)
      return r.ok ? ok(comAvisoDoBackup(r.dado, await estado())) : r
    },
  }
}
