import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBanco, transacao, versaoDoBanco, type Banco } from './banco'
import { migracoes } from './migracoes'

const AGORA = '2026-10-27T12:00:00.000Z'
const HOJE = '2026-10-27'
const ULTIMA = migracoes.length

let banco: Banco

beforeEach(() => {
  banco = abrirBanco(':memory:')
  banco.prepare("insert into operador (id, nome, pin_hash, criado_em) values ('op', 'Loja', 'scrypt$sal$hash', ?)").run(AGORA)
})

afterEach(() => banco.close())

function inserir(tabela: string, linha: Record<string, string | number | null>) {
  const colunas = Object.keys(linha)
  banco
    .prepare(`insert into ${tabela} (${colunas.join(', ')}) values (${colunas.map(() => '?').join(', ')})`)
    .run(...Object.values(linha))
}

function produto(id: string, numero: number) {
  inserir('produto', { id, numero, descricao: 'Caderno', categoria: 'Cadernos', unidade: 'un', preco: 1500, criado_em: AGORA })
}

let movimentos = 0
function movimento(produtoId: string, tipo: string, quantidade: number, extra: Record<string, string | null> = {}) {
  const { saldo } = banco.prepare('select saldo from produto where id = ?').get(produtoId) as { saldo: number }
  inserir('movimento_estoque', {
    id: `mov-${++movimentos}`, produto_id: produtoId, tipo, quantidade,
    saldo_antes: saldo, saldo_depois: saldo + quantidade,
    operador_id: 'op', registrado_em: AGORA, ...extra,
  })
}

function saldo(produtoId: string) {
  return (banco.prepare('select saldo from produto where id = ?').get(produtoId) as { saldo: number }).saldo
}

function ficha(id: string, numero: number, total = 1500) {
  inserir('ficha', { id, numero, forma: 'dinheiro', subtotal: total, total, dia: HOJE, operador_id: 'op', registrado_em: AGORA })
}

describe('abrir e migrar', () => {
  it('aplica a migration inicial com as chaves estrangeiras ligadas', () => {
    expect(versaoDoBanco(banco)).toBe(migracoes.length)
    expect(banco.prepare('pragma foreign_keys').get()).toEqual({ foreign_keys: 1 })
    const series = banco.prepare('select serie, ultimo from sequencia order by serie').all()
    expect(series).toEqual([
      { serie: 'boleto', ultimo: 0 }, { serie: 'cliente', ultimo: 0 },
      { serie: 'ficha', ultimo: 0 }, { serie: 'produto', ultimo: 0 },
    ])
  })

  describe('em arquivo', () => {
    let pasta: string
    beforeEach(() => { pasta = mkdtempSync(path.join(tmpdir(), 'banco-')) })
    afterEach(() => rmSync(pasta, { recursive: true, force: true }))

    it('abre em WAL e não reaplica o que já foi aplicado', () => {
      const caminho = path.join(pasta, 'loja.sqlite')
      const primeiro = abrirBanco(caminho)
      expect(primeiro.prepare('pragma journal_mode').get()).toEqual({ journal_mode: 'wal' })
      primeiro.close()
      const segundo = abrirBanco(caminho)
      expect(versaoDoBanco(segundo)).toBe(ULTIMA)
      segundo.close()
      expect(existsSync(`${caminho}.v${ULTIMA}`)).toBe(false)
    })

    it('recusa banco de uma versão mais nova que o app', () => {
      const caminho = path.join(pasta, 'loja.sqlite')
      abrirBanco(caminho).close()
      expect(() => abrirBanco(caminho, [])).toThrow(new RegExp(`versão ${ULTIMA}; este app conhece até a 0`))
    })

    it('migration que falha volta atrás inteira, e a cópia de antes fica ao lado', () => {
      const caminho = path.join(pasta, 'loja.sqlite')
      abrirBanco(caminho).close()
      const quebrada = [...migracoes, { versao: ULTIMA + 1, nome: 'quebrada', sql: 'create table nova (id text); insert into inexistente values (1);' }]
      expect(() => abrirBanco(caminho, quebrada)).toThrow(/no such table: inexistente/)
      expect(existsSync(`${caminho}.v${ULTIMA}`)).toBe(true)
      const depois = abrirBanco(caminho)
      expect(versaoDoBanco(depois)).toBe(ULTIMA)
      expect(depois.prepare("select count(*) as n from sqlite_master where name = 'nova'").get()).toEqual({ n: 0 })
      depois.close()
    })
  })
})

