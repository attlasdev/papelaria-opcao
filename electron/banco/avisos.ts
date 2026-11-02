/**
 * O sino no banco da 1.0 (tela 8.2; `R-INICIO-05`). As regras estão em
 * `comum/regras/avisos.ts`, as mesmas do mock; os boletos e o que aguarda a
 * dona vêm das leituras das telas deles, para a conta ser a mesma. O lido
 * fica em `preferencia` (`avisos_lidos`), como JSON: uma máquina só.
 */
import { ok, type Contrato } from '../../comum/contrato'
import { avisosDaLoja, avisosLidosDe, comLido, conferirIdsDeAvisos, marcarLidos, type AvisosLidos } from '../../comum/regras/avisos'
import { hojeEmSaoPaulo } from '../../comum/regras/entrada'
import type { Banco } from './banco'
import { boletosSqlite } from './boletos'
import { inicioSqlite } from './inicio'
import { abertas, NOTINHAS, type LinhaNotinha } from './recebimentos'

type OperacoesAvisos = Pick<Contrato, 'listarAvisos' | 'marcarAvisosLidos'>

const LIDOS = 'avisos_lidos'

export function avisosSqlite(banco: () => Banco): OperacoesAvisos {
  const lidos = () => avisosLidosDe((banco().prepare('select valor from preferencia where chave = ?').get(LIDOS) as { valor: string } | undefined)?.valor)
  const gravar = (l: AvisosLidos) => banco().prepare('insert into preferencia (chave, valor) values (?, ?) on conflict (chave) do update set valor = excluded.valor')
    .run(LIDOS, JSON.stringify(l))

  async function avisosDeAgora() {
    const hoje = hojeEmSaoPaulo()
    const [boletos, aguardando] = await Promise.all([boletosSqlite(banco).listarBoletos('a-pagar', ''), inicioSqlite(banco).listarAguardandoDona()])
    if (!boletos.ok) return boletos
    if (!aguardando.ok) return aguardando
    const nomes = new Map((banco().prepare('select id, nome from cliente').all() as { id: string; nome: string }[]).map((c) => [c.id, c.nome]))
    const notinhas = abertas(banco().prepare(NOTINHAS).all() as LinhaNotinha[], hoje)
      .map((n) => ({ clienteId: n.clienteId, cliente: nomes.get(n.clienteId) ?? '', vencimento: n.vencimento, emAberto: n.emAberto }))
    const produtos = banco().prepare('select descricao, saldo, minimo from produto where ativo = 1').all() as { descricao: string; saldo: number; minimo: number }[]
    return ok(avisosDaLoja({ notinhas, boletos: boletos.dado.boletos, produtos, aguardandoDona: aguardando.dado.length }, hoje))
  }

  return {
    async listarAvisos() {
      const avisos = await avisosDeAgora()
      if (!avisos.ok) return avisos
      return ok(comLido(avisos.dado, lidos()))
    },

    async marcarAvisosLidos(bruto) {
      const ids = conferirIdsDeAvisos(bruto)
      if ('ok' in ids) return ids
      const avisos = await avisosDeAgora()
      if (!avisos.ok) return avisos
      const proximos = marcarLidos(avisos.dado, lidos(), ids)
      gravar(proximos)
      return ok(comLido(avisos.dado, proximos))
    },
  }
}
