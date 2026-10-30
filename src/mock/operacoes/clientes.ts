/**
 * O cadastro de cliente sobre a base da demonstração (1.0, tela 3.1;
 * `R-CLIENTE-04`, `09`, `10`). Lado "mock" dos testes de contrato e, até a
 * Fase 3, o que responde no app (`src/dados/api.ts`).
 *
 * A base ainda guarda o cliente como a 0.1 (documento e telefone com máscara,
 * "Sem documento", endereço numa frase), porque a lista e a ficha leem assim até
 * as telas delas; aqui ele vira os campos do contrato, iguais aos do SQLite.
 */
import { falha, ok, type Cliente as ClienteContrato, type Contrato, type DadosCliente, type Resultado } from '../../../comum/contrato'
import { clienteValido, formatarDocumento, formatarTelefone, MENSAGENS_CLIENTE } from '../../../comum/regras/cliente'
import { juntarEndereco, separarEndereco } from '../../dados/endereco'
import { FISCAL_CLIENTE_PADRAO } from '../../dados/fiscal'
import type { Cliente } from '../base/tipos'
import { cadastrarCliente, editarCliente, obterBase } from '../estado-demonstracao'

export type OperacoesCliente = Pick<Contrato, 'obterCliente' | 'cadastrarCliente' | 'editarCliente'>

const SEM_DOCUMENTO = 'Sem documento'
const SEM_TELEFONE = 'Sem telefone'
const digitos = (texto: string) => texto.replace(/\D/g, '')


/** Da base para o contrato; na base o id é o próprio código. */
function paraCliente(c: Cliente): ClienteContrato {
  // Gravado pela 1.0: as partes. Da 0.1: a frase, separada como dá.
  const e = c.enderecoPartes ?? (() => {
    const s = separarEndereco(c.endereco)
    const barra = s.cidade.lastIndexOf('/')
    return { ...s, cidade: barra === -1 ? s.cidade : s.cidade.slice(0, barra), uf: barra === -1 ? '' : s.cidade.slice(barra + 1) }
  })()
  const { cidade, uf } = e
  const ou = (v: string | undefined) => v?.trim() || null
  return {
    id: c.id, codigo: c.id, nome: c.nome,
    documento: c.documento === SEM_DOCUMENTO ? null : ou(digitos(c.documento)),
    telefone: c.telefone === SEM_TELEFONE ? null : ou(digitos(c.telefone)),
    rua: ou(e.rua), numero: ou(e.numero), complemento: ou(c.fiscal?.complemento), bairro: ou(e.bairro),
    cidade: ou(cidade), uf: ou(uf), cep: ou(c.fiscal?.cep),
    fiscal: {
      tipoContribuinte: c.fiscal?.tipoContribuinte ?? null,
      tipoCliente: c.fiscal?.tipoCliente ?? null,
      inscricaoEstadual: ou(c.fiscal?.inscricaoEstadual),
    },
  }
}

/** Do contrato para a base, no formato que a lista e a ficha da 0.1 leem. */
function paraBase(d: DadosCliente) {
  const cidade = d.cidade && d.uf ? `${d.cidade}/${d.uf}` : d.cidade ?? ''
  return {
    nome: d.nome,
    documento: d.documento ? formatarDocumento(d.documento) : SEM_DOCUMENTO,
    telefone: d.telefone ? formatarTelefone(d.telefone) : SEM_TELEFONE,
    endereco: juntarEndereco(d.rua ?? '', d.numero ?? '', d.bairro ?? '', cidade),
    enderecoPartes: { rua: d.rua ?? '', numero: d.numero ?? '', bairro: d.bairro ?? '', cidade: d.cidade ?? '', uf: d.uf ?? '' },
    fiscal: {
      tipoContribuinte: d.fiscal.tipoContribuinte ?? FISCAL_CLIENTE_PADRAO.tipoContribuinte,
      tipoCliente: d.fiscal.tipoCliente ?? FISCAL_CLIENTE_PADRAO.tipoCliente,
      ...(d.fiscal.inscricaoEstadual ? { inscricaoEstadual: d.fiscal.inscricaoEstadual } : {}),
      ...(d.cep ? { cep: d.cep } : {}),
      ...(d.complemento ? { complemento: d.complemento } : {}),
    },
  }
}

export function criarClientesDaBase(): OperacoesCliente {
  const buscar = (id: unknown) => (typeof id === 'string' ? obterBase().clientes.find((c) => c.id === id) : undefined)
  const devolver = (id: string): Resultado<ClienteContrato> => {
    const c = buscar(id)
    return c ? ok(paraCliente(c)) : falha('nao-encontrado', MENSAGENS_CLIENTE.naoEncontrado)
  }

  /** O dado limpo, ou a falha: formato, e documento repetido pelos dígitos. */
  function preparar(bruto: unknown, menos?: string): DadosCliente | Resultado<never> {
    const dados = clienteValido(bruto)
    if ('ok' in dados) return dados
    const outro = dados.documento && obterBase().clientes.find((c) => c.id !== menos && digitos(c.documento) === dados.documento)
    if (outro) return falha('validacao', MENSAGENS_CLIENTE.repetido(outro.id, outro.nome))
    return dados
  }

  return {
    async obterCliente(id) {
      return devolver(String(id))
    },

    async cadastrarCliente(bruto) {
      const dados = preparar(bruto)
      if ('ok' in dados) return dados
      const id = cadastrarCliente(paraBase(dados))
      return id ? devolver(id) : falha('validacao', MENSAGENS_CLIENTE.documento)
    },

    async editarCliente(id, bruto) {
      const atual = buscar(id)
      if (!atual) return falha('nao-encontrado', MENSAGENS_CLIENTE.naoEncontrado)
      const dados = preparar(bruto, atual.id)
      if ('ok' in dados) return dados
      editarCliente(atual.id, paraBase(dados))
      return devolver(atual.id)
    },
  }
}

export const clientesDaBase = criarClientesDaBase()
