/**
 * O registro do backup desta máquina (`R-LOGIN-01`; Fase 3.5): quando a loja
 * entrou pela primeira vez, a última cópia que subiu e a mudança que espera.
 * Fica em `estado-backup.json` na pasta de dados, fora do banco: a cópia do
 * banco não pode carregar o próprio estado da cópia.
 *
 * Grava num temporário e troca de nome: queda de luz no meio não deixa meio
 * arquivo. Arquivo faltando ou estragado vale como vazio.
 */
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { REGISTRO_VAZIO, registroDe, type RegistroBackup } from '../../comum/regras/backup'
import { log } from '../log'

export type Registro = {
  ler(): RegistroBackup
  atualizar(mudanca: Partial<RegistroBackup>): RegistroBackup
}

export function criarRegistro(arquivo: string): Registro {
  let atual: RegistroBackup | null = null
  const ler = () => {
    if (atual) return atual
    try { atual = registroDe(JSON.parse(readFileSync(arquivo, 'utf8'))) }
    catch { atual = { ...REGISTRO_VAZIO } }
    return atual
  }
  return {
    ler,
    atualizar(mudanca) {
      const proximo = { ...ler(), ...mudanca }
      try {
        writeFileSync(`${arquivo}.gravando`, JSON.stringify(proximo, null, 2))
        renameSync(`${arquivo}.gravando`, arquivo)
      } catch (erro) {
        // Fica na memória: a próxima mudança tenta gravar de novo.
        log.aviso('backup', 'não consegui gravar o registro do backup:', erro)
      }
      atual = proximo
      return proximo
    },
  }
}
