import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import path from 'node:path'
import { falha, type Contrato, type NomeOperacao } from '../comum/contrato'
import { criarAgendador, fazerCopia, NOME_ATUAL, restaurarCopia } from './backup/backup'
import { destinoSupabase } from './backup/supabase-destino'
import { migracoes } from './banco/migracoes'
import { ConexaoAusente } from './conexao'
import { configurarLog, log } from './log'
import { bancoDaLoja, operacoes, registroBackup } from './operacoes'
import { interpretar, supabase } from './supabase'

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

// A pasta de dados (conexao.json, sessao, copia local) tem nome fixo e sem acento,
// independente do nome exibido "Papelaria Opção": e o caminho que a instalacao
// manual usa (`%APPDATA%\papelaria-opcao`, ver docs/piloto.md).
//
// Fora do app empacotado, `PAPELARIA_PASTA_DADOS` troca a pasta: é como se
// confere o restaurar numa cópia, sem tocar no banco do dia a dia.
const PASTA_DE_TESTE = app.isPackaged ? undefined : process.env.PAPELARIA_PASTA_DADOS
app.setPath('userData', PASTA_DE_TESTE ? path.resolve(PASTA_DE_TESTE) : path.join(app.getPath('appData'), 'papelaria-opcao'))
configurarLog(path.join(app.getPath('userData'), 'logs'))

// Só no desenvolvimento e só pedida (`PAPELARIA_DEPURACAO=<porta>`): deixa
// conferir a janela por fora (plano da 1.0, Fase 3.3). O app empacotado não
// tem o servidor do Vite, então nunca abre a porta.
const PORTA_DEPURACAO = VITE_DEV_SERVER_URL ? process.env.PAPELARIA_DEPURACAO : undefined
if (PORTA_DEPURACAO && /^\d{4,5}$/.test(PORTA_DEPURACAO)) {
  app.commandLine.appendSwitch('remote-debugging-port', PORTA_DEPURACAO)
  log.aviso('inicio', `porta de depuração aberta (${PORTA_DEPURACAO}): só no desenvolvimento`)
}

// Erro solto no processo principal vai para o log em vez de virar a caixa de
// erro do Electron (que mostraria o texto cru na tela). O app segue: as
// operações já são embrulhadas uma a uma, e o banco grava em transação.
process.on('uncaughtException', (erro) => log.erro('processo', 'exceção não tratada:', erro))
process.on('unhandledRejection', (motivo) => log.erro('processo', 'promessa rejeitada sem tratamento:', motivo))

// Uma instância só (auditoria de 21/10, A6): o segundo clique no atalho traz a
// janela aberta para a frente. Duas janelas gravando a mesma base davam
// conflito na 0.1 e disputariam o arquivo do banco na 1.0.
const instanciaUnica = app.requestSingleInstanceLock()
if (!instanciaUnica) app.quit()
app.on('second-instance', (_evento, argv) => {
  if (!win) return
  if (argv.some((a) => a.startsWith('--restaurar='))) {
    void dialog.showMessageBox(win, { type: 'warning', title: 'Papelaria Opção', message: 'Para restaurar uma cópia, feche o aplicativo antes.', noLink: true })
  }
  if (win.isMinimized()) win.restore()
  win.focus()
})

let win: BrowserWindow | null = null

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    title: 'Papelaria Opção',
    icon: path.join(__dirname, '../../recursos/icone/icone.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // So a interface empacotada (ou o Vite local em dev) abre nesta janela.
  // Nao ha dominios externos aprovados neste projeto, entao novas janelas
  // sao negadas. Se surgir essa necessidade, criar uma lista explicita.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (evento, url) => {
    if (url !== win?.webContents.getURL()) evento.preventDefault()
  })
  win.on('closed', () => { win = null })

  // A tela caiu (falta de memória, erro do Chromium): sem isto, fica uma janela
  // branca e a loja não sabe o que fazer.
  win.webContents.on('render-process-gone', async (_evento, detalhes) => {
    log.erro('tela', `a tela parou (${detalhes.reason}, código ${detalhes.exitCode})`)
    if (detalhes.reason === 'clean-exit' || !win || win.isDestroyed()) return
    const { response } = await dialog.showMessageBox(win, {
      type: 'error',
      title: 'Papelaria Opção',
      message: 'A tela do aplicativo parou.',
      detail: 'O que já foi gravado continua salvo. O que estava sendo digitado pode precisar ser refeito.',
      buttons: ['Recarregar', 'Fechar o aplicativo'],
      defaultId: 0,
      noLink: true,
    })
    if (response === 0) win?.webContents.reload()
    else app.quit()
  })
  win.on('unresponsive', () => log.aviso('tela', 'a tela não responde'))
  win.on('responsive', () => log.info('tela', 'a tela voltou a responder'))

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../../dist/index.html'))
  }
}

function remetenteConfiavel(evento: IpcMainInvokeEvent): boolean {
  return win !== null
    && !win.isDestroyed()
    && evento.sender === win.webContents
    && evento.senderFrame === win.webContents.mainFrame
}

/**
 * Registra um handler por operacao do contrato. O nome da operacao E o nome do
 * canal, entao nao ha uma terceira lista para desatualizar.
 *
 * Isto NAO e um canal generico: o laco roda sobre as chaves de um objeto tipado
 * como `Contrato`, fixo em tempo de build. O renderer nao tem `ipcRenderer` e nao
 * consegue inventar um canal.
 *
 * Toda chamada vem embrulhada: excecao em `operacoes.ts` sai como `Falha`, para o
 * contrato valer ("nenhuma operacao lanca excecao para o front").
 */
