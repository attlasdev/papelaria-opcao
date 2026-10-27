/**
 * O banco da loja na 1.0: um arquivo SQLite aberto só pelo processo principal
 * (`node:sqlite`, que já vem no Electron; nenhum módulo nativo).
 *
 * Não depende do Electron, para poder testar: quem chama decide o caminho
 * (na loja, um arquivo em `userData`).
 */
import { existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { migracoes, type Migracao } from './migracoes'

export type Banco = DatabaseSync

/**
 * Abre o banco e deixa no formato desta versão do app. Banco de uma versão
 * mais nova que o app é recusado: a versão antiga não sabe o que descartaria
 * (o mesmo defeito da v0.1.8 apagando boletos, agora barrado na porta).
 */
export function abrirBanco(caminho: string, lista: readonly Migracao[] = migracoes): Banco {
  const banco = new DatabaseSync(caminho)
  try {
    banco.exec('pragma journal_mode = wal')
    banco.exec('pragma foreign_keys = on')
    banco.exec('pragma busy_timeout = 5000')
    migrar(banco, caminho, lista)
    return banco
  } catch (erro) {
    banco.close()
    throw erro
  }
}

export function versaoDoBanco(banco: Banco): number {
  return (banco.prepare('pragma user_version').get() as { user_version: number }).user_version
}

/**
 * Aplica as migrations que faltam, cada uma na sua transação junto com o
 * número da versão: se uma falhar, o banco fica como estava.
 *
 * Antes de mexer num banco que já tem dados, guarda uma cópia ao lado
 * (`<arquivo>.v<versão atual>`). Se a cópia já existir, uma tentativa anterior
 * falhou e voltou atrás: a cópia que está lá é a mesma.
 */
function migrar(banco: Banco, caminho: string, lista: readonly Migracao[]) {
  lista.forEach((migracao, indice) => {
    if (migracao.versao !== indice + 1) throw new Error(`migration fora de ordem: ${migracao.versao} na posição ${indice + 1}`)
  })
  const atual = versaoDoBanco(banco)
  if (atual > lista.length) throw new Error(`banco na versão ${atual}; este app conhece até a ${lista.length}`)
  if (atual === lista.length) return

  const copia = `${caminho}.v${atual}`
  if (atual > 0 && caminho !== ':memory:' && !existsSync(copia)) {
    banco.prepare('vacuum into ?').run(copia)
  }
  for (const migracao of lista.slice(atual)) {
    transacao(banco, () => {
      banco.exec(migracao.sql)
      banco.exec(`pragma user_version = ${migracao.versao}`)
    })
  }
}

export type Serie = 'ficha' | 'cliente' | 'produto' | 'boleto'

/** O próximo número de exibição da série. Chamar dentro da transação que cria o registro. */
export function proximoNumero(banco: Banco, serie: Serie): number {
  return (banco.prepare('update sequencia set ultimo = ultimo + 1 where serie = ? returning ultimo').get(serie) as { ultimo: number }).ultimo
}

/**
 * Roda `fazer` numa transação. `begin immediate` reserva a escrita logo no
 * começo: o que foi lido dentro dela não muda até o `commit`.
 */
export function transacao<T>(banco: Banco, fazer: () => T): T {
  banco.exec('begin immediate')
  try {
    const resultado = fazer()
    banco.exec('commit')
    return resultado
  } catch (erro) {
    banco.exec('rollback')
    throw erro
  }
}
