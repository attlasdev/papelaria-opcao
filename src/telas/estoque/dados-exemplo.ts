import type { Grupo } from '../../mock/estado-demonstracao'

export type { Grupo, Produto, SituacaoSaldo } from '../../mock/estado-demonstracao'
export { situacaoSaldo } from '../../mock/estado-demonstracao'

export const grupos: { valor: Grupo; rotulo: string }[] = [
  { valor: 'papeis', rotulo: 'Papéis e sulfite' },
  { valor: 'escrita', rotulo: 'Escrita e canetas' },
  { valor: 'cadernos', rotulo: 'Cadernos e agendas' },
  { valor: 'escritorio', rotulo: 'Escritório e arquivo' },
  { valor: 'artes', rotulo: 'Artes e escolar' },
]