describe('[R-ESTOQUE-01] saldo mantido pelo banco (P4)', () => {
  it('produto nasce com saldo 0; o saldo inicial é um movimento', () => {
    expect(() => inserir('produto', { id: 'p', numero: 1, descricao: 'X', categoria: '', unidade: 'un', preco: 1, saldo: 5, criado_em: AGORA }))
      .toThrow(/nasce com saldo 0/)
    produto('p', 1)
    movimento('p', 'entrada', 10)
    expect(saldo('p')).toBe(10)
  })

  it('[R-VENDA-07] cada movimento atualiza o saldo, e venda além do saldo é recusada', () => {
    produto('p', 1)
    ficha('f', 1)
    movimento('p', 'entrada', 3)
    movimento('p', 'venda', -2, { ficha_id: 'f' })
    expect(saldo('p')).toBe(1)
    expect(() => movimento('p', 'venda', -2, { ficha_id: 'f' })).toThrow(/CHECK constraint failed/)
    expect(saldo('p')).toBe(1)
  })

  it('recusa movimento com saldo_antes diferente do saldo atual', () => {
    produto('p', 1)
    movimento('p', 'entrada', 3)
    expect(() => inserir('movimento_estoque', {
      id: 'x', produto_id: 'p', tipo: 'entrada', quantidade: 1, saldo_antes: 0, saldo_depois: 1, operador_id: 'op', registrado_em: AGORA,
    })).toThrow(/saldo_antes difere/)
  })

  it('recusa mudar o saldo direto, mas aceita editar o resto do cadastro', () => {
    produto('p', 1)
    movimento('p', 'entrada', 3)
    expect(() => banco.prepare("update produto set saldo = 50 where id = 'p'").run()).toThrow(/so muda por movimento_estoque/)
    banco.prepare("update produto set preco = 1800, saldo = 3 where id = 'p'").run()
    expect(banco.prepare("select preco, saldo from produto where id = 'p'").get()).toEqual({ preco: 1800, saldo: 3 })
  })

  it('ajuste exige motivo; venda e cancelamento exigem ficha', () => {
    produto('p', 1)
    expect(() => movimento('p', 'ajuste', 4)).toThrow(/CHECK constraint failed/)
    movimento('p', 'ajuste', 4, { motivo: 'Contagem da prateleira' })
    expect(() => movimento('p', 'venda', -1)).toThrow(/CHECK constraint failed/)
  })

  it('[R-ESTOQUE-02] produto só com o saldo inicial sai de verdade; com histórico, não', () => {
    produto('p', 1)
    movimento('p', 'entrada', 5, { motivo: 'Saldo inicial do cadastro' })
    expect(() => banco.prepare("delete from movimento_estoque where produto_id = 'p'").run()).toThrow(/fato nao se apaga/)
    banco.prepare("delete from produto where id = 'p'").run()
    expect(banco.prepare('select count(*) as n from movimento_estoque').get()).toEqual({ n: 0 })

    produto('q', 2)
    movimento('q', 'entrada', 5)
    movimento('q', 'ajuste', -1, { motivo: 'Quebrado' })
    expect(() => banco.prepare("delete from produto where id = 'q'").run()).toThrow(/produto com historico/)
    expect(saldo('q')).toBe(4)
  })

  it('a transação que falha no meio não deixa baixa pela metade', () => {
    produto('a', 1)
    produto('b', 2)
    movimento('a', 'entrada', 5)
    movimento('b', 'entrada', 1)
    ficha('f', 1)
    expect(() => transacao(banco, () => {
      movimento('a', 'venda', -2, { ficha_id: 'f' })
      movimento('b', 'venda', -3, { ficha_id: 'f' })
    })).toThrow()
    expect([saldo('a'), saldo('b')]).toEqual([5, 1])
  })
})

describe('operador', () => {
  const PIN = 'scrypt$sal$hash'
  const operador = (id: string, nome: string, extra: Record<string, string | number | null> = {}) =>
    inserir('operador', { id, nome, pin_hash: PIN, criado_em: AGORA, ...extra })

  it('[R-OPERADOR-01] não nasce sem PIN, o PIN não sai, e o nome não repete', () => {
    expect(() => inserir('operador', { id: 'a', nome: 'Ana', criado_em: AGORA })).toThrow(/operador sem PIN/)
    expect(() => operador('a', 'Ana', { pin_hash: '1234' })).toThrow(/operador sem PIN/)
    operador('a', 'Ana')
    expect(() => banco.prepare("update operador set pin_hash = null where id = 'a'").run()).toThrow(/operador sem PIN/)
    expect(() => operador('b', 'ANA')).toThrow(/UNIQUE/)
  })

  it('[R-OPERADOR-03] uma administradora só, e ela não se desativa', () => {
    operador('dona', 'Helena', { admin: 1 })
    expect(() => operador('outra', 'Bia', { admin: 1 })).toThrow(/UNIQUE/)
    expect(() => banco.prepare("update operador set ativo = 0 where id = 'dona'").run()).toThrow(/administradora/)
    expect(() => banco.prepare("update operador set admin = 0 where id = 'dona'").run()).toThrow(/administradora/)
    expect(() => operador('nova', 'Bia', { admin: 1, ativo: 0 })).toThrow(/administradora|UNIQUE/)
    banco.prepare("update operador set nome = 'Helena Prado' where id = 'dona'").run()
  })
})

