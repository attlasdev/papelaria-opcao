/**
 * O sino sobre a base da demonstração (1.0, tela 8.2; `R-INICIO-05`). Lado
 * "mock" dos testes de contrato e, até a Fase 3, o que responde no app
 * (`src/dados/api.ts`). As regras são as de `comum/regras/avisos.ts`, as
 * mesmas do SQLite; os boletos e o que aguarda a dona vêm das leituras das
 * telas deles, para a conta ser a mesma.
 */
import { ok, type Contrato } from '../../../comum/contrato'
import { avisosDaLoja, avisosLidosDe, comLido, conferirIdsDeAvisos, marcarLidos } from '../../../comum/regras/avisos'
import { hojeEmSaoPaulo } from '../../../comum/regras/entrada'
import { gravarAvisosLidos, obterBase } from '../estado-demonstracao'
import { criarBoletosDaBase } from './boletos'
import { criarInicioDaBase } from './inicio'
import { aberta } from './recebimentos'

export type OperacoesAvisos = Pick<Contrato, 'listarAvisos' | 'marcarAvisosLidos'>

async function avisosDeAgora() {
  const hoje = hojeEmSaoPaulo()
  const base = obterBase()
  const [boletos, aguardando] = await Promise.all([criarBoletosDaBase().listarBoletos('a-pagar', ''), criarInicioDaBase().listarAguardandoDona()])
  if (!boletos.ok) return boletos
  if (!aguardando.ok) return aguardando
  const notinhas = base.fichas.flatMap((f) => {
    const n = aberta(f, hoje)
    const cliente = n && base.clientes.find((c) => c.id === n.clienteId)
    return n && cliente ? [{ clienteId: cliente.id, cliente: cliente.nome, vencimento: n.vencimento, emAberto: n.emAberto }] : []
  })
  const produtos = base.produtos.filter((p) => !p.inativo).map((p) => ({ descricao: p.descricao, saldo: p.saldo, minimo: p.minimo }))
  return ok(avisosDaLoja({ notinhas, boletos: boletos.dado.boletos, produtos, aguardandoDona: aguardando.dado.length }, hoje))
}

export function criarAvisosDaBase(): OperacoesAvisos {
  return {
    async listarAvisos() {
      const avisos = await avisosDeAgora()
      if (!avisos.ok) return avisos
      return ok(comLido(avisos.dado, avisosLidosDe(obterBase().avisosLidos)))
    },

    async marcarAvisosLidos(bruto) {
      const ids = conferirIdsDeAvisos(bruto)
      if ('ok' in ids) return ids
      const avisos = await avisosDeAgora()
      if (!avisos.ok) return avisos
      const lidos = marcarLidos(avisos.dado, avisosLidosDe(obterBase().avisosLidos), ids)
      gravarAvisosLidos(lidos)
      return ok(comLido(avisos.dado, lidos))
    },
  }
}

export const avisosDaBase = criarAvisosDaBase()
