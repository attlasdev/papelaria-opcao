/**
 * As migrations do banco, em ordem. A versão de cada uma é a posição na lista
 * e vai para o `user_version` do arquivo. Migration aplicada na loja nunca
 * muda: correção é a migration seguinte. E nenhuma estreia na máquina da loja
 * (CLAUDE.md, regra 8).
 */
import inicial from './migracoes/0001-inicial.sql?raw'
import operadorPin from './migracoes/0002-operador-pin.sql?raw'
import conferenciaAjuste from './migracoes/0003-conferencia-ajuste.sql?raw'
import conferenciaCancelamento from './migracoes/0004-conferencia-cancelamento.sql?raw'
import conferenciaEstorno from './migracoes/0005-conferencia-estorno.sql?raw'
import conferenciaFechamento from './migracoes/0006-conferencia-fechamento.sql?raw'
import conferenciaLancamento from './migracoes/0007-conferencia-lancamento.sql?raw'

export type Migracao = { versao: number; nome: string; sql: string }

export const migracoes: readonly Migracao[] = [
  { versao: 1, nome: 'inicial', sql: inicial },
  { versao: 2, nome: 'operador-pin', sql: operadorPin },
  { versao: 3, nome: 'conferencia-ajuste', sql: conferenciaAjuste },
  { versao: 4, nome: 'conferencia-cancelamento', sql: conferenciaCancelamento },
  { versao: 5, nome: 'conferencia-estorno', sql: conferenciaEstorno },
  { versao: 6, nome: 'conferencia-fechamento', sql: conferenciaFechamento },
  { versao: 7, nome: 'conferencia-lancamento', sql: conferenciaLancamento },
]
