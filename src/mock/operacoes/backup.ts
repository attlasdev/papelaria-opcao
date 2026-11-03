/**
 * O backup no mock (Fase 3.5; `R-LOGIN-01`). Não há cópia de verdade: a loja
 * do mock já entrou e a última cópia é a de quando a página abriu. Sair do
 * login deixa a cópia parada, com o aviso no sino; entrar de novo resolve. As
 * regras são as de `comum/regras/backup.ts`, as mesmas do Electron.
 */
import { operacoesDoBackup, type RegistroBackup } from '../../../comum/regras/backup'
import { criarAvisosDaBase } from './avisos'

export type EstadoDoBackupMock = { sessao: boolean; registro: RegistroBackup }

const abertura = new Date().toISOString()
export const backupDoMock: EstadoDoBackupMock = { sessao: true, registro: { entrouEm: abertura, ultimaCopiaEm: abertura, pendenteDesde: null } }

export function criarBackupDaBase(estado: EstadoDoBackupMock = backupDoMock) {
  return operacoesDoBackup({
    registro: () => estado.registro,
    temSessao: async () => estado.sessao,
    marcarEntrada: () => { estado.registro = { ...estado.registro, entrouEm: new Date().toISOString() } },
  }, criarAvisosDaBase())
}

export const backupDaBase = criarBackupDaBase()
