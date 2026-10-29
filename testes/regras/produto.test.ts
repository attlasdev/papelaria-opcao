/** As regras puras do cadastro de produto (`comum/regras/produto.ts`). */
import { describe, expect, it } from 'vitest'
import {
  categoriaCanonica, codigoProduto, conferirProduto, MENSAGENS_PRODUTO, ordenarCategorias, paginaQueExiste, paraBusca, situacaoSaldo, textoDoCadastro,
} from '../../comum/regras/produto'

describe('cadastro de produto', () => {
  it('[R-ESTOQUE-08] o código de exibição vem do número do banco', () => {
    expect([codigoProduto(1), codigoProduto(37), codigoProduto(12345)]).toEqual(['EST-0001', 'EST-0037', 'EST-12345'])
  })

  it('[R-ESTOQUE-06] NCM e CEST: pontos saem, vazio é nulo, tamanho errado aponta o campo', () => {
    expect(conferirProduto({ ncm: '4820.20.00', cest: ' ' }).dados).toMatchObject({ ncm: '48202000', cest: null })
    expect(conferirProduto({ ncm: '4820', cest: '19.024' }).erros).toMatchObject({ ncm: MENSAGENS_PRODUTO.ncm, cest: MENSAGENS_PRODUTO.cest })
  })

  it('aponta cada campo, na ordem da tela', () => {
    const { erros } = conferirProduto({ preco: 0, minimo: -1, custo: -5, conteudo: { embalagem: 'saco' } })
    expect(Object.keys(erros)).toEqual(['descricao', 'categoria', 'unidade', 'preco', 'custo', 'minimo', 'conteudo'])
    expect(conferirProduto({ descricao: 'x', categoria: 'y', unidade: 'un', preco: 1, minimo: 0, custo: null, conteudo: { embalagem: 'cx', pacotes: 10, unidades: null } }).erros).toEqual({})
  })

  it('texto colado de site: espaço duro e caractere invisível saem', () => {
    expect(textoDoCadastro('  Marca-texto Stabilo​  Boss ')).toBe('Marca-texto Stabilo Boss')
    expect(textoDoCadastro('​ ')).toBeNull()
    expect(textoDoCadastro(42)).toBeNull()
  })

  it('categoria: caixa e acento não criam outra; a lista sai em ordem, sem repetir', () => {
    expect(categoriaCanonica('papeis', ['Escrita', 'Papéis'])).toBe('Papéis')
    expect(categoriaCanonica('Mochilas', ['Escrita'])).toBe('Mochilas')
    expect(ordenarCategorias(['Papéis', 'Escrita', 'Agendas', 'Escrita'])).toEqual(['Agendas', 'Escrita', 'Papéis'])
  })

  it('saldo: zerado vem antes de baixo; no mínimo é normal', () => {
    expect([situacaoSaldo(0, 0), situacaoSaldo(0, 5), situacaoSaldo(4, 5), situacaoSaldo(5, 5)]).toEqual(['zerado', 'zerado', 'baixo', 'normal'])
  })

  it('busca: sem acento e sem maiúscula; página além do fim vira a última', () => {
    expect(paraBusca('Papéis AÇÃO')).toBe('papeis acao')
    expect([paginaQueExiste(9, 10, 3), paginaQueExiste(2, 0, 3), paginaQueExiste(2, 6, 3)]).toEqual([4, 1, 2])
  })
})
