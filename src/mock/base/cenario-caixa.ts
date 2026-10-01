import { diaDoInstante, somarDias } from './datas'
import { CATEGORIA_ADICAO_CAIXA, CATEGORIA_RETIRADA_CAIXA } from './derivados'
import type { Base, MovimentoCaixa, TurnoCaixa } from './tipos'

/** Exemplos da prévia local, sem substituir lançamentos ou a conferência atual. */
export function comFechamentosExemplo(base: Base, hoje: string): Base {
  if (base.turnosCaixa?.some((turno) => turno.id.startsWith('exemplo-caixa-'))) return base
  const aberto = base.turnosCaixa?.find((turno) => !turno.fechadoEm)
  const referencia = aberto && diaDoInstante(aberto.abertoEm) < hoje ? diaDoInstante(aberto.abertoEm) : hoje
  const turnos: TurnoCaixa[] = []
  const movimentos: MovimentoCaixa[] = []
  const cenarios = [
    { atras: 1, adicionado: 15000, retirado: 4000, diferenca: 0 },
    { atras: 2, adicionado: 10000, retirado: 4000, diferenca: -1000 },
    { atras: 3, adicionado: 8000, retirado: 3000, diferenca: 0 },
    { atras: 12, adicionado: 5000, retirado: 2000, diferenca: 0 },
  ]
  for (const cenario of cenarios) {
    const data = somarDias(referencia, -cenario.atras)
    // Não sobrepor conferências já registradas pela pessoa que está testando.
    if (base.turnosCaixa?.some((turno) => data >= diaDoInstante(turno.abertoEm) && data <= diaDoInstante(turno.fechadoEm ?? `${hoje}T12:00:00-03:00`))) continue
    const id = `exemplo-caixa-${data}`
    const instante = (horario: string) => new Date(`${data}T${horario}:00-03:00`).toISOString()
    const esperado = 10000 + cenario.adicionado - cenario.retirado
    turnos.push({ id, abertoEm: instante('08:00'), fechadoEm: instante('18:00'), operadorAbertura: base.operador, operadorFechamento: base.operador, fundoInicial: 10000, esperadoFechamento: esperado, contadoFechamento: esperado + cenario.diferenca, ...(cenario.diferenca ? { justificativaDiferenca: 'Exemplo: troco entregue sem registro.' } : {}) })
    movimentos.push(
      { id: `${id}-adicao`, data, horario: '09:00', registradoEm: instante('09:00'), turnoCaixaId: id, operador: base.operador, descricao: 'Exemplo: dinheiro do cofre para reforçar o troco', origem: 'Cenário de demonstração', categoria: CATEGORIA_ADICAO_CAIXA, meio: 'dinheiro', valor: cenario.adicionado },
      { id: `${id}-retirada`, data, horario: '17:00', registradoEm: instante('17:00'), turnoCaixaId: id, operador: base.operador, descricao: 'Exemplo: dinheiro guardado no cofre', origem: 'Cenário de demonstração', categoria: CATEGORIA_RETIRADA_CAIXA, meio: 'dinheiro', valor: -cenario.retirado },
    )
  }
  return { ...base, turnosCaixa: [...(base.turnosCaixa ?? []), ...turnos], movimentosCaixa: [...base.movimentosCaixa, ...movimentos] }
}