describe('fato só se insere', () => {
  it('[R-CORRECAO-01] recusa update e delete em fatos', () => {
    ficha('f', 1)
    expect(() => banco.prepare("update ficha set total = 1 where id = 'f'").run()).toThrow(/fato nao se altera: ficha/)
    expect(() => banco.prepare("delete from ficha where id = 'f'").run()).toThrow(/fato nao se apaga: ficha/)
    produto('p', 1)
    movimento('p', 'entrada', 1)
    expect(() => banco.prepare("update movimento_estoque set motivo = 'x'").run()).toThrow(/fato nao se altera/)
  })

  it('ficha: total é subtotal menos desconto; notinha tem vencimento e cliente', () => {
    expect(() => inserir('ficha', { id: 'f', numero: 1, forma: 'pix', subtotal: 1000, desconto: 100, total: 1000, dia: HOJE, operador_id: 'op', registrado_em: AGORA }))
      .toThrow(/CHECK constraint failed/)
    expect(() => inserir('ficha', { id: 'f', numero: 1, forma: 'notinha', subtotal: 1000, total: 1000, vencimento: '2026-11-10', dia: HOJE, operador_id: 'op', registrado_em: AGORA }))
      .toThrow(/CHECK constraint failed/)
  })
})

describe('caixa e dinheiro', () => {
  function abrirCaixa(id: string) {
    inserir('caixa', { id, dinheiro_abertura: 10000, operador_id: 'op', registrado_em: AGORA })
  }
  function fechar(caixaId: string, esperado: number, contado: number, justificativa: string | null = null) {
    inserir('caixa_fechamento', { id: `fech-${caixaId}`, caixa_id: caixaId, esperado, contado, justificativa, operador_id: 'op', registrado_em: AGORA })
  }
  function lancamento(id: string, tipo: string, valor: number, extra: Record<string, string | null> = {}) {
    inserir('lancamento', { id, tipo, descricao: 'Água', origem: 'Balcão', meio: 'dinheiro', valor, dia: HOJE, operador_id: 'op', registrado_em: AGORA, ...extra })
  }

  it('[R-CAIXA-04] [R-CAIXA-02] um caixa aberto por vez; fechamento com diferença exige justificativa', () => {
    abrirCaixa('c1')
    expect(() => abrirCaixa('c2')).toThrow(/ja existe um caixa aberto/)
    expect(() => fechar('c1', 10000, 9500)).toThrow(/CHECK constraint failed/)
    fechar('c1', 10000, 9500, 'Troco errado')
    abrirCaixa('c2')
  })

  it('[R-CAIXA-06] caixa fechado não recebe dinheiro', () => {
    abrirCaixa('c1')
    fechar('c1', 10000, 10000)
    expect(() => lancamento('l', 'despesa', -500, { caixa_id: 'c1' })).toThrow(/caixa fechado/)
    expect(() => inserir('movimento_gaveta', { id: 'g', caixa_id: 'c1', tipo: 'retirada', valor: 100, motivo: 'Banco', operador_id: 'op', registrado_em: AGORA }))
      .toThrow(/caixa fechado/)
  })

  it('[R-CORRECAO-04] lançamento: o sinal segue o tipo, e o estorno inverte o original', () => {
    expect(() => lancamento('l0', 'despesa', 500)).toThrow(/CHECK constraint failed/)
    lancamento('l1', 'despesa', -500)
    expect(() => lancamento('e1', 'despesa', 400, { estorno_de: 'l1', motivo: 'Engano' })).toThrow(/inverter o lancamento original/)
    expect(() => lancamento('e1', 'despesa', 500, { estorno_de: 'l1' })).toThrow(/CHECK constraint failed/)
    lancamento('e1', 'despesa', 500, { estorno_de: 'l1', motivo: 'Engano' })
    expect(() => lancamento('e2', 'despesa', 500, { estorno_de: 'l1', motivo: 'De novo' })).toThrow(/UNIQUE constraint failed/)
  })
})

