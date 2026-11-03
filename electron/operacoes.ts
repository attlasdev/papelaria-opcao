import { app, BrowserWindow, dialog } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { conferirComprovante, linhasComprovante } from '../comum/comprovante'
import { falha, ok, type Contrato, type Falha } from '../comum/contrato'
import { criarMaquininhaDemonstracao } from '../comum/maquininha-demonstracao'
import { criarTentativas } from '../comum/regras/operador'
import { abrirBanco, type Banco } from './banco/banco'
import { operadoresSqlite } from './banco/operadores'
import { produtosSqlite } from './banco/produtos'
import { entradasSqlite } from './banco/entradas'
import { ajustesSqlite } from './banco/ajustes'
import { movimentosSqlite } from './banco/movimentos'
import { clientesSqlite } from './banco/clientes'
import { vendasSqlite } from './banco/vendas'
import { fichasSqlite } from './banco/fichas'
import { recebimentosSqlite } from './banco/recebimentos'
import { vendasSemIdentificacaoSqlite } from './banco/vendas-sem-identificacao'
import { boletosSqlite } from './banco/boletos'
import { servicosSqlite } from './banco/servicos'
import { caixaSqlite } from './banco/caixa'
import { financeiroSqlite } from './banco/financeiro'
import { inicioSqlite } from './banco/inicio'
import { avisosSqlite } from './banco/avisos'
import { operacoesDoBackup } from '../comum/regras/backup'
import { criarRegistro } from './backup/registro'
import { buscaSqlite } from './banco/busca'
import { ConexaoAusente } from './conexao'
import { bytesComprovante } from './escpos'
import { enviarCru, lerConfigComprovante } from './impressora'
import { log } from './log'
import { interpretar, supabase } from './supabase'

/**
 * O lado real do contrato: e aqui que se fala com o banco.
 *
 * Pode lancar excecao a vontade — o registro em `main.ts` embrulha toda chamada e
 * converte em `Falha`. O que nao pode e deixar uma excecao chegar ao front, e isso
 * esta garantido la, nao aqui.
 *
 * `const operacoes: Contrato` faz o compilador exigir uma implementacao por
 * operacao do contrato.
 */

/** Erro do banco vira Falha legivel; o texto cru fica so no log. */
function falhou(nome: string, erro: unknown, status?: number): Falha {
  if (erro instanceof ConexaoAusente) return falha('configuracao', erro.message)
  log.erro(nome, erro)
  const { causa, mensagem } = interpretar(erro, status)
  return falha(causa, mensagem)
}

/** Filtro da janela de salvar; as chaves em inglês são as que o Electron pede. */
const TIPOS_ARQUIVO: Record<string, Electron.FileFilter> = {
  '.xml': { name: 'XML', extensions: ['xml'] },
  '.xlsx': { name: 'Planilha do Excel', extensions: ['xlsx'] },
}

/** Só o nome, sem pasta, e só com caracteres seguros: o lugar quem escolhe é a pessoa. */
function nomeSeguro(sugerido: string) {
  return path.basename(sugerido).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '-').slice(0, 80)
}

/**
 * Piloto 0.1: a maquininha é a de demonstração (sem credencial nem rede). Na
 * 1.0 entra aqui o cliente da Orders API do Mercado Pago, com as mesmas
 * operações; a prova real dos estados está em Memoria.md (`2026-10-06`).
 */
const maquininha = criarMaquininhaDemonstracao()
const idValido = (id: unknown) => (typeof id === 'string' && id.length <= 80 ? id : '')

/** O dado entra pela IPC sem garantia de tipo: confere antes de usar. */
const texto = (valor: unknown) => (typeof valor === 'string' ? valor.trim() : '')

/**
 * O banco da 1.0 (`userData/loja.sqlite`), aberto na primeira operação que o
 * usa.
 */
let banco: Banco | null = null
export const bancoDaLoja = () => (banco ??= abrirBanco(path.join(app.getPath('userData'), 'loja.sqlite')))
/** Quem copia é o processo principal (`main.ts`); daqui sai só o que a tela lê. */
export const registroBackup = criarRegistro(() => path.join(app.getPath('userData'), 'estado-backup.json'))
const fonteDoBackup = {
  registro: () => registroBackup.ler(),
  temSessao: async () => Boolean((await supabase().auth.getSession()).data.session),
  marcarEntrada: () => { registroBackup.atualizar({ entrouEm: new Date().toISOString() }) },
}
/** Uma conta de PINs errados para o app inteiro (`R-OPERADOR-04`). */
const tentativas = criarTentativas()

