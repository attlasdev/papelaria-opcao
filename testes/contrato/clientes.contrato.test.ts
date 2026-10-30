/**
 * Cadastro de cliente (1.0, tela 3.1): os mesmos cenários no mock (base da
 * demonstração) e no SQLite. Regras em Memoria.md, "Clientes".
 */
import { expect, it } from 'vitest'
import type { DadosCliente } from '../../comum/contrato'
import { MENSAGENS_CLIENTE } from '../../comum/regras/cliente'
import type { Banco } from '../../electron/banco/banco'
import { clientesSqlite } from '../../electron/banco/clientes'
import { criarClientesDaBase } from '../../src/mock/operacoes/clientes'
import { testarContrato } from './estrutura'

const mock = () => criarClientesDaBase()
const sqlite = (banco: Banco) => clientesSqlite(() => banco)

const VAZIO: DadosCliente = {
  nome: '', documento: null, telefone: null, rua: null, numero: null, complemento: null, bairro: null,
  cidade: null, uf: null, cep: null, fiscal: { tipoContribuinte: null, tipoCliente: null, inscricaoEstadual: null },
}

// CPF e CNPJ com os dígitos verificadores certos; o último dígito trocado os invalida.
const CPF = '529.982.247-25'
const OUTRO_CPF = '111.444.777-35'
const CNPJ = '11.222.333/0001-81'

function dado<T>(r: { ok: true; dado: T } | { ok: false; erro: string }): T {
  if (!r.ok) throw new Error(r.erro)
  return r.dado
}

const recusa = (erro: string) => ({ ok: false, causa: 'validacao', erro })

