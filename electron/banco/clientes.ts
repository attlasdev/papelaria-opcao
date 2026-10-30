/**
 * O cadastro de cliente no banco da 1.0 (tela 3.1; `R-CLIENTE-04`, `09`, `10`).
 * As regras estão em `comum/regras/cliente.ts`, as mesmas do mock; aqui fica o
 * que é do banco: o número que nasce na sequência e o documento único, pelos
 * dígitos (restrição `unique` do schema).
 */
import { falha, ok, type Cliente, type Contrato, type DadosCliente, type Falha, type Resultado } from '../../comum/contrato'
import { clienteValido, codigoCliente, MENSAGENS_CLIENTE } from '../../comum/regras/cliente'
import { proximoNumero, transacao, type Banco } from './banco'

type OperacoesCliente = Pick<Contrato, 'obterCliente' | 'cadastrarCliente' | 'editarCliente'>

type Linha = {
  id: string; numero: number; nome: string; documento: string | null; telefone: string | null
  logradouro: string | null; numero_endereco: string | null; complemento: string | null; bairro: string | null
  cidade: string | null; uf: string | null; cep: string | null
  tipo_contribuinte: DadosCliente['fiscal']['tipoContribuinte']; tipo_cliente: DadosCliente['fiscal']['tipoCliente']; inscricao_estadual: string | null
}

const paraCliente = (l: Linha): Cliente => ({
  id: l.id, codigo: codigoCliente(l.numero), nome: l.nome, documento: l.documento, telefone: l.telefone,
  rua: l.logradouro, numero: l.numero_endereco, complemento: l.complemento, bairro: l.bairro, cidade: l.cidade, uf: l.uf, cep: l.cep,
  fiscal: { tipoContribuinte: l.tipo_contribuinte, tipoCliente: l.tipo_cliente, inscricaoEstadual: l.inscricao_estadual },
})

/** As colunas do cadastro, na ordem de `valores`. */
const COLUNAS = ['nome', 'documento', 'telefone', 'logradouro', 'numero_endereco', 'complemento', 'bairro', 'cidade', 'uf', 'cep',
  'tipo_contribuinte', 'tipo_cliente', 'inscricao_estadual'] as const

const valores = (d: DadosCliente) => [d.nome, d.documento, d.telefone, d.rua, d.numero, d.complemento, d.bairro, d.cidade, d.uf, d.cep,
  d.fiscal.tipoContribuinte, d.fiscal.tipoCliente, d.fiscal.inscricaoEstadual]

export function clientesSqlite(banco: () => Banco): OperacoesCliente {
  const buscar = (id: unknown) =>
    typeof id === 'string' ? (banco().prepare('select * from cliente where id = ?').get(id) as Linha | undefined) ?? null : null
  const devolver = (id: string): Resultado<Cliente> => {
    const l = buscar(id)
    return l ? ok(paraCliente(l)) : falha('nao-encontrado', MENSAGENS_CLIENTE.naoEncontrado)
  }

  /** O dado limpo, ou a falha: formato, e documento repetido. Dentro da transação. */
  function preparar(bruto: unknown, menos?: string): DadosCliente | Falha {
    const dados = clienteValido(bruto)
    if ('ok' in dados) return dados
    const outro = dados.documento
      ? banco().prepare('select numero, nome from cliente where documento = ? and id is not ?').get(dados.documento, menos ?? null) as { numero: number; nome: string } | undefined
      : undefined
    return outro ? falha('validacao', MENSAGENS_CLIENTE.repetido(codigoCliente(outro.numero), outro.nome)) : dados
  }

  return {
    async obterCliente(id) {
      return devolver(String(id))
    },

    async cadastrarCliente(bruto) {
      return transacao(banco(), () => {
        const dados = preparar(bruto)
        if ('ok' in dados) return dados
        const id = crypto.randomUUID()
        banco().prepare(`insert into cliente (id, numero, criado_em, ${COLUNAS.join(', ')}) values (?, ?, ?, ${COLUNAS.map(() => '?').join(', ')})`)
          .run(id, proximoNumero(banco(), 'cliente'), new Date().toISOString(), ...valores(dados))
        return devolver(id)
      })
    },

    async editarCliente(id, bruto) {
      return transacao(banco(), () => {
        const atual = buscar(id)
        if (!atual) return falha('nao-encontrado', MENSAGENS_CLIENTE.naoEncontrado)
        const dados = preparar(bruto, atual.id)
        if ('ok' in dados) return dados
        banco().prepare(`update cliente set ${COLUNAS.map((c) => `${c} = ?`).join(', ')} where id = ?`).run(...valores(dados), atual.id)
        return devolver(atual.id)
      })
    },
  }
}