function registrar(implementacao: Contrato) {
  for (const nome of Object.keys(implementacao) as NomeOperacao[]) {
    const fn = implementacao[nome] as (...args: unknown[]) => Promise<unknown>

    ipcMain.handle(nome, async (evento, ...args: unknown[]) => {
      if (!remetenteConfiavel(evento)) {
        log.aviso(nome, 'chamada recusada: origem não autorizada')
        return falha('permissao', 'Origem da chamada não autorizada.')
      }
      try {
        return await fn(...args)
      } catch (erro) {
        // O texto cru pode carregar URL de conexao ou pedaco de credencial. Ele
        // fica no log do processo principal; para a tela vai mensagem generica.
        log.erro(nome, 'falhou:', erro)
        return falha('desconhecida', 'Algo falhou nesta operação. Tente de novo; se continuar, chame o suporte.')
      }
    })
  }
}

/**
 * O backup (Fase 3.5): o agendador pergunta ao banco se ele mudou
 * (`total_changes`, que conta toda gravação desta conexão) em vez de uma lista
 * de operações que gravam, que esqueceria a próxima.
 */
let agendador: ReturnType<typeof criarAgendador> | null = null
function iniciarBackup() {
  const banco = bancoDaLoja()
  const mudancas = () => (banco.prepare('select total_changes() as n').get() as { n: number }).n
  let vistas = mudancas()
  let destino: ReturnType<typeof destinoSupabase> | null = null
  // Só no desenvolvimento: encurta os 5 minutos para conferir sem esperar.
  const segundos = VITE_DEV_SERVER_URL ? Number(process.env.PAPELARIA_INTERVALO_BACKUP) : NaN
  agendador = criarAgendador({
    fazer: () => fazerCopia(banco, { destino: (destino ??= destinoSupabase(supabase())), pastaLocal: path.join(app.getPath('userData'), 'copias') }),
    houveMudanca: () => {
      const agora = mudancas()
      if (agora === vistas) return false
      vistas = agora
      return true
    },
    registro: registroBackup,
    ...(Number.isInteger(segundos) && segundos >= 5 ? { intervaloMs: segundos * 1000 } : {}),
  })
}

// Ao fechar, a cópia do que mudou sai antes (até 10 s; sem internet, fica
// pendente e vai na próxima abertura).
let saindo = false
app.on('before-quit', (evento) => {
  if (saindo || !agendador) return
  evento.preventDefault()
  saindo = true
  void agendador.aoFechar().finally(() => app.quit())
})

/**
 * Restaurar pelo suporte (decisão de `2026-10-28`): `--restaurar=atual` ou
 * `--restaurar=dias/AAAA-MM-DD`, com o app fechado. Pergunta antes; o banco
 * que estava fica guardado ao lado. Sem tela da loja: só as janelas do sistema.
 */
async function restaurarPeloSuporte(pedido: string) {
  const titulo = 'Papelaria Opção'
  const nome = pedido === 'atual' ? NOME_ATUAL : /^dias\/\d{4}-\d\d-\d\d$/.test(pedido) ? `${pedido}.sqlite.gz` : null
  if (!nome) {
    await dialog.showMessageBox({ type: 'error', title: titulo, message: 'Cópia inválida.', detail: 'Use --restaurar=atual ou --restaurar=dias/AAAA-MM-DD.', noLink: true })
    return
  }
  const caminhoBanco = path.join(app.getPath('userData'), 'loja.sqlite')
  const { response } = await dialog.showMessageBox({
    type: 'warning', title: titulo, message: `Restaurar a cópia "${pedido}" da nuvem?`,
    detail: `O banco deste computador é trocado pela cópia. O que está nele agora não é apagado: fica guardado ao lado, em loja.sqlite.antes-restauracao-….\n\n${caminhoBanco}`,
    buttons: ['Restaurar', 'Cancelar'], defaultId: 1, cancelId: 1, noLink: true,
  })
  if (response !== 0) return log.info('backup', `restaurar ${pedido}: cancelado`)
  try {
    const { guardado } = await restaurarCopia({ destino: destinoSupabase(supabase()), nome, caminhoBanco, versaoApp: migracoes.length })
    await dialog.showMessageBox({
      type: 'info', title: titulo, message: 'Cópia restaurada.',
      detail: guardado ? `O banco anterior ficou em ${path.basename(guardado)}.` : 'Não havia banco neste computador.', noLink: true,
    })
  } catch (erro) {
    // O texto cru fica no log (regra 5); a janela diz o que fazer.
    log.erro('backup', `restaurar ${pedido} falhou:`, erro)
    const { causa, mensagem } = interpretar(erro)
    const detalhe = erro instanceof ConexaoAusente ? erro.message
      : erro instanceof Error && erro.message.startsWith('sem sessão') ? 'Este computador está sem o login da loja: abra o app, entre e tente de novo.'
      : causa === 'rede' || causa === 'sessao' ? mensagem
      : 'A cópia não foi encontrada ou não passou na conferência. O motivo está no app.log.'
    await dialog.showMessageBox({ type: 'error', title: titulo, message: 'A cópia não foi restaurada. O banco deste computador não mudou.', detail: detalhe, noLink: true })
  }
}

app.whenReady().then(async () => {
  if (!instanciaUnica) return
  log.info('inicio', `versão ${app.getVersion()}, Electron ${process.versions.electron}, ${process.platform}`)
  const restaurar = process.argv.find((a) => a.startsWith('--restaurar='))?.slice('--restaurar='.length)
  if (restaurar !== undefined) {
    await restaurarPeloSuporte(restaurar)
    return app.quit()
  }
  registrar(operacoes)
  iniciarBackup()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