testarContrato('cadastro de cliente', { mock, sqlite }, (abrir) => {
  it('[R-CLIENTE-04] só o nome é obrigatório; o código nasce no banco', async () => {
    const api = abrir('vazia')
    const lucas = dado(await api.cadastrarCliente({ ...VAZIO, nome: '  Lucas   Ferreira ' }))
    expect(lucas).toMatchObject({ codigo: 'CLI-0001', nome: 'Lucas Ferreira', documento: null, telefone: null, cidade: null, uf: null })
    expect(dado(await api.cadastrarCliente({ ...VAZIO, nome: 'Bia' })).codigo).toBe('CLI-0002')
    expect(dado(await api.obterCliente(lucas.id))).toEqual(lucas)
    expect(await api.cadastrarCliente({ ...VAZIO, nome: '   ' })).toEqual(recusa(MENSAGENS_CLIENTE.nome))
    expect(await api.obterCliente('nao-existe')).toMatchObject({ ok: false, causa: 'nao-encontrado' })
    expect(await api.editarCliente('nao-existe', { ...VAZIO, nome: 'X' })).toMatchObject({ ok: false, causa: 'nao-encontrado' })
  })

  it('[R-CLIENTE-09] CPF e CNPJ com os dígitos verificadores; pontuação livre, guardado só com números', async () => {
    const api = abrir('vazia')
    expect(dado(await api.cadastrarCliente({ ...VAZIO, nome: 'Lucas', documento: CPF })).documento).toBe('52998224725')
    expect(dado(await api.cadastrarCliente({ ...VAZIO, nome: 'Papelaria Ltda', documento: CNPJ })).documento).toBe('11222333000181')
    for (const errado of ['529.982.247-24', '11.222.333/0001-80', '111.111.111-11', '1234567', '5299822472']) {
      expect(await api.cadastrarCliente({ ...VAZIO, nome: 'X', documento: errado })).toEqual(recusa(MENSAGENS_CLIENTE.documento))
    }
  })

  it('[R-CLIENTE-04] documento repetido é barrado pelos dígitos, e diz em qual cliente', async () => {
    const api = abrir('vazia')
    const lucas = dado(await api.cadastrarCliente({ ...VAZIO, nome: 'Lucas Ferreira', documento: CPF }))
    const bia = dado(await api.cadastrarCliente({ ...VAZIO, nome: 'Bia', documento: OUTRO_CPF }))
    const repetido = recusa(MENSAGENS_CLIENTE.repetido(lucas.codigo, 'Lucas Ferreira'))
    expect(await api.cadastrarCliente({ ...VAZIO, nome: 'Outro', documento: '52998224725' })).toEqual(repetido)
    expect(await api.editarCliente(bia.id, { ...VAZIO, nome: 'Bia', documento: CPF })).toEqual(repetido)
    // O próprio documento não conta como repetido.
    expect(await api.editarCliente(lucas.id, { ...VAZIO, nome: 'Lucas F.', documento: CPF })).toMatchObject({ ok: true, dado: { nome: 'Lucas F.' } })
  })

  it('[R-CLIENTE-10] telefone com DDD, 10 ou 11 números; opcional', async () => {
    const api = abrir('vazia')
    expect(dado(await api.cadastrarCliente({ ...VAZIO, nome: 'A', telefone: '(33) 99999-1234' })).telefone).toBe('33999991234')
    expect(dado(await api.cadastrarCliente({ ...VAZIO, nome: 'B', telefone: '33 3341-1234' })).telefone).toBe('3333411234')
    expect(dado(await api.cadastrarCliente({ ...VAZIO, nome: 'C', telefone: '  ' })).telefone).toBeNull()
    for (const errado of ['99999-1234', '(33) 99999-12345']) {
      expect(await api.cadastrarCliente({ ...VAZIO, nome: 'X', telefone: errado })).toEqual(recusa(MENSAGENS_CLIENTE.telefone))
    }
  })

  it('[R-CLIENTE-04] endereço em partes: cidade e estado separados, estado pela sigla, CEP só com números', async () => {
    const api = abrir('vazia')
    const endereco = { rua: 'Rua das Flores', numero: '142', complemento: 'Sala 3', bairro: 'Centro', cidade: 'Simonésia', uf: 'mg', cep: '35.890-000' }
    const c = dado(await api.cadastrarCliente({ ...VAZIO, nome: 'Lucas', ...endereco }))
    expect(c).toMatchObject({ ...endereco, uf: 'MG', cep: '35890000' })
    // Sem bairro, e sem rua: as partes que vieram, e nada inventado.
    expect(dado(await api.cadastrarCliente({ ...VAZIO, nome: 'Bia', cidade: 'Manhuaçu', uf: 'MG' })))
      .toMatchObject({ rua: null, numero: null, bairro: null, cidade: 'Manhuaçu', uf: 'MG' })
    expect(await api.cadastrarCliente({ ...VAZIO, nome: 'X', uf: 'XX' })).toEqual(recusa(MENSAGENS_CLIENTE.uf))
    expect(await api.cadastrarCliente({ ...VAZIO, nome: 'X', cep: '3589' })).toEqual(recusa(MENSAGENS_CLIENTE.cep))
  })

  it('editar troca o cadastro e preserva o bloco fiscal que a tela não mostra', async () => {
    const api = abrir('vazia')
    const fiscal = { tipoContribuinte: 'contribuinte' as const, tipoCliente: 'revenda' as const, inscricaoEstadual: '062.307.904/0081' }
    const loja = dado(await api.cadastrarCliente({ ...VAZIO, nome: 'Papelaria Ltda', documento: CNPJ, fiscal }))
    expect(loja.fiscal).toEqual({ ...fiscal, inscricaoEstadual: '0623079040081' })
    const editado = dado(await api.editarCliente(loja.id, { ...loja, nome: 'Papelaria Central Ltda', cidade: 'Simonésia', uf: 'MG' }))
    expect(editado).toMatchObject({ nome: 'Papelaria Central Ltda', codigo: loja.codigo, documento: '11222333000181', fiscal: loja.fiscal, cidade: 'Simonésia' })
  })
})
