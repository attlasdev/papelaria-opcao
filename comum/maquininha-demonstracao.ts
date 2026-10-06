import { falha, ok, type Cobranca, type MeioCobranca, type Resultado, type SituacaoCobranca } from './contrato'

/**
 * A maquininha de DEMONSTRACAO do piloto 0.1 (Memoria.md, `2026-10-06`).
 *
 * Imita o que a prova real contra o Mercado Pago (credencial de teste e
 * maquininha virtual SBX0000001) mostrou: a cobranca leva um instante para
 * chegar a maquininha, so existe uma aberta por vez, termina aprovada,
 * recusada, cancelada ou expirada. Aqui o "cliente paga" sozinho depois de
 * alguns segundos; `simular` antecipa o fim (aprovada ou recusada).
 *
 * Fica em `comum/` porque as duas implementacoes do contrato a usam: o
 * processo principal (app instalado) e o mock (navegador). Sem rede, sem
 * credencial, sem estado fora da memoria. Na 1.0 o processo principal troca
 * isto pelo cliente da Orders API; a tela nao muda.
 */

type Fim = { situacao: Extract<SituacaoCobranca, 'aprovada' | 'recusada' | 'cancelada' | 'expirada'>; bandeira?: string; motivo?: string }
type Registro = { id: string; meio: MeioCobranca; valor: number; criadaEm: number; fim?: Fim }

/** Tempos em ms. Exportados para os testes. */
export const TEMPOS = { envio: 1200, pagamento: { credito: 7000, debito: 7000, pix: 9000 }, expira: 120_000 }

const BANDEIRAS = ['Visa', 'Mastercard', 'Elo']
const MEIOS: MeioCobranca[] = ['credito', 'debito', 'pix']
const finais: SituacaoCobranca[] = ['aprovada', 'recusada', 'cancelada', 'expirada']

export function criarMaquininhaDemonstracao(agora: () => number = Date.now) {
  const registros = new Map<string, Registro>()
  let sequencia = 0

  /** Fecha a cobranca quando o tempo dela passou: cliente pagou, ou expirou. */
  function atualizar(r: Registro) {
    if (r.fim) return
    const decorrido = agora() - r.criadaEm
    if (decorrido >= TEMPOS.expira) r.fim = { situacao: 'expirada' }
    else if (decorrido >= TEMPOS.pagamento[r.meio]) r.fim = aprovada(r)
  }

  function aprovada(r: Registro): Fim {
    return { situacao: 'aprovada', bandeira: r.meio === 'pix' ? undefined : BANDEIRAS[(Number(r.id.split('-').pop()) - 1) % BANDEIRAS.length] }
  }

  function cobranca(r: Registro): Cobranca {
    atualizar(r)
    const situacao: SituacaoCobranca = r.fim?.situacao ?? (agora() - r.criadaEm < TEMPOS.envio ? 'enviando' : 'na-maquininha')
    return { id: r.id, meio: r.meio, valor: r.valor, situacao, demonstracao: true, bandeira: r.fim?.bandeira, motivo: r.fim?.motivo }
  }

  function aberta() {
    return [...registros.values()].find((r) => !finais.includes(cobranca(r).situacao))
  }

  function buscar(id: string): Resultado<Registro> {
    const r = registros.get(id)
    return r ? ok(r) : falha('nao-encontrado', 'Cobrança não encontrada.')
  }

  return {
    iniciar(dados: { valor: number; meio: MeioCobranca; referencia: string }): Resultado<Cobranca> {
      if (!Number.isSafeInteger(dados.valor) || dados.valor <= 0) return falha('validacao', 'Valor da cobrança inválido.')
      if (!MEIOS.includes(dados.meio)) return falha('validacao', 'Meio de pagamento inválido.')
      if (aberta()) return falha('conflito', 'Já há uma cobrança aberta na maquininha. Cancele antes de mandar outra.')
      const r: Registro = { id: `demo-${++sequencia}`, meio: dados.meio, valor: dados.valor, criadaEm: agora() }
      registros.set(r.id, r)
      return ok(cobranca(r))
    },

    consultar(id: string): Resultado<Cobranca> {
      const r = buscar(id)
      return r.ok ? ok(cobranca(r.dado)) : r
    },

    cancelar(id: string): Resultado<Cobranca> {
      const r = buscar(id)
      if (!r.ok) return r
      if (!finais.includes(cobranca(r.dado).situacao)) r.dado.fim = { situacao: 'cancelada' }
      return ok(cobranca(r.dado))
    },

    simular(id: string, resultado: 'aprovada' | 'recusada'): Resultado<Cobranca> {
      const r = buscar(id)
      if (!r.ok) return r
      if (finais.includes(cobranca(r.dado).situacao)) return falha('validacao', 'A cobrança já terminou.')
      r.dado.fim = resultado === 'aprovada' ? aprovada(r.dado) : { situacao: 'recusada', motivo: 'Saldo insuficiente no cartão.' }
      return ok(cobranca(r.dado))
    },
  }
}