export const operacoes: Contrato = {
  ...operadoresSqlite(bancoDaLoja, tentativas),
  ...produtosSqlite(bancoDaLoja, tentativas),
  ...entradasSqlite(bancoDaLoja, tentativas),
  ...ajustesSqlite(bancoDaLoja, tentativas),
  ...movimentosSqlite(bancoDaLoja),
  ...clientesSqlite(bancoDaLoja),
  ...vendasSqlite(bancoDaLoja, tentativas),
  ...fichasSqlite(bancoDaLoja, tentativas),
  ...recebimentosSqlite(bancoDaLoja, tentativas),
  ...vendasSemIdentificacaoSqlite(bancoDaLoja),
  ...boletosSqlite(bancoDaLoja, tentativas),
  ...servicosSqlite(bancoDaLoja),
  ...caixaSqlite(bancoDaLoja, tentativas),
  ...financeiroSqlite(bancoDaLoja, tentativas),
  ...inicioSqlite(bancoDaLoja),
  ...operacoesDoBackup(fonteDoBackup, avisosSqlite(bancoDaLoja)),
  ...buscaSqlite(bancoDaLoja),

  async sessaoAtual() {
    try {
      const { data, error } = await supabase().auth.getSession()
      if (error) return falhou('sessaoAtual', error)
      const email = data.session?.user.email
      return ok(email ? { email } : null)
    } catch (erro) {
      return falhou('sessaoAtual', erro)
    }
  },

  async entrar(email, senha) {
    if (!texto(email) || typeof senha !== 'string' || !senha) return falha('validacao', 'Informe o e-mail e a senha.')
    try {
      const { data, error } = await supabase().auth.signInWithPassword({ email: texto(email), password: senha })
      if (error) return falhou('entrar', error, error.status)
      if (!registroBackup.ler().entrouEm) fonteDoBackup.marcarEntrada()
      return ok({ email: data.user.email ?? texto(email) })
    } catch (erro) {
      return falhou('entrar', erro)
    }
  },

  async sair() {
    try {
      const { error } = await supabase().auth.signOut()
      if (error) return falhou('sair', error)
      return ok(null)
    } catch (erro) {
      return falhou('sair', erro)
    }
  },

  async salvarArquivo(nomeSugerido, conteudo) {
    const nome = nomeSeguro(typeof nomeSugerido === 'string' ? nomeSugerido : '')
    const tipo = TIPOS_ARQUIVO[path.extname(nome).toLowerCase()]
    if (!nome || !tipo) return falha('validacao', 'Tipo de arquivo não permitido.')
    if (typeof conteudo !== 'string' && !(conteudo instanceof Uint8Array)) return falha('validacao', 'Conteúdo do arquivo inválido.')
    const janela = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const opcoes = { defaultPath: path.join(app.getPath('documents'), nome), filters: [tipo] }
    const escolha = janela ? await dialog.showSaveDialog(janela, opcoes) : await dialog.showSaveDialog(opcoes)
    if (escolha.canceled || !escolha.filePath) return ok({ salvo: false })
    await fs.writeFile(escolha.filePath, conteudo)
    return ok({ salvo: true, nome: path.basename(escolha.filePath) })
  },

  async iniciarCobranca(dados) {
    if (!dados || typeof dados !== 'object') return falha('validacao', 'Dados da cobrança inválidos.')
    return maquininha.iniciar({ valor: Number(dados.valor), meio: dados.meio, referencia: texto(dados.referencia).slice(0, 64) })
  },
  async consultarCobranca(id) {
    return maquininha.consultar(idValido(id))
  },
  async cancelarCobranca(id) {
    return maquininha.cancelar(idValido(id))
  },
  async simularCobranca(id, resultado) {
    if (resultado !== 'aprovada' && resultado !== 'recusada') return falha('validacao', 'Resultado inválido.')
    return maquininha.simular(idValido(id), resultado)
  },

  async imprimirComprovante(dados) {
    const conferido = conferirComprovante(dados)
    if (typeof conferido === 'string') return falha('validacao', conferido)
    const config = lerConfigComprovante()
    if (!config.ok) return config
    const bytes = bytesComprovante(linhasComprovante(conferido, config.dado.loja))
    return enviarCru(config.dado.impressora, `Venda ${conferido.numero}`, bytes)
  },
}
