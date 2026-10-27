/**
 * As migrations do banco, em ordem. A versão de cada uma é a posição na lista
 * e vai para o `user_version` do arquivo. Migration aplicada na loja nunca
 * muda: correção é a migration seguinte. E nenhuma estreia na máquina da loja
 * (CLAUDE.md, regra 8).
 */
import inicial from './migracoes/0001-inicial.sql?raw'

export type Migracao = { versao: number; nome: string; sql: string }

export const migracoes: readonly Migracao[] = [
  { versao: 1, nome: 'inicial', sql: inicial },
]
