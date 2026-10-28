/**
 * EXEMPLO da estrutura dos testes de contrato, com um contrato de teste: as
 * operações daqui não estão em `comum/contrato.ts`. Sai quando a primeira
 * operação real da 1.0 entrar (tela 1 do plano) e ganhar o seu
 * `<area>.contrato.test.ts`, no mesmo formato.
 *
 * Mostra as três partes de todo teste de contrato:
 *   1. o recorte do contrato em teste (aqui, `ContratoExemplo`);
 *   2. os dois lados implementando o recorte;
 *   3. os cenários, escritos uma vez, citando a regra que protegem.
 */
import { expect, it } from 'vitest'
import { falha, ok, type Resultado } from '../../comum/contrato'
import { proximoNumero, type Banco } from '../../electron/banco/banco'
import { cadastrarCliente, obterBase } from '../../src/mock/estado-demonstracao'
import { testarContrato } from './estrutura'

type Cliente = { id: string; nome: string; documento: string | null }

type ContratoExemplo = {
  cadastrarCliente(dados: { nome: string; documento: string }): Promise<Resultado<{ id: string }>>
  listarClientes(): Promise<Resultado<Cliente[]>>
}

const DOCUMENTO_REPETIDO = 'Já existe um cliente com este documento.'
const digitos = (texto: string) => texto.replace(/\D/g, '')

const mock = (): ContratoExemplo => ({
  async cadastrarCliente({ nome, documento }) {
    const id = cadastrarCliente({ nome, documento, telefone: '', endereco: '' })
    return id ? ok({ id }) : falha('validacao', DOCUMENTO_REPETIDO)
  },
  async listarClientes() {
    return ok(obterBase().clientes.map((c) => ({ id: c.id, nome: c.nome, documento: digitos(c.documento) || null })))
  },
})

const sqlite = (banco: Banco): ContratoExemplo => ({
  async cadastrarCliente({ nome, documento }) {
    const id = crypto.randomUUID()
    try {
      banco.prepare('insert into cliente (id, numero, nome, documento, criado_em) values (?, ?, ?, ?, ?)')
        .run(id, proximoNumero(banco, 'cliente'), nome.trim(), digitos(documento) || null, new Date().toISOString())
    } catch (erro) {
      if (/UNIQUE constraint failed: cliente\.documento/.test(String(erro))) return falha('validacao', DOCUMENTO_REPETIDO)
      throw erro
    }
    return ok({ id })
  },
  async listarClientes() {
    return ok(banco.prepare('select id, nome, documento from cliente order by numero').all() as Cliente[])
  },
})

testarContrato('exemplo: cadastro de cliente', { mock, sqlite }, (abrir) => {
  it('[R-CLIENTE-04] recusa documento repetido mesmo com outra pontuação', async () => {
    const api = abrir('vazia')
    expect(await api.cadastrarCliente({ nome: 'Maria', documento: '123.456.789-01' })).toMatchObject({ ok: true })
    expect(await api.cadastrarCliente({ nome: 'Outra Maria', documento: '12345678901' }))
      .toEqual({ ok: false, causa: 'validacao', erro: DOCUMENTO_REPETIDO })
    const lista = await api.listarClientes()
    expect(lista.ok && lista.dado.map((c) => c.nome)).toEqual(['Maria'])
  })

  it('cliente sem documento não colide com outro sem documento', async () => {
    const api = abrir('vazia')
    expect(await api.cadastrarCliente({ nome: 'Ana', documento: '' })).toMatchObject({ ok: true })
    expect(await api.cadastrarCliente({ nome: 'Bia', documento: '' })).toMatchObject({ ok: true })
  })

  it('parte da semente quando o cenário pede', async () => {
    const api = abrir('semente')
    const lista = await api.listarClientes()
    expect(lista.ok && lista.dado.length).toBeGreaterThan(20)
  })
})