describe('[A4] cobrança da maquininha', () => {
  function cobranca(id: string, situacao: string) {
    inserir('cobranca', { id, meio: 'credito', valor: 1500, situacao, criada_em: AGORA, atualizada_em: AGORA })
  }
  function pagamentoCartao(id: string, cobrancaId: string) {
    inserir('pagamento', { id, ficha_id: 'f', tipo: 'venda', meio: 'cartao', valor: 1500, cartao: 'credito', maquininha: 'mercado-pago', cobranca_id: cobrancaId, dia: HOJE, operador_id: 'op', registrado_em: AGORA })
  }

  it('só cobrança aprovada vira pagamento, e uma vez só', () => {
    ficha('f', 1)
    cobranca('cob', 'na-maquininha')
    expect(() => pagamentoCartao('pg1', 'cob')).toThrow(/exige cobranca aprovada/)
    banco.prepare("update cobranca set situacao = 'aprovada', bandeira = 'Visa' where id = 'cob'").run()
    pagamentoCartao('pg1', 'cob')
    expect(() => pagamentoCartao('pg2', 'cob')).toThrow(/UNIQUE constraint failed/)
  })

  it('aprovada não volta atrás e o valor não muda', () => {
    cobranca('cob', 'aprovada')
    expect(() => banco.prepare("update cobranca set situacao = 'cancelada' where id = 'cob'").run()).toThrow(/aprovada nao volta/)
    cobranca('cob2', 'enviando')
    expect(() => banco.prepare("update cobranca set valor = 1 where id = 'cob2'").run()).toThrow(/so muda de situacao/)
    expect(() => banco.prepare("delete from cobranca where id = 'cob2'").run()).toThrow(/nao se apaga/)
  })
})

describe('boletos (D7)', () => {
  function evento(id: string, tipo: string, extra: Record<string, string | null> = {}) {
    inserir('boleto_evento', { id, boleto_id: 'b', tipo, operador_id: 'op', registrado_em: AGORA, ...extra })
  }

  it('[R-BOLETO-03] eventos seguem a situação; excluir é evento com motivo, nunca delete', () => {
    inserir('boleto', { id: 'b', numero_exibicao: 1, descricao: 'Luz', valor: 25000, numero: '12', vencimento: HOJE, criado_em: AGORA })
    expect(() => evento('e0', 'pagamento-desfeito', { motivo: 'x' })).toThrow(/fora de ordem/)
    evento('e1', 'pago', { dia: HOJE })
    expect(() => evento('e2', 'pago', { dia: HOJE })).toThrow(/fora de ordem/)
    expect(() => evento('e2', 'pagamento-desfeito')).toThrow(/CHECK constraint failed/)
    evento('e2', 'pagamento-desfeito', { motivo: 'Marcado errado' })
    evento('e3', 'excluido', { motivo: 'Duplicado' })
    expect(() => evento('e4', 'pago', { dia: HOJE })).toThrow(/fora de ordem/)
    expect(() => banco.prepare("delete from boleto where id = 'b'").run()).toThrow(/excluir e um evento/)
  })
})

describe('cliente', () => {
  function cliente(id: string, numero: number, documento: string | null) {
    inserir('cliente', { id, numero, nome: 'Maria', documento, criado_em: AGORA })
  }

  it('[R-CLIENTE-04] documento só com dígitos, único quando preenchido', () => {
    cliente('c1', 1, '12345678901')
    cliente('c2', 2, null)
    cliente('c3', 3, null)
    expect(() => cliente('c4', 4, '12345678901')).toThrow(/UNIQUE constraint failed/)
    expect(() => cliente('c5', 5, '123.456.789-01')).toThrow(/CHECK constraint failed/)
  })
})

describe('[R-ESTOQUE-11] conferência do ajuste (0003)', () => {
  beforeEach(() => {
    banco.prepare("insert into operador (id, nome, admin, pin_hash, criado_em) values ('dona', 'Helena', 1, 'scrypt$sal$hash', ?)").run(AGORA)
    produto('p', 1)
    movimento('p', 'entrada', 5)
    movimento('p', 'ajuste', -1, { motivo: 'Quebrado' })
  })
  const idDo = (tipo: string) => (banco.prepare('select id from movimento_estoque where tipo = ?').get(tipo) as { id: string }).id
  const conferir = (movimentoId: string, operadorId: string) =>
    banco.prepare('insert into conferencia_ajuste (movimento_id, operador_id, registrado_em) values (?, ?, ?)').run(movimentoId, operadorId, AGORA)

  it('só a dona confere, só ajuste, e uma vez', () => {
    expect(() => conferir(idDo('ajuste'), 'op')).toThrow(/so a administradora confere/)
    expect(() => conferir(idDo('entrada'), 'dona')).toThrow(/so ajuste se confere/)
    conferir(idDo('ajuste'), 'dona')
    expect(() => conferir(idDo('ajuste'), 'dona')).toThrow(/UNIQUE constraint failed/)
  })

  it('a conferência é fato: não se altera nem se apaga', () => {
    conferir(idDo('ajuste'), 'dona')
    expect(() => banco.prepare("update conferencia_ajuste set operador_id = 'op'").run()).toThrow(/fato nao se altera/)
    expect(() => banco.prepare('delete from conferencia_ajuste').run()).toThrow(/fato nao se apaga/)
  })
})

